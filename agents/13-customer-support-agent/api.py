import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
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

users_collection = db["users"]
chats_collection = db["chats"]
tickets_collection = db["tickets"]


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
    version="0.4.0",
)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

_origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "*",
)

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
    email: str = Field(
        ...,
        min_length=5,
    )

    password: str = Field(
        ...,
        min_length=6,
    )

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:

        value = value.strip().lower()

        if "@" not in value:
            raise ValueError(
                "Invalid email address"
            )

        return value


class RegisterResponse(BaseModel):
    message: str
    email: str


class LoginRequest(BaseModel):
    email: str = Field(
        ...,
        min_length=5,
    )

    password: str = Field(
        ...,
        min_length=1,
    )

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:

        value = value.strip().lower()

        if "@" not in value:
            raise ValueError(
                "Invalid email address"
            )

        return value


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    email: str
    role: str


# ---------------------------------------------------------------------------
# Chat schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="The customer's message.",
    )

    conversation_id: Optional[str] = Field(
        default=None,
        description="Unique ID for the conversation.",
    )

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(
        cls,
        value: str,
    ) -> str:

        stripped = value.strip()

        if not stripped:
            raise ValueError(
                "message must not be empty or whitespace-only"
            )

        return stripped


class ChatResponse(BaseModel):
    answer: str
    escalated: bool
    conversation_id: str
    ticket_id: Optional[str] = None


class ChatHistoryMessage(BaseModel):
    role: str
    content: str
    escalated: bool = False
    ticket_id: Optional[str] = None


class ChatHistoryItem(BaseModel):
    id: str
    title: str
    messages: list[ChatHistoryMessage]


# ---------------------------------------------------------------------------
# Ticket schemas
# ---------------------------------------------------------------------------

class TicketResponse(BaseModel):
    ticket_id: str
    conversation_id: str
    subject: str
    description: str
    status: str
    priority: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Admin dashboard schemas
# ---------------------------------------------------------------------------

class AdminDashboardResponse(BaseModel):
    total_tickets: int
    open_tickets: int
    in_progress_tickets: int
    resolved_tickets: int
    high_priority_tickets: int


class AdminTicketResponse(BaseModel):
    ticket_id: str
    user_id: str
    conversation_id: str
    subject: str
    description: str
    ai_response: str = ""
    status: str
    priority: str
    created_at: datetime


class TicketStatusUpdateRequest(BaseModel):
    status: str = Field(
        ...,
        description="Ticket status: open, in_progress, or resolved.",
    )

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        value = value.strip().lower()

        allowed_statuses = {
            "open",
            "in_progress",
            "resolved",
        }

        if value not in allowed_statuses:
            raise ValueError(
                "Status must be open, in_progress, or resolved."
            )

        return value


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

    return HealthResponse(
        status="ok"
    )


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

@app.post(
    "/api/auth/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
) -> RegisterResponse:

    existing_user = users_collection.find_one(
        {
            "email": payload.email
        }
    )

    if existing_user:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists.",
        )


    password_hash = bcrypt.hashpw(
        payload.password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


    user_document = {
        "email": payload.email,
        "password_hash": password_hash,
        "role": "customer",
        "created_at": datetime.now(timezone.utc),
    }


    try:

        users_collection.insert_one(
            user_document
        )

    except Exception as exc:

        logger.exception(
            "Failed to create user"
        )

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
def login(
    payload: LoginRequest,
) -> LoginResponse:

    user = users_collection.find_one(
        {
            "email": payload.email
        }
    )


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
        "exp": now + timedelta(
            minutes=JWT_EXPIRES_IN
        ),
    }


    access_token = jwt.encode(
        token_payload,
        JWT_SECRET,
        algorithm="HS256",
    )


    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        email=user["email"],
        role=user["role"],
    )


# ---------------------------------------------------------------------------
# Authentication dependency
# ---------------------------------------------------------------------------

security = HTTPBearer(
    auto_error=False
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
) -> dict:

    if credentials is None:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )


    try:

        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
        )

    except jwt.ExpiredSignatureError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    except jwt.InvalidTokenError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )


    return payload


