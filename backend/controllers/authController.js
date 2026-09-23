const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { sendResetCodeEmail } = require("../utils/sendEmail");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const hashCode = (code) => crypto.createHash("sha256").update(code).digest("hex");

// @route  POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password, dependentName, dependentRelationship } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      dependent: {
        name: dependentName || "",
        relationship: dependentRelationship || "",
      },
    });

    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/auth/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("device");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, dependent, emergencyContacts, notificationSettings, fcmToken } = req.body;

    if (name) user.name = name;
    if (dependent) user.dependent = { ...user.dependent.toObject(), ...dependent };
    if (emergencyContacts) user.emergencyContacts = emergencyContacts;
    if (notificationSettings)
      user.notificationSettings = { ...user.notificationSettings.toObject(), ...notificationSettings };
    if (fcmToken) user.fcmToken = fcmToken;

    const updated = await user.save();
    return res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      dependent: updated.dependent,
      emergencyContacts: updated.emergencyContacts,
      notificationSettings: updated.notificationSettings,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/auth/forgot-password
// @desc   Generate a 6-digit code, email it, store its hash + expiry
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    // Always respond success even if user not found, so attackers can't probe which emails exist
    if (!user) {
      return res.json({ message: "If that email exists, a reset code has been sent." });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCodeHash = hashCode(code);
    user.resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    await sendResetCodeEmail(user.email, code);

    return res.json({ message: "If that email exists, a reset code has been sent." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/auth/verify-reset-code
// @desc   Check the 6-digit code; issue a short-lived reset token if valid
const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and code are required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.resetCodeHash || !user.resetCodeExpires) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    if (user.resetCodeExpires < new Date()) {
      return res.status(400).json({ message: "This code has expired. Please request a new one." });
    }

    if (user.resetCodeHash !== hashCode(code)) {
      return res.status(400).json({ message: "Incorrect code" });
    }

    const resetToken = jwt.sign({ id: user._id, purpose: "reset" }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });

    return res.json({ resetToken });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/auth/reset-password
// @desc   Set a new password using the short-lived reset token
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: "Reset token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: "This reset session has expired. Please start over." });
    }

    if (decoded.purpose !== "reset") {
      return res.status(401).json({ message: "Invalid reset session" });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetCodeHash = null;
    user.resetCodeExpires = null;
    await user.save();

    return res.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  forgotPassword,
  verifyResetCode,
  resetPassword,
};