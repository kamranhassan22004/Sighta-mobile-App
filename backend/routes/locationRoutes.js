
const express = require("express");
const router = express.Router();

const {
  deviceUpdateLocation,
  updateLocation,
  getCurrentLocation,
  getLocationHistory,
} = require("../controllers/locationController");

const { protect } = require("../middleware/authMiddleware");

// Raspberry Pi GPS upload
// Authentication handled using x-device-key in controller
router.post("/device-update", deviceUpdateLocation);

// Existing guardian-authenticated location update
router.post("/update", protect, updateLocation);

// Guardian gets latest GPS location
router.get("/current/:userId", protect, getCurrentLocation);

// Guardian gets saved location history
router.get("/history/:userId", protect, getLocationHistory);

module.exports = router;
