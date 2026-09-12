"""
FastAPI backend for the existing LangGraph customer support agent.

This file does NOT change the agent's logic. It only:
  1. Builds the existing compiled LangGraph once at startup.
  2. Exposes it over HTTP with request/response validation.
  3. Turns unexpected agent/Gemini/FAISS failures into clean HTTP errors.

Flow:
    Client -> FastAPI -> agent.build_graph() -> LangGraph
              -> retrieve_context (FAISS/RAG) -> check_escalation -> generate_response (Gemini)
"""

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field, field_validator

from agent import build_graph, load_kb_texts, retrieve_context

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("support_api")

# ---------------------------------------------------------------------------
# Build the agent ONCE at import time (i.e. once per server process).
#
# The compiled graph (build_graph()) is a stateless workflow definition, so
# sharing one instance across requests is safe and avoids rebuilding it
# (and re-embedding the knowledge base) on every call.
#
# KB_DIR is optional and mirrors agent.py's --kb-dir CLI flag. If unset,
# agent.py's SAMPLE_KB is used, same as running `python agent.py` with no args.
# ---------------------------------------------------------------------------
KB_DIR = os.getenv("KB_DIR")
try:
    retrieve_context.kb_texts = load_kb_texts(KB_DIR)
except ValueError as exc:
    logger.warning("Could not load KB_DIR=%r (%s). Falling back to SAMPLE_KB.", KB_DIR, exc)

agent_graph = build_graph()

if not os.getenv("GEMINI_API_KEY"):
    # Fail loudly at startup rather than on the first request. The agent
    # needs this key for both embeddings and generation.
    logger.warning(
        "GEMINI_API_KEY is not set. Requests to /api/chat will fail until it is configured in .env."
    )

app = FastAPI(
    title="AI Customer Support API",
    description="FastAPI layer around the existing LangGraph/FAISS/Gemini support agent.",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS
# For local development, allow everything by default. If ALLOWED_ORIGINS is
# set in .env (comma-separated), restrict to those origins instead.
# This is intentionally permissive for now — locking it down for production
# is a later step, not this one.
# ---------------------------------------------------------------------------
_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = ["*"] if _origins_env.strip() == "*" else [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ["*"],  # credentials + "*" is invalid per CORS spec
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="The customer's message.")

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("message must not be empty or whitespace-only")
        return stripped


class ChatResponse(BaseModel):
    answer: str
    escalated: bool


class HealthResponse(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post(
    "/api/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "Invalid or empty message"},
        502: {"description": "The underlying agent (LangGraph/FAISS/Gemini) failed"},
    },
)
def chat(payload: ChatRequest) -> ChatResponse:
    # Fresh, independent state per request.
    #
    # NOTE: agent.py's CLI (main()) keeps `messages` growing for the whole
    # terminal session, giving it multi-turn memory. This API has no
    # session/ticket concept yet (out of scope for this step), so each call
    # here is a standalone, single-turn conversation. Multi-turn memory
    # should be added alongside sessions/tickets in a later step, not hacked
    # in here with e.g. a global dict.
    state = {
        "messages": [HumanMessage(content=payload.message)],
        "user_input": payload.message,
        "retrieved_context": "",
        "response": "",
        "escalate": False,
    }

    try:
        result = agent_graph.invoke(state)
    except Exception as exc:  # noqa: BLE001 - deliberately broad: covers FAISS, Gemini, network errors
        logger.exception("Agent invocation failed for message=%r", payload.message)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The support agent failed to process your message. Please try again shortly.",
        ) from exc

    answer = result.get("response", "")
    escalated = bool(result.get("escalate", False))

    if not answer:
        # The graph ran without raising, but produced no answer text.
        # Treat this as a server-side failure rather than returning an
        # empty string silently.
        logger.error("Agent returned an empty response for message=%r", payload.message)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The support agent returned an empty response.",
        )

    return ChatResponse(answer=answer, escalated=escalated)
