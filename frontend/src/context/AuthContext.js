
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authService from "../services/authService";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session and fetch latest profile from MongoDB
  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        const token = await AsyncStorage.getItem("token");

        if (storedUser && token) {
          const cachedUser = JSON.parse(storedUser);

          if (active) {
            setUser(cachedUser);
          }

          try {
            // Get latest user details, including linked device
            const profile = await authService.getProfile();

            const updatedUser = {
              ...cachedUser,
              ...profile,
              token,
            };

            if (active) {
              await AsyncStorage.setItem(
                "user",
                JSON.stringify(updatedUser)
              );

              setUser(updatedUser);
            }
          } catch (error) {
            console.log(
              "PROFILE REFRESH ERROR:",
              error?.message || error
            );

            // Keep cached session if server is temporarily unavailable
          }
        }
      } catch (error) {
        console.warn("Failed to restore session", error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  // Login
  const login = async (email, password) => {
    const data = await authService.login(email, password);

    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("user", JSON.stringify(data));

    setUser(data);

    return data;
  };

  // Register
  const register = async (payload) => {
    const data = await authService.register(payload);

    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("user", JSON.stringify(data));

    setUser(data);

    return data;
  };

  // Logout
  const logout = async () => {
    await AsyncStorage.multiRemove(["token", "user"]);
    setUser(null);
  };

  // Fetch and persist latest profile from backend
  const refreshProfile = async () => {
    const profile = await authService.getProfile();

    const storedUser = await AsyncStorage.getItem("user");
    const token = await AsyncStorage.getItem("token");

    const cachedUser = storedUser
      ? JSON.parse(storedUser)
      : {};

    const updatedUser = {
      ...cachedUser,
      ...profile,
      token,
    };

    await AsyncStorage.setItem(
      "user",
      JSON.stringify(updatedUser)
    );

    setUser(updatedUser);

    return updatedUser;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
