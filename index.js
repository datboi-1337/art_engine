const fs = require("fs");
const readline = require('readline');
const { Select } = require('enquirer');
const basePath = process.cwd();
const { 
  listCompatibility, 
  nestedStructure, 
  markIncompatible, 
  checkCompatibility, 
  countAndSave 
} = require(`${basePath}/modules/isCompatible.js`);
const { startCreating, buildSetup, rarityBreakdown, createPNG } = require(`${basePath}/src/main.js`);

const incompatible = `${basePath}/compatibility/compatibility.json`

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
  let answer = 'Y'

  while (answer == 'Y') {
    answer = await askUserConfirmation("Do you want to define a new incompatibility?");

    if (answer === 'Y') {
      await checkCompatibility()
    } else if (answer !== 'N') {
      console.log("Please enter 'Y' or 'N'.");
    }
  }
}

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
        let incompatibleParents = incompatibilities[children[i]].incompatibleParents;
        for (let j = 0; j < incompatibleParents.length; j++) {
          console.log(`Marking incompatibilities...`);
          await markIncompatible(
            children[i],
            incompatibilities[children[i]].incompatibleParents[j],
            incompatibilities[children[i]].parentIndex,
            incompatibilities[children[i]].childIndex,
            incompatibilities[children[i]].layerIndex
          );
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

  answer = await askUserConfirmation(
    'Please review rarity breakdown above and metadata in build folder. Proceed with image generation?'
  );

  if (answer === 'Y') {
    await createPNG();
  } else {
    console.log('Process aborted.');
    process.exit(0);
  }
};

runScript().catch(err => {
  console.error('An error occurred:', err);
});
