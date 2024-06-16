const readline = require('readline');
const fs = require("fs");
const path = require("path");
const basePath = process.cwd();
const { format, layerConfigurations, rarityDelimiter, zindexDelimiter } = require(`${basePath}/src/config.js`);
const { Select, MultiSelect  } = require('enquirer');
const cliProgress = require('cli-progress');
// const { createCanvas, loadImage } = require("canvas");

// const canvas = createCanvas(format.width, format.height);
// const ctx = canvas.getContext("2d");

// Create compatibility directory if it doesn't already exist
const dir = `${basePath}/compatibility`;
if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir, {
		recursive: true
	});
}

const cleanName = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  let nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  let nameWithoutZindex = nameWithoutWeight.split(zindexDelimiter).pop();
  return nameWithoutZindex;
};

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

let maxCombinations = 1;

const layers = [];
let compatibility = {};
let nest = {}

let traitCounts = {};

const listCompatibility = async () => {
  layerConfigurations.forEach((layerConfig, configIndex) => {
    let layerCombinations = 1;
    const layersOrder = layerConfig.layersOrder;
    const tempLayers = [];
    let layerCounts = {};

    layerCounts[configIndex] = {};
    traitCounts[configIndex] = {};

    layersOrder.forEach((layer, layerIndex) => {

      tempLayers.push(layer.name);
      const filePath = `${basePath}/layers/${layer.name}`
      const files = fs.readdirSync(filePath);

      const imageFiles = files.filter(file => {
        const isFile = fs.statSync(path.join(filePath, file)).isFile();
        const isImage = /\.(png|gif)$/i.test(file);
        if (isFile && !isImage) {
          console.log(`Non-image file detected: ${filePath}/${file}.
          Please be sure to review and remove non-image files before generation!`);
        }
        return isFile && isImage;
      });

      let layerCount = imageFiles.length;
      layerCombinations *= layerCount;

      layerCounts[configIndex][layer.name] = layerCount;

      imageFiles.forEach((file) => {
        const trait = cleanName(file);
        if (!compatibility[layer.name]) {
          compatibility[layer.name] = {};
        }
        compatibility[layer.name][trait] = {};

        for (let nextLayerIndex = layerIndex + 1; nextLayerIndex < layersOrder.length; nextLayerIndex++) {
          const nextLayer = layersOrder[nextLayerIndex].name;
          compatibility[layer.name][trait][nextLayer] = fs.readdirSync(`${basePath}/layers/${nextLayer}`)
            .map(cleanName);
        }
      });
    });
    let layerNames = Object.keys(layerCounts[configIndex]);
    layerNames.forEach((layer) => {
      traitCounts[configIndex][layer] = {}

      let traits = Object.keys(compatibility[layer]);
      let otherLayersTotal = 1;
      for (let i = 0; i < layerNames.length; i++) {
        if (layerNames[i] !== layer) {
          otherLayersTotal *= layerCounts[configIndex][layerNames[i]]
        }
      }

      traits.forEach((trait) => {
        traitCounts[configIndex][layer][trait] = otherLayersTotal;
      })
    })
    maxCombinations += layerCombinations;
    layers.push(tempLayers);
  });
}

const nestedStructure = async () => {
  const topLayers = [];

  layers.forEach((layersOrder, index) => {
    let tempTopLayers = [];
    layersOrder.forEach((layer) => {
      const traits = Object.keys(compatibility[layer]);
      tempTopLayers.push(traits);
    });
    topLayers[index] = tempTopLayers;
  });

  topLayers.forEach((layersOrder, index) => {
    const lastLayerIndex = layersOrder.length - 1
    
    let previousLayer = {};

    for ( let i = lastLayerIndex; i >= 0; i--) {
      if (i == lastLayerIndex) { // Last layer
        let endOfNest = {};
        layersOrder[i].forEach((layer) => {
          endOfNest[layer] = {};
        })
        previousLayer = endOfNest;
      } else { // Everything else
        let lStruct = {}
        layersOrder[i].forEach((layer) => {
          lStruct[layer] = previousLayer;
        })
        previousLayer = lStruct;
      }
      nest[index] = previousLayer;
    }
  });
}

const incompatibilities = {};

