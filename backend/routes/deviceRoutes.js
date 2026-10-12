
  const express = require("express");
  const router = express.Router();

  const {
    registerDevice,
    rotateDeviceKey,
    getDeviceStatus,
    updateDevice,
  } = require("../controllers/deviceController");

  const { protect } = require("../middleware/authMiddleware");

  // Register Raspberry Pi device
  router.post("/register", protect, registerDevice);

  // Generate a new secret key for an existing device
  router.post("/rotate-key/:deviceId", protect, rotateDeviceKey);

  // Get device status
  router.get("/status/:deviceId", protect, getDeviceStatus);

  // Update device details
  router.put("/update/:deviceId", protect, updateDevice);

  module.exports = router;
