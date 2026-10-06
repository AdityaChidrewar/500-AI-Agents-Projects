// Single place that knows how to communicate
// with the FastAPI backend.

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error(
    "VITE_API_URL is not set. Copy .env.example to .env and set it, then restart npm run dev."
  );
}


// --------------------------------------------------
// Custom API error
// --------------------------------------------------

export class ChatApiError extends Error {
  constructor(message, kind) {
    super(message);

    this.name = "ChatApiError";

    this.kind = kind;
  }
}


// --------------------------------------------------
// Send chat message
// --------------------------------------------------

export async function sendMessage(
  message,
  token,
  conversationId = null
) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/api/chat`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },

        body: JSON.stringify({
          message,

          ...(conversationId
            ? {
                conversation_id:
                  conversationId,
              }
            : {}),
        }),
      }
    );
  } catch {
    throw new ChatApiError(
      "Can't reach the support server. Check that the backend is running and try again.",
      "network"
    );
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Invalid/non-JSON response.
  }

  if (!response.ok) {
    const detail =
      extractDetailMessage(body);

    if (response.status === 401) {
      throw new ChatApiError(
        detail ||
          "Your session has expired. Please log in again.",
        "auth"
      );
    }

    if (response.status === 422) {
      throw new ChatApiError(
        detail ||
          "That message couldn't be sent as-is.",
        "validation"
      );
    }

    throw new ChatApiError(
      detail ||
        `The support server returned an error (status ${response.status}).`,
      "server"
    );
  }

  if (
    !body ||
    typeof body.answer !== "string" ||
    typeof body.escalated !== "boolean" ||
    typeof body.conversation_id !== "string"
  ) {
    throw new ChatApiError(
      "The support server sent back a response we didn't expect.",
      "invalid_response"
    );
  }

  return {
    answer: body.answer,
    escalated: body.escalated,
    conversationId: body.conversation_id,
    ticketId: body.ticket_id || null,
  };
}


// --------------------------------------------------
// Get persistent chat history
// --------------------------------------------------

export async function getChatHistory(
  token
) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/api/chats`,
      {
        method: "GET",

        headers: {
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
      }
    );
  } catch {
    throw new ChatApiError(
      "Can't reach the support server. Check that the backend is running and try again.",
      "network"
    );
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Invalid/non-JSON response.
  }

  if (!response.ok) {
    const detail =
      extractDetailMessage(body);

    if (response.status === 401) {
      throw new ChatApiError(
        detail ||
          "Your session has expired. Please log in again.",
        "auth"
      );
    }

    throw new ChatApiError(
      detail ||
        `The support server returned an error (status ${response.status}).`,
      "server"
    );
  }

  if (!Array.isArray(body)) {
    throw new ChatApiError(
      "The support server returned invalid chat history.",
      "invalid_response"
    );
  }

  return body;
}


// --------------------------------------------------
// Get customer tickets
// --------------------------------------------------

export async function getTickets(
  token
) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/api/tickets`,
      {
        method: "GET",

        headers: {
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
      }
    );
  } catch {
    throw new ChatApiError(
      "Can't reach the support server. Check that the backend is running and try again.",
      "network"
    );
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Invalid JSON response.
  }

  if (!response.ok) {
    const detail =
      extractDetailMessage(body);

    if (response.status === 401) {
      throw new ChatApiError(
        detail ||
          "Your session has expired. Please log in again.",
        "auth"
      );
    }

    throw new ChatApiError(
      detail ||
        "Unable to load support tickets.",
      "server"
    );
  }

  if (!Array.isArray(body)) {
    throw new ChatApiError(
      "Invalid ticket data received from the server.",
      "invalid_response"
    );
  }

  return body;
}


// --------------------------------------------------
// Get one customer ticket
// --------------------------------------------------

export async function getTicket(
  ticketId,
  token
) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/api/tickets/${encodeURIComponent(
        ticketId
      )}`,
      {
        method: "GET",

        headers: {
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
      }
    );
  } catch {
    throw new ChatApiError(
      "Can't reach the support server. Check that the backend is running and try again.",
      "network"
    );
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Invalid JSON response.
  }

  if (!response.ok) {
    const detail =
      extractDetailMessage(body);

    if (response.status === 401) {
      throw new ChatApiError(
        detail ||
          "Your session has expired. Please log in again.",
        "auth"
      );
    }

    if (response.status === 404) {
      throw new ChatApiError(
        detail ||
          "Ticket not found.",
        "not_found"
      );
    }

    throw new ChatApiError(
      detail ||
        "Unable to load the support ticket.",
      "server"
    );
  }

  return body;
}


// ==================================================
// ADMIN API
// ==================================================


