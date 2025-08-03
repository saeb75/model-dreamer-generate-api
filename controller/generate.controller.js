import Replicate from "replicate";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import axios from "axios";
import ImageComposer from "../services/ImageComposer.js";
import ReplicateService from "../services/ReplicateService.js";
import CloudinaryService from "../services/CloudinaryService.js";
import ImageProcessor from "../services/ImageProcessor.js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPT = `Dress the AI fashion model in the exact top and bottom garments I provide. This is an AI-generated model, and the purpose is to apply the given outfit with photorealistic precision. Preserve every detail of the garments — including texture, fabric, color, shape, and folds. Do not alter the outfit in any way.

The model’s face, expression, hair, pose, body position, and background must remain completely unchanged. Apply the outfit seamlessly, so it looks like she was originally photographed wearing it. Ensure the result is extremely photorealistic and natural.`;

dotenv.config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  userAgent: "https://www.npmjs.com/package/create-replicate",
});

class GenerateController {
  static async generate(req, res) {
    try {
      const {
        prompt,
        quality = "auto",
        background = "auto",
        aspect_ratio = "1:1",
        number_of_images = 1,
      } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

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
        number_of_images: number_of_images,
        output_compression: 90,
      };

      console.log("Using model: %s", model);
      console.log("With input: %O", input);

      const output = await replicate.run(model, { input });
      console.log("Raw output type:", typeof output);
      console.log("Raw output:", output);

      if (Array.isArray(output) && output.length > 0) {
        console.log("Output is an array with length:", output.length);

        const results = [];

        for (let i = 0; i < output.length; i++) {
          const item = output[i];
          console.log(`Item ${i}:`, item);
          console.log(`Item ${i} type:`, typeof item);

          if (item instanceof ReadableStream) {
            console.log(`Item ${i} is a ReadableStream`);

            try {
              const arrayBuffer = await new Response(item).arrayBuffer();
              console.log("Stream size:", arrayBuffer.byteLength, "bytes");

              const uint8Array = new Uint8Array(arrayBuffer);
              const base64 = Buffer.from(uint8Array).toString("base64");

              // Create uploads directory if it doesn't exist
              const uploadsDir = path.join(process.cwd(), "uploads");
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }

              // Save image with timestamp
              const timestamp = Date.now();
              const filename = `generated_image_${timestamp}_${i}.webp`;
              const filepath = path.join(uploadsDir, filename);

              fs.writeFileSync(filepath, uint8Array);
              console.log(`Image saved as '${filename}'`);

              results.push({
                index: i,
                filename: filename,
                filepath: filepath,
                base64: base64,
                size: arrayBuffer.byteLength,
              });

              // Clean up the file after saving to results
              const imageProcessor = new ImageProcessor();
              await imageProcessor.cleanupUploadedFile(filepath, filename);
            } catch (streamError) {
              console.error(`Error processing stream ${i}:`, streamError);
              results.push({
                index: i,
                error: "Failed to process image stream",
              });
            }
          } else if (typeof item === "string") {
            // If it's a URL or string
            results.push({
              index: i,
              url: item,
              type: "url",
            });
          } else {
            results.push({
              index: i,
              data: item,
              type: "unknown",
            });
          }
        }

        res.json({
          success: true,
          model: model,
          input: input,
          results: results,
          totalGenerated: results.length,
        });
      } else {
        res.json({
          success: true,
          model: model,
          input: input,
          output: output,
        });
      }
    } catch (error) {
      console.error("Error running model:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.toString(),
      });
    }
  }

  /**
   * Generate images with multiple inputs (2-3 images: 1 URL + 1-2 uploaded files)
   * Creates A4 composition and uploads to Cloudinary
   */
  static async generateWithMultipleImages(req, res) {
    try {
      let {
        imageUrls = [],
        prompt,
        quality = "auto",
        background = "auto",
        aspect_ratio = "1:1",
      } = req.body;
      const uploadedFiles = req.files || [];
      prompt = PROMPT;
      let parsedImageUrls = imageUrls;
      if (typeof imageUrls === "string") {
        try {
          parsedImageUrls = JSON.parse(imageUrls);
        } catch (parseError) {
          console.error("Error parsing imageUrls:", parseError);
          return res.status(400).json({
            success: false,
            error: "Invalid imageUrls format. Expected JSON array.",
          });
        }
      }

      if (!Array.isArray(parsedImageUrls) || parsedImageUrls.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one image URL is required",
        });
      }

      if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one image file must be uploaded",
        });
      }

      const totalImages = parsedImageUrls.length + uploadedFiles.length;
      if (totalImages < 2 || totalImages > 3) {
        return res.status(400).json({
          success: false,
          error: "Total images must be between 2 and 3 (URLs + uploaded files)",
        });
      }

      // Generate unique generation ID
      const generationId = `gen_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const userId = req.user.id;

      // Start tracking this generation
      if (global.socketService) {
        global.socketService.startTrackingGeneration(generationId, userId, {
          status: "started",
          message: "Image generation started...",
          progress: 0,
          type: "generate",
        });

        global.socketService.sendToUserRoom(userId, "generation_started", {
          generationId,
          status: "started",
          message: "Image generation started...",
        });
      }

      // Send continue notification
      if (global.socketService) {
        global.socketService.sendToUserRoom(userId, "continue", {
          generationId,
          status: "composition",
          message: "Composing images...",
          progress: 20,
        });
      }

      const imageComposer = new ImageComposer();

      const compositionResult = await imageComposer.composeAndUpload(
        uploadedFiles,
        parsedImageUrls
      );

      // Send continue notification
      if (global.socketService) {
        global.socketService.sendToUserRoom(userId, "continue", {
          generationId,
          status: "composition_completed",
          message: "Image composition completed, starting AI generation...",
          progress: 40,
          compositionUrl: compositionResult.cloudinaryUrl,
        });
      }

      let replicateResult = null;
      if (prompt) {
        try {
          const replicateService = new ReplicateService();

          // Use face swap if we have image URLs (first URL will be used for face swap)
          if (parsedImageUrls.length > 0) {
            // Send face swap started notification
            // if (global.socketService) {
            //   global.socketService.sendToUserRoom(userId, "face_swap_started", {
            //     generationId,
            //     status: "face_swap_started",
            //     message: "Face swap started...",
            //   });
            // }

            const result = await replicateService.generateImageWithFaceSwap(
              prompt,
              compositionResult.cloudinaryUrl,
              parsedImageUrls[0], // First image URL for face swap
              {
                quality,
                background,
                aspect_ratio: "2:3",
              }
            );

            replicateResult = {
              success: true,
              generatedImageUrl: result.generatedImageUrl,
              faceSwapUrl: result.faceSwapUrl,
            };

            // Send face swap completed notification
            // if (global.socketService) {
            //   global.socketService.sendToUserRoom(
            //     userId,
            //     "face_swap_completed",
            //     {
            //       generationId,
            //       status: "face_swap_completed",
            //       generatedImageUrl: result.generatedImageUrl,
            //       faceSwapUrl: result.faceSwapUrl,
            //       message: "Face swap completed successfully!",
            //     }
            //   );
            // }
          } else {
            // Send continue notification
            if (global.socketService) {
              global.socketService.sendToUserRoom(userId, "continue", {
                generationId,
                status: "ai_generation",
                message: "AI image generation started...",
                progress: 60,
              });
            }

            // Fallback to regular generation if no image URLs
            const generatedImageUrl = await replicateService.generateImage(
              prompt,
              compositionResult.cloudinaryUrl,
              {
                quality,
                background,
                aspect_ratio: "2:3",
              }
            );

            replicateResult = {
              success: true,
              generatedImageUrl: generatedImageUrl,
            };

            // Send AI generation completed notification
            // if (global.socketService) {
            //   global.socketService.sendToUserRoom(
            //     userId,
            //     "ai_generation_completed",
            //     {
            //       generationId,
            //       status: "ai_generation_completed",
            //       generatedImageUrl: generatedImageUrl,
            //       message: "AI image generation completed successfully!",
            //     }
            //   );
            // }
          }
        } catch (replicateError) {
          console.error("Replicate generation failed:", replicateError);
          replicateResult = {
            success: false,
            error: replicateError.message,
          };

          // Send generation failed notification
          if (global.socketService) {
            global.socketService.sendToUserRoom(userId, "generation_failed", {
              generationId,
              status: "failed",
              error: replicateError.message,
              message: "Image generation failed!",
            });
          }
        }
      }

      await GenerateController.createGenerationWithUserId(req.user.id, {
        input_url: compositionResult.cloudinaryUrl,
        output_url: replicateResult.generatedImageUrl,
        swaped_url: replicateResult.faceSwapUrl,
      });

      await GenerateController.updateUserCredit(
        req.user.id,
        req.user.imageCredit - 1
      );

      // Send final completion notification
      if (global.socketService && replicateResult.success) {
        global.socketService.sendToUserRoom(userId, "generation_completed", {
          generationId,
          status: "completed",
          compositionUrl: compositionResult.cloudinaryUrl,
          generatedImageUrl: replicateResult.generatedImageUrl,
          faceSwapUrl: replicateResult.faceSwapUrl,
          credit: req.user.imageCredit - 1,
          message: "Image generation completed successfully!",
        });
      }

      // Clean up uploaded files after processing
      const imageProcessor = new ImageProcessor();
      await imageProcessor.cleanupUploadedFiles(uploadedFiles);

      res.json({
        success: true,
        generationId,
        composition: compositionResult,
        replicateGeneration: replicateResult,
        summary: {
          totalInputImages: totalImages,
          urlCount: imageUrls.length,
          uploadedCount: uploadedFiles.length,
          hasPrompt: !!prompt,
          cloudinaryUrl: compositionResult.cloudinaryUrl,
        },
      });
    } catch (error) {
      console.error("Error in generateWithMultipleImages:", error);

      // Send error notification
      if (global.socketService && req.user) {
        global.socketService.sendToUserRoom(req.user.id, "generation_failed", {
          generationId: `gen_${Date.now()}`,
          status: "failed",
          error: error.message,
          message: "Image generation failed!",
        });
      }

      res.status(500).json({
        success: false,
        error: error.message,
        details: error.toString(),
      });
    }
  }

  /**
   * Legacy method for single image upload
   */
  static async generateWithImage(req, res) {
    try {
      const {
        prompt,
        quality = "auto",
        background = "auto",
        aspect_ratio = "1:1",
      } = req.body;
      const imageFile = req.file;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!imageFile) {
        return res.status(400).json({ error: "Image file is required" });
      }

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
        image: imageFile.path,
      };

      const output = await replicate.run(model, { input });

      // Clean up the uploaded image file after processing
      const imageProcessorForLegacy = new ImageProcessor();
      await imageProcessorForLegacy.cleanupUploadedFile(
        imageFile.path,
        imageFile.originalname
      );

      res.json({
        success: true,
        model: model,
        input: input,
        output: output,
      });
    } catch (error) {
      console.error("Error running model with image:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get validation rules for client
   */
  static async getValidationRules(req, res) {
    try {
      const imageComposer = new ImageComposer();
      const rules = imageComposer.getValidationRules();

      res.json({
        success: true,
        validationRules: rules,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Test Cloudinary connection
   */
  static async testCloudinary(req, res) {
    try {
      const imageComposer = new ImageComposer();
      const testResult = await imageComposer.testCloudinaryConnection();

      res.json(testResult);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
  static async createGenerationWithUserId(userId, generationData) {
    console.log({ userId });
    try {
      const response = await axios.post(
        `${process.env.API_URL}/api/generations`,
        {
          data: {
            input_url: generationData.input_url,
            output_url: generationData.output_url,
            swaped_url: generationData.swaped_url,
            success: generationData.success || false,
            type: generationData.type || "IMAGE",
            users_permissions_user: userId, // User ID'si (sayı)
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.API_KEY}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error:", error.response?.data);
      throw error;
    }
  }
  static async updateUserCredit(userId, newCredit) {
    console.log({ userId, newCredit });
    if (isNaN(newCredit)) {
      return;
    }
    try {
      const response = await axios.put(
        `${process.env.API_URL}/api/users/${userId}`,
        {
          imageCredit: newCredit,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.API_KEY}`,
          },
        }
      );

      console.log("Credit updated:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error updating credit:", error.response?.data);
      throw error;
    }
  }

  static async editImageWithOpenAI(req, res) {
    try {
      let {
        imageUrls = [],
        prompt,
        quality = "auto",
        background = "auto",
        aspect_ratio = "1:1",
        input_fidelity = "low",
      } = req.body;
      const uploadedFiles = req.files || [];

      // Function to send periodic status updates
      const sendPeriodicUpdates = (userId, generationId, inputImage) => {
        const interval = setInterval(() => {
          if (global.socketService) {
            global.socketService.sendToUserRoom(userId, "continue", {
              generationId,
              status: "processing",
              message: "Image editing in progress...",
              timestamp: new Date().toISOString(),
              inputImage,
            });
          }
        }, 2000); // Send every 2 seconds

        return interval; // Return interval ID to clear it later
      };

      let parsedImageUrls = imageUrls;
      if (typeof imageUrls === "string") {
        try {
          parsedImageUrls = JSON.parse(imageUrls);
        } catch (parseError) {
          console.error("Error parsing imageUrls:", parseError);
          return res.status(400).json({
            success: false,
            error: "Invalid imageUrls format. Expected JSON array.",
          });
        }
      }

      if (!Array.isArray(parsedImageUrls) || parsedImageUrls.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one image URL is required",
        });
      }

      if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one image file must be uploaded",
        });
      }

      const totalImages = parsedImageUrls.length + uploadedFiles.length;
      if (totalImages < 2 || totalImages > 3) {
        return res.status(400).json({
          success: false,
          error: "Total images must be between 2 and 3 (URLs + uploaded files)",
        });
      }

      // Generate unique generation ID
      const generationId = `edit_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const userId = req.user.id;

      // Send generation started notification
      if (global.socketService) {
        global.socketService.sendToUserRoom(userId, "generation_started", {
          generationId,
          status: "started",
          message: "Image editing started...",
          inputImage: parsedImageUrls[0],
        });
      }

      // Start periodic status updates
      const statusInterval = sendPeriodicUpdates(
        userId,
        generationId,
        parsedImageUrls[0]
      );

      const imageComposer = new ImageComposer();

      // Update generation status to composition
      if (global.socketService) {
        global.socketService.updateGenerationStatus(generationId, {
          status: "composition",
          message: "Composing images...",
          progress: 20,
          inputImage: parsedImageUrls[0],
        });
      }

      const compositionResult = await imageComposer.composeAndUpload(
        uploadedFiles,
        parsedImageUrls
      );

      // Send continue notification
      if (global.socketService) {
        global.socketService.sendToUserRoom(userId, "continue", {
          generationId,
          status: "composition_completed",
          message: "Image composition completed, starting OpenAI editing...",
          progress: 40,
          compositionUrl: compositionResult.cloudinaryUrl,
          inputImage: parsedImageUrls[0],
        });
      }

      let openaiResult = null;
      if (prompt) {
        try {
          // Send continue notification
          if (global.socketService) {
            global.socketService.sendToUserRoom(userId, "continue", {
              generationId,
              status: "openai_editing",
              message: "OpenAI image editing started...",
              progress: 60,
              inputImage: parsedImageUrls[0],
            });
          }

          // Download the composed image from Cloudinary
          const imageResponse = await axios.get(
            compositionResult.cloudinaryUrl,
            {
              responseType: "arraybuffer",
            }
          );

          // Convert to OpenAI format using toFile
          const { toFile } = await import("openai");
          const imageBuffer = Buffer.from(imageResponse.data);
          const imageFile = await toFile(imageBuffer, "image.png", {
            type: "image/png",
          });

          console.log("imageFileaasdasdsads");
          // Use OpenAI's image editing API
          const response = await openai.images.edit({
            model: "gpt-image-1",
            image: imageFile,
            prompt: prompt || PROMPT,
            n: 1,
            input_fidelity: input_fidelity,
            size: "1024x1536",
          });
          console.log("asdasdasdasdsadsadasd");

          // Convert base64 to buffer and save to file
          const image_base64 = response.data[0].b64_json;

          const image_bytes = Buffer.from(image_base64, "base64");
          // Save to uploads directory with timestamp
          const timestamp = Date.now();
          const filename = `edited_image_${timestamp}.png`;
          const filepath = path.join(process.cwd(), "uploads", filename);

          fs.writeFileSync(filepath, image_bytes);

          // Upload to Cloudinary to get URL
          const cloudinaryService = new CloudinaryService();
          const cloudinaryResult = await cloudinaryService.uploadImage(
            filepath,
            "openai-edits",
            `edited_image_${timestamp}`
          );

          // Clean up the local file after uploading to Cloudinary
          const imageProcessorForCleanup = new ImageProcessor();
          await imageProcessorForCleanup.cleanupUploadedFile(
            filepath,
            filename
          );

          openaiResult = {
            success: true,
            editedImageUrl: cloudinaryResult.url,
            localFilePath: null, // Set to null since file is cleaned up
          };

          // Send continue notification
          if (global.socketService) {
            global.socketService.sendToUserRoom(userId, "continue", {
              generationId,
              status: "openai_editing_completed",
              message: "OpenAI image editing completed successfully!",
              progress: 80,
              editedImageUrl: cloudinaryResult.url,
              inputImage: parsedImageUrls[0],
            });
          }

          // Now apply face swap if we have image URLs
          if (parsedImageUrls.length > 0) {
            try {
              const replicateService = new ReplicateService();

              // Send face swap started notification
              if (global.socketService) {
                global.socketService.sendToUserRoom(userId, "continue", {
                  generationId,
                  status: "face_swap",
                  message: "Applying face swap...",
                  progress: 85,
                  inputImage: parsedImageUrls[0],
                });
              }

              const faceSwapResult =
                await replicateService.generateImageWithFaceSwap(
                  prompt,
                  cloudinaryResult.url, // Use the OpenAI edited image
                  parsedImageUrls[0], // First image URL for face swap
                  {
                    quality,
                    background,
                    aspect_ratio: "2:3",
                  }
                );

              // Update openaiResult with face swap results
              openaiResult = {
                success: true,
                editedImageUrl: faceSwapResult.generatedImageUrl,
                faceSwapUrl: faceSwapResult.faceSwapUrl,
                localFilePath: filepath,
              };

              // Send face swap completed notification
              if (global.socketService) {
                global.socketService.sendToUserRoom(userId, "continue", {
                  generationId,
                  status: "face_swap_completed",
                  message: "Face swap completed successfully!",
                  progress: 95,
                  generatedImageUrl: faceSwapResult.generatedImageUrl,
                  faceSwapUrl: faceSwapResult.faceSwapUrl,
                  inputImage: parsedImageUrls[0],
                });
              }
            } catch (faceSwapError) {
              console.error("Face swap failed:", faceSwapError);
              // Keep the OpenAI result even if face swap fails
              openaiResult = {
                success: true,
                editedImageUrl: cloudinaryResult.url,
                faceSwapUrl: null,
                localFilePath: filepath,
                faceSwapError: faceSwapError.message,
              };

              // Send face swap failed notification
              if (global.socketService) {
                global.socketService.sendToUserRoom(userId, "continue", {
                  generationId,
                  status: "face_swap_failed",
                  message:
                    "Face swap failed, but OpenAI editing completed successfully!",
                  progress: 90,
                  error: faceSwapError.message,
                  inputImage: parsedImageUrls[0],
                });
              }
            }
          }
        } catch (openaiError) {
          console.error("OpenAI editing failed:", openaiError);
          openaiResult = {
            success: false,
            error: openaiError.message,
          };

          // Clear periodic updates and send generation failed notification
          if (statusInterval) {
            clearInterval(statusInterval);
          }

          if (global.socketService) {
            global.socketService.sendToUserRoom(userId, "generation_failed", {
              generationId,
              status: "failed",
              error: openaiError.message,
              message: "Image editing failed!",
              inputImage: parsedImageUrls[0],
            });
          }
        }
      }

      await GenerateController.createGenerationWithUserId(req.user.id, {
        input_url: compositionResult.cloudinaryUrl,
        output_url: openaiResult.editedImageUrl,
        swaped_url: openaiResult.faceSwapUrl,
      });

      await GenerateController.updateUserCredit(
        req.user.id,
        req.user.imageCredit - 1
      );

      // Clear periodic updates and send final completion notification
      if (statusInterval) {
        clearInterval(statusInterval);
      }

      if (global.socketService && openaiResult.success) {
        global.socketService.sendToUserRoom(userId, "generation_completed", {
          generationId,
          status: "completed",
          compositionUrl: compositionResult.cloudinaryUrl,
          editedImageUrl: openaiResult.editedImageUrl,
          faceSwapUrl: openaiResult.faceSwapUrl,
          credit: req.user.imageCredit - 1,
          message: "Image editing completed successfully!",
          inputImage: parsedImageUrls[0],
        });
      }

      // Clean up uploaded files after processing
      const imageProcessor = new ImageProcessor();
      await imageProcessor.cleanupUploadedFiles(uploadedFiles);

      res.json({
        success: true,
        generationId,
        composition: compositionResult,
        openaiEditing: openaiResult,
        summary: {
          totalInputImages: totalImages,
          urlCount: imageUrls.length,
          uploadedCount: uploadedFiles.length,
          hasPrompt: !!prompt,
          cloudinaryUrl: compositionResult.cloudinaryUrl,
          hasFaceSwap: parsedImageUrls.length > 0,
        },
      });
    } catch (error) {
      console.error("Error in editImageWithOpenAI:", error);

      // Clear periodic updates and send error notification
      if (statusInterval) {
        clearInterval(statusInterval);
      }

      if (global.socketService && req.user) {
        const errorGenerationId = `edit_${Date.now()}`;

        // If we have a generationId from the request, use it
        const generationId = req.body.generationId || errorGenerationId;

        global.socketService.sendToUserRoom(req.user.id, "generation_failed", {
          generationId,
          status: "failed",
          error: error.message,
          message: "Image editing failed!",
          inputImage: parsedImageUrls[0],
        });
      }

      res.status(500).json({
        success: false,
        error: error.message,
        details: error.toString(),
      });
    }
  }

  static async editImagesWithOpenAI(req, res) {
    let statusInterval = null;
    try {
      // Validation: Check if user is authenticated
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Validation: Check user credit
      if (req.user.imageCredit <= 0) {
        return res.status(402).json({
          success: false,
          error: "Insufficient image credit",
        });
      }

      let {
        imageUrls = [],
        prompt,
        input_fidelity = "low",
        quality = "auto",
        background = "auto",
        aspect_ratio = "1:1",
      } = req.body;
      const uploadedFiles = req.files || [];

      // Validation: Parse and validate imageUrls
      let parsedImageUrls = imageUrls;
      if (typeof imageUrls === "string") {
        try {
          parsedImageUrls = JSON.parse(imageUrls);
        } catch (parseError) {
          console.error("Error parsing imageUrls:", parseError);
          return res.status(400).json({
            success: false,
            error: "Invalid imageUrls format. Expected JSON array.",
          });
        }
      }

      // Validation: Check if we have at least one image source
      if (
        (!Array.isArray(parsedImageUrls) || parsedImageUrls.length === 0) &&
        (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0)
      ) {
        return res.status(400).json({
          success: false,
          error: "At least one image (URL or uploaded file) is required",
        });
      }

      // Generate unique generation ID
      const generationId = `edit_images_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const userId = req.user.id;

      // Send generation started notification
      if (global.socketService) {
        global.socketService.sendToUserRoom(userId, "generation_started", {
          generationId,
          status: "started",
          message: "Image editing started...",
          inputImage: parsedImageUrls.length > 0 ? parsedImageUrls[0] : null,
        });
      }

      // Periodic updates function
      const sendPeriodicUpdates = (userId, generationId, inputImage) => {
        const interval = setInterval(() => {
          if (global.socketService) {
            global.socketService.sendToUserRoom(userId, "continue", {
              generationId,
              status: "processing",
              message: "Image editing in progress...",
              timestamp: new Date().toISOString(),
              inputImage,
            });
          }
        }, 2000); // Send every 2 seconds
        return interval;
      };

      // Start periodic status updates
      const statusInterval = sendPeriodicUpdates(
        userId,
        generationId,
        parsedImageUrls.length > 0 ? parsedImageUrls[0] : null
      );

      // Convert uploadedFiles to OpenAI format using toFile
      const { toFile } = await import("openai");

      // Convert uploaded files to OpenAI format
      const uploadedImages = await Promise.all(
        uploadedFiles.map(
          async (file) =>
            await toFile(fs.createReadStream(file.path), null, {
              type: "image/png",
            })
        )
      );

      // Convert image URLs to files
      const urlImages = await Promise.all(
        parsedImageUrls.map(async (url) => {
          const response = await axios.get(url, {
            responseType: "arraybuffer",
          });
          const buffer = Buffer.from(response.data);
          return await toFile(buffer, null, {
            type: "image/png",
          });
        })
      );

      // Combine both uploaded files and URL images
      const images = [...uploadedImages, ...urlImages];

      // Send continue notification for OpenAI processing
      if (global.socketService) {
        global.socketService.sendToUserRoom(userId, "continue", {
          generationId,
          status: "openai_processing",
          message: "Processing images with OpenAI...",
          progress: 60,
          inputImage: parsedImageUrls.length > 0 ? parsedImageUrls[0] : null,
        });
      }

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: images,
        prompt: prompt || PROMPT,
        input_fidelity: input_fidelity,
        size: "1024x1536",
        // quality: quality,
        // background: background,
        // aspect_ratio: aspect_ratio,
      });
      let image_base64 = response.data[0].b64_json;
      let image_bytes = Buffer.from(image_base64, "base64");
      let filename = `edited_image_${Date.now()}.png`;
      let filepath = path.join(process.cwd(), "uploads", filename);
      fs.writeFileSync(filepath, image_bytes);

      // // Send continue notification for Cloudinary upload
      // if (global.socketService) {
      //   global.socketService.sendToUserRoom(userId, "continue", {
      //     generationId,
      //     status: "uploading",
      //     message: "Uploading edited image...",
      //     progress: 80,
      //     inputImage: parsedImageUrls.length > 0 ? parsedImageUrls[0] : null,
      //   });
      // }

      const cloudinaryService = new CloudinaryService();
      let cloudinaryResult = await cloudinaryService.uploadImage(
        filepath,
        "openai-edits",
        `edited_image_${Date.now()}`
      );

      // Clean up the local file after uploading to Cloudinary
      const imageProcessorForCleanup2 = new ImageProcessor();
      await imageProcessorForCleanup2.cleanupUploadedFile(filepath, filename);

      // Clear periodic updates and send final completion notification
      if (statusInterval) {
        clearInterval(statusInterval);
      }

      if (global.socketService) {
        global.socketService.sendToUserRoom(userId, "generation_completed", {
          generationId,
          status: "completed",
          editedImageUrl: cloudinaryResult.url,
          faceSwapUrl: cloudinaryResult.url,
          credit: req.user.imageCredit - 1,
          message: "Image editing completed successfully!",
          inputImage: parsedImageUrls.length > 0 ? parsedImageUrls[0] : null,
        });
      }
      await GenerateController.createGenerationWithUserId(req.user.id, {
        input_url: cloudinaryResult.url,
        output_url: cloudinaryResult.url,
        swaped_url: cloudinaryResult.url,
      });

      // Clean up uploaded files after processing
      const imageProcessor = new ImageProcessor();
      await imageProcessor.cleanupUploadedFiles(uploadedFiles);

      // Update user credit
      await GenerateController.updateUserCredit(
        userId,
        req.user.imageCredit - 1
      );

      return res.json({
        success: true,
        generationId,
        editedImageUrl: cloudinaryResult.url,
        swaped_url: cloudinaryResult.url,
        cloudinaryResult,
        usage: response.usage,
        summary: {
          totalInputImages: images.length,
          urlCount: parsedImageUrls.length,
          uploadedCount: uploadedFiles.length,
          hasPrompt: !!prompt,
        },
      });
    } catch (error) {
      if (statusInterval) {
        clearInterval(statusInterval);
      }

      // Clear periodic updates and send error notification

      if (global.socketService && req.user) {
        const errorGenerationId = `edit_images_${Date.now()}`;
        const generationId = req.body.generationId || errorGenerationId;

        global.socketService.sendToUserRoom(req.user.id, "generation_failed", {
          generationId,
          status: "failed",
          error: error.message,
          message: "Image editing failed!",
          inputImage: req.body.imageUrls
            ? JSON.parse(req.body.imageUrls)[0]
            : null,
        });
      }

      res.status(500).json({
        success: false,
        error: error.message,
        details: error.toString(),
      });
    } finally {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    }
  }
}

export default GenerateController;
