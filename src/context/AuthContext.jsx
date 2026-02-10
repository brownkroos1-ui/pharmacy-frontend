import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [role, setRole] = useState(localStorage.getItem("role"));
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem("refresh_token")
  );

  const login = (newToken, newRole, newRefreshToken) => {
    setToken(newToken);
    setRole(newRole);
    if (newRefreshToken) {
      setRefreshToken(newRefreshToken);
    }
    
    localStorage.setItem("token", newToken);
    if (newRole) {
      localStorage.setItem("role", newRole);
    } else {
      localStorage.removeItem("role");
    }
    if (newRefreshToken) {
      localStorage.setItem("refresh_token", newRefreshToken);
    }
  };

  const logout = () => {
    setToken(null);
    setRole(null);
    setRefreshToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("refresh_token");
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider
      value={{ token, role, refreshToken, login, logout, isAuthenticated }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
