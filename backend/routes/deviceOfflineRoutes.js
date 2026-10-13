const express = require("express");
const mongoose = require("mongoose");

const Device = require("../models/Device");
const User = require("../models/User");

const {
  sendPushNotification,
} = require("../services/pushNotificationService");

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
        const guardian = await User.findById(device.owner);

        if (
          !guardian ||
          guardian.notificationSettings?.deviceOffline === false ||
          !guardian.fcmToken
        ) {
          continue;
        }

        // Claim this disconnection only once
        try {
          await OfflineAlert.create({
            device: device._id,
            lastSync: device.lastSyncedAt,
          });
        } catch (error) {
          if (error.code === 11000) {
            continue;
          }

          throw error;
        }

        const result = await sendPushNotification({
          pushToken: guardian.fcmToken,
          title: "⚠️ SIGHTA Device Offline",
          body:
            "Your SIGHTA device has stopped syncing. Please check its connection.",
          data: {
            type: "deviceOffline",
            deviceId: device.deviceId,
          },
        });

        if (result?.success) {
          notificationsSent++;
        } else {
          // Allow retry if push was not accepted
          await OfflineAlert.deleteOne({
            device: device._id,
            lastSync: device.lastSyncedAt,
          });
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