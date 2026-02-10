import api from "./api";

const SUPPLIERS_PATH = "/suppliers";

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  return [];
};

export const fetchSuppliers = async () => {
  const res = await api.get(SUPPLIERS_PATH);
  return unwrapList(res.data);
};

export const createSupplier = async (payload) => {
  const res = await api.post(SUPPLIERS_PATH, payload);
  return res.data;
};

export const updateSupplier = async (id, payload) => {
  const res = await api.put(`${SUPPLIERS_PATH}/${id}`, payload);
  return res.data;
};

export const deleteSupplier = async (id) => {
  const res = await api.delete(`${SUPPLIERS_PATH}/${id}`);
  return res.data;
};
