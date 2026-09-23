import api from "../api/axiosConfig";

export const createAlert = async (payload) => {
  const { data } = await api.post("/alerts/create", payload);
  return data;
};

export const getAlerts = async (userId, page = 1, limit = 20) => {
  const { data } = await api.get(`/alerts/${userId}`, { params: { page, limit } });
  return data;
};

export const markAlertRead = async (alertId) => {
  const { data } = await api.put(`/alerts/read/${alertId}`);
  return data;
};
