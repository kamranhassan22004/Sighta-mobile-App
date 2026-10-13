
import React, {
  useEffect,
  useCallback,
  useRef,
} from "react";

import { Platform, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";

import {
  AuthProvider,
  useAuth,
} from "./src/context/AuthContext";

import AuthNavigator from "./src/navigation/AuthNavigator";
import AppNavigator from "./src/navigation/AppNavigator";
import LaunchScreen from "./src/components/LaunchScreen";

// Push notifications enabled
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Keep native splash visible until React layout is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const {
    user,
    isLoading,
    loadingProgress,
    loadingMessage,
  } = useAuth();

  if (isLoading) {
    return (
      <LaunchScreen
        progress={loadingProgress}
        message={loadingMessage}
      />
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  const splashHidden = useRef(false);

  const onAppLayout = useCallback(() => {
    if (splashHidden.current) return;

    splashHidden.current = true;

    SplashScreen.hideAsync().catch((error) => {
      console.log(
        "Splash hide error:",
        error?.message || error
      );
    });
  }, []);

  useEffect(() => {
    const configureNotifications = async () => {
      if (Platform.OS === "android") {
        try {
          await Notifications.setNotificationChannelAsync(
            "default",
            {
              name: "SIGHTA Guardian Alerts",
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              enableVibrate: true,
              sound: "default",
            }
          );

          console.log(
            "SIGHTA notification channel configured."
          );
        } catch (error) {
          console.log(
            "Notification channel setup error:",
            error?.message || error
          );
        }
      }
    };

    configureNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />

        <View
          style={{ flex: 1 }}
          onLayout={onAppLayout}
        >
          <Root />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
