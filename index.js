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
const { startCreating, buildSetup, rarityBreakdown, createPNG } = require(`${basePath}/src/main.js`);

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

  if (Object.keys(incompatibilities).length > 0) {
    console.log(incompatibilities);

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
      for (let i = 0; i < children.length; i++) {
        // account for additional parent index in path
        let parentIndexes = Object.keys(incompatibilities[children[i]]);
        for (let j = 0; j < parentIndexes.length; j++) {
          let tempIndex = parentIndexes[j];

          let incompatibleParents = incompatibilities[children[i]][tempIndex].incompatibleParents;
          let forcedCombination = incompatibilities[children[i]][tempIndex].forced;
          for (let k = 0; k < incompatibleParents.length; k++) {
            if (!forcedCombination) {
              console.log(`Marking Incompatibilities...`);
              await markIncompatible(
                children[i],
                incompatibilities[children[i]][tempIndex].incompatibleParents[k],
                incompatibilities[children[i]][tempIndex].parentIndex,
                incompatibilities[children[i]][tempIndex].childIndex,
                incompatibilities[children[i]][tempIndex].layerIndex
              );
            } else {
              console.log(`Marking Forced Combinations...`);
              await markForcedCombination(
                children[i],
                incompatibilities[children[i]][tempIndex].parents[0],
                incompatibilities[children[i]][tempIndex].parentIndex,
                incompatibilities[children[i]][tempIndex].childIndex,
                incompatibilities[children[i]][tempIndex].layerIndex
              );
            }
          }
        }
      }
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

  buildSetup();
  await startCreating();
  await rarityBreakdown();

  const selectProceed = new Select({
    name: 'proceed',
    message: 'Please review rarity breakdown above and metadata in build folder.',
    choices: ['Proceed with image generation', 'Abort']
  });

  const answer = await selectProceed.run();

  if (answer === 'Proceed with image generation') {
    await createPNG();
  } else {
    console.log('Process aborted.');
    process.exit(0);
  }
};

runScript().catch(err => {
  console.error('An error occurred:', err);
});
