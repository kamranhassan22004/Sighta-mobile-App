const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["guardian"], default: "guardian" },

    dependent: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
    },

    emergencyContacts: [
      {
        name: String,
        phone: String,
        relationship: String,
      },
    ],

    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },

    fcmToken: { type: String, default: null },

    notificationSettings: {
      sosAlerts: { type: Boolean, default: true },
      lowBattery: { type: Boolean, default: true },
      deviceOffline: { type: Boolean, default: true },
      dailySummary: { type: Boolean, default: false },
    },

    resetCodeHash: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);