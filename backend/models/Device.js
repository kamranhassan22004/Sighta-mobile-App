
const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Secure authentication for Raspberry Pi
    apiKeyHash: {
      type: String,
      select: false,
    },

    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },

    batteryPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },

    connectivity: {
      wifi: {
        type: Boolean,
        default: false,
      },
      bluetooth: {
        type: Boolean,
        default: false,
      },
    },

    firmwareVersion: {
      type: String,
      default: "1.0.0",
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", deviceSchema);
