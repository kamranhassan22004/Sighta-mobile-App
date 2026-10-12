
const DeviceEvent = require("../models/DeviceEvent");

// GET /api/device-events/:userId
// Fetch device activity history for logged-in guardian
const getDeviceEvents = async (req, res) => {
  try {
    // Guardian can only view their own device events
    if (String(req.user._id) !== req.params.userId) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const page = Math.max(
      1,
      parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const events = await DeviceEvent.find({
      user: req.user._id,
    })
      .sort({ occurredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json(events);
  } catch (error) {
    console.error("GET DEVICE EVENTS ERROR:", error);

    return res.status(500).json({
      message: "Unable to fetch device history",
    });
  }
};

module.exports = {
  getDeviceEvents,
};
