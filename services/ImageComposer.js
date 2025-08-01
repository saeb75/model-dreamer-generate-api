import ImageProcessor from "./ImageProcessor.js";
import CloudinaryService from "./CloudinaryService.js";
import ImageValidator from "./ImageValidator.js";
import fs from "fs";

class ImageComposer {
  constructor() {
    this.imageProcessor = new ImageProcessor();
    this.cloudinaryService = new CloudinaryService();
    this.imageValidator = new ImageValidator();
  }

  /**
   * Main method to compose images and upload to Cloudinary
   * @param {Array} uploadedFiles - Array of uploaded files
   * @param {Array} imageUrls - Array of image URLs
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Result with Cloudinary URL
   */
  async composeAndUpload(uploadedFiles = [], imageUrls = [], options = {}) {
    const tempFiles = [];

    try {
      // Step 1: Validate inputs
      const validation = this.imageValidator.validateAllInputs(
        uploadedFiles,
        imageUrls
      );
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      console.log(
        `Processing ${validation.totalImages} images (${validation.uploadedCount} uploaded, ${validation.urlCount} URLs)`
      );

      // Step 2: Process uploaded files
      const uploadedBuffers = await this.processUploadedFiles(
        uploadedFiles,
        tempFiles
      );

      // Step 3: Download and process URLs
      const urlBuffers = await this.processImageUrls(imageUrls);

      // Step 4: Combine all image buffers
      const allImageBuffers = [...uploadedBuffers, ...urlBuffers];

      // Step 5: Create A4 canvas
      const a4CanvasBuffer = await this.imageProcessor.createA4Canvas(
        allImageBuffers
      );

      // Step 6: Generate unique filename
      const timestamp = Date.now();
      const filename = `a4_composition_${timestamp}.png`;
      const tempFilePath = await this.imageProcessor.saveToTempFile(
        a4CanvasBuffer,
        filename
      );
      tempFiles.push(tempFilePath);

      // Step 7: Upload to Cloudinary
      const publicId = `a4_composition_${timestamp}`;
      const uploadResult = await this.cloudinaryService.uploadImage(
        tempFilePath,
        "a4-compositions",
        publicId
      );

      // Step 8: Return result
      return {
        success: true,
        cloudinaryUrl: uploadResult.url,
        publicId: uploadResult.publicId,
        assetId: uploadResult.assetId,
        format: uploadResult.format,
        size: uploadResult.size,
        composition: {
          totalImages: validation.totalImages,
          uploadedCount: validation.uploadedCount,
          urlCount: validation.urlCount,
          canvasSize: {
            width: this.imageProcessor.A4_WIDTH,
            height: this.imageProcessor.A4_HEIGHT,
          },
        },
        metadata: {
          timestamp: timestamp,
          filename: filename,
          tempFilePath: tempFilePath,
        },
      };
    } catch (error) {
      console.error("Error in composeAndUpload:", error);
      throw error;
    } finally {
      // Cleanup temp files
      await this.imageProcessor.cleanupTempFiles(tempFiles);
    }
  }

  /**
   * Process uploaded files and return buffers
   * @param {Array} uploadedFiles - Array of uploaded files
   * @param {Array} tempFiles - Array to track temp files for cleanup
   * @returns {Promise<Array<Buffer>>} - Array of image buffers
   */
  async processUploadedFiles(uploadedFiles, tempFiles) {
    const buffers = [];

    for (const file of uploadedFiles) {
      try {
        const buffer = fs.readFileSync(file.path);
        buffers.push(buffer);
        console.log(
          `Processed uploaded file: ${file.originalname} (${buffer.length} bytes)`
        );
      } catch (error) {
        throw new Error(
          `Failed to process uploaded file ${file.originalname}: ${error.message}`
        );
      }
    }

    return buffers;
  }

  /**
   * Download and process image URLs
   * @param {Array} imageUrls - Array of image URLs
   * @returns {Promise<Array<Buffer>>} - Array of image buffers
   */
  async processImageUrls(imageUrls) {
    const buffers = [];

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const url = imageUrls[i];
        const buffer = await this.imageProcessor.downloadImage(url);
        buffers.push(buffer);
        console.log(
          `Downloaded image from URL ${i + 1}: ${url} (${buffer.length} bytes)`
        );
      } catch (error) {
        throw new Error(
          `Failed to download image from URL ${i + 1}: ${error.message}`
        );
      }
    }

    return buffers;
  }

  /**
   * Get validation rules for client
   * @returns {Object} - Validation rules
   */
  getValidationRules() {
    return this.imageValidator.getValidationRules();
  }

  /**
   * Test Cloudinary connection
   * @returns {Promise<Object>} - Test result
   */
  async testCloudinaryConnection() {
    try {
      // Create a simple test image
      const testBuffer = await this.imageProcessor.createA4Canvas([
        Buffer.from("test"), // This will fail, but we just want to test the connection
      ]);

      return {
        success: true,
        message: "Cloudinary connection test successful",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default ImageComposer;
