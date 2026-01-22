import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
});

// Attach JWT from localStorage as Authorization: Bearer <token>
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      if (!config.headers) config.headers = {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
