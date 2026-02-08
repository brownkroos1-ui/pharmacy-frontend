import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login } from "../api/auth";
import { Eye, EyeOff } from "lucide-react";
import "./Login.css";

export default function Login() {
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reason = sessionStorage.getItem("logout_reason");
    if (!reason) return;
    sessionStorage.removeItem("logout_reason");
    if (reason === "session_expired") {
      setInfo("Your session expired. Please log in again.");
    } else if (reason === "unauthorized") {
      setInfo("Please log in to continue.");
    }
  }, []);

  useEffect(() => {
    const savedRemember = localStorage.getItem("login_remember") === "true";
    if (!savedRemember) return;
    const savedUsername = localStorage.getItem("login_username") || "";
    const savedPassword = localStorage.getItem("login_password") || "";
    setUsername(savedUsername);
    setPassword(savedPassword);
    setRemember(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login({ username, password });

      // token may be in several shapes depending on backend
      const token = data?.token || data?.accessToken || data?.data?.token;
      const role =
        (data && (data.role || data.user?.role)) ||
        (data?.user && (data.user.roles?.[0]?.name || data.user.roles?.[0]));

      if (token) {
        if (remember) {
          localStorage.setItem("login_remember", "true");
          localStorage.setItem("login_username", username);
          localStorage.setItem("login_password", password);
        } else {
          localStorage.removeItem("login_remember");
          localStorage.removeItem("login_username");
          localStorage.removeItem("login_password");
        }

        // Save token in AuthContext (also persisted to localStorage there)
        authLogin(token, role);

        // Redirect based on role
        const r = role ? String(role).toUpperCase() : "";
        if (r === "ADMIN") navigate("/admin/dashboard");
        else if (r === "CASHIER") navigate("/sales");
        else navigate("/login");
      } else {
        setError("No token received from server");
      }
    } catch (err) {
      const serverMessage = err?.response?.data?.message || err?.message;
      setError(serverMessage || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-glow login-glow--one" />
      <div className="login-glow login-glow--two" />
      <div className="login-shell">
        <aside className="login-panel">
          <span className="login-kicker">Pharmacy POS</span>
          <h1>Sales console</h1>
          <p>
            Sign in to manage stock, process cashier sales, and monitor revenue
            in one clean command center.
          </p>
          <div className="login-metrics">
            <div className="login-metric">
              <span>Live stock</span>
              <strong>Real-time alerts</strong>
            </div>
            <div className="login-metric">
              <span>Daily close</span>
              <strong>Profit tracking</strong>
            </div>
            <div className="login-metric">
              <span>Secure access</span>
              <strong>Role-based screens</strong>
            </div>
          </div>
        </aside>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-header">
            <h2>Welcome back</h2>
            <p>Use your pharmacy credentials to continue.</p>
          </div>

          {info && <div className="login-info">{info}</div>}
          {error && <div className="login-error">{error}</div>}

          <label className="login-field">
            <span>Email or Username</span>
            <input
              autoFocus
              placeholder="Email or Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="login-password">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={loading}
            />
            <span>Remember username and password</span>
          </label>

          <button className="login-button" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="login-footer">Contact admin to access the system.</p>
        </form>
      </div>
    </div>
  );
}
