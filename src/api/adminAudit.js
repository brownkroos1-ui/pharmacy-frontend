import api from "./api";

const AUDIT_BASE = "/admin/audit";

export const fetchAuditLogs = async (params = {}) => {
  const res = await api.get(AUDIT_BASE, { params });
  return Array.isArray(res.data) ? res.data : [];
};
