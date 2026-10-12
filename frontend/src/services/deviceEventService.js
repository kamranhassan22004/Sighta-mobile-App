
import api from "../api/axiosConfig";

export const getDeviceEvents = async (
  userId,
  page = 1,
  limit = 30
) => {
  const response = await api.get(
    `/device-events/${userId}`,
    {
      params: { page, limit },
    }
  );

  return response.data;
};
