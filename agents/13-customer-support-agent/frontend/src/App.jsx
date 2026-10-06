import {
  useEffect,
  useState,
} from "react";

import MarkdownMessage from "./components/MarkdownMessage";
import Sidebar from "./components/Sidebar";
import WelcomeScreen from "./components/WelcomeScreen";
import AuthScreen from "./components/AuthScreen";
import AdminDashboard from "./components/AdminDashboard";

import {
  sendMessage as sendChatMessage,
  getChatHistory,
  ChatApiError,
} from "./services/api";

import "./index.css";

const AUTH_STORAGE_KEY = "cloudsync_auth";

function App() {
  // --------------------------------------------------
  // Authentication state
  // --------------------------------------------------

  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem(
        AUTH_STORAGE_KEY
      );

      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [sessionMessage, setSessionMessage] =
    useState("");

  // --------------------------------------------------
  // Current application view
  // --------------------------------------------------

  const [view, setView] = useState(() => {
    try {
      const raw = localStorage.getItem(
        AUTH_STORAGE_KEY
      );

      if (raw) {
        const savedAuth = JSON.parse(raw);

        return savedAuth?.role === "admin"
          ? "admin"
          : "chat";
      }
    } catch {
      // Ignore invalid saved auth.
    }

    return "chat";
  });

  // --------------------------------------------------
  // Chat state
  // --------------------------------------------------

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Sidebar state
  // --------------------------------------------------

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  // --------------------------------------------------
  // Persistent conversation history
  // --------------------------------------------------

  const [history, setHistory] = useState([]);
  const [activeChatId, setActiveChatId] =
    useState(null);

  // Current MongoDB conversation ID.
  const backendConversationId =
    activeChatId;

  // --------------------------------------------------
  // Login
  // --------------------------------------------------

  const handleLoginSuccess = ({
    access_token,
    email,
    role,
  }) => {
    const nextAuth = {
      token: access_token,
      email,
      role,
    };

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify(nextAuth)
    );

    setAuth(nextAuth);
    setSessionMessage("");

    setView(
      role === "admin"
        ? "admin"
        : "chat"
    );
  };

  // --------------------------------------------------
  // Logout
  // --------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem(
      AUTH_STORAGE_KEY
    );

    setAuth(null);
    setMessages([]);
    setHistory([]);
    setActiveChatId(null);
    setMessage("");
    setError("");
    setView("chat");
    setSidebarOpen(false);
  };

  // --------------------------------------------------
  // Session expired
  // --------------------------------------------------

  const handleSessionExpired = () => {
    localStorage.removeItem(
      AUTH_STORAGE_KEY
    );

    setAuth(null);
    setMessages([]);
    setHistory([]);
    setActiveChatId(null);
    setMessage("");
    setError("");
    setView("chat");
    setSidebarOpen(false);

    setSessionMessage(
      "Your session has expired. Please log in again."
    );
  };

  // --------------------------------------------------
  // Load persistent history after login
  // --------------------------------------------------

  useEffect(() => {
    if (!auth?.token) {
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      try {
        const savedHistory =
          await getChatHistory(auth.token);

        if (cancelled) {
          return;
        }

        setHistory(savedHistory);
      } catch (err) {
        if (cancelled) {
          return;
        }

        if (
          err instanceof ChatApiError &&
          err.kind === "auth"
        ) {
          handleSessionExpired();
          return;
        }

        console.error(
          "Failed to load chat history:",
          err
        );

        setError(
          err instanceof ChatApiError
            ? err.message
            : "Unable to load chat history."
        );
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [auth?.token]);

  // --------------------------------------------------
  // Send message
  // --------------------------------------------------

  const sendMessage = async (
    suggestedMessage = null
  ) => {
    const userMessage =
      suggestedMessage || message;

    if (
      !userMessage.trim() ||
      loading ||
      !auth?.token
    ) {
      return;
    }

    setMessage("");
    setError("");
    setLoading(true);

    const userMessageObject = {
      role: "user",
      content: userMessage,
      escalated: false,
      ticket_id: null,
    };

    setMessages((previous) => [
      ...previous,
      userMessageObject,
    ]);

    try {
      const {
        answer,
        escalated,
        conversationId,
        ticketId,
      } = await sendChatMessage(
        userMessage,
        auth.token,
        backendConversationId
      );

      const newConversationId =
        conversationId;

      const assistantMessage = {
        role: "assistant",
        content: answer,
        escalated,
        ticket_id: ticketId || null,
      };

      setMessages((previous) => {
        const updatedMessages = [
          ...previous,
          assistantMessage,
        ];

        setHistory((previousHistory) => {
          const existingConversation =
            previousHistory.find(
              (chat) =>
                chat.id ===
                newConversationId
            );

          if (existingConversation) {
            return previousHistory.map(
              (chat) => {
                if (
                  chat.id !==
                  newConversationId
                ) {
                  return chat;
                }

                return {
                  ...chat,
                  messages:
                    updatedMessages,
                };
              }
            );
          }

          const newHistoryItem = {
            id: newConversationId,
            title: userMessage.slice(
              0,
              48
            ),
            messages:
              updatedMessages,
          };

          return [
            newHistoryItem,
            ...previousHistory,
          ];
        });

        return updatedMessages;
      });

      setActiveChatId(
        newConversationId
      );
    } catch (err) {
      if (
        err instanceof ChatApiError &&
        err.kind === "auth"
      ) {
        handleSessionExpired();
        return;
      }

      setError(
        err instanceof ChatApiError
          ? err.message
          : "Unable to connect to the support server. Please make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Start a new chat
  // --------------------------------------------------

  const startNewChat = () => {
    setMessages([]);
    setMessage("");
    setError("");
    setActiveChatId(null);
    setView("chat");
    setSidebarOpen(false);
  };

  // --------------------------------------------------
  // Select previous chat
  // --------------------------------------------------

  const selectChat = (chatId) => {
    const chat = history.find(
      (item) => item.id === chatId
    );

    if (!chat) {
      return;
    }

    setMessages(chat.messages || []);
    setActiveChatId(chat.id);
    setMessage("");
    setError("");
    setView("chat");
    setSidebarOpen(false);
  };

  // --------------------------------------------------
  // Open admin dashboard
  // --------------------------------------------------

  const openAdminDashboard = () => {
    if (auth?.role !== "admin") {
      return;
    }

    setView("admin");
    setError("");
    setSidebarOpen(false);
  };

  // --------------------------------------------------
  // Open customer chat
  // --------------------------------------------------

  const openChat = () => {
    setView("chat");
    setError("");
    setSidebarOpen(false);
  };

  // --------------------------------------------------
  // If user is not logged in
  // --------------------------------------------------

  if (!auth) {
    return (
      <AuthScreen
        onLoginSuccess={
          handleLoginSuccess
        }
        sessionMessage={
          sessionMessage
        }
      />
    );
  }

  // --------------------------------------------------
  // Main application
  // --------------------------------------------------

  return (
    <div className="app-layout">

      {/* =========================================
          SIDEBAR
      ========================================= */}

      <div
        className={`sidebar-wrapper ${
          sidebarOpen
            ? "sidebar-open"
            : ""
        }`}
      >
        <Sidebar
          history={history}
          activeChatId={activeChatId}
          onNewChat={startNewChat}
          onSelectChat={selectChat}
          isOpen={sidebarOpen}
          onClose={() =>
            setSidebarOpen(false)
          }
          userEmail={auth.email}
          onLogout={handleLogout}
          isAdmin={
            auth.role === "admin"
          }
          view={view}
          onOpenAdmin={
            openAdminDashboard
          }
          onBackToChat={openChat}
        />
      </div>

      {/* =========================================
          ADMIN DASHBOARD
      ========================================= */}

      {view === "admin" &&
      auth.role === "admin" ? (
        <div className="app admin-app">

          {/* Mobile menu */}
          <button
            className="mobile-menu-button admin-mobile-menu"
            onClick={() =>
              setSidebarOpen(true)
            }
            aria-label="Open menu"
          >
            Menu
          </button>

          <AdminDashboard
            token={auth.token}
            onSessionExpired={
              handleSessionExpired
            }
          />
        </div>
      ) : (

        /* =========================================
           CUSTOMER CHAT
        ========================================= */

        <div className="app">

          {/* =======================================
              HEADER
          ======================================= */}

          <header className="header">

            <button
              className="mobile-menu-button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open menu"
            >
              Menu
            </button>

            <h1>
              AI Customer Support
            </h1>

            <span className="status">
              <span className="status-dot">
                O
              </span>

              Online
            </span>
          </header>

          {/* =======================================
              CHAT
          ======================================= */}

          <main className="chat-container">

            {/* Welcome screen */}
            {messages.length === 0 ? (
              <WelcomeScreen
                onSuggestionClick={
                  sendMessage
                }
              />
            ) : (

              /* Messages */
              <div className="messages">

                {messages.map(
                  (msg, index) => (
                    <div
                      key={`${index}-${msg.role}`}
                      className={`message-row ${
                        msg.role === "user"
                          ? "user-row"
                          : "ai-row"
                      }`}
                    >

                      {/* Avatar */}
                      <div className="message-avatar">
                        {msg.role === "user"
                          ? "You"
                          : "AI"}
                      </div>

                      {/* Message */}
                      <div
                        className={`message ${
                          msg.role === "user"
                            ? "user-message"
                            : "ai-message"
                        }`}
                      >

                        <strong>
                          {msg.role === "user"
                            ? "You"
                            : "AI Support"}
                        </strong>

                        {/* AI response with Markdown */}
                        {msg.role === "assistant" ? (
                          <MarkdownMessage
                            content={
                              msg.content
                            }
                          />
                        ) : (
                          <p>
                            {msg.content}
                          </p>
                        )}

                        {/* =================================
                            ESCALATION
                        ================================= */}

                        {msg.escalated && (
                          <div className="escalation">

                            <strong>
                              ⚠️ This issue has been escalated to support.
                            </strong>

                            {msg.ticket_id && (
                              <div>
                                Ticket ID:{" "}
                                <strong>
                                  {
                                    msg.ticket_id
                                  }
                                </strong>
                              </div>
                            )}

                            <div>
                              Our support team can review this issue.
                            </div>

                          </div>
                        )}

                      </div>
                    </div>
                  )
                )}

              </div>
            )}

            {/* =====================================
                ERROR
            ===================================== */}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* =====================================
                LOADING
            ===================================== */}

            {loading && (
              <div className="loading-message">

                <div className="loading-avatar">
                  AI
                </div>

                <div className="loading-content">

                  <strong>
                    AI Support
                  </strong>

                  <span>
                    AI is thinking...
                  </span>

                </div>

              </div>
            )}

            {/* =====================================
                INPUT
            ===================================== */}

            <div className="input-area">

              <textarea
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type your question..."
                rows="1"
                disabled={loading}
              />

              <button
                onClick={() =>
                  sendMessage()
                }
                disabled={
                  loading ||
                  !message.trim()
                }
              >
                {loading
                  ? "Thinking..."
                  : "Send"}
              </button>

            </div>

          </main>
        </div>
      )}

    </div>
  );
}

export default App;
