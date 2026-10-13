const { getAuthorizedDevice, recordQuery } = require("./deviceAccessService");

const alertQuery = async (user) => {
  const device = await getAuthorizedDevice(user);
  return { $or: [
    // Private information alerts and legacy account alerts stay private.
    { user: user._id, type: "info" },
    { user: user._id, device: null },
    ...(device ? [{ $and: [recordQuery(device), { type: { $ne: "info" } }] }] : []),
  ] };
};

const alertView = (alert, userId) => {
  const result = alert.toObject ? alert.toObject() : { ...alert };
  result.isRead = (result.readBy || []).some(id => String(id) === String(userId)) ||
    (String(result.user) === String(userId) && result.isRead === true);
  delete result.readBy;
  // Event authorship is retained internally; account details are never populated.
  return result;
};
module.exports = { alertQuery, alertView };
