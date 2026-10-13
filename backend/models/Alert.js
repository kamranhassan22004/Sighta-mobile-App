const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },

    type: {
      type: String,
      enum: ["sos", "low_battery", "device_offline", "fall_detected", "info"],
      required: true,
    },

    message: { type: String, required: true },

    location: {
      latitude: Number,
      longitude: Number,
      address: String,
    },

    isRead: { type: Boolean, default: false },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    triggeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

alertSchema.index({ user: 1, triggeredAt: -1 });
alertSchema.index({ device: 1, triggeredAt: -1 });

module.exports = mongoose.model("Alert", alertSchema);
