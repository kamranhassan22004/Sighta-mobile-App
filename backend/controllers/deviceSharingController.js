const mongoose = require("mongoose");
const Device = require("../models/Device");
const User = require("../models/User");
const { getAuthorizedDevice } = require("../services/deviceAccessService");

// Invitations are bound to a registered account and require its authenticated acceptance.
const getSharing = async (req, res) => {
  try {
    const devices = await Device.find({ owner: req.user._id }).select("deviceId guardians invitations");
    const owned = await Promise.all(devices.map(async (device) => {
      const ids = [...new Set([...(device.guardians || []), ...device.invitations.map(i => i.guardian)].map(String))];
      const users = await User.find({ _id: { $in: ids } }).select("_id email");
      return {
        _id: device._id, deviceId: device.deviceId,
        guardians: users.map(u => ({
          _id: u._id, email: u.email,
          status: device.guardians.some(id => String(id) === String(u._id)) ? "accepted" :
            device.invitations.find(i => String(i.guardian) === String(u._id))?.status,
        })).filter(u => u.status !== "revoked"),
      };
    }));
    const pendingDevices = await Device.find({ invitations: { $elemMatch: {
      guardian: req.user._id, status: "pending", expiresAt: { $gt: new Date() },
    } } }).select("deviceId");
    return res.json({ owned, invitations: pendingDevices.map(d => ({ _id: d._id, deviceId: d.deviceId })) });
  } catch (error) { return res.status(500).json({ message: "Unable to load device sharing" }); }
};

const inviteGuardian = async (req, res) => {
  try {
    if (typeof req.body.email !== "string" || !req.body.email.trim()) {
      return res.status(400).json({ message: "Registered guardian email is required" });
    }
    const device = await Device.findOne({ deviceId: req.params.deviceId, owner: req.user._id });
    if (!device) return res.status(404).json({ message: "Owned device not found" });
    const guardian = await User.findOne({ email: req.body.email.trim().toLowerCase() });
    if (!guardian || String(guardian._id) === String(req.user._id)) {
      return res.status(400).json({ message: "Enter another registered guardian's email" });
    }
    if (device.guardians.some(id => String(id) === String(guardian._id))) {
      return res.status(409).json({ message: "Guardian already has access" });
    }
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // Update an existing invitation, or insert once under an atomic condition.
    const updated = await Device.updateOne({ _id: device._id, owner: req.user._id,
      "invitations.guardian": guardian._id, guardians: { $ne: guardian._id } }, {
      $set: { "invitations.$.status": "pending", "invitations.$.expiresAt": expiresAt },
    });
    if (!updated.matchedCount) {
      await Device.updateOne({ _id: device._id, owner: req.user._id,
        "invitations.guardian": { $ne: guardian._id }, guardians: { $ne: guardian._id } }, {
        $push: { invitations: { guardian: guardian._id, status: "pending", expiresAt } },
      });
    }
    return res.status(201).json({ message: "Invitation sent. Guardian can accept from Profile." });
  } catch (error) { return res.status(500).json({ message: "Unable to invite guardian" }); }
};

const acceptInvitation = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.deviceId)) {
      return res.status(400).json({ message: "Invalid invitation" });
    }
    const current = await getAuthorizedDevice(req.user);
    if (current && String(current._id) !== req.params.deviceId) {
      return res.status(409).json({ message: "Your account is already linked to another device" });
    }
    // Acceptance and membership change together; revoke cannot leave a late membership.
    const device = await Device.findOneAndUpdate({
      _id: req.params.deviceId,
      invitations: { $elemMatch: { guardian: req.user._id, status: "pending", expiresAt: { $gt: new Date() } } },
    }, {
      $set: { "invitations.$.status": "accepted" },
      $addToSet: { guardians: req.user._id },
    }, { new: true });
    if (!device) return res.status(404).json({ message: "Invitation expired or unavailable" });
    return res.json({ message: "Device access accepted" });
  } catch (error) { return res.status(500).json({ message: "Unable to accept invitation" }); }
};

const revokeGuardian = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.guardianId) || String(req.user._id) === req.params.guardianId) {
      return res.status(400).json({ message: "Invalid guardian" });
    }
    const device = await Device.findOneAndUpdate({ deviceId: req.params.deviceId, owner: req.user._id }, {
      $pull: { guardians: req.params.guardianId },
      $set: { "invitations.$[invitation].status": "revoked" },
    }, { new: true, arrayFilters: [{ "invitation.guardian": new mongoose.Types.ObjectId(req.params.guardianId) }] });
    if (!device) return res.status(404).json({ message: "Owned device not found" });
    // Clear an optional selection; every read rechecks membership independently.
    await User.updateOne({ _id: req.params.guardianId, device: device._id }, { $unset: { device: 1 } });
    return res.json({ message: "Guardian access revoked" });
  } catch (error) { return res.status(500).json({ message: "Unable to revoke guardian" }); }
};

module.exports = { getSharing, inviteGuardian, acceptInvitation, revokeGuardian };
