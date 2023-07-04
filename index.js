const basePath = process.cwd();
const { startCreating, buildSetup } = require(`${basePath}/src/main.js`);

(() => {
  try {
    buildSetup();
    startCreating();
  } catch (err) {
    console.error(err);
  }
})();
