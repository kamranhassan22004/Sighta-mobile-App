
const crypto = require("crypto");

const Device = require("../models/Device");
const User = require("../models/User");
const Alert = require("../models/Alert");
const LiveLocation = require("../models/LiveLocation");

const {
  sendPushNotification,
} = require("../services/pushNotificationService");

// POST /api/alerts/device-sos
// Secure SOS request from Raspberry Pi
const deviceSOS = async (req, res) => {
  try {
    const { deviceId } = req.body || {};
    const deviceKey = req.get("x-device-key");

    // Step 1: Validate device credentials
    if (
      typeof deviceId !== "string" ||
      !deviceId.trim() ||
      !deviceKey
    ) {
      return res.status(401).json({
        message: "Device authentication required",
      });
    }

    // Step 2: Find registered device
    const device = await Device.findOne({
      deviceId: deviceId.trim(),
    }).select("+apiKeyHash");

    if (!device || !device.apiKeyHash) {
      return res.status(401).json({
        message: "Invalid device credentials",
      });
    }

    // Step 3: Verify device API key
    const incomingHash = crypto
      .createHash("sha256")
      .update(deviceKey)
      .digest();

    const storedHash = Buffer.from(
      device.apiKeyHash,
      "hex"
    );

    if (
      storedHash.length !== incomingHash.length ||
      !crypto.timingSafeEqual(
        storedHash,
        incomingHash
      )
    ) {
      return res.status(401).json({
        message: "Invalid device credentials",
      });
    }

    // Step 4: Find guardian linked to device
    const guardian = await User.findById(device.owner);

    if (!guardian) {
      return res.status(404).json({
        message: "Guardian account not found",
      });
    }

    const dependentName =
      guardian.dependent?.name?.trim() ||
      "Your SIGHTA user";

    // Step 5: Fetch last-known GPS location
    // Match both guardian and device for safety
    const latestLocation = await LiveLocation.findOne({
      user: guardian._id,
      device: device._id,
    });

    let safeLocation = null;
    let locationRecordedAt = null;

    if (
      latestLocation &&
      typeof latestLocation.latitude === "number" &&
      Number.isFinite(latestLocation.latitude) &&
      latestLocation.latitude >= -90 &&
      latestLocation.latitude <= 90 &&
      typeof latestLocation.longitude === "number" &&
      Number.isFinite(latestLocation.longitude) &&
      latestLocation.longitude >= -180 &&
      latestLocation.longitude <= 180
    ) {
      safeLocation = {
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
        address: latestLocation.address || "",
      };

      locationRecordedAt =
        latestLocation.recordedAt || null;
    }

    // Step 6: Prepare SOS message
    const alertMessage = safeLocation
      ? `${dependentName} has triggered an SOS alert. Last-known GPS location is available.`
      : `${dependentName} has triggered an SOS alert. GPS location is currently unavailable.`;

    // Step 7: Save SOS alert in MongoDB
    const alert = await Alert.create({
      user: guardian._id,
      device: device._id,
      type: "sos",
      message: alertMessage,
      ...(safeLocation
        ? { location: safeLocation }
        : {}),
    });

    // Step 8: Prepare push notification data
    const notificationData = {
      type: "sos",
      alertId: String(alert._id),
      deviceId: device.deviceId,
    };

    if (safeLocation) {
      notificationData.latitude =
        safeLocation.latitude;

      notificationData.longitude =
        safeLocation.longitude;

      if (locationRecordedAt) {
        notificationData.locationRecordedAt =
          new Date(locationRecordedAt).toISOString();
      }
    }

    // Step 9: Send push notification
    let pushAccepted = false;

    if (
      guardian.notificationSettings?.sosAlerts !== false &&
      guardian.fcmToken
    ) {
      try {
        const result = await sendPushNotification({
          pushToken: guardian.fcmToken,
          title: "🚨 SIGHTA SOS ALERT",
          body: alertMessage,
          data: notificationData,
        });

        pushAccepted = result.success;
      } catch (pushError) {
        console.error(
          "SOS PUSH ERROR:",
          pushError.message
        );
      }
    }

    // Alert stays saved even if push fails
    return res.status(201).json({
      success: true,
      message: "SOS alert recorded",
      alertId: alert._id,
      locationAvailable: Boolean(safeLocation),
      locationRecordedAt,
      pushAccepted,
    });
  } catch (error) {
    console.error("DEVICE SOS ERROR:", error);

    return res.status(500).json({
      message: "Unable to process SOS alert",
    });
  }
};

module.exports = {
  deviceSOS,
};
