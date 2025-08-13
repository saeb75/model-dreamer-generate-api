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
import { fal } from "@fal-ai/client";
import GenerateController from "./generate.controller.js";

dotenv.config();

fal.config({
  credentials: process.env.FAL_KEY,
});

class TryOnController {
  static async generate(req, res) {
    try {
      const { modelImage } = req.body;
      const images = req.files;

      // Generate unique generation ID
      const generationId = `tryon_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const userId = req.user.id;

      // Send generation started notification
      if (global.socketService) {
        global.socketService.sendToUserRoom(userId, "generation_started", {
          generationId,
          status: "started",
          message: "Try-on generation started...",
          inputImage: modelImage,
        });
      }

      const imageUrl = await TryOnController.combineImages(images);

      const result = await fal.subscribe("easel-ai/fashion-tryon", {
        input: {
          full_body_image: modelImage,
          clothing_image: imageUrl.url,
          gender: "female",
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(console.log);
          }
          if (global.socketService) {
            global.socketService.sendToUserRoom(userId, "continue", {
              generationId,
              status: "processing",
              message: "AI try-on in progress...",
              timestamp: new Date().toISOString(),
              data: update,
              progress: 60,
              inputImage: modelImage,
            });
          }
        },
      });
      console.log({
        result: JSON.stringify(result),
      });

      if (global.socketService) {
        global.socketService.sendToUserRoom(userId, "generation_completed", {
          generationId,
          status: "completed",
          inputImage: modelImage,
          compositionUrl: result.data.image.url,
          generatedImageUrl: result.data.image.url,
          message: "Try-on generation completed successfully!",
        });
      }
      await GenerateController.createGenerationWithUserId(req.user.id, {
        input_url: imageUrl.url,
        output_url: result.data.image.url,
        swaped_url: result.data.image.url,
      });
      return res.status(200).json({
        success: true,
        message: "Try on generated successfully",
        image: result.data.image.url,
        generationId,
      });
    } catch (error) {
      console.log({ error });

      if (global.socketService && req.user) {
        global.socketService.sendToUserRoom(req.user.id, "generation_failed", {
          generationId: generationId,
          status: "failed",
          error: error.message,
          message: "Try-on generation failed!",
        });
      }

      res.status(500).json({ error: error.message });
    }
  }

  static async combineImages(images) {
    try {
      const imageComposer = new ImageProcessor();
      const cloudinaryService = new CloudinaryService();
      let imageCombine = null;

      if (images.length > 1) {
        const uploadedBuffers = images.map((file) =>
          fs.readFileSync(file.path)
        );

        const allImageBuffers = [...uploadedBuffers];
        let imageCombineBuffer = await imageComposer.createA4Canvas(
          allImageBuffers
        );
        imageCombine = await cloudinaryService.uploadBuffer(
          imageCombineBuffer,
          "try-on",
          "try-on"
        );
      } else {
        imageCombine = await cloudinaryService.uploadImage(images[0].path);
      }
      return imageCombine;
    } catch (error) {
      throw new Error(`Failed to combine images: ${error.message}`);
    }
  }
}

export default TryOnController;
