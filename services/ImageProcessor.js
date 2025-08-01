import sharp from "sharp";
import axios from "axios";
import fs from "fs";
import path from "path";

class ImageProcessor {
  constructor() {
    this.A4_WIDTH = 3508; // A4 width in pixels at 300 DPI (landscape)
    this.A4_HEIGHT = 2480; // A4 height in pixels at 300 DPI (landscape)
  }

  /**
   * Download image from URL and return buffer
   * @param {string} url - Image URL
   * @returns {Promise<Buffer>} - Image buffer
   */
  async downloadImage(url) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download image from ${url}: ${error.message}`);
    }
  }

  /**
   * Resize image to fit specified dimensions while maintaining aspect ratio
   * @param {Buffer} imageBuffer - Input image buffer
   * @param {number} targetWidth - Target width
   * @param {number} targetHeight - Target height
   * @returns {Promise<Buffer>} - Resized image buffer
   */
  async resizeImage(imageBuffer, targetWidth, targetHeight) {
    try {
      return await sharp(imageBuffer)
        .resize(targetWidth, targetHeight, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer();
    } catch (error) {
      throw new Error(`Failed to resize image: ${error.message}`);
    }
  }

  /**
   * Create A4 canvas with images arranged horizontally
   * @param {Array<Buffer>} imageBuffers - Array of image buffers
   * @returns {Promise<Buffer>} - Combined A4 image buffer
   */
  async createA4Canvas(imageBuffers) {
    try {
      const imageCount = imageBuffers.length;
      const sectionWidth = Math.floor(this.A4_WIDTH / imageCount);
      const sectionHeight = this.A4_HEIGHT;

      // Create A4 canvas
      const canvas = sharp({
        create: {
          width: this.A4_WIDTH,
          height: this.A4_HEIGHT,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      });

      // Prepare composite operations
      const compositeOperations = [];

      for (let i = 0; i < imageCount; i++) {
        const resizedImage = await this.resizeImage(
          imageBuffers[i],
          sectionWidth,
          sectionHeight
        );
        compositeOperations.push({
          input: resizedImage,
          left: i * sectionWidth,
          top: 0,
        });
      }

      return await canvas.composite(compositeOperations).png().toBuffer();
    } catch (error) {
      throw new Error(`Failed to create A4 canvas: ${error.message}`);
    }
  }

  /**
   * Save buffer to temporary file
   * @param {Buffer} buffer - Image buffer
   * @param {string} filename - Filename
   * @returns {Promise<string>} - File path
   */
  async saveToTempFile(buffer, filename) {
    try {
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filepath = path.join(tempDir, filename);
      fs.writeFileSync(filepath, buffer);
      return filepath;
    } catch (error) {
      throw new Error(`Failed to save temp file: ${error.message}`);
    }
  }

  /**
   * Clean up temporary files
   * @param {Array<string>} filepaths - Array of file paths to delete
   */
  async cleanupTempFiles(filepaths) {
    for (const filepath of filepaths) {
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (error) {
        console.warn(`Failed to delete temp file ${filepath}:`, error.message);
      }
    }
  }

  /**
   * Clean up uploaded files from uploads directory
   * @param {Array} uploadedFiles - Array of uploaded file objects
   */
  async cleanupUploadedFiles(uploadedFiles) {
    for (const file of uploadedFiles) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log(`Cleaned up uploaded file: ${file.originalname}`);
        }
      } catch (error) {
        console.warn(`Failed to cleanup uploaded file ${file.originalname}:`, error.message);
      }
    }
  }

  /**
   * Clean up a single file from uploads directory
   * @param {string} filepath - File path to delete
   * @param {string} filename - Optional filename for logging
   */
  async cleanupUploadedFile(filepath, filename = null) {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        const logName = filename || path.basename(filepath);
        console.log(`Cleaned up uploaded file: ${logName}`);
      }
    } catch (error) {
      const logName = filename || path.basename(filepath);
      console.warn(`Failed to cleanup uploaded file ${logName}:`, error.message);
    }
  }
}

export default ImageProcessor;
