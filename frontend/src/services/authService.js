import api from "../api/axiosConfig";

export const googleLogin = async (idToken) => {
  const { data } = await api.post("/auth/google", { idToken });
  return data;
};

export const login = async (email, password) => {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
};

export const register = async (payload) => {
  const { data } = await api.post("/auth/register", payload);
  return data;
};

export const getProfile = async (token) => {
  const { data } = await api.get("/auth/profile", token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  return data;
};

export const updateProfile = async (payload, token) => {
  const { data } = await api.put("/auth/profile", payload, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  return data;
};

export const forgotPassword = async (email) => {
  const { data } = await api.post("/auth/forgot-password", { email });
  return data;
};

export const verifyResetCode = async (email, code) => {
  const { data } = await api.post("/auth/verify-reset-code", { email, code });
  return data;
};

export const resetPassword = async (resetToken, newPassword) => {
  const { data } = await api.post("/auth/reset-password", { resetToken, newPassword });
  return data;
};
