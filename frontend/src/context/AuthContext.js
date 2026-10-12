
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authService from "../services/authService";
import { registerPushNotifications } from "../services/pushNotificationService";

export const AuthContext = createContext(null);

// SIGHTA Guardian Expo Project ID
const EXPO_PROJECT_ID = "08dc0c31-0885-4f4b-a153-bcaf16f4612f";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Avoid repeated push registration during profile refreshes
  const lastPushAttemptToken = useRef(null);
  const pushRegistrationPromise = useRef(null);
  const loggingOutRef = useRef(false);
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
            setUser({
              ...cachedUser,
              token,
            });
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

  // Register push notifications once per authenticated session
  // Register push notifications once per authenticated session
  useEffect(() => {
    const token = user?.token;

    if (!token || loggingOutRef.current) {
      if (!token) {
        lastPushAttemptToken.current = null;
      }
      return;
    }

    if (lastPushAttemptToken.current === token) {
      return;
    }

    lastPushAttemptToken.current = token;

    pushRegistrationPromise.current = registerPushNotifications(
      EXPO_PROJECT_ID
    ).catch((error) => {
      console.log(
        "PUSH REGISTRATION ERROR:",
        error?.message || error
      );
    });
  }, [user?.token]);
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
  // Logout and unregister push notifications
  const logout = async () => {
    loggingOutRef.current = true;

    try {
      // Wait for any ongoing push token registration
      if (pushRegistrationPromise.current) {
        await pushRegistrationPromise.current;
      }

      // Remove the saved push token from MongoDB
      try {
        await authService.updateProfile({
          fcmToken: null,
        });

        console.log("Push token removed from guardian account.");
      } catch (error) {
        console.log(
          "PUSH TOKEN REMOVAL ERROR:",
          error?.message || error
        );
      }
    } finally {
      // Always clear the local login session
      await AsyncStorage.multiRemove(["token", "user"]);

      lastPushAttemptToken.current = null;
      pushRegistrationPromise.current = null;

      setUser(null);
      loggingOutRef.current = false;
    }
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
