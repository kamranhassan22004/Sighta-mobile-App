const mongoose = require("mongoose");
const crypto = require("crypto");
const Device = require("../models/Device");
const User = require("../models/User");
const { sendPushNotification } = require("../services/pushNotificationService");

// Generate a secure key for Raspberry Pi
const generateDeviceKey = () => {
  const deviceKey = crypto.randomBytes(32).toString("hex");

  const apiKeyHash = crypto
    .createHash("sha256")
    .update(deviceKey)
    .digest("hex");

  return { deviceKey, apiKeyHash };
};

// Register SIGHTA glasses with guardian account
const registerDevice = async (req, res) => {
  try {
    const { deviceId, firmwareVersion } = req.body;

    if (
      typeof deviceId !== "string" ||
      !/^[a-zA-Z0-9_-]{3,64}$/.test(deviceId)
    ) {
      return res.status(400).json({
        message: "Valid deviceId is required (3-64 characters)",
      });
    }

    const existing = await Device.findOne({ deviceId });

    if (existing) {
      return res.status(409).json({
        message: "Device already registered. Use rotate-key if you own it.",
      });
    }

    const { deviceKey, apiKeyHash } = generateDeviceKey();

    const device = await Device.create({
      deviceId,
      owner: req.user._id,
      firmwareVersion: firmwareVersion || "1.0.0",
      apiKeyHash,
    });

    await User.findByIdAndUpdate(req.user._id, {
      device: device._id,
    });

    const result = device.toObject();
    delete result.apiKeyHash;

    return res.status(201).json({
      ...result,
      deviceKey,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Device already registered",
      });
    }

    return res.status(500).json({
      message: error.message,
    });
  }
};

// Generate a new key for an already registered device
const rotateDeviceKey = async (req, res) => {
  try {
    const device = await Device.findOne({
      deviceId: req.params.deviceId,
      owner: req.user._id,
    });

    if (!device) {
      return res.status(404).json({
        message: "Device not found for this guardian",
      });
    }

    const { deviceKey, apiKeyHash } = generateDeviceKey();

    device.apiKeyHash = apiKeyHash;
    await device.save();

    return res.json({
      deviceId: device.deviceId,
      deviceKey,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// Get device status

const getDeviceStatus = async (req, res) => {
  try {
    const identifier = req.params.deviceId;

    // Accept both MongoDB _id and custom deviceId
    const identifiers = [{ deviceId: identifier }];

    if (mongoose.isValidObjectId(identifier)) {
      identifiers.push({ _id: identifier });
    }

    const device = await Device.findOne({
      owner: req.user._id,
      $or: identifiers,
    }).select("-apiKeyHash");

    if (!device) {
      return res.status(404).json({
        message: "Device not found for this guardian",
      });
    }

    const result = device.toObject();

    // A device is online only if it has synced recently
    const lastSyncTime = result.lastSyncedAt
      ? new Date(result.lastSyncedAt).getTime()
      : NaN;

    const isRecent =
      Number.isFinite(lastSyncTime) &&
      Date.now() - lastSyncTime >= 0 &&
      Date.now() - lastSyncTime <= 15000;

    result.status =
      result.status === "online" && isRecent
        ? "online"
        : "offline";

    return res.json(result);
  } catch (error) {
    console.log("GET DEVICE STATUS ERROR:", error);

    return res.status(500).json({
      message: "Unable to fetch device status",
    });
  }
};


// Update device details from guardian account
const updateDevice = async (req, res) => {
  try {
    const {
      status,
      batteryPercentage,
      connectivity,
      firmwareVersion,
    } = req.body;

    const device = await Device.findOne({
      deviceId: req.params.deviceId,
      owner: req.user._id,
    });

    if (!device) {
      return res.status(404).json({
        message: "Device not found",
      });
    }

    // Validate battery reading
    if (
      batteryPercentage !== undefined &&
      (
        typeof batteryPercentage !== "number" ||
        !Number.isFinite(batteryPercentage) ||
        batteryPercentage < 0 ||
        batteryPercentage > 100
      )
    ) {
      return res.status(400).json({
        message: "Battery percentage must be between 0 and 100",
      });
    }

    const previousBattery = device.batteryPercentage;

    if (status) device.status = status;

    if (batteryPercentage !== undefined) {
      device.batteryPercentage = batteryPercentage;
    }

    if (connectivity) {
      device.connectivity = {
        ...device.connectivity.toObject(),
        ...connectivity,
      };
    }

    if (firmwareVersion) {
      device.firmwareVersion = firmwareVersion;
    }

    device.lastSyncedAt = new Date();

    const updated = await device.save();

    // Notify only when battery crosses below 20%
    const batteryJustBecameLow =
      batteryPercentage !== undefined &&
      batteryPercentage < 20 &&
      typeof previousBattery === "number" &&
      previousBattery >= 20;

    if (batteryJustBecameLow) {
      const guardian = await User.findById(device.owner);

      if (
        guardian &&
        guardian.notificationSettings?.lowBattery !== false &&
        guardian.fcmToken
      ) {
        try {
          await sendPushNotification({
            pushToken: guardian.fcmToken,
            title: "🔋 SIGHTA Low Battery",
            body: `Your SIGHTA device battery is at ${batteryPercentage}%. Please charge it.`,
            data: {
              type: "lowBattery",
              deviceId: device.deviceId,
            },
          });
        } catch (error) {
          console.error("LOW BATTERY PUSH ERROR:", error);
        }
      }
    }

    return res.json(updated);
  } catch (error) {
    console.error("UPDATE DEVICE ERROR:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  registerDevice,
  rotateDeviceKey,
  getDeviceStatus,
  updateDevice,
};