const markIncompatible = async (_child, _incompatibleParent, _parentIndex, _childIndex, _layerIndex) => {
  let incompatibleParents;

  if (!incompatibilities[_child]) {
    incompatibilities[_child] = {};
  }

  if (!incompatibilities[_child][_parentIndex]) {
    incompatibleParents = [];
  } else {
    incompatibleParents = incompatibilities[_child][_parentIndex].incompatibleParents;
  }

  incompatibleParents.push(_incompatibleParent);

  let parents = []

  let allParents = Object.keys(compatibility[layers[_layerIndex][_parentIndex]]);

  allParents.forEach((parentTrait) => {
    if(!incompatibleParents.includes(parentTrait)) {
      parents.push(parentTrait);
    }
  });

  let incompatibilty = {
    incompatibleParents,
    parents,
    parentIndex: _parentIndex,
    childIndex: _childIndex,
    layerIndex: Number(_layerIndex),
    maxCount: 0,
    forced: false
  }

  // Log each incompatibility as it's own object for use in generation later
  if (!incompatibilities[_child][_parentIndex]) {
    incompatibilities[_child][_parentIndex] = incompatibilty;
  } else {
      const remainingParents = incompatibilities[_child][_parentIndex].parents.filter(
      element => incompatibilty.parents.includes(element)
    );
    if (remainingParents.length == 0) {
      throw new Error(`No parent layers remaining for ${_child}, which would result in 0 generation of that trait.` +
      ` Please review your layer folders and your previous selections, then try again. `)
    }
    incompatibilities[_child][_parentIndex].parents = remainingParents
  }

  // console.log(`${_incompatibleParent} marked incompatible with ${_child}`);
}

const markForcedCombination = async (_child, _forcedParent, _parentIndex, _childIndex, _layerIndex) => {
  let incompatibleParents = [];

  if (!incompatibilities[_child]) {
    incompatibilities[_child] = {};
  }

  let parents = [_forcedParent];
  let allParents = Object.keys(compatibility[layers[_layerIndex][_parentIndex]]);

  allParents.forEach((parentTrait) => {
    if(parentTrait != _forcedParent) {
      incompatibleParents.push(parentTrait);
    }
  });

  let incompatibilty = {
    incompatibleParents,
    parents,
    parentIndex: _parentIndex,
    childIndex: _childIndex,
    layerIndex: Number(_layerIndex),
    maxCount: 0,
    forced: true
  }

  // Log each forced combination as incompatibility as it's own object for use in generation later
  if (!incompatibilities[_child][_parentIndex]) {
    incompatibilities[_child][_parentIndex] = incompatibilty;
  } else {
    incompatibilities[_child][_parentIndex].parents = parents
  }

  // console.log(`${_forcedParent} marked forced with ${_child}`);
}

const checkCompatibility = async () => {
  const selectType = new Select({
    name: 'Incompatibility/Forced Combination',
    message: 'Are you defining an incompatibility or a forced combination?',
    choices: ['Incompatibility', 'Forced Combination'],
  });

  const typeChoice = await selectType.run();

  const forcedCombination = typeChoice === 'Forced Combination';

  const selectLayersOrder = new Select({
    name: 'layersOrder',
    message: 'Which layer configuration index? (starts at 0)',
    choices: Object.keys(nest),
  });

  let layersOrderChoice = Object.keys(nest).length > 1 ? await selectLayersOrder.run() : 0;

  const layersOrder = parseInt(layersOrderChoice);

  let firstLayerChoice;
  let firstTraitChoice;
  let secondLayerChoice;
  let selectedTraits;
  let indexOfFirstLayer;
  let indexOfSecondLayer;

  while (true) {
    let goBackToFirstLayer = false;

    while (true) {
      const selectFirstLayer = new Select({
        name: 'layer',
        message: 'Select the first (parent) layer:',
        choices: layers[layersOrder].slice(0, -1).map(layer => layer).concat('Go Back'),
      });

      firstLayerChoice = await selectFirstLayer.run();

      if (firstLayerChoice === 'Go Back') {
        continue;
      }

      const firstLayer = firstLayerChoice;
      indexOfFirstLayer = layers[layersOrder].findIndex(layer => layer === firstLayer);

      const selectFirstTrait = new Select({
        name: 'trait',
        message: 'Select the first (parent) trait:',
        choices: Object.keys(compatibility[firstLayer]).concat('Go Back'),
      });

      firstTraitChoice = await selectFirstTrait.run();

      if (firstTraitChoice === 'Go Back') {
        continue;
      }

      break;
    }

    const firstTrait = firstTraitChoice;

    while (true) {
      const choicesForSecondLayer = layers[layersOrder].slice(indexOfFirstLayer + 1).map(layer => layer).concat('Go Back');

      const selectSecondLayer = new Select({
        name: 'layer',
        message: 'Select the second (child) layer:',
        choices: choicesForSecondLayer,
      });

      secondLayerChoice = await selectSecondLayer.run();

      if (secondLayerChoice === 'Go Back') {
        goBackToFirstLayer = true;
        break;
      }

      const secondLayer = secondLayerChoice;
      indexOfSecondLayer = layers[layersOrder].findIndex(layer => layer === secondLayer);

      const selectSecondTraits = new MultiSelect({
        name: 'traits',
        message: 'Select incompatible traits (children) with space bar:',
        choices: Object.keys(compatibility[secondLayer]).length === 1 
        ? ['Selected layer only has one trait. If chosen, generation would fail. Press enter to go back'] 
        : Object.keys(compatibility[secondLayer]).concat('Go Back'),
      });

      const selectSecondTrait = new Select({
        name: 'trait',
        message: 'Select the forced trait (child)',
        choices: Object.keys(compatibility[secondLayer]).length === 1 
        ? ['Selected layer only has one trait. If chosen, generation would fail. Press enter to go back'] 
        : Object.keys(compatibility[secondLayer]).concat('Go Back'),
      });

      selectedTraits = forcedCombination ? [await selectSecondTrait.run()] :await selectSecondTraits.run();

      if (selectedTraits.includes('Go Back')) {
        goBackToFirstLayer = true;
        break;
      }

      break;
    }

    if (goBackToFirstLayer) {
      continue;
    }

    for (const secondTrait of selectedTraits) {
      if (forcedCombination) {
        await markForcedCombination(secondTrait, firstTrait, indexOfFirstLayer, indexOfSecondLayer, layersOrder);
      } else {
        await markIncompatible(secondTrait, firstTrait, indexOfFirstLayer, indexOfSecondLayer, layersOrder);
      }
    }

    break;
  }
};


