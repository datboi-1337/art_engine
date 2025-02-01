const fs = require('fs');
const path = require('path');
const gifFrames = require('gif-frames');
const GifEncoder = require('gif-encoder-2');
const { createCanvas, loadImage } = require('canvas');

/**
 * Extract frames from a GIF and return them as buffers.
 * @param {string} gifURL - Path or URL to the GIF.
 * @returns {Promise<Array<Buffer>>} - Resolves with an array of frame buffers.
 */
const gifToBuffer = (gifURL) => {
  return new Promise((resolve, reject) => {
    if (!gifURL.trim()) {
      return reject('GIF URL is required.');
    }

    gifFrames({ url: gifURL, frames: 'all', outputType: 'png' })
      .then((frameData) => {
        const buffers = [];
        let processedFrames = 0;

        frameData.forEach((frame, index) => {
          const chunks = [];
          const stream = frame.getImage();

          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => {
            buffers[index] = Buffer.concat(chunks);
            processedFrames++;

            if (processedFrames === frameData.length) {
              // All frames are processed
              resolve(buffers);
            }
          });

          stream.on('error', (err) => reject(err));
        });
      })
      .catch(reject);
  });
};

const combineGIF = async (imagePaths, outputFile) => {
  try {
    const gifBuffers = {};
    const pngImages = [];

    for (const filePath of imagePaths) {
      if (filePath.toLowerCase().endsWith('.gif')) {
        const gifName = path.basename(filePath, '.gif');
        gifBuffers[gifName] = await gifToBuffer(filePath);
      } else if (filePath.toLowerCase().endsWith('.png')) {
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
    const ctx = canvas.getContext('2d');

    // Initialize GifEncoder
    const gifEncoder = new GifEncoder(width, height, 'octree');
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

    // console.log(`Combined GIF saved to: ${outputFile}`);
  } catch (error) {
    console.error('Error creating GIF:', error);
  }
};

module.exports = combineGIF;
