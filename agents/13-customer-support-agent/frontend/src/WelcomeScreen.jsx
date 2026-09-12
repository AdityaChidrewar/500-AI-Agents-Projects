function WelcomeScreen({ onSuggestionClick }) {
  const suggestions = [
    {
      icon: "💳",
      title: "Billing & Plans",
      text: "What is the price of the Pro plan?",
    },
    {
      icon: "🔐",
      title: "Password Help",
      text: "How do I reset my password?",
    },
    {
      icon: "📦",
      title: "Subscriptions",
      text: "How can I manage my subscription?",
    },
    {
      icon: "🎫",
      title: "Contact Support",
      text: "I have a billing issue and need help.",
    },
  ];

  return (
    <div className="welcome">
      <div className="welcome-icon">✨</div>

      <h2>How can we help you today?</h2>

      <p>
        Get instant answers from our AI customer support agent.
      </p>

      <div className="suggestions">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            className="suggestion-card"
            onClick={() => onSuggestionClick(suggestion.text)}
          >
            <span className="suggestion-icon">{suggestion.icon}</span>

            <span className="suggestion-content">
              <strong>{suggestion.title}</strong>
              <small>{suggestion.text}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default WelcomeScreen;