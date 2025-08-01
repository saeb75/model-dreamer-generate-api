import fs from "fs";
import path from "path";

class ImageValidator {
  constructor() {
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    this.allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  }

  /**
   * Validate image URL format
   * @param {string} url - Image URL
   * @returns {boolean} - Is valid URL
   */
  validateImageUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate uploaded file
   * @param {Object} file - Multer file object
   * @returns {Object} - Validation result
   */
  validateUploadedFile(file) {
    if (!file) {
      return {
        isValid: false,
        error: "No file uploaded",
      };
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum limit of ${
          this.maxFileSize / (1024 * 1024)
        }MB`,
      };
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(
          ", "
        )}`,
      };
    }

    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(extension)) {
      return {
        isValid: false,
        error: `Invalid file extension. Allowed extensions: ${this.allowedExtensions.join(
          ", "
        )}`,
      };
    }

    // Check if file exists
    if (!fs.existsSync(file.path)) {
      return {
        isValid: false,
        error: "Uploaded file not found on server",
      };
    }

    return {
      isValid: true,
      file: file,
    };
  }

  /**
   * Validate image count requirements
   * @param {Array} uploadedFiles - Array of uploaded files
   * @param {Array} imageUrls - Array of image URLs
   * @returns {Object} - Validation result
   */
  validateImageCount(uploadedFiles = [], imageUrls = []) {
    const totalImages = uploadedFiles.length + imageUrls.length;

    if (totalImages < 2) {
      return {
        isValid: false,
        error: "Minimum 2 images required (uploaded files + URLs)",
      };
    }

    if (totalImages > 3) {
      return {
        isValid: false,
        error: "Maximum 3 images allowed (uploaded files + URLs)",
      };
    }

    if (uploadedFiles.length === 0) {
      return {
        isValid: false,
        error: "At least one image must be uploaded as file",
      };
    }

    if (imageUrls.length === 0) {
      return {
        isValid: false,
        error: "At least one image URL must be provided",
      };
    }

    return {
      isValid: true,
      totalImages: totalImages,
      uploadedCount: uploadedFiles.length,
      urlCount: imageUrls.length,
    };
  }

  /**
   * Validate all image inputs
   * @param {Array} uploadedFiles - Array of uploaded files
   * @param {Array} imageUrls - Array of image URLs
   * @returns {Object} - Comprehensive validation result
   */
  validateAllInputs(uploadedFiles = [], imageUrls = []) {
    console.log("validateAllInputs", uploadedFiles, imageUrls);
    // Validate count
    const countValidation = this.validateImageCount(uploadedFiles, imageUrls);
    if (!countValidation.isValid) {
      return countValidation;
    }

    // Validate uploaded files
    for (let i = 0; i < uploadedFiles.length; i++) {
      const fileValidation = this.validateUploadedFile(uploadedFiles[i]);
      if (!fileValidation.isValid) {
        return {
          isValid: false,
          error: `File ${i + 1}: ${fileValidation.error}`,
        };
      }
    }

    // Validate URLs
    for (let i = 0; i < imageUrls.length; i++) {
      if (!this.validateImageUrl(imageUrls[i])) {
        return {
          isValid: false,
          error: `Invalid URL ${i + 1}: ${imageUrls[i]}`,
        };
      }
    }

    return {
      isValid: true,
      totalImages: countValidation.totalImages,
      uploadedCount: countValidation.uploadedCount,
      urlCount: countValidation.urlCount,
    };
  }

  /**
   * Get validation rules for client
   * @returns {Object} - Validation rules
   */
  getValidationRules() {
    return {
      maxFileSize: this.maxFileSize,
      maxFileSizeMB: this.maxFileSize / (1024 * 1024),
      allowedMimeTypes: this.allowedMimeTypes,
      allowedExtensions: this.allowedExtensions,
      minImages: 2,
      maxImages: 3,
      requireUpload: true,
      requireUrl: true,
    };
  }
}

export default ImageValidator;
