const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const GifEncoder = require("gif-encoder-2");
const { createCanvas, loadImage } = require("canvas");

/**
 * Extract frames from a GIF using ffmpeg and return them as buffers.
 * @param {string} gifPath - Path to the GIF.
 * @returns {Promise<Array<Buffer>>} - Resolves with an array of frame buffers.
 */
const gifToBuffer = (gifPath) => {
  return new Promise((resolve, reject) => {
    const outputFolder = path.join(path.dirname(gifPath), "temp_frames");
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Extract frames to the temp folder
    execFile(
      ffmpegPath,
      ["-i", gifPath, `${outputFolder}/frame_%04d.png`],
      (error) => {
        if (error) {
          return reject(error);
        }

        // Read the extracted frames into buffers
        const frameFiles = fs
          .readdirSync(outputFolder)
          .filter((file) => file.toLowerCase().endsWith(".png"))
          .sort(); // Ensure frames are in the correct order

        if (frameFiles.length === 0) {
          return reject("No frames extracted from the GIF.");
        }

        const buffers = frameFiles.map((file) =>
          fs.readFileSync(path.join(outputFolder, file))
        );

        // Clean up extracted frame files
        frameFiles.forEach((file) =>
          fs.unlinkSync(path.join(outputFolder, file))
        );
        fs.rmdirSync(outputFolder);

        resolve(buffers);
      }
    );
  });
};

const combineGIF = async (imagePaths, outputFile) => {
  try {
    const gifBuffers = {};
    const pngImages = [];

    for (const filePath of imagePaths) {
      if (filePath.toLowerCase().endsWith(".gif")) {
        const gifName = path.basename(filePath, ".gif");
        gifBuffers[gifName] = await gifToBuffer(filePath);
      } else if (filePath.toLowerCase().endsWith(".png")) {
        const pngImage = await loadImage(filePath);
        pngImages.push(pngImage);
      }
    }

    const maxFrames = 60; // TODO: pull this from config.
    const firstFrameBuffer = gifBuffers[Object.keys(gifBuffers)[0]][0];
    const firstFrame = await loadImage(firstFrameBuffer);

    const width = firstFrame.width;
    const height = firstFrame.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Initialize GifEncoder
    const gifEncoder = new GifEncoder(width, height, "octree");
    const outputStream = fs.createWriteStream(outputFile);

    gifEncoder.setRepeat(0); // TODO: pull this from config.
    gifEncoder.setDelay(40); // TODO: pull this from config.
    gifEncoder.start();
    gifEncoder.createReadStream().pipe(outputStream);

    for (let i = 0; i < maxFrames; i++) {
      ctx.clearRect(0, 0, width, height);

      // Draw GIF frames
      for (const [gifName, frames] of Object.entries(gifBuffers)) {
        const totalFrames = frames.length;
        const frameIndex = Math.floor((i / maxFrames) * totalFrames); // Determine which frame to use
        const frameImage = await loadImage(frames[frameIndex]);
        ctx.drawImage(frameImage, 0, 0);
      }

      // Draw PNGs on every frame
      for (const pngImage of pngImages) {
        ctx.drawImage(pngImage, 0, 0);
      }

      gifEncoder.addFrame(ctx);
    }

    gifEncoder.finish();
  } catch (error) {
    console.error("Error creating GIF:", error);
  }
};

module.exports = combineGIF;
