const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyGoogleToken } = require("../services/googleAuthService");
const { getAuthorizedDevice, deviceView } = require("../services/deviceAccessService");

async function googleLogin(req, res) {
  const { idToken } = req.body;
  if (typeof idToken !== "string" || !idToken || idToken.length > 16000) {
    return res.status(400).json({ message: "A Google identity token is required." });
  }
  try {
    const identity = await verifyGoogleToken(idToken);
    let user = await User.findOne({ googleSub: identity.sub });
    if (!user) {
      const email = identity.email.trim().toLowerCase();
      if (await User.findOne({ email })) {
        return res.status(409).json({ code: "ACCOUNT_LINK_REQUIRED",
          message: "An account already uses this email. Sign in with your password (or use Forgot Password). Google account linking is not enabled." });
      }
      try {
        user = await User.create({ googleSub: identity.sub, email,
          name: identity.name?.trim() || "SIGHTA Guardian",
          picture: typeof identity.picture === "string" && identity.picture.startsWith("https://") ? identity.picture : "" });
      } catch (error) {
        if (error.code !== 11000) throw error;
        // Concurrent requests for the same subject may safely reuse the winner.
        user = await User.findOne({ googleSub: identity.sub });
        if (!user) return res.status(409).json({ message: "An account already uses this email. Please sign in with your password." });
      }
    }
    return res.json({ _id: user._id, name: user.name, email: user.email,
      picture: user.picture, phone: user.phone || "", dependent: user.dependent,
      emergencyContacts: user.emergencyContacts, notificationSettings: user.notificationSettings,
      device: deviceView(await getAuthorizedDevice(user)),
      token: jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Google sign-in could not complete. Please try again." });
  }
}
module.exports = { googleLogin };
