import api from "./api";

const STOCK_INS_PATH = "/stock-ins";

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  return [];
};

export const fetchStockIns = async () => {
  const res = await api.get(STOCK_INS_PATH);
  return unwrapList(res.data);
};

export const createStockIn = async (payload) => {
  const res = await api.post(STOCK_INS_PATH, payload);
  return res.data;
};
