function Sidebar({ onNewChat }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand">
          <div className="brand-icon">AI</div>
          <div>
            <h2>AI Support</h2>
            <span>Customer Service</span>
          </div>
        </div>

        <button className="new-chat-btn" onClick={onNewChat}>
          <span>＋</span>
          New Chat
        </button>

        <div className="history-section">
          <p className="section-title">Recent</p>

          <button className="history-item">
            <span>💬</span>
            Pro plan pricing
          </button>

          <button className="history-item">
            <span>💬</span>
            Password reset
          </button>
        </div>
      </div>

      <div className="sidebar-bottom">
        <button className="sidebar-item">
          <span>⚙️</span>
          Settings
        </button>

        <div className="user-profile">
          <div className="avatar">C</div>
          <div>
            <strong>Customer</strong>
            <span>Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;