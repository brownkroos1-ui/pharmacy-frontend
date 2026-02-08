import React from "react";
import { Routes, Route, Navigate, Outlet, NavLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedAdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import Medicines from "./pages/Medicines";
import Sales from "./pages/Sales";
import "./App.css";

const Layout = () => {
  const { logout, role } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">Pharmacy App</div>
        <nav className="app-nav">
          {role === "ADMIN" && (
            <>
              <NavLink
                to="/dashboard"
                end={false}
                className={({ isActive }) =>
                  isActive ? "app-link active" : "app-link"
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/medicines"
                end={false}
                className={({ isActive }) =>
                  isActive ? "app-link active" : "app-link"
                }
              >
                Medicines
              </NavLink>
              <NavLink
                to="/sales"
                end={false}
                className={({ isActive }) =>
                  isActive ? "app-link active" : "app-link"
                }
              >
                Sales
              </NavLink>
              <NavLink
                to="/admin/users"
                end={false}
                className={({ isActive }) =>
                  isActive ? "app-link active" : "app-link"
                }
              >
                Users
              </NavLink>
            </>
          )}
          {role === "CASHIER" && (
            <NavLink
              to="/sales"
              end={false}
              className={({ isActive }) =>
                isActive ? "app-link active" : "app-link"
              }
            >
              Sales
            </NavLink>
          )}
        </nav>
        <button
          onClick={logout}
          className="app-logout"
        >
          Logout
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Admin Routes */}
        <Route path="/dashboard" element={<ProtectedAdminDashboard />} />
        {/* Redirect legacy path from Login.jsx */}
        <Route
          path="/admin/dashboard"
          element={<Navigate to="/dashboard" replace />}
        />

        <Route
          path="/medicines"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Medicines />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "CASHIER"]}>
              <Sales />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />

        {/* Cashier legacy route */}
        <Route path="/user/home" element={<Navigate to="/sales" replace />} />
      </Route>

      {/* Default Redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
