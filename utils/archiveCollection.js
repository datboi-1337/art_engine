
const fs = require('fs-extra');
const path = require('path');
const { prompt } = require('enquirer');

async function copyFilesAndFolders() {
  try {
    // Prompt user for name
    const response = await prompt({
      type: 'input',
      name: 'name',
      message: 'Enter a name:',
    });

    const enteredName = response.name;

    // Create target directory
    const targetDirectory = `archive/${enteredName}`;
    await fs.ensureDir(targetDirectory);

    // Copy src folder and its contents to archive directory
    const srcFolder = './src';
    const targetSrcFolder = path.join(targetDirectory, 'src');
    await fs.copy(srcFolder, targetSrcFolder);

    // Delete src contents and restore from template
    const configFile = './src/config.js';
    const mainFile = './src/main.js';
    const configTemplate = './srcTemplate/configTemplate.js';
    const mainTemplate = './srcTemplate/mainTemplate.js';

    await fs.remove(configFile);
    await fs.remove(mainFile);

    await fs.copyFile(configTemplate, configFile);
    await fs.copyFile(mainTemplate, mainFile);

    // Copy layers folder and its contents to target directory
    const layersFolder = './layers';
    const targetLayersFolder = path.join(targetDirectory, 'layers');
    await fs.copy(layersFolder, targetLayersFolder);

    // Delete contents of layers folder
    await fs.emptyDir(layersFolder);

    console.log('src files and layer folders archived successfully. Defaults restored');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

copyFilesAndFolders();