// --------------------------------------------------
// Admin Dashboard
// GET /api/admin/dashboard
// --------------------------------------------------

export async function getAdminDashboard(token) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/api/admin/dashboard`,
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch {
    throw new ChatApiError(
      "Can't reach the support server. Check that the backend is running and try again.",
      "network"
    );
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Invalid/non-JSON response.
  }

  if (!response.ok) {
    const detail =
      extractDetailMessage(body);

    if (response.status === 401) {
      throw new ChatApiError(
        detail ||
          "Your session has expired. Please log in again.",
        "auth"
      );
    }

    if (response.status === 403) {
      throw new ChatApiError(
        detail ||
          "Admin access required.",
        "forbidden"
      );
    }

    throw new ChatApiError(
      detail ||
        "Unable to load admin dashboard.",
      "server"
    );
  }

  return body;
}


// --------------------------------------------------
// Admin - Get all tickets
// GET /api/admin/tickets
// --------------------------------------------------

export async function getAdminTickets(token) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/api/admin/tickets`,
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch {
    throw new ChatApiError(
      "Can't reach the support server. Check that the backend is running and try again.",
      "network"
    );
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Invalid/non-JSON response.
  }

  if (!response.ok) {
    const detail =
      extractDetailMessage(body);

    if (response.status === 401) {
      throw new ChatApiError(
        detail ||
          "Your session has expired. Please log in again.",
        "auth"
      );
    }

    if (response.status === 403) {
      throw new ChatApiError(
        detail ||
          "Admin access required.",
        "forbidden"
      );
    }

    throw new ChatApiError(
      detail ||
        "Unable to load admin tickets.",
      "server"
    );
  }

  if (!Array.isArray(body)) {
    throw new ChatApiError(
      "Invalid ticket data received from the server.",
      "invalid_response"
    );
  }

  return body;
}


// --------------------------------------------------
// Admin - Get one ticket
// GET /api/admin/tickets/{ticket_id}
// --------------------------------------------------

export async function getAdminTicket(
  ticketId,
  token
) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/api/admin/tickets/${encodeURIComponent(
        ticketId
      )}`,
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch {
    throw new ChatApiError(
      "Can't reach the support server. Check that the backend is running and try again.",
      "network"
    );
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Invalid/non-JSON response.
  }

  if (!response.ok) {
    const detail =
      extractDetailMessage(body);

    if (response.status === 401) {
      throw new ChatApiError(
        detail ||
          "Your session has expired. Please log in again.",
        "auth"
      );
    }

    if (response.status === 403) {
      throw new ChatApiError(
        detail ||
          "Admin access required.",
        "forbidden"
      );
    }

    if (response.status === 404) {
      throw new ChatApiError(
        detail ||
          "Ticket not found.",
        "not_found"
      );
    }

    throw new ChatApiError(
      detail ||
        "Unable to load the ticket.",
      "server"
    );
  }

  return body;
}


// --------------------------------------------------
// Admin - Update ticket status
// PATCH /api/admin/tickets/{ticket_id}/status
// --------------------------------------------------

export async function updateAdminTicketStatus(
  ticketId,
  status,
  token
) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/api/admin/tickets/${encodeURIComponent(
        ticketId
      )}/status`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          status,
        }),
      }
    );
  } catch {
    throw new ChatApiError(
      "Can't reach the support server. Check that the backend is running and try again.",
      "network"
    );
  }

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Invalid/non-JSON response.
  }

  if (!response.ok) {
    const detail =
      extractDetailMessage(body);

    if (response.status === 401) {
      throw new ChatApiError(
        detail ||
          "Your session has expired. Please log in again.",
        "auth"
      );
    }

    if (response.status === 403) {
      throw new ChatApiError(
        detail ||
          "Admin access required.",
        "forbidden"
      );
    }

    if (response.status === 404) {
      throw new ChatApiError(
        detail ||
          "Ticket not found.",
        "not_found"
      );
    }

    if (response.status === 422) {
      throw new ChatApiError(
        detail ||
          "Invalid ticket status.",
        "validation"
      );
    }

    throw new ChatApiError(
      detail ||
        "Unable to update ticket status.",
      "server"
    );
  }

  return body;
}


// ==================================================
// Helper
// ==================================================


// --------------------------------------------------
// Extract FastAPI error message
// --------------------------------------------------

function extractDetailMessage(
  body
) {
  if (
    !body ||
    !body.detail
  ) {
    return null;
  }

  if (
    typeof body.detail ===
    "string"
  ) {
    return body.detail;
  }

  if (
    Array.isArray(body.detail)
  ) {
    return body.detail
      .map(
        (error) =>
          error.msg
      )
      .filter(Boolean)
      .join(" ");
  }

  return null;
}