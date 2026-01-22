import api from "./api";

export const fetchAdminDashboard = async () => {
  try {
    const res = await api.get("/admin/dashboard");
    return res.data;
  } catch (error) {
    console.error("Error fetching admin dashboard data:", error);
    throw error;
  }
};
