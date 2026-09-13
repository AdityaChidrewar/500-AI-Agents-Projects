import logging
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field, field_validator
from pymongo import MongoClient

from agent import build_graph, load_kb_texts, retrieve_context

# ---------------------------------------------------------------------------
# Environment variables
# ---------------------------------------------------------------------------
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is not set in .env")

JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is not set in .env")

_jwt_expires_in_raw = os.getenv("JWT_EXPIRES_IN")

if not _jwt_expires_in_raw:
    raise RuntimeError("JWT_EXPIRES_IN is not set in .env")

try:
    JWT_EXPIRES_IN = int(_jwt_expires_in_raw)
except ValueError as exc:
    raise RuntimeError(
        "JWT_EXPIRES_IN must be an integer number of minutes"
    ) from exc


# ---------------------------------------------------------------------------
# MongoDB
# ---------------------------------------------------------------------------
mongo_client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
)

db = mongo_client["customer_support_db"]

chats_collection = db["chats"]
users_collection = db["users"]


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("support_api")


# ---------------------------------------------------------------------------
# Build AI agent
# ---------------------------------------------------------------------------
KB_DIR = os.getenv("KB_DIR")

try:
    retrieve_context.kb_texts = load_kb_texts(KB_DIR)
except ValueError as exc:
    logger.warning(
        "Could not load KB_DIR=%r (%s). Falling back to SAMPLE_KB.",
        KB_DIR,
        exc,
    )

agent_graph = build_graph()


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI Customer Support API",
    description=(
        "AI customer support backend using "
        "LangGraph, RAG, Gemini, MongoDB and JWT authentication."
    ),
    version="0.3.0",
)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_origins_env = os.getenv("ALLOWED_ORIGINS", "*")

allowed_origins = (
    ["*"]
    if _origins_env.strip() == "*"
    else [
        origin.strip()
        for origin in _origins_env.split(",")
        if origin.strip()
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()

        if "@" not in value:
            raise ValueError("Invalid email address")

        return value


class RegisterResponse(BaseModel):
    message: str
    email: str


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()

        if "@" not in value:
            raise ValueError("Invalid email address")

        return value


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    email: str
    role: str


class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="The customer's message.",
    )

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()

        if not stripped:
            raise ValueError(
                "message must not be empty or whitespace-only"
            )

        return stripped


class ChatResponse(BaseModel):
    answer: str
    escalated: bool


class HealthResponse(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get(
    "/api/health",
    response_model=HealthResponse,
)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------
@app.post(
    "/api/auth/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest) -> RegisterResponse:

    # Check whether user already exists
    existing_user = users_collection.find_one(
        {"email": payload.email}
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists.",
        )

    # Hash password
    password_hash = bcrypt.hashpw(
        payload.password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

    # Create user document
    user_document = {
        "email": payload.email,
        "password_hash": password_hash,
        "role": "customer",
        "created_at": datetime.now(timezone.utc),
    }

    try:
        users_collection.insert_one(user_document)

    except Exception as exc:
        logger.exception("Failed to create user")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create user.",
        ) from exc

    return RegisterResponse(
        message="User registered successfully.",
        email=payload.email,
    )


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
@app.post(
    "/api/auth/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
)
def login(payload: LoginRequest) -> LoginResponse:

    user = users_collection.find_one({"email": payload.email})

    # Same error for "no such user" and "wrong password" - don't reveal
    # which one it was.
    if not user or not bcrypt.checkpw(
        payload.password.encode("utf-8"),
        user["password_hash"].encode("utf-8"),
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    now = datetime.now(timezone.utc)
    token_payload = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "exp": now + timedelta(minutes=JWT_EXPIRES_IN),
    }

    access_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        email=user["email"],
        role=user["role"],
    )


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
@app.post(
    "/api/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
)
def chat(payload: ChatRequest) -> ChatResponse:

    state = {
        "messages": [
            HumanMessage(content=payload.message)
        ],
        "user_input": payload.message,
        "retrieved_context": "",
        "response": "",
        "escalate": False,
    }

    # Run AI agent
    try:
        result = agent_graph.invoke(state)

    except Exception as exc:
        logger.exception(
            "Agent invocation failed for message=%r",
            payload.message,
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The support agent failed to process "
                "your message. Please try again shortly."
            ),
        ) from exc

    answer = result.get("response", "")
    escalated = bool(result.get("escalate", False))

    if not answer:
        logger.error(
            "Agent returned an empty response for message=%r",
            payload.message,
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The support agent returned an empty response.",
        )

    # Save chat
    chat_document = {
        "user_message": payload.message,
        "ai_response": answer,
        "escalated": escalated,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        chats_collection.insert_one(chat_document)

    except Exception:
        logger.exception(
            "Failed to save chat to MongoDB"
        )

    return ChatResponse(
        answer=answer,
        escalated=escalated,
    )