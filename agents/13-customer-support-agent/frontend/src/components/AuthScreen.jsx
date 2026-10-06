import { useState } from "react";
import { login, register, AuthApiError } from "../services/authApi";

// One screen, two modes (login / register), toggled by a link at the bottom.
// Kept as a single component on purpose: no router is installed, and this
// is simple enough to explain as "one form, one flag that switches its
// labels and which API function it calls."
function AuthScreen({ onLoginSuccess, sessionMessage }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setInfoMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return; // empty fields never submit

    setIsSubmitting(true);
    setError("");
    setInfoMessage("");

    try {
      if (mode === "login") {
        const result = await login(email.trim(), password);
        onLoginSuccess(result); // { access_token, token_type, email, role }
      } else {
        await register(email.trim(), password);
        // Don't auto-login after registering - keep the two actions distinct
        // and obvious, which is easier to reason about and to explain.
        setInfoMessage("Account created. You can log in now.");
        setMode("login");
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <span className="sidebar-brand-mark">CS</span>
          <span className="auth-brand-name">CloudSync Support</span>
        </div>

        <h1>{mode === "login" ? "Log in" : "Create an account"}</h1>

        {sessionMessage && mode === "login" && (
          <p className="auth-session-message">{sessionMessage}</p>
        )}
        {infoMessage && <p className="auth-info-message">{infoMessage}</p>}
        {error && <p className="auth-error-message">{error}</p>}

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "register" ? 6 : undefined}
            required
          />
        </label>

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {isSubmitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>

        <p className="auth-switch">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button type="button" onClick={() => switchMode("register")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => switchMode("login")}>
                Log in
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}

export default AuthScreen;
