import "./Sidebar.css";

function Sidebar({
  history,
  activeChatId,
  onNewChat,
  onSelectChat,
  isOpen,
  onClose,
  userEmail,
  onLogout,
  isAdmin,
  view,
  onOpenAdmin,
  onBackToChat,
}) {
  const inAdmin = view === "admin";

  return (
    <>
      {/* =========================================
          MOBILE SIDEBAR BACKDROP
      ========================================= */}

      {isOpen && (
        <div
          className="cs-sidebar-backdrop"
          onClick={onClose}
        />
      )}

      {/* =========================================
          SIDEBAR
      ========================================= */}

      <aside
        className={`cs-sidebar ${
          isOpen
            ? "cs-sidebar-open"
            : ""
        }`}
      >

        {/* =========================================
            BRAND
        ========================================= */}

        <div className="cs-brand">

          <div className="cs-brand-mark">
            CS
          </div>

          <div className="cs-brand-text">
            <strong>
              CloudSync
            </strong>

            <span>
              AI Support Platform
            </span>
          </div>

        </div>

        {/* =========================================
            SIDEBAR ACTIONS
        ========================================= */}

        <div className="cs-sidebar-actions">

          {/* Admin Dashboard / Back to Chat */}
          {isAdmin && (
            <button
              className={`cs-nav-button ${
                inAdmin
                  ? "active"
                  : ""
              }`}
              type="button"
              onClick={
                inAdmin
                  ? onBackToChat
                  : onOpenAdmin
              }
            >

              <span className="cs-nav-icon">
                {inAdmin
                  ? "←"
                  : "▦"}
              </span>

              <span>
                {inAdmin
                  ? "Back to Chat"
                  : "Admin Dashboard"}
              </span>

            </button>
          )}

          {/* New Conversation */}
          {!inAdmin && (
            <button
              className="cs-new-chat"
              type="button"
              onClick={onNewChat}
            >

              <span className="cs-new-chat-icon">
                +
              </span>

              <span>
                New conversation
              </span>

            </button>
          )}

        </div>

        {/* =========================================
            CHAT HISTORY
        ========================================= */}

        {!inAdmin && (
          <div className="cs-history-section">

            <div className="cs-sidebar-label">
              Conversations
            </div>

            <nav className="cs-chat-history">

              {/* Empty history */}
              {history.length === 0 && (
                <div className="cs-history-empty">

                  <span>
                    ◌
                  </span>

                  <p>
                    Your conversations will
                    appear here.
                  </p>

                </div>
              )}

              {/* History items */}
              {history.map((chat) => (
                <button
                  key={chat.id}
                  className={`cs-history-item ${
                    chat.id ===
                    activeChatId
                      ? "active"
                      : ""
                  }`}
                  type="button"
                  onClick={() =>
                    onSelectChat(
                      chat.id
                    )
                  }
                  title={chat.title}
                >

                  <span className="cs-history-dot" />

                  <span className="cs-history-title">
                    {chat.title}
                  </span>

                </button>
              ))}

            </nav>

          </div>
        )}

        {/* =========================================
            ACCOUNT SECTION
        ========================================= */}

        <div className="cs-account">

          {/* Account information */}
          <div className="cs-account-card">

            {/* User Avatar */}
            <div className="cs-avatar">
              {(userEmail || "A")
                .charAt(0)
                .toUpperCase()}
            </div>

            {/* User Information */}
            <div className="cs-account-info">

              <strong>
                {isAdmin
                  ? "Administrator"
                  : "Customer"}
              </strong>

              <span
                title={userEmail}
              >
                {userEmail ||
                  "Signed in"}
              </span>

            </div>

          </div>

          {/* =======================================
              ACCOUNT ACTIONS
          ======================================= */}

          <div className="cs-account-actions">

            {/* Logout */}
            <button
              className="cs-account-button logout"
              type="button"
              onClick={onLogout}
            >

              <span>
                ↪
              </span>

              <span>
                Log out
              </span>

            </button>

          </div>

        </div>

      </aside>
    </>
  );
}

export default Sidebar;