const ffmpegPath = require('ffmpeg-static');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const inputDir = 'C:/Users/ricky/art_engine/layers/TEST';
const outputDir = 'C:/Users/ricky/art_engine/normalized_gifs';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Extract properties of the GIF (resolution and FPS)
const extractGifProperties = (inputPath) => {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      ['-i', inputPath],
      (error, stdout, stderr) => {
        if (error) {
          const match = stderr.match(/Stream #0:0.* (\d+)x(\d+).* (\d+) fps/);
          if (match) {
            const [, width, height, fps] = match;
            resolve({ width: parseInt(width), height: parseInt(height), fps: parseFloat(fps) });
          } else {
            reject(new Error('Could not extract GIF properties.'));
          }
        }
      }
    );
  });
};

// Normalize a single GIF and enforce original resolution
const normalizeGif = (inputPath, outputPath, width, height, fps) => {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      [
        '-i', inputPath,
        '-filter_complex',
        `[0:v]fps=${fps},scale=${width}:${height}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        '-c:v', 'gif',
        '-y', outputPath,
      ],
      (error) => {
        if (error) {
          return reject(error);
        }
        resolve(`Normalized GIF saved to: ${outputPath}`);
      }
    );
  });
};



// Normalize all GIFs in the directory
const normalizeAllGifs = async () => {
  const gifFiles = fs
    .readdirSync(inputDir)
    .filter((file) => file.toLowerCase().endsWith('.gif'));

  if (gifFiles.length === 0) {
    console.log('No GIFs found in the input directory.');
    return;
  }

  console.log(`Found ${gifFiles.length} GIFs to normalize.`);

  for (const gifFile of gifFiles) {
    const inputPath = path.join(inputDir, gifFile);
    const outputPath = path.join(outputDir, gifFile);

    try {
      const { width, height, fps } = await extractGifProperties(inputPath);
      console.log(`Processing: ${gifFile} - Resolution: ${width}x${height}, FPS: ${fps}`);
      const result = await normalizeGif(inputPath, outputPath, width, height, fps);
      console.log(result);
    } catch (error) {
      console.error(`Error normalizing ${gifFile}:`, error.message);
    }
  }

  console.log('All GIFs processed.');
};

normalizeAllGifs();
