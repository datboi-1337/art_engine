const fs = require("fs");
const readline = require('readline');
const basePath = process.cwd();
const { createPNG } = require(`${basePath}/src/main.js`);

if (!fs.existsSync(`${basePath}/build/json/_imgData.json`)) {
  throw new Error('_imgData not found! Please run `npm run generate` instead to create new metadata. ');
}

const runScript = async () => {
  await createPNG();
};

runScript().catch(err => {
  console.error('An error occurred:', err);
});
