import axios from "axios";
import { toast } from "../components/toastStore";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  headers: {
    "Content-Type": "application/json",
  },
});

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    let normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4 !== 0) {
      normalized += "=";
    }
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
};

const clearAuthAndRedirect = (reason) => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  if (reason) {
    sessionStorage.setItem("logout_reason", reason);
  }
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

// Attach JWT from localStorage as Authorization: Bearer <token>
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (!token) {
      const url = String(config?.url || "");
      if (!url.includes("/auth/")) {
        clearAuthAndRedirect("unauthorized");
        return Promise.reject(new Error("Not authenticated"));
      }
      return config;
    }
    if (isTokenExpired(token)) {
      clearAuthAndRedirect("session_expired");
      return Promise.reject(new Error("Session expired"));
    }
    if (!config.headers) config.headers = {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthAndRedirect("unauthorized");
    } else if (!error?.response) {
      toast.error("Network error", {
        description: "Unable to reach the server. Check your connection.",
      });
    } else if (error?.response?.status >= 500) {
      toast.error("Server error", {
        description: "Something went wrong on the server. Try again shortly.",
      });
    }
    return Promise.reject(error);
  }
);

export default api;
