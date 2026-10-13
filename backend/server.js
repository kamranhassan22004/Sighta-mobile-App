
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.json({ message: "SIGHTA Guardian API is running" });
});

// MongoDB connection middleware
// YAHAN add karna hai — API routes se pehle
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("MongoDB error:", error.message);

    res.status(503).json({
      message: "Database temporarily unavailable",
    });
  }
});

// Authentication routes
app.use("/api/auth", require("./routes/authRoutes"));

// GPS location routes
app.use("/api/location", require("./routes/locationRoutes"));

// Alert routes
app.use("/api/alerts", require("./routes/alertRoutes"));

// Device routes
app.use("/api/device", require("./routes/deviceRoutes"));
app.use("/api/device-monitor", require("./routes/deviceOfflineRoutes"));
app.use("/api/daily-summary", require("./routes/dailySummaryRoutes"));
// Device activity history
app.use(
  "/api/device-events",
  require("./routes/deviceEventRoutes")
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || "Server error",
  });
});

// Export Express app for Vercel
module.exports = app;

// Start server only when running locally
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`SIGHTA Backend running on port ${PORT}`);
  });
}
