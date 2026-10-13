
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

import * as authService from "./authService";

export async function registerPushNotifications(projectId, sessionToken, isCurrent = () => true) {
  try {
    if (!Device.isDevice) {
      console.log(
        "Push notifications require a physical device."
      );
      return null;
    }

    // Android notification channel
    if (Platform.OS === "android") {
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
    }

    // Check permission
    const existingPermission =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingPermission.status;

    if (finalStatus !== "granted") {
      const requestedPermission =
        await Notifications.requestPermissionsAsync();

      finalStatus = requestedPermission.status;
    }

    if (finalStatus !== "granted") {
      console.log(
        "Notification permission not granted."
      );
      return null;
    }

    // Expo EAS project ID
    const resolvedProjectId =
      projectId ||
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId;

    if (!resolvedProjectId) {
      throw new Error(
        "Expo project ID is missing."
      );
    }

    // Generate Expo push token
    const tokenResponse =
      await Notifications.getExpoPushTokenAsync({
        projectId: resolvedProjectId,
      });

    const expoPushToken = tokenResponse.data;

    if (
      !expoPushToken ||
      !(
        expoPushToken.startsWith("ExponentPushToken[") ||
        expoPushToken.startsWith("ExpoPushToken[")
      )
    ) {
      throw new Error(
        "Valid Expo push token was not returned."
      );
    }

    if (!isCurrent()) return null;

    // Save token in guardian's MongoDB account
    await authService.updateProfile({
      fcmToken: expoPushToken,
    }, sessionToken);

    console.log(
      "SIGHTA push token saved successfully."
    );

    return expoPushToken;
  } catch (error) {
    console.log(
      "PUSH REGISTRATION FAILED:",
      error?.message || error
    );

    throw error;
  }
}
