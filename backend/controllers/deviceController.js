const Device = require("../models/Device");
const User = require("../models/User");

// @route  POST /api/device/register
// @desc   Register a SIGHTA glasses device and link it to the logged-in guardian
// @access Private
const registerDevice = async (req, res) => {
  try {
    const { deviceId, firmwareVersion } = req.body;

    if (!deviceId) {
      return res.status(400).json({ message: "deviceId is required" });
    }

    const existing = await Device.findOne({ deviceId });
    if (existing) {
      return res.status(409).json({ message: "This device is already registered" });
    }

    const device = await Device.create({
      deviceId,
      owner: req.user._id,
      firmwareVersion: firmwareVersion || "1.0.0",
    });

    await User.findByIdAndUpdate(req.user._id, { device: device._id });

    return res.status(201).json(device);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/device/status/:deviceId
// @desc   Get current status of a device
// @access Private
const getDeviceStatus = async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    return res.json(device);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/device/update/:deviceId
// @desc   Update device status/battery/connectivity (called by device pipeline)
// @access Private
const updateDevice = async (req, res) => {
  try {
    const { status, batteryPercentage, connectivity, firmwareVersion } = req.body;

    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    if (status) device.status = status;
    if (batteryPercentage !== undefined) device.batteryPercentage = batteryPercentage;
    if (connectivity) device.connectivity = { ...device.connectivity.toObject(), ...connectivity };
    if (firmwareVersion) device.firmwareVersion = firmwareVersion;
    device.lastSyncedAt = new Date();

    const updated = await device.save();
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { registerDevice, getDeviceStatus, updateDevice };
