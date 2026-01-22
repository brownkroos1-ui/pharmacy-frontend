import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login } from "../api/auth";

export default function Login() {
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        // Save token in AuthContext (also persisted to localStorage there)
        authLogin(token, role);

        // Redirect based on role
        const r = role ? String(role).toUpperCase() : "";
        if (r === "ADMIN") navigate("/admin/dashboard");
        else if (r === "USER") navigate("/user/home");
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
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <form onSubmit={handleSubmit} style={{ width: 320, padding: 20, border: "1px solid #eee", borderRadius: 6 }}>
        <h2 style={{ marginTop: 0 }}>Login</h2>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <label style={{ display: "block", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "#333" }}>Username</div>
          <input
            autoFocus
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={loading}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#333" }}>Password</div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <button disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <p style={{ marginTop: 12, textAlign: "center" }}>
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
