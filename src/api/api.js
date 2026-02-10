import axios from "axios";
import { toast } from "../components/toastStore";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshClient = axios.create({
  baseURL: apiBaseUrl,
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
  localStorage.removeItem("refresh_token");
  if (reason) {
    sessionStorage.setItem("logout_reason", reason);
  }
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

const isAuthRequest = (url) => url.includes("/auth/");

let refreshPromise = null;

const attemptRefresh = async () => {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshClient
    .post("/auth/refresh", { refreshToken })
    .then((res) => {
      const newToken = res.data?.token || res.data?.accessToken;
      const newRefreshToken = res.data?.refreshToken || res.data?.refresh_token;
      if (newToken) {
        localStorage.setItem("token", newToken);
      }
      if (newRefreshToken) {
        localStorage.setItem("refresh_token", newRefreshToken);
      }
      return newToken;
    })
    .catch((err) => {
      clearAuthAndRedirect("session_expired");
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// Attach JWT from localStorage as Authorization: Bearer <token>
api.interceptors.request.use(
  async (config) => {
    const url = String(config?.url || "");
    if (isAuthRequest(url)) {
      return config;
    }

    let token = localStorage.getItem("token");
    if (token && !isTokenExpired(token)) {
      if (!config.headers) config.headers = {};
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    }

    const refreshed = await attemptRefresh();
    if (refreshed) {
      if (!config.headers) config.headers = {};
      config.headers.Authorization = `Bearer ${refreshed}`;
      return config;
    }

    clearAuthAndRedirect("unauthorized");
    return Promise.reject(new Error("Not authenticated"));
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401 && error?.config) {
      const url = String(error.config?.url || "");
      if (!isAuthRequest(url) && !error.config._retry) {
        error.config._retry = true;
        try {
          const refreshed = await attemptRefresh();
          if (refreshed) {
            if (!error.config.headers) error.config.headers = {};
            error.config.headers.Authorization = `Bearer ${refreshed}`;
            return api(error.config);
          }
        } catch {
          // handled by attemptRefresh
        }
      }
      clearAuthAndRedirect("unauthorized");
    } else if (error?.response?.status === 429) {
      const retryAfter = error.response.headers?.["retry-after"];
      const description = retryAfter
        ? `Too many requests. Try again in ${retryAfter} seconds.`
        : error?.response?.data?.message || "Too many requests. Please try again shortly.";
      toast.warning("Slow down", { description });
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
