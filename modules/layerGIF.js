const fs = require("fs");
const path = require("path");
const basePath = process.cwd();
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const GifEncoder = require("gif-encoder-2");
const { createCanvas, loadImage } = require("canvas");
const {format, gif } = require(`${basePath}/src/config.js`);

/**
 * Extract frames from a GIF using ffmpeg and return them as buffers.
 * @param {string} gifPath - Path to the GIF.
 * @returns {Promise<Array<Buffer>>} - Resolves with an array of frame buffers.
 */
const gifToBuffer = (gifPath) => {
  return new Promise((resolve, reject) => {
    const outputFolder = path.join(path.dirname(gifPath), "temp_frames", path.basename(gifPath, ".gif"));
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Check if frames already exist
    const frameFiles = fs
      .readdirSync(outputFolder)
      .filter((file) => file.toLowerCase().endsWith(".png"))
      .sort();

    if (frameFiles.length > 0) {
      // Frames already exist; read them into buffers
      const buffers = frameFiles.map((file) =>
        fs.readFileSync(path.join(outputFolder, file))
      );
      return resolve(buffers);
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
        const newFrameFiles = fs
          .readdirSync(outputFolder)
          .filter((file) => file.toLowerCase().endsWith(".png"))
          .sort();

        if (newFrameFiles.length === 0) {
          return reject("No frames extracted from the GIF.");
        }

        const buffers = newFrameFiles.map((file) =>
          fs.readFileSync(path.join(outputFolder, file))
        );

        resolve(buffers);
      }
    );
  });
};

/**
 * Recursively delete all contents of a directory, including subdirectories and files.
 * @param {string} dirPath - The directory path to clean up.
 */
const deleteDirectoryContents = (dirPath) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Recursively delete subdirectories
      deleteDirectoryContents(entryPath);
      fs.rmdirSync(entryPath);
    } else {
      // Delete files
      fs.unlinkSync(entryPath);
    }
  }
};

/**
 * Recursively find and clean up all temp_frames directories.
 * @param {string} baseDir - The base directory to start the search.
 */
const cleanupTempFrames = (baseDir) => {
  // console.log(`Searching for temp_frames directories in: ${baseDir}`);

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "temp_frames") {
        // Clean up the temp_frames directory
        // console.log(`Cleaning up temp_frames: ${entryPath}`);
        deleteDirectoryContents(entryPath); // Recursively delete contents
        fs.rmdirSync(entryPath); // Remove the empty temp_frames directory
        // console.log(`Deleted: ${entryPath}`);
      } else {
        // Recursively check subdirectories
        cleanupTempFrames(entryPath);
      }
    }
  }
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

    const maxFrames = gif.numberOfFrames;
    const firstFrameBuffer = gifBuffers[Object.keys(gifBuffers)[0]][0];
    const firstFrame = await loadImage(firstFrameBuffer);

    const width = format.width;
    const height = format.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Initialize GifEncoder
    const gifEncoder = new GifEncoder(width, height, "octree");
    const outputStream = fs.createWriteStream(outputFile);

    gifEncoder.setRepeat(gif.repeat); 
    gifEncoder.setDelay(gif.delay); 
    gifEncoder.start();
    gifEncoder.createReadStream().pipe(outputStream);

    for (let i = 0; i < maxFrames; i++) {
      ctx.clearRect(0, 0, width, height);

      // Draw GIF frames
      for (const [gifName, frames] of Object.entries(gifBuffers)) {
        const totalFrames = frames.length;
        const frameIndex = Math.floor((i / maxFrames) * totalFrames);
        const frameImage = await loadImage(frames[frameIndex]);
        ctx.drawImage(frameImage, 0, 0);
      }

      // Draw PNGs on every frame
      for (const pngImage of pngImages) {
        ctx.drawImage(pngImage, 0, 0, width, height);
      }

      gifEncoder.addFrame(ctx);
    }

    gifEncoder.finish();
  } catch (error) {
    console.error("Error creating GIF:", error);
  }
};

module.exports = { combineGIF, cleanupTempFrames };