let layerIncompatibilities = {};

let createLayerIncompatibilities = async () => {
  layers.forEach((layersOrder, index) => {
    const restricted = Object.keys(incompatibilities);
    layerIncompatibilities[index] = {};

    layersOrder.forEach((layer, layerIndex) => {
      layerIncompatibilities[index][layerIndex] = {};

      const traits = Object.keys(compatibility[layer]);
      const restrictedTraits = {};

      if (restricted.length > 0) {
        restricted.forEach((restrictedTrait) => {
          let parentIndexes = Object.keys(incompatibilities[restrictedTrait]);

          if (traits.includes(restrictedTrait)) { // Create elements in restrictedTraits for any incompatible parents
            parentIndexes.forEach((pIndex) => {
              if (incompatibilities[restrictedTrait][pIndex].layerIndex == index) {
                let incompatibleParents = incompatibilities[restrictedTrait][pIndex].incompatibleParents;

                incompatibleParents.forEach((incompatibleParent) => {
                  if (!restrictedTraits[incompatibleParent]) {
                    restrictedTraits[incompatibleParent] = traits.filter((trait) => trait != restrictedTrait);
                  } else {
                    restrictedTraits[incompatibleParent] = restrictedTraits[incompatibleParent].filter((trait) => trait != restrictedTrait);
                  }
                });

                // Handle forced combinations
                if (incompatibilities[restrictedTrait][pIndex].forced) {
                  let forcedParents = incompatibilities[restrictedTrait][pIndex].parents;

                  if (!restrictedTraits[forcedParents[0]]) {
                    restrictedTraits[forcedParents[0]] = traits.filter((trait) => trait == restrictedTrait);
                  } else {
                    throw new Error(`Forced trait exists elsewhere. Please review your incompatibilities and try again. ` +
                      `Forced combinations can ONLY work with one another. `
                    )
                  }
                
                }
              }
            });
          } else { // Create elements in restrictedTraits for any incompatible children
            parentIndexes.forEach((pIndex) => {
              if (incompatibilities[restrictedTrait][pIndex].layerIndex == index) {
                compatibleParents = incompatibilities[restrictedTrait][pIndex].parents;

                if (incompatibilities[restrictedTrait][pIndex].parentIndex == layerIndex) {
                  if (!restrictedTraits[restrictedTrait]) {
                    restrictedTraits[restrictedTrait] = compatibleParents;
                  } else {
                    throw new Error(`Incompatibility error: ${restrictedTrait} is incompatible with ${compatibleParents} ` + 
                      `in layer ${layerIndex}, but ${restrictedTrait} is not a trait in layer ${layerIndex}. ` +
                      `Please review your incompatibilities and try again. If you need help, please send details to @datboi`);
                  }
                }
              }
            });
          }
        });
      }

      layerIncompatibilities[index][layerIndex].traits = traits;
      layerIncompatibilities[index][layerIndex].restrictedTraits = restrictedTraits;
    });
  });
}

