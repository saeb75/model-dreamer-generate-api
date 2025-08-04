import express from "express";
import multer from "multer";
import path from "path";
import GenerateController from "../controller/generate.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Basic image generation route
router.post("/generate", GenerateController.generate);

// Multiple images composition route (2-3 images: 1 URL + 1-2 uploaded files)
router.post(
  "/generate-with-multiple-images",
  authMiddleware,
  upload.array("images", 2),
  GenerateController.generateWithMultipleImages
);

// Legacy route for single image upload
router.post(
  "/generate-with-image",
  upload.single("image"),
  GenerateController.generateWithImage
);

// Get validation rules
router.get("/validation-rules", GenerateController.getValidationRules);

// Test Cloudinary connection
router.get("/test-cloudinary", GenerateController.testCloudinary);

// OpenAI image editing route
router.post(
  "/edit-with-openai",
  authMiddleware,
  upload.array("images", 2),
  GenerateController.editImageWithOpenAI
);

// Direct OpenAI image editing route (no composition)
router.post(
  "/edit-images-with-openai",
  authMiddleware,
  upload.array("images", 5), // Allow up to 5 images
  GenerateController.editImagesWithOpenAI
);

// Combined images OpenAI editing route (combines multiple images into one before editing)
router.post(
  "/combine",
  authMiddleware,
  upload.array("images", 5), // Allow up to 5 images
  GenerateController.editImagesWithOpenAIOneImage
);

export default router;
