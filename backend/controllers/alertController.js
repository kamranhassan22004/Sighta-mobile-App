const Alert = require("../models/Alert");

// @route  POST /api/alerts/create
// @desc   Create a new alert (SOS, low battery, device offline, etc.)
// @access Private
const createAlert = async (req, res) => {
  try {
    const { type, message, location, deviceId } = req.body;

    if (!type || !message) {
      return res.status(400).json({ message: "type and message are required" });
    }

    const alert = await Alert.create({
      user: req.user._id,
      device: deviceId || req.user.device,
      type,
      message,
      location,
    });

    return res.status(201).json(alert);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/alerts/:userId
// @desc   Get alert history for a user (paginated)
// @access Private
const getAlerts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const alerts = await Alert.find({ user: req.params.userId })
      .sort({ triggeredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json(alerts);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/alerts/read/:alertId
// @desc   Mark an alert as read
// @access Private
const markAlertRead = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.alertId,
      { isRead: true },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    return res.json(alert);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { createAlert, getAlerts, markAlertRead };
