
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Check whether the saved token is an Expo push token
const isValidExpoPushToken = (token) => {
  return (
    typeof token === "string" &&
    /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(token)
  );
};

// Send a push notification to a guardian's phone
const sendPushNotification = async ({
  pushToken,
  title,
  body,
  data = {},
}) => {
  if (!isValidExpoPushToken(pushToken)) {
    return {
      success: false,
      reason: "No valid Expo push token",
    };
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: pushToken,
      title,
      body,
      data,
      sound: "default",
      priority: "high",
      channelId: "default",
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `Expo push request failed: HTTP ${response.status}`
    );
  }

  const result = await response.json();
  const ticket = result?.data;

  if (ticket?.status !== "ok") {
    throw new Error(
      ticket?.message || "Expo rejected the push notification"
    );
  }

  return {
    success: true,
    ticketId: ticket.id,
  };
};

// Re-read membership and preference immediately before each delivery.
const notifyDeviceGuardians = async (device, preference, notification) => {
  const { getGuardians } = require("./deviceAccessService");
  const Device = require("../models/Device");
  const User = require("../models/User");
  const currentDevice = await Device.findById(device._id);
  if (!currentDevice) return 0;
  const guardians = await getGuardians(currentDevice);
  const tokens = new Set();
  let accepted = 0;
  for (const candidate of guardians) {
    try {
      const authorized = await Device.exists({ _id: device._id,
        $or: [{ owner: candidate._id }, { guardians: candidate._id }] });
      if (!authorized) continue;
      const guardian = await User.findById(candidate._id);
      if (!guardian || guardian.notificationSettings?.[preference] === false ||
          !isValidExpoPushToken(guardian.fcmToken) || tokens.has(guardian.fcmToken)) continue;
      tokens.add(guardian.fcmToken);
      const payload = typeof notification === "function" ? notification(guardian) : notification;
      const result = await sendPushNotification({ ...payload, pushToken: guardian.fcmToken });
      if (result.success) accepted++;
    } catch (error) {
      console.error("DEVICE PUSH DELIVERY FAILED");
    }
  }
  return accepted;
};

module.exports = { sendPushNotification, notifyDeviceGuardians };