const updateIncompatibleCounts = () => {
  const topLayers = [];
  let layerCounts = {};

  layers.forEach((layersOrder, index) => {
    let tempTopLayers = [];
    layerCounts[index] = {};
    layersOrder.forEach((layer) => {
      const traits = Object.keys(compatibility[layer]);
      tempTopLayers.push(traits);
      layerCounts[index][layer] = traits.length;
    });
    
    topLayers[index] = tempTopLayers;
  });

  topLayers.forEach((layersOrder, index) => {
    const lastLayerIndex = layersOrder.length - 1

    // Add all paths excluding incompatibilities
    for ( let i = lastLayerIndex; i >= 0; i--) {
      let restricted = [];
      for (const incompatibility in incompatibilities) {
        let parentIndexes = Object.keys(incompatibilities[incompatibility]);
        parentIndexes.forEach((pIndex) => {
          if (incompatibilities[incompatibility][pIndex].layerIndex == index && incompatibilities[incompatibility][pIndex].childIndex == i) {
            restricted.push(incompatibility);
          }
          if (incompatibilities[incompatibility][pIndex].forced) {
            let restrictedParent = incompatibilities[incompatibility][pIndex].parents[0];
            if (!restricted.includes(restrictedParent)) {
              restricted.push(restrictedParent);
            }
          }
        });
      }
      
      if (i == lastLayerIndex) { // Last layer
        layersOrder[i].forEach((trait) => {
          if (restricted.includes(trait)) {
            let previousLayerCount = 1;
            
            for (let j = 0; j < i; j++) {
              let previousLayerName = layers[index][j];
              previousLayerCount *= layerCounts[index][previousLayerName];
            }
            traitCounts[index][layers[index][i]][trait] -= previousLayerCount;
            if(traitCounts[index][layers[index][i]][trait] <= 0) {
              throw new Error(`Incompatibility error: This is a HYPER specific issue that boils down to the math being a little weird. ` +
              `The simplest solution, for now, is to add another layer to layer configuration ${index} with 2+ blank pngs. You can use the exclude ` +
              `option so it doesn't appear in the final metadata. If you need help, please send details to @datboi`);
            }
            maxCombinations -= previousLayerCount;
          }
        });
      } else { // Everything else
        layersOrder[i].forEach((trait) => {
          if (restricted.includes(trait)) {
            let previousLayerCount = 1;
            
            for (let j = 0; j < i; j++) {
              let previousLayerName = layers[index][j];
              previousLayerCount *= layerCounts[index][previousLayerName];
            }
            traitCounts[index][layers[index][i]][trait] -= previousLayerCount;
            if(traitCounts[index][layers[index][i]][trait] <= 0) {
              throw new Error(`Incompatibility error: This is a HYPER specific issue that boils down to the math being a little weird. ` +
              `The simplest solution, for now, is to add another layer to layer configuration ${index} with 2+ blank pngs. You can use the exclude ` +
              `option so it doesn't appear in the final metadata. If you need help, please send details to @datboi`);
            }
            maxCombinations -= previousLayerCount;
          }
        });
      }
    }

  });
}

const countAndSave = () => {
  updateIncompatibleCounts();
  createLayerIncompatibilities();
 
  console.log(`With the defined incompatibilites and available traits, `+
    `a maximum of ${maxCombinations} images can be generated`);

  // Save compatibility objects as JSON
  // const ijsonOutput = JSON.stringify(incompatibleNest, null, 2);
  // const ioutputFile = path.join(basePath, 'compatibility/incompatibleNest.json');
  // fs.writeFileSync(ioutputFile, ijsonOutput);

  // // Save compatibility objects as JSON
  // const cjsonOutput = JSON.stringify(compatibleNest, null, 2);
  // const coutputFile = path.join(basePath, 'compatibility/compatibleNest.json');
  // fs.writeFileSync(coutputFile, cjsonOutput);

  // Save compatibility objects as JSON
  const ljsonOutput = JSON.stringify(layerIncompatibilities, null, 2);
  const loutputFile = path.join(basePath, 'compatibility/layerIncompatibilities.json');
  fs.writeFileSync(loutputFile, ljsonOutput);

  // Save compatibility objects as JSON
  const jsonOutput = JSON.stringify(incompatibilities, null, 2);
  const outputFile = path.join(basePath, 'compatibility/incompatibilities.json');
  fs.writeFileSync(outputFile, jsonOutput);

  console.log(`Compatibility files created in ${outputFile}`);

  // console.log(traitCounts);
}

module.exports = { 
  listCompatibility, 
  nestedStructure, 
  markIncompatible, 
  markForcedCombination, 
  checkCompatibility, 
  countAndSave, 
  traitCounts, 
  layerIncompatibilities,
};