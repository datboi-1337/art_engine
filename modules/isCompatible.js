const readline = require('readline');
const fs = require("fs");
const path = require("path");
const basePath = process.cwd();
const { format, layerConfigurations } = require(`${basePath}/src/config.js`);
const { Select } = require('enquirer');
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
  var nameWithoutWeight = nameWithoutExtension.split('#').shift();
  return nameWithoutWeight;
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

// var parents = [];
// const incompatibleTraits = [];

// const getAllPaths = (currentObj, path, initTrait, targetTrait, initLayerIndex) => {

//   const keys = Object.keys(currentObj);

//   for (const key of keys) {
//     if (keys.includes(initTrait)) {
//       if (key != initTrait) {
//         if (!parents.includes(key)) {
//           parents.push(key);
//         }
//       }
//     }

//     const newPath = initLayerIndex == 0 ? path : path.concat([key]);

//     if (key === targetTrait) {
//       incompatibleTraits.push(newPath);
//     } else if (typeof currentObj[key] === 'object') {
//       getAllPaths(currentObj[key], newPath, initTrait, targetTrait, initLayerIndex + 1);
//     }
//   }
// };

const incompatibilities = {};

const markIncompatible = async (_child, _incompatibleParent, _parentIndex, _childIndex, _layerIndex) => {
  // parents = [];
  // // Get all paths for incompatible traits
  // if (_parentIndex === 0) {
  //   const firstLayerObj = nest[_layerIndex];
  //   getAllPaths(firstLayerObj, [_incompatibleParent], _incompatibleParent, _child, _parentIndex);
  // } else {
  //   const root = Object.keys(nest[_layerIndex]);
  //   for (let i = 0; i < root.length; i++) {
  //     const currentLayerObj = nest[_layerIndex][root[i]];
  //     getAllPaths(currentLayerObj, [root[i]], _incompatibleParent, _child, _parentIndex);
  //   }
  // }

  // // Then filter them down to only full paths where both traits are present
  // const filteredIncompatibleTraits = incompatibleTraits.filter(path =>
  //   path.includes(_incompatibleParent)
  // );

  // @Ricky, getAllPaths has now been MOSTLY depreciated. parents are generated separately, now we just have the matter
  // of counts. current system counts filteredIncompatibleTraits and removes that number. We won't have that anymore, so 
  // need to find a new way to calculate those values. 

  let incompatibleParents;

  if (!incompatibilities[_child]) {
    incompatibleParents = [];
  } else {
    incompatibleParents = incompatibilities[_child].incompatibleParents;
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
    maxCount: 0
  }

  // Log each incompatibility as it's own object for use in generation later
  if (!incompatibilities[_child]) {
    incompatibilities[_child] = incompatibilty;
  } else {
    const remainingParents = incompatibilities[_child].parents.filter(
      element => incompatibilty.parents.includes(element)
    );
    if (remainingParents.length == 0) {
      throw new Error(`No parent layers remaining for ${_child}, which would result in 0 generation of that trait.` +
      ` Please review your layer folders and your previous selections, then try again. `)
    }
    incompatibilities[_child].parents = remainingParents
  }

  // const removeCombination = filteredIncompatibleTraits.length;
  // const layer = layers[_layerIndex][_childIndex];

  // maxCombinations -= removeCombination;
  // // traitCounts[_layerIndex][layer][_child] -= removeCombination;
  
  // const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

  // bar1.start(removeCombination, 0);

  // // Delete each item at specified paths
  // for (let i = 0; i < filteredIncompatibleTraits.length; i++) {
  //   bar1.update(i + 1);
  //   const pathToDelete = filteredIncompatibleTraits[i];
  //   let object = nest[_layerIndex];

  //   // Handle array-based paths
  //   for (let i = 0; i < pathToDelete.length - 1; i++) {
  //     object = object[pathToDelete[i]];
  //     if (!object) return; // Early return if part of the path doesn't exist
  //   }

  //   delete nest[_layerIndex][pathToDelete[pathToDelete.length - 1]];
  // }

  // bar1.stop();

  console.log(`${_incompatibleParent} marked incompatible with ${_child}`);
}

