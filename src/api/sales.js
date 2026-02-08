import api from "./api";

const SALES_BASE = "/sales";

const STATUS_ENDPOINTS = {
  valid: "VALID",
  rejected_expired: "REJECTED_EXPIRED",
  rejected_out_of_stock: "REJECTED_OUT_OF_STOCK",
};

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  return [];
};

const fetchByStatus = async (status) => {
  const res = await api.get(`${SALES_BASE}/status/${status}`);
  return unwrapList(res.data);
};

export const fetchSales = async (filters = {}) => {
  const filter = filters.status || "all";

  if (filter !== "all") {
    const status =
      STATUS_ENDPOINTS[filter] || String(filter).trim().toUpperCase();
    return fetchByStatus(status);
  }

  const statuses = Object.values(STATUS_ENDPOINTS);
  const responses = await Promise.all(statuses.map(fetchByStatus));
  return responses.flat();
};

export const fetchMonthlySalesSummary = async (year, month) => {
  const res = await api.get(`${SALES_BASE}/summary/monthly`, {
    params: { year, month },
  });
  return res.data;
};

export const fetchMonthlySalesRange = async (year, month, count = 6) => {
  const res = await api.get(`${SALES_BASE}/summary/monthly/range`, {
    params: { year, month, count },
  });
  return res.data;
};

export const createSale = async (payload) => {
  const res = await api.post(SALES_BASE, payload);
  return res.data;
};

export const fetchProfitSummary = async ({ start, end } = {}) => {
  const res = await api.get(`${SALES_BASE}/profit/summary`, {
    params: { start, end },
  });
  return res.data;
};

export const fetchProfitSeries = async ({ start, end, period } = {}) => {
  const res = await api.get(`${SALES_BASE}/profit/series`, {
    params: { start, end, period },
  });
  return res.data;
};

export const fetchTopProfitMedicines = async ({
  start,
  end,
  limit = 5,
} = {}) => {
  const res = await api.get(`${SALES_BASE}/profit/top`, {
    params: { start, end, limit },
  });
  return res.data;
};
