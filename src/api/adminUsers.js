import api from "./api";

const USERS_BASE = "/admin/users";

export const fetchAdminUsers = async (params = {}) => {
  const res = await api.get(USERS_BASE, { params });
  return Array.isArray(res.data) ? res.data : [];
};

export const updateAdminUserRole = async (id, role) => {
  const res = await api.patch(`${USERS_BASE}/${id}/role`, { role });
  return res.data;
};

export const updateAdminUserStatus = async (id, active) => {
  const res = await api.patch(`${USERS_BASE}/${id}/status`, { active });
  return res.data;
};

export const createAdminUser = async (payload) => {
  const res = await api.post(USERS_BASE, payload);
  return res.data;
};

export const resetAdminUserPassword = async (id, password) => {
  const res = await api.patch(`${USERS_BASE}/${id}/password`, { password });
  return res.data;
};
