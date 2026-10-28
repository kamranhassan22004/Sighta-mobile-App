import axios from "axios";
import AsyncStorage from "./sessionStorage";
import { sessionSnapshot } from "./sessionState";

// IMPORTANT: Update this to your backend's address.
// - Android emulator: use 10.0.2.2 instead of localhost
// - Physical device (Expo Go): use your computer's LAN IP, e.g. http://192.168.1.5:5000/api
// - Deployed backend: use its public URL
export const BASE_URL = "https://sighta-mobile-app.vercel.app/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach the JWT token to every request if we have one
api.interceptors.request.use(async (config) => {
  const snapshot = sessionSnapshot();
  config.sessionGeneration = snapshot.generation;
  const token = snapshot.initialized ? snapshot.token : await AsyncStorage.getItem("token");
  if (snapshot.generation !== sessionSnapshot().generation) {
    throw new axios.CanceledError("Account session changed");
  }
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralize error shape so screens don't each parse axios errors
api.interceptors.response.use(
  (response) => {
    if (response.config.sessionGeneration !== sessionSnapshot().generation) {
      return Promise.reject(new axios.CanceledError("Account session changed"));
    }
    return response;
  },
  (error) => {
    if (error.config?.sessionGeneration !== undefined &&
        error.config.sessionGeneration !== sessionSnapshot().generation) {
      return Promise.reject(new axios.CanceledError("Account session changed"));
    }
    const message =
      error.response?.data?.message || error.message || "Something went wrong";
    return Promise.reject({ ...error, message });
  }
);

export default api;
