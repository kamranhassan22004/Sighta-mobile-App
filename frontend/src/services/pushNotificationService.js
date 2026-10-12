
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as authService from "./authService";

export const registerPushNotifications = async (projectId) => {
  try {
    if (!projectId) {
      console.log("Expo project ID is not configured yet.");
      return null;
    }

    // Check existing notification permission
    const existingPermission =
      await Notifications.getPermissionsAsync();

    let status = existingPermission.status;

    // Ask permission only when necessary
    if (status !== "granted") {
      const requestedPermission =
        await Notifications.requestPermissionsAsync();

      status = requestedPermission.status;
    }

    if (status !== "granted") {
      console.log("Notification permission not granted.");
      return null;
    }

    // Get this device's Expo push token
    const tokenResponse =
      await Notifications.getExpoPushTokenAsync({
        projectId,
      });

    const pushToken = tokenResponse.data;

    // Save token against logged-in guardian account
    await authService.updateProfile({
      fcmToken: pushToken,
    });

    console.log("Guardian push token registered.");

    return pushToken;
  } catch (error) {
    console.log(
      "PUSH REGISTRATION ERROR:",
      error?.message || error
    );

    return null;
  }
};
