// app.js - WhatsApp Business API Webhook Server (Flask-like structure)
import express from "express";
import dotenv from "dotenv";
import webhookRouter from "./routes/webhook.js";
import { setupDatabase } from "./config/database.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Database setup
setupDatabase();

// Routes
app.use("/webhook", webhookRouter);

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "TrophyBot WhatsApp Business API Server",
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "WhatsApp Business API Webhook",
    endpoints: {
      webhook_get: "GET /webhook - Webhook verification",
      webhook_post: "POST /webhook - Message handling",
      health: "GET /health",
    },
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "WhatsApp Business API Webhook",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(500).json({
    status: "error",
    message: err.message || "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint not found",
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});

export default app;
