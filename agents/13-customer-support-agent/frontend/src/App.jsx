import { useState } from "react";
import Sidebar from "./Sidebar";
import WelcomeScreen from "./WelcomeScreen";
import "./index.css";

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sendMessage = async (suggestedMessage = null) => {
    const userMessage = suggestedMessage || message;

    if (!userMessage.trim() || loading) return;

    setMessage("");
    setError("");
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          escalated: data.escalated,
        },
      ]);
    } catch (error) {
      setError(
        "Unable to connect to the support server. Please make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setMessage("");
    setError("");
    setSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`sidebar-wrapper ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <Sidebar onNewChat={startNewChat} />
      </div>

      <div className="app">
        <header className="header">
          <button
            className="mobile-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <h1>AI Customer Support</h1>

          <span className="status">
            <span className="status-dot">●</span>
            Online
          </span>
        </header>

        <main className="chat-container">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={sendMessage} />
          ) : (
            <div className="messages">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message-row ${
                    msg.role === "user"
                      ? "user-row"
                      : "ai-row"
                  }`}
                >
                  <div className="message-avatar">
                    {msg.role === "user" ? "You" : "AI"}
                  </div>

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

                    <p>{msg.content}</p>

                    {msg.escalated && (
                      <div className="escalation">
                        ⚠️ This issue has been escalated to support.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {loading && (
            <div className="loading-message">
              <div className="loading-avatar">AI</div>

              <div className="loading-content">
                <strong>AI Support</strong>
                <span>AI is thinking...</span>
              </div>
            </div>
          )}

          <div className="input-area">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your question..."
              rows="1"
              disabled={loading}
            />

            <button
              onClick={() => sendMessage()}
              disabled={loading || !message.trim()}
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;