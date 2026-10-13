
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authService from "../services/authService";
import { changeSession, setSessionToken } from "../api/sessionState";

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
  const sessionVersion = useRef(0);
  const currentUser = useRef(null);
  const storageQueue = useRef(Promise.resolve());
  const logoutPromise = useRef(null);
  const refreshSequence = useRef(0);

  // Serialize storage writes so a late profile cannot repopulate a cleared session.
  const store = useCallback((version, operation) => {
    const pending = storageQueue.current.catch(() => {}).then(async () => {
      if (sessionVersion.current !== version) return;
      await operation();
    });
    storageQueue.current = pending;
    return pending;
  }, []);

  const publish = useCallback((value) => {
    currentUser.current = value;
    setSessionToken(value?.token || null);
    setUser(value);
  }, []);

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
      const version = sessionVersion.current;
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


          updateProgress(
            55,
            "Loading your account..."
          );

          try {
            const profile =
              await authService.getProfile(token);

            updateProgress(
              85,
              "Preparing your dashboard..."
            );

            const updatedUser = {
              ...profile,
              token,
            };

            if (active && version === sessionVersion.current) {
              await store(version, () => AsyncStorage.setItem(
                "user",
                JSON.stringify(updatedUser)
              ));

              if (active && version === sessionVersion.current) {
                publish(updatedUser);
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

            if (active && version === sessionVersion.current) {
              if (error?.response?.status === 401 || error?.response?.status === 404 || cachedUser.token !== token) {
                await store(version, () => AsyncStorage.multiRemove(["token", "user"]));
                publish(null);
              } else {
                // Cached identity may be used offline; cached device availability is never trusted.
                publish({ ...cachedUser, token, device: cachedUser.device && typeof cachedUser.device === "object"
                  ? { ...cachedUser.device, status: "offline", connectivity: { ...cachedUser.device.connectivity, wifi: false } }
                  : cachedUser.device || null });
              }
            }
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
        EXPO_PROJECT_ID,
        token,
        () => currentUser.current?.token === token && !loggingOutRef.current
      ).catch((error) => {
        console.log(
          "PUSH REGISTRATION ERROR:",
          error?.message || error
        );
      });
  }, [user?.token]);

  const authenticate = async (request) => {
    if (logoutPromise.current) await logoutPromise.current;
    const version = ++sessionVersion.current;
    changeSession();
    publish(null);
    await store(version, () => AsyncStorage.multiRemove(["token", "user"]));
    const data = await request();
    const profile = await authService.getProfile(data.token);
    if (sessionVersion.current !== version) throw new Error("Account session changed");
    if (String(profile._id) !== String(data._id)) throw new Error("Account profile mismatch");
    const updatedUser = { ...profile, token: data.token };
    await store(version, () => AsyncStorage.multiSet([
      ["token", data.token], ["user", JSON.stringify(updatedUser)],
    ]));
    if (sessionVersion.current !== version) throw new Error("Account session changed");
    publish(updatedUser);
    return updatedUser;
  };

  const login = (email, password) => authenticate(() => authService.login(email, password));
  const register = (payload) => authenticate(() => authService.register(payload));

  const logout = useCallback(() => {
    if (logoutPromise.current) return logoutPromise.current;
    const token = currentUser.current?.token;
    const version = ++sessionVersion.current;
    loggingOutRef.current = true;
    changeSession();
    publish(null);
    const cleanup = (async () => {
      try {
        await store(version, () => AsyncStorage.multiRemove(["token", "user"]));
        if (pushRegistrationPromise.current) await pushRegistrationPromise.current;
        if (token) {
          try { await authService.updateProfile({ fcmToken: null }, token); }
          catch (error) { console.log("Push token cleanup could not complete."); }
        }
      } finally {
        lastPushAttemptToken.current = null;
        pushRegistrationPromise.current = null;
        loggingOutRef.current = false;
        logoutPromise.current = null;
      }
    })();
    logoutPromise.current = cleanup;
    return cleanup;
  }, [publish, store]);

  const refreshProfile = useCallback(async () => {
    const account = currentUser.current;
    const version = sessionVersion.current;
    if (!account?.token || loggingOutRef.current) return null;
    const sequence = ++refreshSequence.current;
    const pending = (async () => {
      let profile;
      try { profile = await authService.getProfile(account.token); }
      catch (error) {
        if (version !== sessionVersion.current || sequence !== refreshSequence.current) return null;
        throw error;
      }
      if (version !== sessionVersion.current || sequence !== refreshSequence.current) return null;
      if (String(profile._id) !== String(account._id)) throw new Error("Account profile mismatch");
      const updatedUser = { ...profile, token: account.token };
      await store(version, () => AsyncStorage.setItem("user", JSON.stringify(updatedUser)));
      if (version !== sessionVersion.current || sequence !== refreshSequence.current) return null;
      if (JSON.stringify(currentUser.current) !== JSON.stringify(updatedUser)) publish(updatedUser);
      return updatedUser;
    })();
    return pending;
  }, [publish, store]);

  // Existing device polling cadence also refreshes authorization while the app is open.
  useEffect(() => {
    if (!user?.token) return;
    const timer = setInterval(() => {
      refreshProfile().catch(error => {
        if (error?.response?.status === 401) logout();
      });
    }, 15000);
    return () => clearInterval(timer);
  }, [user?.token, refreshProfile, logout]);

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