const checkCompatibility = async () => {
  const selectLayersOrder = new Select({
    name: 'layersOrder',
    message: 'Which layersOrder index contains the incompatibility (starting at 0)?',
    choices: Object.keys(nest),
  })

  const layersOrder = Object.keys(nest).length > 1 ? await selectLayersOrder.run() : 0;

  const selectFirstLayer = new Select({
    name: 'layer',
    message: 'What layer is your first trait in?',
    choices: layers[layersOrder].slice(0, -1).map(layer => layer),
  });

  const firstLayer = await selectFirstLayer.run();
  const indexOfFirstLayer = layers[layersOrder].findIndex(layer => layer === firstLayer);

  const selectFirstTrait = new Select({
    name: 'trait',
    message: 'Select first trait:',
    choices: Object.keys(compatibility[firstLayer]),
  });

  const firstTrait = await selectFirstTrait.run();

  const choicesForSecondLayer = layers[layersOrder].slice(indexOfFirstLayer + 1).map(layer => layer);

  const selectSecondLayer = new Select({
    name: 'layer',
    message: 'Select the second layer:',
    choices: choicesForSecondLayer,
  });

  const secondLayer = await selectSecondLayer.run();
  const indexOfSecondLayer = layers[layersOrder].findIndex(layer => layer === secondLayer);

  const selectSecondTrait = new Select({
    name: 'trait',
    message: 'Select incompatible trait',
    choices: Object.keys(compatibility[secondLayer]),
  });

  const secondTrait = await selectSecondTrait.run();

  await markIncompatible(secondTrait, firstTrait, indexOfFirstLayer, indexOfSecondLayer, layersOrder);
}

//Re-create nested structures with incompatibilities taken into account
let incompatibleNest = {};
let compatibleNest = {};

const incompatibleNestedStructure = async () => {
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
    incompatibleNest[index] = {};
    const lastLayerIndex = layersOrder.length - 1
    
    let previousLayer = {};
    const restricted = Object.keys(incompatibilities);
    // incompatible paths
    restricted.forEach((restrictedTrait) => {
      let compatibilityFlag = false;
      let parents = incompatibilities[restrictedTrait].parents;
      let childIndex = incompatibilities[restrictedTrait].childIndex;
      let parentIndex = incompatibilities[restrictedTrait].parentIndex;
      // Add all paths containing incompatibilities
      for ( let i = lastLayerIndex; i >= 0; i--) {
        if (i == lastLayerIndex) { // Last layer
          let endOfNest = {};
          if (i == childIndex) {
            endOfNest[restrictedTrait] = {};
            compatibilityFlag = true;
          } else {
            layersOrder[i].forEach((trait) => {
              endOfNest[trait] = {};
            });
          }
          previousLayer = endOfNest;
        } else { // Everything else
          let lStruct = {};
          if (i == childIndex) {
            lStruct[restrictedTrait] = previousLayer;
            compatibilityFlag = true;
          } else if (i == parentIndex && compatibilityFlag) {
            parents.forEach((trait) => {
              lStruct[trait] = previousLayer;
            });
            previousLayer = lStruct;
          } else {
            layersOrder[i].forEach((trait) => {
              lStruct[trait] = previousLayer;
            });
            previousLayer = lStruct;
          }
          previousLayer = lStruct;
        }
        incompatibleNest[index][restrictedTrait] = previousLayer;
      }
    });
  });
}

const compatibleNestedStructure = async => {
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
    
    let previousLayer = {};

    // Add all paths excluding incompatibilities
    for ( let i = lastLayerIndex; i >= 0; i--) {
      let restricted = [];
      for (const incompatibility in incompatibilities) {
        if (incompatibilities[incompatibility].layerIndex == index && incompatibilities[incompatibility].childIndex == i) {
          restricted.push(incompatibility);
        } 
      }

      if (i == lastLayerIndex) { // Last layer
        let endOfNest = {};
        layersOrder[i].forEach((trait) => {
          if (!restricted.includes(trait)) {
            endOfNest[trait] = {};
          } else {
            let previousLayerCount = 1;
            
            for (let j = 0; j < i; j++) {
              let previousLayer = layers[index][j]
              previousLayerCount *= layerCounts[index][previousLayer];
            }
            traitCounts[index][layers[index][i]][trait] -= previousLayerCount;
            maxCombinations -= previousLayerCount;
          }
        });
        previousLayer = endOfNest;
      } else { // Everything else
        let lStruct = {}
        layersOrder[i].forEach((trait) => {
          if (!restricted.includes(trait)) {
            lStruct[trait] = previousLayer;
          } else {
            let previousLayerCount = 1;
            
            for (let j = 0; j < i; j++) {
              let previousLayer = layers[index][j]
              previousLayerCount *= layerCounts[index][previousLayer];
            }
            traitCounts[index][layers[index][i]][trait] -= previousLayerCount;
            maxCombinations -= previousLayerCount;
          }
        });
        previousLayer = lStruct;
      }
      compatibleNest[index] = previousLayer;
    }

  });
}

const countAndSave = () => {
  incompatibleNestedStructure();
  compatibleNestedStructure();
  
  console.log(`With the defined incompatibilites and available traits, `+
    `a maximum of ${maxCombinations} images can be generated`);

  // Save compatibility objects as JSON
  const jsonOutput = JSON.stringify(incompatibilities, null, 2);
  const outputFile = path.join(basePath, 'compatibility/compatibility.json');
  fs.writeFileSync(outputFile, jsonOutput);

  console.log(`Compatibility files created in ${basePath}/compatibility/`);
}

module.exports = { listCompatibility, nestedStructure, markIncompatible, checkCompatibility, countAndSave, traitCounts, incompatibleNest,  compatibleNest};