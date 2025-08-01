import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createServer } from "http";
import generateRoute from "./routes/generate.route.js";
import SocketService from "./services/SocketService.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
const socketService = new SocketService();
socketService.initialize(server);

// Make socket service available globally
global.socketService = socketService;

// Create necessary directories
const uploadsDir = path.join(__dirname, "uploads");
const tempDir = path.join(__dirname, "temp");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Created uploads directory");
}

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log("Created temp directory");
}

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve Swagger UI
app.use("/docs", express.static(path.join(__dirname, "swagger")));

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Routes
app.use("/api/v1", generateRoute);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Model Generator API is running",
    version: "1.0.0",
    socketConnected: socketService.getConnectedUsersCount(),
    endpoints: {
      generate: "/api/v1/generate",
      generateWithImage: "/api/v1/generate-with-image",
      generateWithMultipleImages: "/api/v1/generate-with-multiple-images",
      editWithOpenAI: "/api/v1/edit-with-openai",
      validationRules: "/api/v1/validation-rules",
      testCloudinary: "/api/v1/test-cloudinary",
    },
    documentation: "/docs",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || "Something went wrong!",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO is ready for real-time connections`);
  console.log(`API Documentation: http://localhost:${PORT}/docs`);
  console.log(`API Endpoints:`);
  console.log(`- POST /api/v1/generate - Generate images with text prompt`);
  console.log(
    `- POST /api/v1/generate-with-multiple-images - Generate images with multiple inputs`
  );
  console.log(
    `- POST /api/v1/generate-with-image - Generate images with single image upload`
  );
  console.log(`- POST /api/v1/edit-with-openai - Edit images with OpenAI`);

  console.log(`- GET /api/v1/validation-rules - Get validation rules`);
  console.log(`- GET /api/v1/test-cloudinary - Test Cloudinary connection`);
});
