import api from "../api/axiosConfig";

export const updateLocation = async (payload) => {
  const { data } = await api.post("/location/update", payload);
  return data;
};

export const getCurrentLocation = async (userId) => {
  const { data } = await api.get(`/location/current/${userId}`);
  return data;
};

export const getLocationHistory = async (userId, page = 1, limit = 20) => {
  const { data } = await api.get(`/location/history/${userId}`, {
    params: { page, limit },
  });
  return data;
};
