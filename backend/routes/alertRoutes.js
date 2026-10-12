
const express = require("express");
const router = express.Router();

const {
  createAlert,
  getAlerts,
  markAlertRead,
} = require("../controllers/alertController");

const {
  deviceSOS,
} = require("../controllers/deviceSOSController");

const {
  protect,
} = require("../middleware/authMiddleware");

// Raspberry Pi SOS endpoint
// Authentication handled by x-device-key in controller
router.post("/device-sos", deviceSOS);

// Guardian creates an alert
router.post("/create", protect, createAlert);

// Guardian gets their alerts
router.get("/:userId", protect, getAlerts);

// Guardian marks an alert as read
router.put("/read/:alertId", protect, markAlertRead);

module.exports = router;
