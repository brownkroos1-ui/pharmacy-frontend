import React, { useEffect, useState } from "react";
import { fetchAdminDashboard } from "../api/adminDashboard";
import ProtectedRoute from "../components/ProtectedRoute";
import "./AdminDashboard.css";

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getDashboardData = async () => {
      try {
        setLoading(true);
        const response = await fetchAdminDashboard();
        setData(response);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    getDashboardData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      <div className="dashboard-cards">
        <div className="card">
          <h2>Total Users</h2>
          <p>{data?.totalUsers}</p>
        </div>
        <div className="card">
          <h2>Total Medicines</h2>
          <p>{data?.totalMedicines}</p>
        </div>
        <div className="card">
          <h2>Low Stock</h2>
          <p>{data?.lowStock}</p>
        </div>
        <div className="card">
          <h2>Out of Stock</h2>
          <p>{data?.outOfStock}</p>
        </div>
        <div className="card">
          <h2>Total Sales</h2>
          <p>{data?.totalSales}</p>
        </div>
        <div className="card">
          <h2>Today's Revenue</h2>
          <p>${data?.todayRevenue?.toFixed(2)}</p>
        </div>
        <div className="card">
          <h2>Completed Sales</h2>
          <p>{data?.completedSales}</p>
        </div>
        <div className="card">
          <h2>Cancelled Sales</h2>
          <p>{data?.cancelledSales}</p>
        </div>
      </div>
    </div>
  );
};

export default function ProtectedAdminDashboard() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminDashboard />
    </ProtectedRoute>
  );
}