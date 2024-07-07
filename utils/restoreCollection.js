
const path = require('path');
const isLocal = typeof process.pkg === 'undefined';
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require('fs-extra');
const { Select, prompt } = require('enquirer');

const runScript = async () => {
  const choices = [
    'Restore from Backup', 
    'Restore from Cache', 
    'Restore from Archive'
  ];

  const restoreWhat = new Select({
    name: 'restoreSelection',
    message: 'What would you like to restore?',
    choices: ['Restore from Backup', 'Restore from Cache', 'Restore from Archive'],
  });

  const restoreSelection = await restoreWhat.run();

  if (restoreSelection === choices[0]) {
    let backups = fs.readdirSync(`${basePath}/backup`);

    if (backups.length === 0) {
      console.log('No backups found');
      return;
    } else {
      const selectBackup = new Select({
        name: 'backupSelection',
        message: 'Which backup would you like to restore?',
        choices: backups,
      });

      const selectedBackup = await selectBackup.run();
      const sourceDir = `${basePath}/backup/${selectedBackup}`;
      const destinationDir = `${basePath}/build/json`;

      fs.emptyDirSync(destinationDir);
      fs.copySync(sourceDir, destinationDir);
      console.log('Backup restored successfully');
    }    
  } else if (restoreSelection === choices[1]) {
    const sourceDir = `${basePath}/cache`;
    let cacheFiles = fs.readdirSync(sourceDir);

    if (cacheFiles.length === 0) {
      console.log('No cache files found');
      return;
    } else {
      const selectCache = new Select({
        name: 'cacheSelection',
        message: 'Which cached run would you like to restore?',
        choices: cacheFiles,
      });

      const selectedCache = await selectCache.run();
      const sourceFile = `${basePath}/backup/${selectedCache}/_imgData.json`;

      let rawdata = fs.readFileSync(sourceFile);
      let data = JSON.parse(rawdata);

      let allMetadata = [];

      data.forEach((item) => {

        for (let i = item.attributes.length - 1; i >= 0; i--) {
          delete item.attributes[i].imgData;
          if (!Object.keys(item.attributes[i]).length > 0 || item.attributes[i].exclude) {
            item.attributes.splice(i, 1);
          } else {
            delete item.attributes[i].exclude;
          }
        }

        fs.writeFileSync(`${basePath}/build/json/${data.edition}.json`, JSON.stringify(data, null, 2));

        allMetadata.push(item);
      });

      fs.writeFileSync(`${buildDir}/json/_metadata.json`, JSON.stringify(allMetadata, null, 2));
    }
    console.log('Cache restored successfully');
  } else if (restoreSelection === choices[2]) {
    // You're tired. This is all copilot generated. Review and fix as needed.
    const archives = fs.readdirSync(`${basePath}/archive`);

    if (archives.length === 0) {
      console.log('No archives found');
      return;
    } else {
      const selectArchive = new Select({
        name: 'archiveSelection',
        message: 'Which archive would you like to restore?',
        choices: archives,
      });

      const selectedArchive = await selectArchive.run();
      const sourceSrc = `${basePath}/archive/${selectedArchive}/src`;
      const destinationSrc = `${basePath}/src`;
      const sourceLayers = `${basePath}/archive/${selectedArchive}/layers`;
      const destinationLayers = `${basePath}/layers`;

      fs.emptyDirSync(destinationSrc);
      fs.emptyDirSync(destinationLayers);
      fs.copySync(sourceSrc, destinationSrc);
      fs.copySync(sourceLayers, destinationLayers);
      console.log('Archive restored successfully');
    }
  }
};

runScript();
