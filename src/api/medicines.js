import api from "./api";

const MEDICINES_PATH = "/medicines";

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  return [];
};

export const fetchMedicines = async () => {
  const res = await api.get(MEDICINES_PATH);
  return unwrapList(res.data);
};

export const createMedicine = async (payload) => {
  const res = await api.post(MEDICINES_PATH, payload);
  return res.data;
};

export const updateMedicine = async (id, payload) => {
  const res = await api.put(`${MEDICINES_PATH}/${id}`, payload);
  return res.data;
};

export const updateMedicineByBatch = async (batchNumber, payload) => {
  const res = await api.put(`${MEDICINES_PATH}/batch/${batchNumber}`, payload);
  return res.data;
};

export const deleteMedicine = async (id) => {
  const res = await api.delete(`${MEDICINES_PATH}/${id}`);
  return res.data;
};

export const fetchLowStockThreshold = async () => {
  const res = await api.get(`${MEDICINES_PATH}/threshold`);
  return res.data;
};
