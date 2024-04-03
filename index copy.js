const basePath = process.cwd();
const { startCreating, buildSetup, rarityBreakdown, createPNG } = require(`${basePath}/src/main.js`);

const runScript = async () => {
  const startTime = process.hrtime();

  buildSetup();
  await startCreating();
  await rarityBreakdown();

  const elapsedTime = process.hrtime(startTime);

  const elapsedMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1e6;

  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
  const milliseconds = Math.floor(elapsedMs % 1000);

  console.log(`Created metadata in ${hours} hours, ${minutes} minutes, ${seconds} seconds, and ${milliseconds} milliseconds.`);

  // await createPNG();
};

runScript().catch(err => {
  console.error('An error occurred:', err);
});
