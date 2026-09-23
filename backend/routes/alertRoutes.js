const express = require("express");
const router = express.Router();
const { createAlert, getAlerts, markAlertRead } = require("../controllers/alertController");
const { protect } = require("../middleware/authMiddleware");

router.post("/create", protect, createAlert);
router.get("/:userId", protect, getAlerts);
router.put("/read/:alertId", protect, markAlertRead);

module.exports = router;
