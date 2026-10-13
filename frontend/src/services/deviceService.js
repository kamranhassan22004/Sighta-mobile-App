import api from "../api/axiosConfig";

export const getDeviceSharing = async () => (await api.get("/device/sharing")).data;
export const inviteGuardian = async (deviceId, email) =>
  (await api.post(`/device/sharing/${encodeURIComponent(deviceId)}/invite`, { email })).data;
export const acceptDeviceInvitation = async (deviceId) =>
  (await api.post(`/device/sharing/${encodeURIComponent(deviceId)}/accept`)).data;
export const revokeGuardian = async (deviceId, guardianId) =>
  (await api.delete(`/device/sharing/${encodeURIComponent(deviceId)}/guardians/${guardianId}`)).data;

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
