const express = require("express");
const mongoose = require("mongoose");

const Device = require("../models/Device");
const User = require("../models/User");

const {
  sendPushNotification,
} = require("../services/pushNotificationService");

const { getGuardians } = require("../services/deviceAccessService");
const router = express.Router();

// Prevent duplicate alerts for the same disconnection
const offlineAlertSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    lastSync: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

offlineAlertSchema.index(
  { device: 1, lastSync: 1 },
  { unique: true }
);

const OfflineAlert =
  mongoose.models.OfflineAlert ||
  mongoose.model("OfflineAlert", offlineAlertSchema);

// Separate collection avoids changing the legacy owner-only unique index.
const deliverySchema = new mongoose.Schema({
  device: { type: mongoose.Schema.Types.ObjectId, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  lastSync: { type: Date, required: true },
}, { timestamps: true });
deliverySchema.index({ device: 1, user: 1, lastSync: 1 }, { unique: true });
const OfflineGuardianDelivery = mongoose.models.OfflineGuardianDelivery ||
  mongoose.model("OfflineGuardianDelivery", deliverySchema);

// GET /api/device-monitor/offline
router.get("/offline", async (req, res) => {
  try {
    // Only trusted scheduler can run this
    const secret = process.env.CRON_SECRET;

    if (
      !secret ||
      req.get("authorization") !== `Bearer ${secret}`
    ) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const now = Date.now();

    // Give device 2 minutes before declaring it offline
    const offlineBefore = new Date(now - 2 * 60 * 1000);

    // Only consider devices active within the past 24 hours
    const activeSince = new Date(
      now - 24 * 60 * 60 * 1000
    );

    const devices = await Device.find({
      lastSyncedAt: {
        $gte: activeSince,
        $lte: offlineBefore,
      },
    });

    let notificationsSent = 0;

    for (const device of devices) {
      try {
        const guardians = await getGuardians(device);
        for (const candidate of guardians) {
          let claim;
          try {
            const authorized = await Device.exists({ _id: device._id,
              $or: [{ owner: candidate._id }, { guardians: candidate._id }] });
            const guardian = await User.findById(candidate._id);
            if (!authorized || !guardian || guardian.notificationSettings?.deviceOffline === false || !guardian.fcmToken) continue;
            // An existing owner delivery remains deduplicated after upgrade.
            if (String(guardian._id) === String(device.owner) && await OfflineAlert.exists({
              device: device._id, lastSync: device.lastSyncedAt,
            })) continue;
            claim = { device: device._id, user: guardian._id, lastSync: device.lastSyncedAt };
            try { await OfflineGuardianDelivery.create(claim); }
            catch (error) { if (error.code === 11000) continue; throw error; }
            const result = await sendPushNotification({
              pushToken: guardian.fcmToken,
              title: "\u26A0\uFE0F SIGHTA Device Offline",
              body: "Your SIGHTA device has stopped syncing. Please check its connection.",
              data: { type: "deviceOffline", deviceId: device.deviceId },
            });
            if (result?.success) notificationsSent++;
            else await OfflineGuardianDelivery.deleteOne(claim);
          } catch (error) {
            if (claim) await OfflineGuardianDelivery.deleteOne(claim);
            console.error("OFFLINE GUARDIAN DELIVERY FAILED");
          }
        }

      } catch (error) {
        console.error(
          "OFFLINE NOTIFICATION ERROR:",
          error.message
        );
      }
    }

    return res.json({
      success: true,
      devicesChecked: devices.length,
      notificationsSent,
    });
  } catch (error) {
    console.error("DEVICE MONITOR ERROR:", error);

    return res.status(500).json({
      message: "Unable to check offline devices",
    });
  }
});

module.exports = router;
