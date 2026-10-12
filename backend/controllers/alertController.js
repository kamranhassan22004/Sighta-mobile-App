
const mongoose = require("mongoose");
const Alert = require("../models/Alert");

// Guardian-created alerts.
// Automatic device alerts will be created by trusted backend logic.
const CLIENT_ALERT_TYPES = ["sos", "info"];

// POST /api/alerts/create
const createAlert = async (req, res) => {
  try {
    const { type, message, location } = req.body;

    if (!CLIENT_ALERT_TYPES.includes(type)) {
      return res.status(400).json({
        message: "Invalid guardian alert type",
      });
    }

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 500
    ) {
      return res.status(400).json({
        message: "A valid alert message is required",
      });
    }

    let safeLocation;

    if (location != null) {
      const { latitude, longitude, address } = location;

      if (
        typeof latitude !== "number" ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        typeof longitude !== "number" ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          message: "Invalid alert location",
        });
      }

      safeLocation = {
        latitude,
        longitude,
        address:
          typeof address === "string"
            ? address.slice(0, 300)
            : "",
      };
    }

    const alert = await Alert.create({
      user: req.user._id,
      device: req.user.device?._id || req.user.device || undefined,
      type,
      message: message.trim(),
      ...(safeLocation ? { location: safeLocation } : {}),
    });

    return res.status(201).json(alert);
  } catch (error) {
    console.error("CREATE ALERT ERROR:", error);
    return res.status(500).json({
      message: "Unable to create alert",
    });
  }
};

// GET /api/alerts/:userId
const getAlerts = async (req, res) => {
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

    const alerts = await Alert.find({
      user: req.user._id,
    })
      .sort({ triggeredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json(alerts);
  } catch (error) {
    console.error("GET ALERTS ERROR:", error);
    return res.status(500).json({
      message: "Unable to fetch alerts",
    });
  }
};

// PUT /api/alerts/read/:alertId
const markAlertRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.alertId)) {
      return res.status(400).json({
        message: "Invalid alert ID",
      });
    }

    const alert = await Alert.findOneAndUpdate(
      {
        _id: req.params.alertId,
        user: req.user._id,
      },
      {
        $set: { isRead: true },
      },
      {
        new: true,
      }
    );

    if (!alert) {
      return res.status(404).json({
        message: "Alert not found",
      });
    }

    return res.json(alert);
  } catch (error) {
    console.error("MARK ALERT READ ERROR:", error);
    return res.status(500).json({
      message: "Unable to update alert",
    });
  }
};

module.exports = {
  createAlert,
  getAlerts,
  markAlertRead,
};
