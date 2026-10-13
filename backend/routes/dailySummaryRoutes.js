const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Device = require("../models/Device");
const Location = require("../models/Location");
const DeviceEvent = require("../models/DeviceEvent");
const Alert = require("../models/Alert");
const { protect } = require("../middleware/authMiddleware");
const {
  sendPushNotification,
} = require("../services/pushNotificationService");

const { getAuthorizedDevice, recordQuery } = require("../services/deviceAccessService");
const router = express.Router();

// Pakistan time: UTC + 5
const getPakistanDate = () => {
  return new Date(Date.now() + 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
};

const getDayRange = (date) => ({
  start: new Date(`${date}T00:00:00+05:00`),
  end: new Date(`${date}T23:59:59.999+05:00`),
});

// Prevent duplicate daily notifications
const dailySummaryLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    date: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

dailySummaryLogSchema.index(
  { user: 1, date: 1 },
  { unique: true }
);

const DailySummaryLog =
  mongoose.models.DailySummaryLog ||
  mongoose.model(
    "DailySummaryLog",
    dailySummaryLogSchema
  );

// Count real GPS records only when schema supports it
const getGPSCount = async (userId, device, start, end) => {
  const dateField = [
    "recordedAt",
    "timestamp",
    "createdAt",
  ].find((field) => Location.schema.path(field));

  if (!dateField) return null;

  const query = {
    [dateField]: { $gte: start, $lte: end },
  };

  if (!device) return 0;
  Object.assign(query, recordQuery(device));

  return Location.countDocuments(query);
};

// GET /api/daily-summary/run
// Called by trusted scheduler
router.get("/run", async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;

    if (
      !secret ||
      req.get("authorization") !== `Bearer ${secret}`
    ) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const date = getPakistanDate();
    const { start, end } = getDayRange(date);

    const guardians = await User.find({
      "notificationSettings.dailySummary": true,
      fcmToken: { $exists: true, $nin: [null, ""] },
    });

    let notificationsSent = 0;
    let failed = 0;
    let alreadySent = 0;

    for (const guardian of guardians) {
      try {
        const device = await getAuthorizedDevice(guardian);
        if (!device) continue;

        const gpsCount = await getGPSCount(
          guardian._id,
          device,
          start,
          end
        );

        const deviceEvents = await DeviceEvent.countDocuments({
          ...recordQuery(device),
          occurredAt: { $gte: start, $lte: end },
        });

        const sosAlerts = await Alert.countDocuments({
          ...recordQuery(device),
          type: "sos",
          triggeredAt: { $gte: start, $lte: end },
        });

        // Claim once per guardian per date
        try {
          await DailySummaryLog.create({
            user: guardian._id,
            date,
          });
        } catch (error) {
          if (error.code === 11000) {
            alreadySent++;
            continue;
          }

          throw error;
        }

        const gpsText =
          gpsCount === null
            ? "GPS history count unavailable"
            : `${gpsCount} GPS updates`;

        const message =
          `${gpsText}, ` +
          `${deviceEvents} device events, ` +
          `${sosAlerts} SOS alerts recorded today.`;

        let accepted = false;

        try {
          const authorized = await Device.exists({ _id: device._id,
            $or: [{ owner: guardian._id }, { guardians: guardian._id }] });
          const freshGuardian = await User.findById(guardian._id);
          if (!authorized || freshGuardian?.notificationSettings?.dailySummary !== true || !freshGuardian?.fcmToken) {
            await DailySummaryLog.deleteOne({ user: guardian._id, date });
            continue;
          }
          const result = await sendPushNotification({
            pushToken: freshGuardian.fcmToken,
            title: "📍 SIGHTA Daily Summary",
            body: message,
            data: {
              type: "dailySummary",
              date,
            },
          });

          accepted = result?.success === true;
        } catch (pushError) {
          console.error(
            "DAILY SUMMARY PUSH ERROR:",
            pushError.message
          );
        }

        if (accepted) {
          notificationsSent++;
        } else {
          failed++;

          // Retry on next run if push was not accepted
          await DailySummaryLog.deleteOne({
            user: guardian._id,
            date,
          });
        }
      } catch (error) {
        failed++;

        console.error(
          "DAILY SUMMARY USER ERROR:",
          error.message
        );
      }
    }

    return res.json({
      success: true,
      date,
      guardiansChecked: guardians.length,
      notificationsSent,
      alreadySent,
      failed,
    });
  } catch (error) {
    console.error("DAILY SUMMARY ERROR:", error);

    return res.status(500).json({
      message: "Unable to generate daily summary",
    });
  }
});
// GET /api/daily-summary/activity?date=2026-10-13
router.get("/activity", protect, async (req, res) => {
  try {
    const date = req.query.date || getPakistanDate();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(
        new Date(`${date}T00:00:00+05:00`).getTime()
      )
    ) {
      return res.status(400).json({
        message: "Invalid date",
      });
    }

    const { start, end } = getDayRange(date);
    const userId = req.user._id;

    const device = await getAuthorizedDevice(req.user);

    const gpsUpdates = await getGPSCount(
      userId,
      device,
      start,
      end
    );

    const dateField = [
      "recordedAt",
      "timestamp",
      "createdAt",
    ].find((field) => Location.schema.path(field));

    let lastLocation = null;

    if (dateField) {
      const locationQuery = {
        [dateField]: {
          $gte: start,
          $lte: end,
        },
      };

      let canQuery = false;

      if (device) {
        Object.assign(locationQuery, recordQuery(device));
        canQuery = true;
      }

      if (canQuery) {
        const location = await Location.findOne(
          locationQuery
        )
          .sort({ [dateField]: -1 })
          .lean();

        if (location) {
          lastLocation = {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address || "",
            recordedAt: location[dateField],
          };
        }
      }
    }

    const [deviceEvents, sosAlerts] = await Promise.all([
      DeviceEvent.countDocuments({
        ...recordQuery(device),
        occurredAt: { $gte: start, $lte: end },
      }),
      Alert.countDocuments({
        ...recordQuery(device),
        type: "sos",
        triggeredAt: { $gte: start, $lte: end },
      }),
    ]);

    return res.json({
      date,
      gpsUpdates,
      deviceEvents,
      sosAlerts,
      lastLocation,
    });
  } catch (error) {
    console.error("DAILY ACTIVITY ERROR:", error);

    return res.status(500).json({
      message: "Unable to fetch daily activity",
    });
  }
});

module.exports = router;
