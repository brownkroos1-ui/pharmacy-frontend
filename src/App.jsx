import React from "react";
import { Routes, Route, Navigate, Outlet, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedAdminDashboard from "./pages/AdminDashboard";
import ProtectedUserHome from "./pages/UserHome";

// Placeholder components for requested routes
const Medicines = () => <div style={{ padding: "2rem" }}><h2>Medicines Management</h2><p>Manage inventory here.</p></div>;
const Sales = () => <div style={{ padding: "2rem" }}><h2>Sales Management</h2><p>View sales records here.</p></div>;

const Layout = () => {
  const { logout, role } = useAuth();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <header style={{ backgroundColor: "#2c3e50", color: "white", padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>Pharmacy App</div>
        <nav style={{ display: "flex", gap: "1.5rem" }}>
          {role === "ADMIN" && (
            <>
              <Link to="/dashboard" style={{ color: "white", textDecoration: "none" }}>Dashboard</Link>
              <Link to="/medicines" style={{ color: "white", textDecoration: "none" }}>Medicines</Link>
              <Link to="/sales" style={{ color: "white", textDecoration: "none" }}>Sales</Link>
            </>
          )}
          {role === "USER" && (
            <Link to="/user/home" style={{ color: "white", textDecoration: "none" }}>Home</Link>
          )}
        </nav>
        <button 
          onClick={logout} 
          style={{ backgroundColor: "#e74c3c", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer" }}
        >
          Logout
        </button>
      </header>
      <main style={{ flex: 1, backgroundColor: "#f4f6f8" }}>
        <Outlet />
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          {/* Admin Routes */}
          <Route path="/dashboard" element={<ProtectedAdminDashboard />} />
          {/* Redirect legacy path from Login.jsx */}
          <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
          
          <Route path="/medicines" element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Medicines />
            </ProtectedRoute>
          } />
          <Route path="/sales" element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Sales />
            </ProtectedRoute>
          } />

          {/* User Routes */}
          <Route path="/user/home" element={<ProtectedUserHome />} />
        </Route>

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}