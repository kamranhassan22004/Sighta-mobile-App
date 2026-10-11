
const crypto = require("crypto");

const Location = require("../models/Location");
const LiveLocation = require("../models/LiveLocation");
const Device = require("../models/Device");

// Validate GPS coordinates
const isValidCoordinates = (latitude, longitude) => {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
};

// Save the latest GPS reading
const saveGPSLocation = async (
  device,
  latitude,
  longitude,
  address = ""
) => {
  const now = new Date();

  // Update one live-location document per guardian
  const liveLocation = await LiveLocation.findOneAndUpdate(
    { user: device.owner },
    {
      $set: {
        user: device.owner,
        device: device._id,
        latitude,
        longitude,
        address,
        recordedAt: now,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );

  // Save a history point approximately every 60 seconds
  const lastHistory = await Location.findOne({
    user: device.owner,
  }).sort({ recordedAt: -1 });

  if (
    !lastHistory ||
    now.getTime() -
      new Date(lastHistory.recordedAt).getTime() >=
      60000
  ) {
    await Location.create({
      user: device.owner,
      device: device._id,
      latitude,
      longitude,
      address,
      recordedAt: now,
    });
  }

  // Mark Raspberry Pi device as online
  device.status = "online";
  device.lastSyncedAt = now;
  await device.save();

  return liveLocation;
};

// Raspberry Pi sends GPS location using device key
// POST /api/location/device-update
const deviceUpdateLocation = async (req, res) => {
  try {
    const { deviceId, latitude, longitude } = req.body;

    const deviceKey = req.get("x-device-key");

    if (
      typeof deviceId !== "string" ||
      !deviceKey
    ) {
      return res.status(401).json({
        message: "Device authentication required",
      });
    }

    const device = await Device.findOne({
      deviceId,
    }).select("+apiKeyHash");

    if (!device || !device.apiKeyHash) {
      return res.status(401).json({
        message: "Invalid device credentials",
      });
    }

    // Hash the incoming key
    const incomingHash = crypto
      .createHash("sha256")
      .update(deviceKey)
      .digest();

    const storedHash = Buffer.from(
      device.apiKeyHash,
      "hex"
    );

    // Compare keys securely
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

    if (!isValidCoordinates(latitude, longitude)) {
      return res.status(400).json({
        message: "Valid GPS coordinates required",
      });
    }

    const location = await saveGPSLocation(
      device,
      latitude,
      longitude
    );

    return res.status(200).json({
      success: true,
      message: "GPS location updated",
      latitude: location.latitude,
      longitude: location.longitude,
      recordedAt: location.recordedAt,
    });
  } catch (error) {
    console.error("GPS update error:", error);

    return res.status(500).json({
      message: "Unable to update GPS location",
    });
  }
};

// Existing guardian-authenticated location endpoint
// POST /api/location/update
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;

    if (!isValidCoordinates(latitude, longitude)) {
      return res.status(400).json({
        message: "Valid GPS coordinates required",
      });
    }

    const device = await Device.findOne({
      owner: req.user._id,
      _id: req.user.device,
    });

    if (!device) {
      return res.status(404).json({
        message: "Please register a device first",
      });
    }

    const location = await saveGPSLocation(
      device,
      latitude,
      longitude,
      address || ""
    );

    return res.status(201).json(location);
  } catch (error) {
    console.error("Location update error:", error);

    return res.status(500).json({
      message: "Unable to save location",
    });
  }
};

// Guardian reads their latest location
// GET /api/location/current/:userId
const getCurrentLocation = async (req, res) => {
  try {
    if (String(req.user._id) !== req.params.userId) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const liveLocation = await LiveLocation.findOne({
      user: req.user._id,
    });

    if (liveLocation) {
      return res.json(liveLocation);
    }

    // Fallback to previously saved location
    const lastLocation = await Location.findOne({
      user: req.user._id,
    }).sort({ recordedAt: -1 });

    if (!lastLocation) {
      return res.status(404).json({
        message: "No GPS location available yet",
      });
    }

    return res.json(lastLocation);
  } catch (error) {
    return res.status(500).json({
      message: "Unable to fetch current location",
    });
  }
};

// Guardian reads saved location history
// GET /api/location/history/:userId
const getLocationHistory = async (req, res) => {
  try {
    if (String(req.user._id) !== req.params.userId) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const page = Math.max(
      1,
      parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const history = await Location.find({
      user: req.user._id,
    })
      .sort({ recordedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json(history);
  } catch (error) {
    return res.status(500).json({
      message: "Unable to fetch location history",
    });
  }
};

module.exports = {
  deviceUpdateLocation,
  updateLocation,
  getCurrentLocation,
  getLocationHistory,
};
