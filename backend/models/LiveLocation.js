
const mongoose = require("mongoose");

const liveLocationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },

    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },

    address: {
      type: String,
      default: "",
    },

    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "LiveLocation",
  liveLocationSchema
);