# ---------------------------------------------------------------------------
# Admin authorization
# ---------------------------------------------------------------------------

def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Allows access only to users with the admin role.
    """

    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    return current_user


# ---------------------------------------------------------------------------
# Escalation rules
# ---------------------------------------------------------------------------

ESCALATION_KEYWORDS = (
    "speak to a human",
    "talk to a human",
    "human agent",
    "real person",
    "contact support",
    "serious issue",
    "serious problem",
    "urgent issue",
    "urgent problem",
    "complaint",
    "refund",
    "charged twice",
    "payment failed",
)


def should_escalate_message(
    message: str,
) -> bool:

    normalized = message.lower().strip()

    return any(
        keyword in normalized
        for keyword in ESCALATION_KEYWORDS
    )


# ---------------------------------------------------------------------------
# Ticket ID generator
# ---------------------------------------------------------------------------

def generate_ticket_id() -> str:

    return (
        f"TKT-{secrets.token_hex(4).upper()}"
    )


# ---------------------------------------------------------------------------
# Create support ticket
# ---------------------------------------------------------------------------

def create_support_ticket(
    user_id: str,
    conversation_id: str,
    user_message: str,
    ai_response: str,
) -> str:

    # Do not create multiple open tickets
    # for the same conversation.

    existing_ticket = tickets_collection.find_one(
        {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "status": {
                "$in": [
                    "open",
                    "in_progress",
                ]
            },
        }
    )


    if existing_ticket:

        return existing_ticket["ticket_id"]


    ticket_id = generate_ticket_id()


    ticket_document = {
        "ticket_id": ticket_id,
        "user_id": user_id,
        "conversation_id": conversation_id,
        "subject": user_message[:80],
        "description": user_message,
        "ai_response": ai_response,
        "status": "open",
        "priority": "high",
        "created_at": datetime.now(timezone.utc),
    }


    tickets_collection.insert_one(
        ticket_document
    )


    logger.info(
        "Created support ticket %s for user %s",
        ticket_id,
        user_id,
    )


    return ticket_id


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

@app.post(
    "/api/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
)
def chat(
    payload: ChatRequest,
    current_user: dict = Depends(
        get_current_user
    ),
) -> ChatResponse:

    # -------------------------------------------------------
    # Continue an existing conversation or create a new one.
    # -------------------------------------------------------

    conversation_id = (
        payload.conversation_id
        or str(uuid4())
    )


    # -------------------------------------------------------
    # Prepare agent state.
    # -------------------------------------------------------

    state = {
        "messages": [
            HumanMessage(
                content=payload.message
            )
        ],
        "user_input": payload.message,
        "retrieved_context": "",
        "response": "",
        "escalate": False,
    }


    # -------------------------------------------------------
    # Run AI agent.
    # -------------------------------------------------------

    try:

        result = agent_graph.invoke(
            state
        )

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


    # -------------------------------------------------------
    # Get AI response.
    # -------------------------------------------------------

    answer = result.get(
        "response",
        "",
    )


    agent_escalated = bool(
        result.get(
            "escalate",
            False,
        )
    )


    # Additional deterministic escalation rule.
    keyword_escalated = should_escalate_message(
        payload.message
    )


    escalated = (
        agent_escalated
        or keyword_escalated
    )


    if not answer:

        logger.error(
            "Agent returned an empty response for message=%r",
            payload.message,
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The support agent returned "
                "an empty response."
            ),
        )


    # -------------------------------------------------------
    # Create ticket if escalation is required.
    # -------------------------------------------------------

    ticket_id = None


    if escalated:

        try:

            ticket_id = create_support_ticket(
                user_id=current_user["sub"],
                conversation_id=conversation_id,
                user_message=payload.message,
                ai_response=answer,
            )

        except Exception as exc:

            logger.exception(
                "Failed to create support ticket"
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "The issue was identified for escalation, "
                    "but the support ticket could not be created."
                ),
            ) from exc


    # -------------------------------------------------------
    # Save chat message to MongoDB.
    # -------------------------------------------------------

    chat_document = {
        "user_id": current_user["sub"],
        "conversation_id": conversation_id,
        "user_message": payload.message,
        "ai_response": answer,
        "escalated": escalated,
        "ticket_id": ticket_id,
        "created_at": datetime.now(timezone.utc),
    }


    try:

        chats_collection.insert_one(
            chat_document
        )

    except Exception:

        logger.exception(
            "Failed to save chat to MongoDB"
        )


    # -------------------------------------------------------
    # Return response.
    # -------------------------------------------------------

    return ChatResponse(
        answer=answer,
        escalated=escalated,
        conversation_id=conversation_id,
        ticket_id=ticket_id,
    )


# ---------------------------------------------------------------------------
# Persistent chat history
# ---------------------------------------------------------------------------

@app.get(
    "/api/chats",
    response_model=list[ChatHistoryItem],
    status_code=status.HTTP_200_OK,
)
def get_chat_history(
    current_user: dict = Depends(
        get_current_user
    ),
) -> list[ChatHistoryItem]:

    documents = list(
        chats_collection.find(
            {
                "user_id": current_user["sub"]
            },
            {
                "_id": 0,
                "conversation_id": 1,
                "user_message": 1,
                "ai_response": 1,
                "escalated": 1,
                "ticket_id": 1,
                "created_at": 1,
            },
        ).sort(
            "created_at",
            1,
        )
    )


    conversations = {}


    for document in documents:

        conversation_id = document.get(
            "conversation_id"
        )


        # Old messages created before conversation IDs
        # are treated as individual conversations.

        if not conversation_id:

            conversation_id = str(
                uuid4()
            )


        if conversation_id not in conversations:

            conversations[conversation_id] = {
                "id": conversation_id,
                "title": document[
                    "user_message"
                ][:48],
                "messages": [],
            }


        # User message
        conversations[
            conversation_id
        ]["messages"].append(
            {
                "role": "user",
                "content": document[
                    "user_message"
                ],
                "escalated": False,
                "ticket_id": None,
            }
        )


        # AI message
        conversations[
            conversation_id
        ]["messages"].append(
            {
                "role": "assistant",
                "content": document[
                    "ai_response"
                ],
                "escalated": bool(
                    document.get(
                        "escalated",
                        False,
                    )
                ),
                "ticket_id": document.get(
                    "ticket_id"
                ),
            }
        )


    return list(
        reversed(
            list(
                conversations.values()
            )
        )
    )


# ---------------------------------------------------------------------------
# Customer tickets
# ---------------------------------------------------------------------------

@app.get(
    "/api/tickets",
    response_model=list[TicketResponse],
    status_code=status.HTTP_200_OK,
)
def get_my_tickets(
    current_user: dict = Depends(
        get_current_user
    ),
) -> list[TicketResponse]:

    documents = list(
        tickets_collection.find(
            {
                "user_id": current_user["sub"]
            },
            {
                "_id": 0,
            },
        ).sort(
            "created_at",
            -1,
        )
    )


    return [
        TicketResponse(
            ticket_id=document[
                "ticket_id"
            ],
            conversation_id=document[
                "conversation_id"
            ],
            subject=document[
                "subject"
            ],
            description=document[
                "description"
            ],
            status=document[
                "status"
            ],
            priority=document[
                "priority"
            ],
            created_at=document[
                "created_at"
            ],
        )
        for document in documents
    ]


# ---------------------------------------------------------------------------
# Get one customer ticket
# ---------------------------------------------------------------------------

@app.get(
    "/api/tickets/{ticket_id}",
    response_model=TicketResponse,
    status_code=status.HTTP_200_OK,
)
def get_ticket(
    ticket_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
) -> TicketResponse:

    document = tickets_collection.find_one(
        {
            "ticket_id": ticket_id,
            "user_id": current_user["sub"],
        },
        {
            "_id": 0,
        },
    )


    if not document:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )


    return TicketResponse(
        ticket_id=document[
            "ticket_id"
        ],
        conversation_id=document[
            "conversation_id"
        ],
        subject=document[
            "subject"
        ],
        description=document[
            "description"
        ],
        status=document[
            "status"
        ],
        priority=document[
            "priority"
        ],
        created_at=document[
            "created_at"
        ],
    )

# ---------------------------------------------------------------------------
# Admin dashboard statistics
# ---------------------------------------------------------------------------

@app.get(
    "/api/admin/dashboard",
    response_model=AdminDashboardResponse,
    status_code=status.HTTP_200_OK,
)
def admin_dashboard(
    current_user: dict = Depends(require_admin),
) -> AdminDashboardResponse:

    total_tickets = tickets_collection.count_documents({})

    open_tickets = tickets_collection.count_documents({
        "status": "open"
    })

    in_progress_tickets = tickets_collection.count_documents({
        "status": "in_progress"
    })

    resolved_tickets = tickets_collection.count_documents({
        "status": "resolved"
    })

    high_priority_tickets = tickets_collection.count_documents({
        "priority": "high"
    })

    return AdminDashboardResponse(
        total_tickets=total_tickets,
        open_tickets=open_tickets,
        in_progress_tickets=in_progress_tickets,
        resolved_tickets=resolved_tickets,
        high_priority_tickets=high_priority_tickets,
    )


# ---------------------------------------------------------------------------
# Admin: get all tickets
# ---------------------------------------------------------------------------

@app.get(
    "/api/admin/tickets",
    response_model=list[AdminTicketResponse],
    status_code=status.HTTP_200_OK,
)
def admin_get_tickets(
    current_user: dict = Depends(require_admin),
) -> list[AdminTicketResponse]:

    documents = list(
        tickets_collection.find(
            {},
            {
                "_id": 0,
            },
        ).sort(
            "created_at",
            -1,
        )
    )

    return [
        AdminTicketResponse(
            ticket_id=document["ticket_id"],
            user_id=document["user_id"],
            conversation_id=document["conversation_id"],
            subject=document["subject"],
            description=document["description"],
            ai_response=document.get("ai_response", ""),
            status=document["status"],
            priority=document["priority"],
            created_at=document["created_at"],
        )
        for document in documents
    ]


# ---------------------------------------------------------------------------
# Admin: get one ticket
# ---------------------------------------------------------------------------

@app.get(
    "/api/admin/tickets/{ticket_id}",
    response_model=AdminTicketResponse,
    status_code=status.HTTP_200_OK,
)
def admin_get_ticket(
    ticket_id: str,
    current_user: dict = Depends(require_admin),
) -> AdminTicketResponse:

    document = tickets_collection.find_one(
        {
            "ticket_id": ticket_id,
        },
        {
            "_id": 0,
        },
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )

    return AdminTicketResponse(
        ticket_id=document["ticket_id"],
        user_id=document["user_id"],
        conversation_id=document["conversation_id"],
        subject=document["subject"],
        description=document["description"],
        ai_response=document.get("ai_response", ""),
        status=document["status"],
        priority=document["priority"],
        created_at=document["created_at"],
    )


# ---------------------------------------------------------------------------
# Admin: update ticket status
# ---------------------------------------------------------------------------

@app.patch(
    "/api/admin/tickets/{ticket_id}/status",
    response_model=AdminTicketResponse,
    status_code=status.HTTP_200_OK,
)
def admin_update_ticket_status(
    ticket_id: str,
    payload: TicketStatusUpdateRequest,
    current_user: dict = Depends(require_admin),
) -> AdminTicketResponse:

    result = tickets_collection.update_one(
        {
            "ticket_id": ticket_id,
        },
        {
            "$set": {
                "status": payload.status,
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )

    document = tickets_collection.find_one(
        {
            "ticket_id": ticket_id,
        },
        {
            "_id": 0,
        },
    )

    return AdminTicketResponse(
        ticket_id=document["ticket_id"],
        user_id=document["user_id"],
        conversation_id=document["conversation_id"],
        subject=document["subject"],
        description=document["description"],
        ai_response=document.get("ai_response", ""),
        status=document["status"],
        priority=document["priority"],
        created_at=document["created_at"],
    )
