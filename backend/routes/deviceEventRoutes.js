
const express = require("express");
const router = express.Router();

const {
  getDeviceEvents,
} = require("../controllers/deviceEventController");

const {
  protect,
} = require("../middleware/authMiddleware");

// GET /api/device-events/:userId
router.get("/:userId", protect, getDeviceEvents);

module.exports = router;
