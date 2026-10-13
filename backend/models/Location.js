const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, default: "" },

    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Fast lookup of most recent location per user
locationSchema.index({ user: 1, recordedAt: -1 });
locationSchema.index({ device: 1, recordedAt: -1 });

module.exports = mongoose.model("Location", locationSchema);
