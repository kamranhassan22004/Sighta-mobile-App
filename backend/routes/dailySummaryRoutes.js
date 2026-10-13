const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Device = require("../models/Device");
const Location = require("../models/Location");
const DeviceEvent = require("../models/DeviceEvent");
const Alert = require("../models/Alert");

const {
  sendPushNotification,
} = require("../services/pushNotificationService");

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
const getGPSCount = async (userId, deviceId, start, end) => {
  const dateField = [
    "recordedAt",
    "timestamp",
    "createdAt",
  ].find((field) => Location.schema.path(field));

  if (!dateField) return null;

  const query = {
    [dateField]: { $gte: start, $lte: end },
  };

  if (Location.schema.path("user")) {
    query.user = userId;
  } else if (Location.schema.path("device") && deviceId) {
    query.device = deviceId;
  } else {
    // Never count another guardian's locations
    return null;
  }

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
        const device = await Device.findOne({
          owner: guardian._id,
        });

        const gpsCount = await getGPSCount(
          guardian._id,
          device?._id,
          start,
          end
        );

        const deviceEvents = await DeviceEvent.countDocuments({
          user: guardian._id,
          occurredAt: { $gte: start, $lte: end },
        });

        const sosAlerts = await Alert.countDocuments({
          user: guardian._id,
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
          const result = await sendPushNotification({
            pushToken: guardian.fcmToken,
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

module.exports = router;