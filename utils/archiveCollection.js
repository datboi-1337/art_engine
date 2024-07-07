
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

    // Copy './layers/' folder and its contents to target directory
    const srcFolder = './src';
    const targetSrcFolder = path.join(targetDirectory, 'src');
    await fs.copy(srcFolder, targetSrcFolder);

    // Copy './layers/' folder and its contents to target directory
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
