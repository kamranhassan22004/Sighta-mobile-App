
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

module.exports = {
  sendPushNotification,
};
