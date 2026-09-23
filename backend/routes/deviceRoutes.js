const express = require("express");
const router = express.Router();
const { registerDevice, getDeviceStatus, updateDevice } = require("../controllers/deviceController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", protect, registerDevice);
router.get("/status/:deviceId", protect, getDeviceStatus);
router.put("/update/:deviceId", protect, updateDevice);

module.exports = router;
