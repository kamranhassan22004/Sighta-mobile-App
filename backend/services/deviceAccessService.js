const Device = require("../models/Device");
const User = require("../models/User");

const accessQuery = (userId) => ({ $or: [{ owner: userId }, { guardians: userId }] });

// A cached User.device is a selection, never proof of authorization.
const getAuthorizedDevice = async (user) => {
  const selection = user.device?._id || user.device;
  const selected = await Device.findOne({
    ...accessQuery(user._id),
    ...(selection ? { _id: selection } : {}),
  });
  if (selected || !selection) return selected;
  return Device.findOne(accessQuery(user._id));
};

// Preserve legacy owner records without a device field; never read another device.
const recordQuery = (device) => device ? {
  $or: [
    { device: device._id },
    { device: null, user: device.owner },
  ],
} : { _id: { $in: [] } };

const deviceView = (device) => {
  if (!device) return null;
  const result = device.toObject ? device.toObject() : { ...device };
  delete result.apiKeyHash;
  delete result.guardians;
  delete result.invitations;
  const elapsed = Date.now() - new Date(result.lastSyncedAt).getTime();
  result.status = result.status === "online" && result.lastSyncedAt &&
    Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 15000 ? "online" : "offline";
  if (result.status !== "online") {
    result.connectivity = { ...result.connectivity, wifi: false };
  }
  return result;
};

const getGuardians = async (device) => User.find({
  _id: { $in: [...new Set([device.owner, ...(device.guardians || [])].map(String))] },
});

module.exports = { accessQuery, getAuthorizedDevice, recordQuery, deviceView, getGuardians };
