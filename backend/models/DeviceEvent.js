
const mongoose = require("mongoose");

const deviceEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "device_connected",
        "device_disconnected",
        "device_reconnected",
        "battery_low",
        "battery_charging",
        "battery_normal",
      ],
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    batteryPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    occurredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

deviceEventSchema.index({
  user: 1,
  occurredAt: -1,
});

module.exports = mongoose.model(
  "DeviceEvent",
  deviceEventSchema
);
