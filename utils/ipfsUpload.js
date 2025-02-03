const { upload } = require("thirdweb/storage");
const { createThirdwebClient } = require("thirdweb");
const fs = require("fs");
const path = require("path");
const basePath = process.cwd();
const { config } = require("dotenv");
const { oneOfOne } = require(`${basePath}/src/config.js`);

config();
console.log("Thirdweb Secret Key:", process.env.THIRDWEB_SECRET_KEY ? "Loaded" : "Not Found");

// Set up Thirdweb client
const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

// Get directory type from command-line argument
const directoryType = process.argv[2]; // 'images' or 'metadata'

// Define paths based on the directory type
const directories = {
  images: oneOfOne ? './layers/oneOfOne' : './build/images',
  metadata: './build/json',
};

// Check if the provided directory type is valid
if (!directories[directoryType]) {
  console.error("Invalid directory type. Use 'images' or 'metadata'.");
  process.exit(1);
}

(async () => {
  // Read and prepare files
  const directoryPath = directories[directoryType];
  const files = fs.readdirSync(directoryPath).map((filename) => {
    const filePath = path.join(directoryPath, filename);
    return {
      name: filename,
      data: fs.readFileSync(filePath),
    };
  });

  // Upload to IPFS
  const uri = await upload({
    client,
    files,
  });

  const cid = typeof(uri) == 'string' ? uri.split('/')[2] : uri[0].split('/')[2];

  console.log(`Uploaded ${directoryType} to IPFS with CID: ${cid}`);
})();
