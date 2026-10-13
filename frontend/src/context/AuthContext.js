
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authService from "../services/authService";

export const AuthContext = createContext(null);

const EXPO_PROJECT_ID =
  "08dc0c31-0885-4f4b-a153-bcaf16f4612f";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(
    "Starting SIGHTA Guardian..."
  );

  const lastPushAttemptToken = useRef(null);
  const pushRegistrationPromise = useRef(null);
  const loggingOutRef = useRef(false);

  // Restore saved login session
  useEffect(() => {
    let active = true;
    let firstFrame = null;
    let secondFrame = null;

    const updateProgress = (value, message) => {
      if (!active) return;

      setLoadingProgress(value);
      setLoadingMessage(message);
    };

    const bootstrap = async () => {
      try {
        updateProgress(
          5,
          "Checking saved session..."
        );

        const [storedUser, token] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("token"),
        ]);

        updateProgress(
          35,
          "Session check complete"
        );

        if (storedUser && token) {
          const cachedUser = JSON.parse(storedUser);

          if (active) {
            setUser({
              ...cachedUser,
              token,
            });
          }

          updateProgress(
            55,
            "Loading your account..."
          );

          try {
            const profile =
              await authService.getProfile();

            updateProgress(
              85,
              "Preparing your dashboard..."
            );

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

              if (active) {
                setUser(updatedUser);
              }
            }

            updateProgress(
              95,
              "Account ready"
            );
          } catch (error) {
            console.log(
              "PROFILE REFRESH ERROR:",
              error?.message || error
            );

            updateProgress(
              95,
              "Using your saved account..."
            );
          }
        } else {
          updateProgress(
            95,
            "Preparing login screen..."
          );
        }
      } catch (error) {
        console.warn(
          "Failed to restore session:",
          error?.message || error
        );

        updateProgress(
          95,
          "Preparing application..."
        );
      } finally {
        if (active) {
          updateProgress(
            100,
            "SIGHTA Guardian is ready!"
          );

          firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
              if (active) {
                setIsLoading(false);
              }
            });
          });
        }
      }
    };

    bootstrap();

    return () => {
      active = false;

      if (firstFrame !== null) {
        cancelAnimationFrame(firstFrame);
      }

      if (secondFrame !== null) {
        cancelAnimationFrame(secondFrame);
      }
    };
  }, []);

  // Register push notifications after login
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

    const {
      registerPushNotifications,
    } = require("../services/pushNotificationService");

    pushRegistrationPromise.current =
      registerPushNotifications(
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
    const data = await authService.login(
      email,
      password
    );

    await AsyncStorage.setItem(
      "token",
      data.token
    );

    await AsyncStorage.setItem(
      "user",
      JSON.stringify(data)
    );

    setUser(data);

    return data;
  };

  // Register new account
  const register = async (payload) => {
    const data = await authService.register(
      payload
    );

    await AsyncStorage.setItem(
      "token",
      data.token
    );

    await AsyncStorage.setItem(
      "user",
      JSON.stringify(data)
    );

    setUser(data);

    return data;
  };

  // Logout and clear push token
  const logout = async () => {
    loggingOutRef.current = true;

    try {
      if (pushRegistrationPromise.current) {
        await pushRegistrationPromise.current;
      }

      try {
        await authService.updateProfile({
          fcmToken: null,
        });

        console.log(
          "Push token removal requested."
        );
      } catch (error) {
        console.log(
          "PUSH TOKEN REMOVAL ERROR:",
          error?.message || error
        );
      }
    } finally {
      await AsyncStorage.multiRemove([
        "token",
        "user",
      ]);

      lastPushAttemptToken.current = null;
      pushRegistrationPromise.current = null;

      setUser(null);
      loggingOutRef.current = false;
    }
  };

  // Refresh user profile
  const refreshProfile = async () => {
    const profile =
      await authService.getProfile();

    const storedUser =
      await AsyncStorage.getItem("user");

    const token =
      await AsyncStorage.getItem("token");

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
        loadingProgress,
        loadingMessage,
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

export const useAuth = () =>
  useContext(AuthContext);
