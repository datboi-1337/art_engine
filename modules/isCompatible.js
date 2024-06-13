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
        message: 'Select the first layer:',
        choices: layers[layersOrder].slice(0, -1).map(layer => layer).concat('Back'),
      });

      firstLayerChoice = await selectFirstLayer.run();

      if (firstLayerChoice === 'Back') {
        continue;
      }

      const firstLayer = firstLayerChoice;
      indexOfFirstLayer = layers[layersOrder].findIndex(layer => layer === firstLayer);

      const selectFirstTrait = new Select({
        name: 'trait',
        message: 'Select the first trait:',
        choices: Object.keys(compatibility[firstLayer]).concat('Back'),
      });

      firstTraitChoice = await selectFirstTrait.run();

      if (firstTraitChoice === 'Back') {
        continue;
      }

      break;
    }

    const firstTrait = firstTraitChoice;

    while (true) {
      const choicesForSecondLayer = layers[layersOrder].slice(indexOfFirstLayer + 1).map(layer => layer).concat('Back');

      const selectSecondLayer = new Select({
        name: 'layer',
        message: 'Select the second layer:',
        choices: choicesForSecondLayer,
      });

      secondLayerChoice = await selectSecondLayer.run();

      if (secondLayerChoice === 'Back') {
        goBackToFirstLayer = true;
        break;
      }

      const secondLayer = secondLayerChoice;
      indexOfSecondLayer = layers[layersOrder].findIndex(layer => layer === secondLayer);

      const selectSecondTraits = new MultiSelect({
        name: 'traits',
        message: 'Select incompatible traits:',
        choices: Object.keys(compatibility[secondLayer]).concat('Back'),
      });

      const selectSecondTrait = new Select({
        name: 'trait',
        message: 'Select the forced trait',
        choices: Object.keys(compatibility[secondLayer]),
      });

      selectedTraits = forcedCombination ? [await selectSecondTrait.run()] :await selectSecondTraits.run();

      // console.log(selectedTraits);

      if (selectedTraits.includes('Back')) {
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
    const lastLayerIndex = layersOrder.length - 1;
    
    let previousLayer = {};
    const restricted = Object.keys(incompatibilities);
    // incompatible paths
    restricted.forEach((restrictedTrait) => {
      let parentIndexes = Object.keys(incompatibilities[restrictedTrait]).map((x) => Number(x));

      let compatibilityFlag = false;
      let childIndex = incompatibilities[restrictedTrait][parentIndexes[0]].childIndex; 

      // subLayer incompatibilities (READ: incompatibilities that are not included in the current child/parent being processed)
      // let subIncompatibilities = [];

      for ( let i = lastLayerIndex; i >= 0; i--) {
        if (i == lastLayerIndex) { // Last layer
          let endOfNest = {};
          if (i == childIndex) {
            endOfNest[restrictedTrait] = {};
            compatibilityFlag = true;
          } else {
            layersOrder[i].forEach((trait) => {
              endOfNest[trait] = {};
              // if (restricted.includes(trait)) {
              //   subIncompatibilities.push(trait);
              // }
            
            });
          }
          previousLayer = endOfNest;
        } else { // Everything else
          let lStruct = {};
          // if (i == childIndex) { // Child layer
          //   lStruct[restrictedTrait] = previousLayer;
          //   compatibilityFlag = true;
          if (i == childIndex) { // Child layer
            lStruct[restrictedTrait] = previousLayer;
            compatibilityFlag = true;

            // Need to check previous layer for OTHER incompatibilities
            // restricted.forEach((subTrait) => {
            //   if (incompatibilities[subTrait][i]) {
            //     const subParentIndex = incompatibilities[subTrait][i].parentIndex;

            //     if (subParentIndex == i && incompatibilities[subTrait][i].incompatibleParents.includes(restrictedTrait)) {
            //       // Delete down-stream paths that contain subTrait
            //       const previousLayerTraits = Object.keys(previousLayer);
            //       previousLayerTraits.forEach((pTrait) => {
            //         if (Object.keys(previousLayer[pTrait]).includes(subTrait)) {
            //           delete previousLayer[pTrait][subTrait];
            //         } else {
            //           let nestLookup = [];
            //           let currentLayer = previousLayer[pTrait];

            //           while (true) {
            //             const currentLayerTraits = Object.keys(currentLayer);
            //             let nextLayer = null;

            //             for (let j = 0; j < currentLayerTraits.length; j++) {
            //               const currentTrait = currentLayerTraits[j];
            //               const nextLayerTraits = Object.keys(currentLayer[currentTrait]);

            //               if (nextLayerTraits.includes(subTrait)) {
            //                 nestLookup.push(currentTrait);
            //                 nestLookup.reduce((a, trait, idx) => {
            //                   if (!a || !a[trait]) {
            //                     return a;
            //                   }

            //                   if (idx === nestLookup.length - 1) {
            //                     delete a[trait][subTrait];
            //                   }
            //                   return a[trait];
            //                 }, previousLayer[pTrait]);

            //                 nestLookup = [];
            //                 break;
            //               } else {
            //                 nestLookup.push(currentTrait);
            //                 nextLayer = currentLayer[currentTrait];
            //               }
            //             }

            //             if (!nextLayer) {
            //               break;
            //             }
            //             currentLayer = nextLayer;
            //           }
            //         }
            //       });
            //     }
            //   }
            // });
          } else if (parentIndexes.includes(i) && compatibilityFlag) { // Parent layer
            // Parents should be okay to keep simple, since these paths are simply not added if they're not compatible with restrictedTrait
            let parents = incompatibilities[restrictedTrait][i].parents;
            parents.forEach((trait) => {
              lStruct[trait] = previousLayer;
            });
            previousLayer = lStruct;
          } else { // All other layers
            layersOrder[i].forEach((trait) => {
              if (restricted.includes(trait)) {
                restricted.forEach((subTrait) => {
                  if (incompatibilities[subTrait][i]) {
                    const subChildIndex = incompatibilities[subTrait][i].childIndex;
                    const subParentIndex = incompatibilities[subTrait][i].parentIndex;

                    if (subChildIndex == i) {
                      console.log(`subChildIndex == i`);
                      return;
                    }

                    if (subParentIndex == i && incompatibilities[subTrait][i].incompatibleParents.includes(trait)) {
                      // Delete down-stream paths that contain subTrait
                      const previousLayerTraits = Object.keys(previousLayer);
                      previousLayerTraits.forEach((pTrait) => {
                        if (Object.keys(previousLayer[pTrait]).includes(subTrait)) {
                          // Easy enough, simply delete in the scenario where the previous layer contains the subTrait
                          delete previousLayer[pTrait][subTrait];
                          return;
                        } else {
                          // Less easy. Need to navigate deeper into the structure to delete.
                          let nestLookup = [];
                          let currentLayer = previousLayer[pTrait];

                          while (true) {
                            const currentLayerTraits = Object.keys(currentLayer);
                            let nextLayer = null;

                            for (let j = 0; j < currentLayerTraits.length; j++) {
                              const currentTrait = currentLayerTraits[j];
                              const nextLayerTraits = Object.keys(currentLayer[currentTrait]);

                              if (nextLayerTraits.includes(subTrait)) {
                                // Edit this to use nestLookup to delete the path, then clear nestLookup
                                nestLookup.push(currentTrait);
                                nestLookup.reduce((a, trait, idx) => {
                                  if (!a || !a[trait]) {
                                    // Path not found, just return to continue checking other paths
                                    return a;
                                  }

                                  if (idx === nestLookup.length - 1) {
                                    delete a[trait][subTrait];
                                  } 
                                  return a[trait];
                                }, previousLayer[pTrait]);

                                // Clear nestLookup
                                nestLookup = [];
                                break;
                              } else {
                                nestLookup.push(currentTrait);
                                nextLayer = currentLayer[currentTrait];
                              }
                            }

                            if (!nextLayer) {
                              break;
                            }
                            currentLayer = nextLayer;
                          }
                        }
                      });
                    }
                  }
                });
              } 
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

const incompatibleNestedStructureNew = async () => {
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
    const lastLayerIndex = layersOrder.length - 1;
    
    let previousLayer = {};
    const restricted = Object.keys(incompatibilities);
    // incompatible paths
    restricted.forEach((restrictedTrait) => {
      let parentIndexes = Object.keys(incompatibilities[restrictedTrait]).map((x) => Number(x));

      let compatibilityFlag = false;
      let childIndex = incompatibilities[restrictedTrait][parentIndexes[0]].childIndex; 

      for (let i = lastLayerIndex; i >= 0; i--) {
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
          if (i == childIndex) { // Child layer
            lStruct[restrictedTrait] = previousLayer;
            compatibilityFlag = true;

            // Include logic to traverse and remove incompatible elements
            restricted.forEach((subTrait) => {
              if (incompatibilities[subTrait][i]) {
                const subParentIndex = incompatibilities[subTrait][i].parentIndex;

                if (subParentIndex == i && incompatibilities[subTrait][i].incompatibleParents.includes(restrictedTrait)) {
                  // Delete down-stream paths that contain subTrait
                  const previousLayerTraits = Object.keys(previousLayer);
                  previousLayerTraits.forEach((pTrait) => {
                    if (Object.keys(previousLayer[pTrait]).includes(subTrait)) {
                      delete previousLayer[pTrait][subTrait];
                    } else {
                      let nestLookup = [];
                      let currentLayer = previousLayer[pTrait];

                      while (true) {
                        const currentLayerTraits = Object.keys(currentLayer);
                        let nextLayer = null;

                        for (let j = 0; j < currentLayerTraits.length; j++) {
                          const currentTrait = currentLayerTraits[j];
                          const nextLayerTraits = Object.keys(currentLayer[currentTrait]);

                          if (nextLayerTraits.includes(subTrait)) {
                            nestLookup.push(currentTrait);
                            nestLookup.reduce((a, trait, idx) => {
                              if (!a || !a[trait]) {
                                return a;
                              }

                              if (idx === nestLookup.length - 1) {
                                delete a[trait][subTrait];
                              }
                              return a[trait];
                            }, previousLayer[pTrait]);

                            nestLookup = [];
                            break;
                          } else {
                            nestLookup.push(currentTrait);
                            nextLayer = currentLayer[currentTrait];
                          }
                        }

                        if (!nextLayer) {
                          break;
                        }
                        currentLayer = nextLayer;
                      }
                    }
                  });
                }
              }
            });

          } else if (parentIndexes.includes(i) && compatibilityFlag) { // Parent layer
            let parents = incompatibilities[restrictedTrait][i].parents;
            parents.forEach((trait) => {
              lStruct[trait] = previousLayer;
            });
            previousLayer = lStruct;
          } else { // All other layers
            layersOrder[i].forEach((trait) => {
              if (restricted.includes(trait)) {
                restricted.forEach((subTrait) => {
                  if (incompatibilities[subTrait][i]) {
                    const subChildIndex = incompatibilities[subTrait][i].childIndex;
                    const subParentIndex = incompatibilities[subTrait][i].parentIndex;

                    if (subChildIndex == i) {
                      console.log(`subChildIndex == i`);
                      return;
                    }

                    if (subParentIndex == i && incompatibilities[subTrait][i].incompatibleParents.includes(trait)) {
                      // Delete down-stream paths that contain subTrait
                      const previousLayerTraits = Object.keys(previousLayer);
                      previousLayerTraits.forEach((pTrait) => {
                        if (Object.keys(previousLayer[pTrait]).includes(subTrait)) {
                          delete previousLayer[pTrait][subTrait];
                          return;
                        } else {
                          let nestLookup = [];
                          let currentLayer = previousLayer[pTrait];

                          while (true) {
                            const currentLayerTraits = Object.keys(currentLayer);
                            let nextLayer = null;

                            for (let j = 0; j < currentLayerTraits.length; j++) {
                              const currentTrait = currentLayerTraits[j];
                              const nextLayerTraits = Object.keys(currentLayer[currentTrait]);

                              if (nextLayerTraits.includes(subTrait)) {
                                nestLookup.push(currentTrait);
                                nestLookup.reduce((a, trait, idx) => {
                                  if (!a || !a[trait]) {
                                    return a;
                                  }

                                  if (idx === nestLookup.length - 1) {
                                    delete a[trait][subTrait];
                                  } 
                                  return a[trait];
                                }, previousLayer[pTrait]);

                                nestLookup = [];
                                break;
                              } else {
                                nestLookup.push(currentTrait);
                                nextLayer = currentLayer[currentTrait];
                              }
                            }

                            if (!nextLayer) {
                              break;
                            }
                            currentLayer = nextLayer;
                          }
                        }
                      });
                    }
                  }
                });
              }
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

let finalNest = {};

let finalNestedStructure = async () => {
  /* 
    We're going to emulate some of the incompatibleNestedStructure() and compatibleNestedStructure() functions here.
    The goal is to create a final nested structure that includes all possible combinations, but excludes any incompatibilities.
    
    Instead of going from the bottom up, adding only incompatible traits to incompatibleNest, then excluding their parents,
    we're going to setup previousLayers (name pending) as an object containing objects for each layer. 
    
    The structure of this object will contain an object of objects representing each trait named 'traits', all of which have empty objects 
    as values. Then, we'll create another object of objects representing incompatibilites called restrictedTraits. This object will contain
    alternate versions of the traits for each inccompatible layer, each containing a version of traits that IS compatible with that layer. 
    Finally, I think an object containing arrays for each layersOrder index containing layer indexes of incompatible layers. This will allow
    us to easily iterate through the structure to determine whether to use traits or restrictedTraits

    previousLayers: {
      layerConfigIndex: {
        layer1Index: {
          traits: { 1trait1: {}, 1trait2: {} }, 
          restrictedTraits: { 0: { 2trait1: { 1trait2: {} } } },
          restrictedIndexes: [ ], 
        }, 
        layer2Index: { 
          traits: { 2trait1: {}, 2trait2: {}, 2trait3: {} }, 
          restrictedTraits: { 0: { 1trait1: { 2trait2: {}, 2trait3: {} }, 3trait2: { 3trait1: {}, 3trait3: {} } } },
          restrictedIndexes: [ 0 ], 
        }, 
        layer3Index: { 
          traits: { 3trait1: {}, 3trait2: {}, 3trait3: {} }, 
          restrictedTraits: [  ],
          restrictedIndexes: [ ], 
        }, 
      }
    }

    @Ricky, revise as needed with new restrictedTraits object in mind

    The idea would be to loop through layer objects, starting with the FIRST layer (instead of the last) to create that structure, 
    using incompatibilities to fill in restrictedTraits and restrictedIndexes. ie: for each trait, we'll loop through incompatibilities, checking
    if trait is included in Object.keys(incompatibilities), marking as restricted if it is, and checking that incompatibility's 
    incompatibleParents array to mark it's restrictedParents. If it's not in included in Object.keys(incompatibilities), we'll 
    still check each object in incompatibilities to see if trait is in the incompatibleParents array, marking it as restricted, 
    and marking the incompatibility as a restrictedChild
    //
    After the initial structure of previousLayers is created, we would be able to loop through top down. First loop for each layer,
    then a nested loop for each trait. 
  */
    
  /*
    What if we just bypass compatibleNest and IncompatibleNest all together? Could you just adjust the logic in createDnaExact to utilize incompatibilites?
    As is, you create a 'compatibleTraits' object that uses nestlookup to determine if a trait is compatible with the previous layer(s).
    I think the main concern with utilising incompatibilities as-is is that you may run into issues towards the end of generation if you just go at it raw. 
    So maybe we could keep the same logic where we loop through incompatibilities and generate all the incompatible object first, but instead of using 
    compatibleNest and incompatibleNest, we could use the above structure (object for each layer containing all traits, restrictedTraits, and restrictedIndexes)
    and check each layer's restrictedTraits to see if the incompatible trait is present, and populating elements with the appropriate restrictedTraits. 
    This should ensure that no incompatibilities are generated. And if still generate all the incompatibilities first, counts shouldn't get messed up. 
    This approach would DRAMATICALLY reduce complexity. You'd start with the incompatible traits as you already do. The trait you're currently generating would
    be the key. You'd check each layer's restrictedTraits to see if the trait is included. If it is, you'd use the appropriate restrictedTraits. Then, once all
    of the incompatible traits have been generated, you would continue to use the previousLayers structure to ensure you're not generating any incompatibilities.     
    For each layer during generation, you'd check previousLayers' restrictedTraits by layer config index and layer index, 
    Object.key, loop through that, see if any of the traits present are included in nestLookup, and use the appropriate restrictedTraits. If it's not, you'd 
    just use traits. Since all the incompatible traits have already been generated, the traitCounts system should prevent any of them from being generated further.\
    You do still need to incorporate the layerCounts system from compatibleNeststedStructure to ensure maxCount isn't exceeded. Honestly, it's probably easiest to 
    simply use compatibleNestedStructure(), and take out all the nest logic. It'd make sense to rename the function in that context. 

    @Ricky, this is it. So much simpler. in createDna:
    Use layer for layerIndex
    Use exitsting system in createDna to check incompatibilities and use one. 
    lookup previousLayers[layrIndex] and pull traits and restrictedTraits. 
    Use traits as the baseline, then loop through restrictedTraits[layerIndex]
    Check the current layer's restrictedTraits for the chosen incompatibility, as well as previously selected layers, pulling all versions. 
    filter baseline traits to only contain layers that are present in ALL incompatibilities
    use that new array for compatibleTraits and use in existing elements logic. 

    CONCERNS: 
      I want to resolve the duplicate name issue, so I think you should refactor code to use layerIndex-cleanName for checks. Things like traitCounts, for example
      Need to ensure we won't run into an issue where counts become problematic. I think this should be resolved by continuing to generate incompatible traits first, 
      and keeping track of maxCount in the below function (reworked to remove nested structure logic). 
        subConcern: maxCount is getting reduced regardless of whether the image as a whole is selected. If a duplicate is generated, the maxCount is still reduced, 
        even though the metadata isn't valid. 
  */
  const layerIncompatibilities = {};

  layers.forEach((layersOrder, index) => {
    const restricted = Object.keys(incompatibilities);
    layerIncompatibilities[index] = {};

    layersOrder.forEach((layer, layerIndex) => {
      const traits = Object.keys(compatibility[layer]);
      const restrictedTraits = {};
      const restrictedIndexes = [];

      restricted.forEach((restrictedTrait) => {
        let parentIndexes = Object.keys(incompatibilities[restrictedTrait]);

        // Create element in restrictedTraits for any incompatible parents
        if (traits.includes(restrictedTrait)) {
          parentIndexes.forEach((pIndex) => {
            let incompatibleParents = incompatibilities[restrictedTrait][pIndex].incompatibleParents;

            incompatibleParents.forEach((incompatibleParent) => {
              if (!restrictedTraits[incompatibleParent]) {
                restrictedTraits[incompatibleParent] = traits.filter((trait) => trait != restrictedTrait);
              } else {
                restrictedTraits[incompatibleParent] = restrictedTraits[incompatibleParent].filter((trait) => trait != restrictedTrait);
              }
            });
          });
        } else { // Create element in restrictedTraits for any incompatible children
          parentIndexes.forEach((pIndex) => {
            if (incompatibilities[restrictedTrait][pIndex].parentIndex == layerIndex) {
              if (!restrictedTraits[restrictedTrait]) {
                restrictedTraits[restrictedTrait] = incompatibilities[restrictedTrait][pIndex].parents;
              } else {
                // do a thing
              }
              restrictedIndexes.push(incompatibilities[restrictedTrait][pIndex].childIndex);
            }
          });

          layerIncompatibilities[index][layerIndex].traits = traits;
          layerIncompatibilities[index][layerIndex].restrictedTraits = restrictedTraits;
          layerIncompatibilities[index][layerIndex].restrictedIndexes = restrictedIndexes;
        }
      });
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
        let endOfNest = {};
        layersOrder[i].forEach((trait) => {
          if (!restricted.includes(trait)) {
            endOfNest[trait] = {};
          } else {
            let previousLayerCount = 1;
            
            for (let j = 0; j < i; j++) {
              let previousLayer = layers[index][j];
              previousLayerCount *= layerCounts[index][previousLayer];
            }
            traitCounts[index][layers[index][i]][trait] -= previousLayerCount;
            if(traitCounts[index][layers[index][i]][trait] <= 0) {
              throw new Error(`Incompatibility error: This is a HYPER specific issue that boils down to the math being a little weird. ` +
              `The simplest solution is to add another layer to layer configuration ${index} with 2+ blank pngs. You can use the exclude ` +
              `option so it doesn't appear in the final metadata. If you need help, please send details to @datboi`);
            }
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
              let previousLayer = layers[index][j];
              previousLayerCount *= layerCounts[index][previousLayer];
            }
            traitCounts[index][layers[index][i]][trait] -= previousLayerCount;
            if(traitCounts[index][layers[index][i]][trait] <= 0) {
              throw new Error(`Incompatibility error: This is a HYPER specific issue that boils down to the math being a little weird. ` +
              `The simplest solution is to add another layer to layer configuration ${index} with 2+ blank pngs. You can use the exclude ` +
              `option so it doesn't appear in the final metadata. If you need help, please send details to @datboi`);
            }
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
  const ijsonOutput = JSON.stringify(incompatibleNest, null, 2);
  const ioutputFile = path.join(basePath, 'compatibility/incompatibleNest.json');
  fs.writeFileSync(ioutputFile, ijsonOutput);

  // // Save compatibility objects as JSON
  const cjsonOutput = JSON.stringify(compatibleNest, null, 2);
  const coutputFile = path.join(basePath, 'compatibility/compatibleNest.json');
  fs.writeFileSync(coutputFile, cjsonOutput);

  // Save compatibility objects as JSON
  const jsonOutput = JSON.stringify(incompatibilities, null, 2);
  const outputFile = path.join(basePath, 'compatibility/incompatibilities.json');
  fs.writeFileSync(outputFile, jsonOutput);

  console.log(`Compatibility files created in ${outputFile}`);

  // console.log(traitCounts);
}

module.exports = { listCompatibility, nestedStructure, markIncompatible, markForcedCombination, checkCompatibility, countAndSave, traitCounts, incompatibleNest,  compatibleNest};