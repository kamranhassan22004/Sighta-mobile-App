
  const express = require("express");
  const router = express.Router();

  const {
    registerDevice,
    rotateDeviceKey,
    getDeviceStatus,
    updateDevice,
  } = require("../controllers/deviceController");

  const { protect } = require("../middleware/authMiddleware");
  const { getSharing, inviteGuardian, acceptInvitation, revokeGuardian } = require("../controllers/deviceSharingController");
  router.get("/sharing", protect, getSharing);
  router.post("/sharing/:deviceId/invite", protect, inviteGuardian);
  router.post("/sharing/:deviceId/accept", protect, acceptInvitation);
  router.delete("/sharing/:deviceId/guardians/:guardianId", protect, revokeGuardian);

  // Register Raspberry Pi device
  router.post("/register", protect, registerDevice);

  // Generate a new secret key for an existing device
  router.post("/rotate-key/:deviceId", protect, rotateDeviceKey);

  // Get device status
  router.get("/status/:deviceId", protect, getDeviceStatus);

  // Update device details
  router.put("/update/:deviceId", protect, updateDevice);

  module.exports = router;
