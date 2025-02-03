const fs = require("fs");
const readline = require('readline');
const { Select } = require('enquirer');
const basePath = process.cwd();
const { 
  listCompatibility, 
  nestedStructure, 
  markIncompatible, 
  markForcedCombination,
  checkCompatibility, 
  countAndSave 
} = require(`${basePath}/modules/isCompatible.js`);
const { startCreating, buildSetup, rarityBreakdown, createPNG, createGIF } = require(`${basePath}/src/main.js`);
const { gif } = require(`${basePath}/src/config.js`);
const { cleanupTempFrames } = require(`${basePath}/modules/layerGIF.js`);
const layersDir = `${basePath}/layers`;

const incompatible = `${basePath}/compatibility/incompatibilities.json`

let incompatibilities = Object();

if (fs.existsSync(incompatible)) {
  incompatibilities = JSON.parse(fs.readFileSync(incompatible));
}

const askUserConfirmation = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${question} (Y/N): `, answer => {
      rl.close();
      resolve(answer.toUpperCase());
    });
  });
};

const addIncompatibility = async () => {
  const selectAddIncompatibility = new Select({
    name: 'addIncompatibility',
    message: 'Do you want to define a new incompatibility or forced combination?',
    choices: ['No', 'Yes']
  });

  const answer = await selectAddIncompatibility.run();

  if (answer === 'Yes') {
    await checkCompatibility();
    await addIncompatibility();
  } else if (answer === 'No') {
    return;
  }
};

const runScript = async () => {

  await listCompatibility();
  await nestedStructure();

  let incompatibleChildren = Object.keys(incompatibilities);

  if (incompatibleChildren.length > 0) {
    incompatibleChildren.forEach((incompatibility) => {
      let incompatibilityCount = 0;
      let parentIndexes = Object.keys(incompatibilities[incompatibility]);
      for (let i = 0; i < parentIndexes.length; i++) {
        let tempIndex = parentIndexes[i];
        let parents = incompatibilities[incompatibility][tempIndex].parents;
        let incompatibleParents = incompatibilities[incompatibility][tempIndex].incompatibleParents;
        incompatibilityCount += incompatibleParents.length;
        if (incompatibilities[incompatibility][tempIndex].forced) {
          console.log(`${parents[0]} will ONLY generate with ${incompatibility}`);
        } else {
          incompatibleParents.forEach((parent) => {
            console.log(`${parent} will not generate with ${incompatibility}`);
          });
        }
      }
    });

    console.log(`\n`);
    
    const choices = [
      'Proceed to generation with existing incompatibilities',
      'Add additional incompatibilities',
      'Remove all incompatibilities'
    ]

    const selectCompatibilityOption = new Select({
      message: "Above incompatibilities are already defined. Would you like to:",
      choices: choices,
    })

    const compatibilityOption = await selectCompatibilityOption.run();

    if (compatibilityOption === choices[1].name) {
      await addIncompatibility();
    }

    if (compatibilityOption === choices[0].name || compatibilityOption === choices[1].name) {
      let children = Object.keys(incompatibilities);
      
      // const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
      // progressBar.start(children.length, 0);

      for (let i = 0; i < children.length; i++) {
        // account for additional parent index in path
        let parentIndexes = Object.keys(incompatibilities[children[i]]);
        for (let j = 0; j < parentIndexes.length; j++) {
          let tempIndex = parentIndexes[j];

          let incompatibleParents = incompatibilities[children[i]][tempIndex].incompatibleParents;
          let forcedCombination = incompatibilities[children[i]][tempIndex].forced;
          for (let k = 0; k < incompatibleParents.length; k++) {
            if (!forcedCombination) {
              // console.log(`Marking Incompatibilities...`);
              await markIncompatible(
                children[i],
                incompatibilities[children[i]][tempIndex].incompatibleParents[k],
                incompatibilities[children[i]][tempIndex].parentIndex,
                incompatibilities[children[i]][tempIndex].childIndex,
                incompatibilities[children[i]][tempIndex].layerIndex,
                incompatibilities[children[i]][tempIndex].universal
              );
            } else {
              // console.log(`Marking Forced Combinations...`);
              await markForcedCombination(
                children[i],
                incompatibilities[children[i]][tempIndex].parents[0],
                incompatibilities[children[i]][tempIndex].parentIndex,
                incompatibilities[children[i]][tempIndex].childIndex,
                incompatibilities[children[i]][tempIndex].layerIndex,
                incompatibilities[children[i]][tempIndex].universal
              );
            }
          }
        }
        // progressBar.increment();
      }
      // progressBar.stop();
    }

    if (compatibilityOption === choices[0].name) {
      console.log('Generating Metadata...');
    } else {
      await addIncompatibility();
    }

  } else {
    await addIncompatibility();
  }

  countAndSave();

  await buildSetup();
  await startCreating();
  await rarityBreakdown();

  const selectProceed = new Select({
    name: 'proceed',
    message: 'Please review rarity breakdown above and metadata in build folder.',
    choices: ['Proceed with image generation', 'Abort']
  });

  let answer = await selectProceed.run();

  if (answer === 'Proceed with image generation') {
    gif.generate ? await createGIF() : await createPNG();
  } else {
    console.log('Process aborted.');
    process.exit(0);
  }

  const selectClearTempFrames = new Select({
    name: 'clearTempFrames',
    message: 'Please review generated GIFs. Would you like to clear temporary frames? \nIf you plan to re-generate, it is recommended to keep them to save generation time. \nIf you are done, you can clear them to save disk space.',
    choices: ['Keep temp frames', 'Clear temp frames']
  });
  
  answer = await selectClearTempFrames.run();
  
  if (answer === 'Clear temp frames') {
    await cleanupTempFrames(layersDir);
    console.log('Temp frames deleted.');
  } else {
    console.log('Temp frames preserved.');
    process.exit(0);
  }
};

runScript().catch(err => {
  console.error('An error occurred:', err);
});
