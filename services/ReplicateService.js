import Replicate from "replicate";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import CloudinaryService from "./CloudinaryService.js";

dotenv.config();

class ReplicateService {
  constructor() {
    this.replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
      userAgent: "https://www.npmjs.com/package/create-replicate",
    });
    this.cloudinaryService = new CloudinaryService();
  }

  /**
   * Generate image with Replicate and return Cloudinary URL
   * @param {string} prompt - The prompt for image generation
   * @param {string} imageUrl - Input image URL
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - Cloudinary URL of generated image
   */
  async generateImage(prompt, imageUrl, options = {}) {
    try {
      const {
        quality = "auto",
        background = "auto",
        aspect_ratio = "2:3",
      } = options;

      const model =
        "openai/gpt-image-1:a6198aeaea27df5f3a9f11335cd61b2031729f9527cd34e6cdb4bb3ee9355b87";

      const input = {
        prompt: prompt,
        quality: quality,
        background: background,
        moderation: "auto",
        aspect_ratio: aspect_ratio,
        output_format: "webp",
        openai_api_key: process.env.OPENAI_API_KEY,
        number_of_images: 1,
        output_compression: 90,
        input_images: [imageUrl],
      };

      console.log("Running Replicate model:", model);
      const output = await this.replicate.run(model, { input });
      console.log("output", output);

      let cloudinaryUrl = null;

      // Handle different output formats
      if (Array.isArray(output) && output.length > 0) {
        console.log("Output is an array with length:", output.length);

        // Check if first item is a ReadableStream
        if (output[0] instanceof ReadableStream) {
          console.log("Processing ReadableStream...");
          const stream = output[0];

          const arrayBuffer = await new Response(stream).arrayBuffer();
          console.log("Stream size:", arrayBuffer.byteLength, "bytes");

          const uint8Array = new Uint8Array(arrayBuffer);

          // Save to temp file
          const timestamp = Date.now();
          const tempFilename = `generated_image_${timestamp}.webp`;
          const tempDir = path.join(process.cwd(), "temp");
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          const tempFilePath = path.join(tempDir, tempFilename);
          fs.writeFileSync(tempFilePath, uint8Array);

          // Upload to Cloudinary
          const cloudinaryResult = await this.cloudinaryService.uploadImage(
            tempFilePath,
            "generated-images",
            `generated_${timestamp}`
          );

          // Clean up temp file
          try {
            fs.unlinkSync(tempFilePath);
          } catch (cleanupError) {
            console.warn("Failed to cleanup temp file:", cleanupError.message);
          }

          cloudinaryUrl = cloudinaryResult.url;
        } else if (typeof output[0] === "string") {
          // If it's a URL string, upload it to Cloudinary
          console.log("Output is a URL string:", output[0]);
          const timestamp = Date.now();
          const cloudinaryResult = await this.cloudinaryService.uploadFromUrl(
            output[0],
            "generated-images",
            `generated_${timestamp}`
          );
          cloudinaryUrl = cloudinaryResult.url;
        } else {
          console.log("First item type:", typeof output[0]);
          console.log("First item:", output[0]);
          throw new Error(`Unexpected output format: ${typeof output[0]}`);
        }
      } else if (typeof output === "string") {
        // Direct URL string - upload to Cloudinary
        console.log("Output is a direct URL string:", output);
        const timestamp = Date.now();
        const cloudinaryResult = await this.cloudinaryService.uploadFromUrl(
          output,
          "generated-images",
          `generated_${timestamp}`
        );
        cloudinaryUrl = cloudinaryResult.url;
      } else {
        console.log("Output type:", typeof output);
        console.log("Output:", output);
        throw new Error(`Unexpected output format: ${typeof output}`);
      }

      return cloudinaryUrl;
    } catch (error) {
      console.error("Error in ReplicateService:", error);
      throw error;
    }
  }

  /**
   * Generate image with face swap - two step process
   * @param {string} prompt - The prompt for image generation
   * @param {string} compositionUrl - Composed image URL
   * @param {string} swapImageUrl - First image URL for face swap
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Object with both generated and face-swapped URLs
   */
  async generateImageWithFaceSwap(
    prompt,
    compositionUrl,
    swapImageUrl,
    options = {}
  ) {
    try {
      // Step 1: Generate image with first model
      const generatedImageUrl = await this.generateImage(
        prompt,
        compositionUrl,
        options
      );
      console.log("generatedImageUrl", generatedImageUrl);

      // Step 2: Face swap
      const faceSwapUrl = await this.faceSwap(swapImageUrl, generatedImageUrl);

      return {
        generatedImageUrl,
        faceSwapUrl,
      };
    } catch (error) {
      console.error("Error in generateImageWithFaceSwap:", error);
      throw error;
    }
  }

  /**
   * Face swap using Replicate
   * @param {string} swapImageUrl - Source face image URL
   * @param {string} inputImageUrl - Target image URL
   * @returns {Promise<string>} - Cloudinary URL of face-swapped image
   */
  async faceSwap(swapImageUrl, inputImageUrl) {
    try {
      const model =
        "cdingram/face-swap:d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111";

      const input = {
        swap_image: swapImageUrl,
        input_image: inputImageUrl,
      };

      console.log("Running face swap model:", model);
      const output = await this.replicate.run(model, { input });
      console.log("Face swap output:", output);

      let cloudinaryUrl = null;

      // Handle face swap output format
      if (output && typeof output.url === "function") {
        // If output has a url() method, use it and upload to Cloudinary
        const url = output.url();
        console.log("Face swap URL:", url);
        const timestamp = Date.now();
        const cloudinaryResult = await this.cloudinaryService.uploadFromUrl(
          url,
          "face-swap-images",
          `face_swap_${timestamp}`
        );
        cloudinaryUrl = cloudinaryResult.url;
      } else if (typeof output === "string") {
        // Direct URL string - upload to Cloudinary
        console.log("Face swap direct URL:", output);
        const timestamp = Date.now();
        const cloudinaryResult = await this.cloudinaryService.uploadFromUrl(
          output,
          "face-swap-images",
          `face_swap_${timestamp}`
        );
        cloudinaryUrl = cloudinaryResult.url;
      } else if (Array.isArray(output) && output.length > 0) {
        // Array format
        if (typeof output[0] === "string") {
          console.log("Face swap array URL:", output[0]);
          const timestamp = Date.now();
          const cloudinaryResult = await this.cloudinaryService.uploadFromUrl(
            output[0],
            "face-swap-images",
            `face_swap_${timestamp}`
          );
          cloudinaryUrl = cloudinaryResult.url;
        } else if (output[0] instanceof ReadableStream) {
          // Process ReadableStream
          console.log("Processing face swap ReadableStream...");
          const stream = output[0];

          const arrayBuffer = await new Response(stream).arrayBuffer();
          console.log(
            "Face swap stream size:",
            arrayBuffer.byteLength,
            "bytes"
          );

          const uint8Array = new Uint8Array(arrayBuffer);

          // Save to temp file
          const timestamp = Date.now();
          const tempFilename = `face_swap_${timestamp}.png`;
          const tempDir = path.join(process.cwd(), "temp");
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          const tempFilePath = path.join(tempDir, tempFilename);
          fs.writeFileSync(tempFilePath, uint8Array);

          // Upload to Cloudinary
          const cloudinaryResult = await this.cloudinaryService.uploadImage(
            tempFilePath,
            "face-swap-images",
            `face_swap_${timestamp}`
          );

          // Clean up temp file
          try {
            fs.unlinkSync(tempFilePath);
          } catch (cleanupError) {
            console.warn("Failed to cleanup temp file:", cleanupError.message);
          }

          cloudinaryUrl = cloudinaryResult.url;
        }
      }

      if (!cloudinaryUrl) {
        console.log("Face swap output type:", typeof output);
        console.log("Face swap output:", output);
        throw new Error(`Unexpected face swap output format: ${typeof output}`);
      }

      return cloudinaryUrl;
    } catch (error) {
      console.error("Error in faceSwap:", error);
      throw error;
    }
  }
}

export default ReplicateService;
