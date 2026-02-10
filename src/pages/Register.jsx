import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { register } from "../api/auth";

export default function Register() {
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        username: email.trim(),
        password,
      };
      const data = await register(payload);
      if (data.token) {
        const refreshToken =
          data?.refreshToken || data?.refresh_token || data?.data?.refreshToken;
        authLogin(data.token, data.role || "CASHIER", refreshToken);
        try {
          const key = `pharmacy_profile_${payload.username || payload.email}`;
          localStorage.setItem(
            key,
            JSON.stringify({ name: payload.name, email: payload.email })
          );
        } catch {
          // ignore localStorage errors
        }
        navigate("/login");
      } else {
        // If registration is successful but no token (e.g., email confirmation needed)
        navigate("/login");
      }
    } catch (err) {
      console.error("Registration error:", err);
      const responseData = err?.response?.data;
      if (responseData?.message) {
        setError(responseData.message);
      } else if (responseData?.error) {
        setError(responseData.error);
      } else if (responseData && typeof responseData === "object") {
        const details = Object.values(responseData).filter(Boolean).join(" ");
        setError(details || `Failed to register: ${err.response.status} ${err.response.statusText}`);
      } else if (err.response) {
        setError(`Failed to register: ${err.response.status} ${err.response.statusText}`);
      } else {
        setError("Failed to register: Network error or server unreachable.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f0f2f5" }}>
      <form onSubmit={handleSubmit} style={{ padding: "30px", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", width: "300px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#333" }}>Register</h2>
        {error && <div style={{ color: "red", marginBottom: "10px", fontSize: "0.9rem", textAlign: "center" }}>{error}</div>}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "#666" }}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "#666" }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "#666" }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "#666" }}>Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", boxSizing: "border-box" }} />
        </div>
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>{loading ? "Registering..." : "Register"}</button>
        <div style={{ marginTop: "15px", textAlign: "center", fontSize: "0.9rem" }}>
          Already have an account? <Link to="/login" style={{ color: "#007bff", cursor: "pointer", textDecoration: "underline" }}>Login</Link>
        </div>
      </form>
    </div>
  );
}
