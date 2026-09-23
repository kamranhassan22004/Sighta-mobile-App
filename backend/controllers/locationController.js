const Location = require("../models/Location");

// @route  POST /api/location/update
// @desc   Push a new location reading (called by the glasses/device pipeline)
// @access Private
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, address, deviceId } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: "latitude and longitude are required" });
    }

    const location = await Location.create({
      user: req.user._id,
      device: deviceId || req.user.device,
      latitude,
      longitude,
      address: address || "",
    });

    return res.status(201).json(location);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/location/current/:userId
// @desc   Get the most recent location for a user
// @access Private
const getCurrentLocation = async (req, res) => {
  try {
    const location = await Location.findOne({ user: req.params.userId }).sort({ recordedAt: -1 });

    if (!location) {
      return res.status(404).json({ message: "No location data found for this user" });
    }

    return res.json(location);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/location/history/:userId
// @desc   Get location history for a user (paginated)
// @access Private
const getLocationHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const history = await Location.find({ user: req.params.userId })
      .sort({ recordedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json(history);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { updateLocation, getCurrentLocation, getLocationHistory };
