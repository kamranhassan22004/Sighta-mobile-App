const express = require("express");
const router = express.Router();
const {
  updateLocation,
  getCurrentLocation,
  getLocationHistory,
} = require("../controllers/locationController");
const { protect } = require("../middleware/authMiddleware");

router.post("/update", protect, updateLocation);
router.get("/current/:userId", protect, getCurrentLocation);
router.get("/history/:userId", protect, getLocationHistory);

module.exports = router;
