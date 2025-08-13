import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

class CloudinaryService {
  constructor() {
    this.initializeCloudinary();
  }

  /**
   * Initialize Cloudinary configuration
   */
  initializeCloudinary() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Upload image to Cloudinary
   * @param {string} filePath - Local file path
   * @param {string} folder - Cloudinary folder name
   * @param {string} publicId - Public ID for the image
   * @returns {Promise<Object>} - Upload result
   */
  async uploadImage(filePath, folder = "model-generator", publicId = null) {
    try {
      const options = {
        folder: folder,
        resource_type: "image",
        format: "png",
      };

      if (publicId) {
        options.public_id = publicId;
      }

      const result = await cloudinary.uploader.upload(filePath, options);

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        assetId: result.asset_id,
        format: result.format,
        size: result.bytes,
      };
    } catch (error) {
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  /**
   * Upload buffer directly to Cloudinary
   * @param {Buffer} buffer - Image buffer
   * @param {string} folder - Cloudinary folder name
   * @param {string} publicId - Public ID for the image
   * @returns {Promise<Object>} - Upload result
   */
  async uploadBuffer(buffer, folder = "model-generator", publicId = null) {
    try {
      const options = {
        folder: folder,
        resource_type: "image",
        format: "png",
      };

      if (publicId) {
        options.public_id = publicId;
      }

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          options,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        uploadStream.end(buffer);
      });

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        assetId: result.asset_id,
        format: result.format,
        size: result.bytes,
      };
    } catch (error) {
      throw new Error(`Cloudinary buffer upload failed: ${error.message}`);
    }
  }

  /**
   * Delete image from Cloudinary
   * @param {string} publicId - Public ID of the image
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return {
        success: true,
        result: result,
      };
    } catch (error) {
      throw new Error(`Cloudinary deletion failed: ${error.message}`);
    }
  }

  /**
   * Get image information from Cloudinary
   * @param {string} publicId - Public ID of the image
   * @returns {Promise<Object>} - Image information
   */
  async getImageInfo(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId);
      return {
        success: true,
        info: result,
      };
    } catch (error) {
      throw new Error(`Failed to get image info: ${error.message}`);
    }
  }

  /**
   * Download image from URL and upload to Cloudinary
   * @param {string} imageUrl - URL of the image to download
   * @param {string} folder - Cloudinary folder name
   * @param {string} publicId - Public ID for the image
   * @returns {Promise<Object>} - Upload result
   */
  async uploadFromUrl(imageUrl, folder = "model-generator", publicId = null) {
    try {
      console.log(`Downloading image from: ${imageUrl}`);

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download image: ${response.status} ${response.statusText}`
        );
      }

      const buffer = await response.buffer();
      console.log(`Downloaded image size: ${buffer.length} bytes`);

      // Upload buffer to Cloudinary
      const result = await this.uploadBuffer(buffer, folder, publicId);

      console.log(`Successfully uploaded to Cloudinary: ${result.url}`);
      return result;
    } catch (error) {
      throw new Error(`Failed to upload from URL: ${error.message}`);
    }
  }
}

export default CloudinaryService;
