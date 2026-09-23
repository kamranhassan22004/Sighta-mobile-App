import api from "../api/axiosConfig";

export const registerDevice = async (payload) => {
  const { data } = await api.post("/device/register", payload);
  return data;
};

export const getDeviceStatus = async (deviceId) => {
  const { data } = await api.get(`/device/status/${deviceId}`);
  return data;
};

export const updateDevice = async (deviceId, payload) => {
  const { data } = await api.put(`/device/update/${deviceId}`, payload);
  return data;
};
