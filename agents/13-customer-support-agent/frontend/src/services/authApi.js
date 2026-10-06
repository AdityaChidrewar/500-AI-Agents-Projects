// Auth-only API calls, kept separate from services/api.js (which only
// handles /api/chat) so each file has one job.

const API_URL = import.meta.env.VITE_API_URL;

export class AuthApiError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = "AuthApiError";
    this.kind = kind; // "network" | "validation" | "conflict" | "invalid_credentials" | "server"
  }
}

// FastAPI validation errors (422) put details in body.detail, which can be
// either a plain string or a list of Pydantic error objects.
function extractDetailMessage(body) {
  if (!body || !body.detail) return null;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail.map((e) => e.msg).filter(Boolean).join(" ");
  }
  return null;
}

async function postJson(path, payload) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AuthApiError(
      "Can't reach the server. Check that the backend is running and try again.",
      "network"
    );
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON - fall through, body stays null.
  }

  if (!response.ok) {
    const detail = extractDetailMessage(body);

    if (response.status === 401) {
      throw new AuthApiError(detail || "Invalid email or password.", "invalid_credentials");
    }
    if (response.status === 409) {
      throw new AuthApiError(detail || "An account with this email already exists.", "conflict");
    }
    if (response.status === 422) {
      throw new AuthApiError(detail || "Please check your email and password.", "validation");
    }
    throw new AuthApiError(detail || `The server returned an error (status ${response.status}).`, "server");
  }

  return body;
}

/**
 * Register a new account. Returns { message, email } on success.
 */
export async function register(email, password) {
  const body = await postJson("/api/auth/register", { email, password });
  if (!body || typeof body.email !== "string") {
    throw new AuthApiError("The server sent back an unexpected response.", "server");
  }
  return body;
}

/**
 * Log in. Returns { access_token, token_type, email, role } on success.
 */
export async function login(email, password) {
  const body = await postJson("/api/auth/login", { email, password });
  if (!body || typeof body.access_token !== "string") {
    throw new AuthApiError("The server sent back an unexpected response.", "server");
  }
  return body;
}
