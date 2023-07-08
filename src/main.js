const basePath = process.cwd();
const { NETWORK } = require(`${basePath}/constants/network.js`);
const fs = require("fs");
const sha1 = require(`${basePath}/node_modules/sha1`);
const { createCanvas, loadImage } = require(`${basePath}/node_modules/canvas`);
const buildDir = `${basePath}/build`;
const layersDir = `${basePath}/layers`;
const {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
  resumeNum,
  rarity_config,
  toCreateNow,
  collectionSize,
  namedWeight,
  exactWeight,
  layerVariations,
  importOldDna,
  allowDuplicates,
  enableStats,
  statBlocks,
  extraAttributes,
} = require(`${basePath}/src/config.js`);
const canvas = createCanvas(format.width, format.height);
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = format.smoothing;
var metadataList = [];
var attributesList = [];
var statList = [];
var dnaList = new Set();
const DNA_DELIMITER = "-";
const HashlipsGiffer = require(`${basePath}/modules/HashlipsGiffer.js`);
const oldDna = `${basePath}/build_old/_oldDna.json`;

let hashlipsGiffer = null;
let allTraitsCount = [];

const buildSetup = () => {
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
    fs.mkdirSync(`${buildDir}/json`);
    fs.mkdirSync(`${buildDir}/images`);
  } else {
    fs.rmdirSync(buildDir, { recursive: true } );
    fs.mkdirSync(buildDir);
    fs.mkdirSync(`${buildDir}/json`);
    fs.mkdirSync(`${buildDir}/images`);
  }
  if (gif.export) {
    fs.mkdirSync(`${buildDir}/gifs`);
  }
  if (importOldDna) {
    let rawdata = fs.readFileSync(oldDna);
    let data = JSON.parse(rawdata);
    if (data.length !== resumeNum) {
      throw new Error(
        `resumeNum (${resumeNum}) does not match count in _oldDna file (${oldDna.length}). 
        Please make sure you have the correct _metadata file in the build_old folder and re-run generateOldDna`);
    }
    data.forEach((item) => {
      dnaList.add(item);
    });
  }
}

const getRarityWeight = (_str, _total) => {
  let nameWithoutExtension = _str.slice(0, -4);
  if (namedWeight) {
    var nameWithoutWeight = String(nameWithoutExtension.split(rarityDelimiter).pop());
  } else if (exactWeight) {
    var nameWithoutWeight = Math.floor(10000 * Number(nameWithoutExtension.split(rarityDelimiter).pop()) / _total);
  } else {
    var nameWithoutWeight = Math.floor(10000 / _total);
  }
  return nameWithoutWeight;
};

function cleanDna(_str) {
  const withoutOptions = removeQueryStrings(_str);
  var dna = Number(withoutOptions.split(":").shift());
  return dna;
}

const cleanName = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  return nameWithoutWeight;
};

const getElements = (path) => {
  const files = fs
    .readdirSync(path)
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
  const variableTotal = exactWeight 
  ? files.reduce((accumulator, currentValue) => accumulator + Number(currentValue.slice(0, -4).split(rarityDelimiter).pop()), 0)
  : files.length
  const elems = files.map((i, index) => {
      if (i.includes("-")) {
        throw new Error(`layer name can not contain dashes, please fix: ${i}`);
      }
      return {
        id: index,
        name: cleanName(i),
        filename: i,
        path: `${path}${i}`,
        weight: getRarityWeight(i, variableTotal),
      };
    });
    return elems
};

const layersSetup = (layersOrder) => {
  const layers = layersOrder.map((layerObj, index) => ({
    id: index,
    elements: getElements(`${layersDir}/${layerObj.name}/`),
    name:
      layerObj.options?.["displayName"] != undefined
        ? layerObj.options?.["displayName"]
        : layerObj.name,
    blend:
      layerObj.options?.["blend"] != undefined
        ? layerObj.options?.["blend"]
        : "source-over",
    opacity:
      layerObj.options?.["opacity"] != undefined
        ? layerObj.options?.["opacity"]
        : 1,
    bypassDNA:
      layerObj.options?.["bypassDNA"] !== undefined
        ? layerObj.options?.["bypassDNA"]
        : false,
    layerVariations: 
      layerObj.options?.['layerVariations'] !== undefined
        ? layerObj.options?.['layerVariations']
        : undefined,
    hiddenFromMetadata: 
        layerObj.options?.['hiddenFromMetadata'] !== undefined
          ? layerObj.options?.['hiddenFromMetadata']
          : undefined,
    ogName: layerObj.name,
    
  }));
  return layers;
};

// const saveImage = (_editionCount) => {
//   fs.writeFileSync(
//     `${buildDir}/images/${_editionCount}.png`,
//     canvas.toBuffer("image/png")
//   );
// };

const saveImage = (_editionCount) => {
  fs.writeFileSync(
    `${buildDir}/images/${_editionCount}.png`,
    canvas.toBuffer("image/png", {
      resolution: format.dpi,
    }),
  );
};

const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, ${background.brightness})`;
  return pastel;
};

const drawBackground = () => {
  ctx.fillStyle = background.static ? background.default : genColor();
  ctx.fillRect(0, 0, format.width, format.height);
};

const addMetadata = (_dna, _edition) => {
  let dateTime = Date.now();
  let tempMetadata = {
    name: `${namePrefix} #${_edition}`,
    description: description,
    image: `${baseUri}/${_edition}.png`,
    dna: sha1(_dna),
    edition: _edition,
    date: dateTime,
    ...extraMetadata,
    attributes: attributesList,
    compiler: "Datboi1337 Art Engine (Hashlips fork)",
  };
  if (network == NETWORK.sol) {
    tempMetadata = {
      //Added metadata for solana
      name: tempMetadata.name,
      symbol: solanaMetadata.symbol,
      description: tempMetadata.description,
      //Added metadata for solana
      seller_fee_basis_points: solanaMetadata.seller_fee_basis_points,
      image: `${_edition}.png`,
      //Added metadata for solana
      external_url: solanaMetadata.external_url,
      edition: _edition,
      ...extraMetadata,
      attributes: tempMetadata.attributes,
      properties: {
        files: [
          {
            uri: `${_edition}.png`,
            type: "image/png",
          },
        ],
        category: "image",
        creators: solanaMetadata.creators,
      },
    };
  }
  metadataList.push(tempMetadata);
  attributesList = [];
};

const addAttributes = (_element) => {
  if (_element.layer.hiddenFromMetadata) return;
  let selectedElement = _element.layer.selectedElement;
  attributesList.push({
    trait_type: _element.layer.name,
    value: selectedElement.name,
  });
};

const addStats = () => {
    statBlocks.forEach((stat) => {
    let min = stat.minValue;
    let max = stat.maxValue;
    let updatedValue = Math.floor(Math.random() * (max - min + 1)) + min;
    let newTrait = stat.attribute
    newTrait.value = updatedValue;
    statList.push(newTrait);
  });
}

const loadLayerImg = (_layer) => {
  return new Promise((resolve, reject) => {
    let path = _layer.selectedElement.path;
    if (_layer.layerVariations != undefined) {
      path = path.split('#')[0];
      path = path.concat(_layer.variant.concat('.png'));
      path = path.replace(_layer.ogName, _layer.ogName.concat('-variant'));
    }
    if (!fs.existsSync(path)) {
      throw new Error(`The selected file (${path}) does not exist. Check spelling and location.`);
    }
    if (debugLogs) console.log('PATH', { path, exists: fs.existsSync(path) });
    loadImage(`${path}`)
      .then((image) => {
        resolve({ layer: _layer, loadedImage: image });
      })
      .catch(() => {
        reject();
      });
  });
};

const addText = (_sig, x, y, size) => {
  ctx.fillStyle = text.color;
  ctx.font = `${text.weight} ${size}pt ${text.family}`;
  ctx.textBaseline = text.baseline;
  ctx.textAlign = text.align;
  ctx.fillText(_sig, x, y);
};

const drawElement = (_renderObject, _index, _layersLen) => {
  ctx.globalAlpha = _renderObject.layer.opacity;
  ctx.globalCompositeOperation = _renderObject.layer.blend;
  text.only
    ? addText(
        `${_renderObject.layer.name}${text.spacer}${_renderObject.layer.selectedElement.name}`,
        text.xGap,
        text.yGap * (_index + 1),
        text.size
      )
    : ctx.drawImage(
        _renderObject.loadedImage,
        0,
        0,
        format.width,
        format.height
      );

  addAttributes(_renderObject);
};

const constructLayerToDna = (_dna = "", _layers = []) => {
  let mappedDnaToLayers = _layers.map((layer, index) => {
    if (_dna.split(DNA_DELIMITER)[index] == undefined) {
      throw new Error(`Some weights in your ${layer.name} folder are either undefined or incorrect.
      NOTE: All layers must include a weight. If using 'namedWeight' system, all layers must contain NAMED weight, no numbers!`);
    }
    let selectedElement = layer.elements.find(
      (e) => e.id == cleanDna(_dna.split(DNA_DELIMITER)[index])
    );

    if (_dna.search(selectedElement.name) < 0) {
      throw new Error(`Some weights in your ${layer.name} folder are either undefined or incorrect.
      NOTE: All layers must include a weight. If using 'namedWeight' system, all layers must contain NAMED weight, no numbers!`);
    }

    let variant = layer.layerVariations != undefined ? (_dna.split('&').pop()).split(DNA_DELIMITER).shift() : '';

    return {
      name: layer.name,
      blend: layer.blend,
      opacity: layer.opacity,
      selectedElement: selectedElement,
      layerVariations: layer.layerVariations,
      variant: variant,
      ogName: layer.ogName,
      hiddenFromMetadata: layer.hiddenFromMetadata
    };
  });
  return mappedDnaToLayers;
};

/**
 * In some cases a DNA string may contain optional query parameters for options
 * such as bypassing the DNA isUnique check, this function filters out those
 * items without modifying the stored DNA.
 *
 * @param {String} _dna New DNA string
 * @returns new DNA string with any items that should be filtered, removed.
 */
const filterDNAOptions = (_dna) => {
  const dnaItems = _dna.split(DNA_DELIMITER);
  const filteredDNA = dnaItems.filter((element) => {
    const query = /(\?.*$)/;
    const querystring = query.exec(element);
    if (!querystring) {
      return true;
    }
    const options = querystring[1].split("&").reduce((r, setting) => {
      const keyPairs = setting.split("=");
      return { ...r, [keyPairs[0]]: keyPairs[1] };
    }, []);

    return options.bypassDNA;
  });

  return filteredDNA.join(DNA_DELIMITER);
};

/**
 * Cleaning function for DNA strings. When DNA strings include an option, it
 * is added to the filename with a ?setting=value query string. It needs to be
 * removed to properly access the file name before Drawing.
 *
 * @param {String} _dna The entire newDNA string
 * @returns Cleaned DNA string without querystring parameters.
 */
const removeQueryStrings = (_dna) => {
  const query = /(\?.*$)/;
  return _dna.replace(query, "");
};

const isDnaUnique = (_DnaList = new Set(), _dna = "") => {
  const _filteredDNA = filterDNAOptions(_dna);
  return !_DnaList.has(_filteredDNA);
};

const createDnaNames = (_layers, _variant) => {
  let randNum = [];
  _layers.forEach((layer) => {
    const rarityCount = {
      Mythic: 0,
      Legendary: 0,
      Epic: 0,
      Rare: 0,
      Uncommon: 0,
      Common: 0
    }
    var totalWeight = 10000;
    // Get count of each rarity in layer folders
    layer.elements.forEach((element) => {
      switch (element.weight) {
        case "Mythic":
          rarityCount.Mythic++;
          break;
        case "Legendary":
          rarityCount.Legendary++;
          break;
        case "Epic":
          rarityCount.Epic++;
          break;
        case "Rare":
          rarityCount.Rare++;
          break;
        case "Uncommon":
          rarityCount.Uncommon++;
          break;
        case "Common":
          rarityCount.Common++;
          break;
        default:
          rarityCount.Common++;
      }
    });
    // Find any missing rarities and log the remainder of 10,000
    let remainder = 0;
    for (const key in rarityCount) {
      let diff = (rarity_config[key]['ranks'][1] - rarity_config[key]['ranks'][0]);
      if (rarityCount[key] !== 0) {
        rarityCount[key] = diff / rarityCount[key]
      } else {
        remainder += diff;
        delete rarityCount[key];
      }
    }
    // Split remainder evenly among remaining rarities
    let remainingRarity = Object.keys(rarityCount).length;
    remainder /= remainingRarity;
    for (const key in rarityCount) {
      rarityCount[key] += remainder;
    }
    // Check for any where higher rarity has larger weight than lower rarity
    let uncommonDiff = (rarityCount.Uncommon > rarityCount.Common) 
      ? Math.floor(rarityCount.Uncommon - rarityCount.Common) : 0;
    let rareDiff = (rarityCount.Rare > rarityCount.Uncommon) 
      ? Math.floor(rarityCount.Rare - rarityCount.Uncommon) : 0;
    let epicDiff = (rarityCount.Epic > rarityCount.Rare) 
      ? Math.floor(rarityCount.Epic - rarityCount.Rare) : 0;
    let legendaryDiff = (rarityCount.Legendary > rarityCount.Epic) 
      ? Math.floor(rarityCount.Legendary - rarityCount.Epic) : 0;
    let mythicDiff = (rarityCount.Mythic > rarityCount.Legendary) 
      ? Math.floor(rarityCount.Mythic - rarityCount.Legendary) : 0;
    // Redistribute weight to ensure weights match rarities      
    rarityCount.Common += uncommonDiff;
    rarityCount.Uncommon -= uncommonDiff;
    rarityCount.Uncommon += rareDiff;
    rarityCount.Rare -= rareDiff;
    rarityCount.Rare += epicDiff;
    rarityCount.Epic -= epicDiff;
    rarityCount.Epic += legendaryDiff;
    rarityCount.Legendary -= legendaryDiff;
    rarityCount.Legendary += mythicDiff;
    rarityCount.Mythic -= mythicDiff;
    // Proceed with random generation: number between 0 - totalWeight
    let random = Math.floor(Math.random() * totalWeight);
    for (var i = 0; i < layer.elements.length; i++) {
      let newWeight = layer.elements[i].weight;
      // subtract the current weight from the random weight until we reach a sub zero value.
      random -= rarityCount[newWeight];
      if (random < 0) {
        if(layer.layerVariations != undefined) {
          return randNum.push(
            `${layer.elements[i].id}:${layer.elements[i].name}& ${_variant}`
          );
        } else {
          return randNum.push(
            `${layer.elements[i].id}:${layer.elements[i].filename}${
              layer.bypassDNA ? "?bypassDNA=true" : ""
            }`
          );
        }
      } 
    } 
  });
  return randNum.join(DNA_DELIMITER);
};


const createDnaExact = (_layers, _remainingInLayersOrder, _currentEdition, _variant) => {
  let randNum = [];
  let layerSizes = allLayerSizes();
  _layers.forEach((layer) => {
    var totalWeight = 0;
    let expected = layerSizes[layer.name] - _currentEdition;
    let remaining = toCreateNow - _currentEdition
    layer.elements.forEach((element) => {
      totalWeight += allTraitsCount[element.name];
    });

    // Require totalWeight to match either current remaining layersOrder, overall size for multiple layersOrders, or remaining collectionSize. 
    if (totalWeight != _remainingInLayersOrder && totalWeight != expected && totalWeight != remaining) {
      throw new Error(`${layer.name} layer total weight (${totalWeight}) does not match either layersOrder weight (${_remainingInLayersOrder}),
      overall expected weight from multiple layersOrders (${expected}), or remaining collection size (${remaining})`);
    };

    // number between 0 - totalWeight
    // We keep the random function here to ensure we don't generate all the same layers back to back.
    let random = Math.floor(Math.random() * totalWeight);
    for (var i = 0; i < layer.elements.length; i++) {
      // subtract the current weight from the random weight until we reach a sub zero value.
      let lookup = allTraitsCount[layer.elements[i].name];
      if (lookup > 0) {
        random -= allTraitsCount[layer.elements[i].name];
      }
      if (random < 0) {
        if(layer.layerVariations != undefined) {
          return randNum.push(
            `${layer.elements[i].id}:${layer.elements[i].name}& ${_variant}`
          );
        } else {
          return randNum.push(
            `${layer.elements[i].id}:${layer.elements[i].filename}${
              layer.bypassDNA ? "?bypassDNA=true" : ""
            }`
          );
        }
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

const createDna = (_layers, _variant) => {
  let randNum = [];
  _layers.forEach((layer) => {
    var totalWeight = 0;
    layer.elements.forEach((element) => {
      totalWeight += element.weight;
    });
    // number between 0 - totalWeight
    let random = Math.floor(Math.random() * totalWeight);
    for (var i = 0; i < layer.elements.length; i++) {
      // subtract the current weight from the random weight until we reach a sub zero value.
      random -= layer.elements[i].weight;
      if (random < 0) {
        if(layer.layerVariations != undefined) {
          return randNum.push(
            `${layer.elements[i].id}:${layer.elements[i].name}& ${_variant}`
          );
        } else {
          return randNum.push(
            `${layer.elements[i].id}:${layer.elements[i].filename}${
              layer.bypassDNA ? "?bypassDNA=true" : ""
            }`
          );
        }
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

const createDnaOG = (_layers) => {
  let randNum = [];
  _layers.forEach((layer) => {
    var totalWeight = 0;
    layer.elements.forEach((element) => {
      totalWeight += element.weight;
    });
    // number between 0 - totalWeight
    let random = Math.floor(Math.random() * totalWeight);
    for (var i = 0; i < layer.elements.length; i++) {
      // subtract the current weight from the random weight until we reach a sub zero value.
      random -= layer.elements[i].weight;
      if (random < 0) {
        return randNum.push(
          `${layer.elements[i].id}:${layer.elements[i].filename}${
            layer.bypassDNA ? "?bypassDNA=true" : ""
          }`
        );
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

const writeMetaData = (_data) => {
  fs.writeFileSync(`${buildDir}/json/_metadata.json`, _data);
};

const sortedMetadata = () => {
  let files = fs.readdirSync(`${buildDir}/json`);
  let filenames  = [];
  let allMetadata = [];
  files.forEach(file => {
    const str = file
    const filename = Number(str.split('.').slice(0, -1).join('.'));
    return filenames.push(filename);
  })
  filenames.sort(function(a, b) {
    return a - b;
  });

  const writingPromises = [];
  for (let i = 0; i < filenames.length; i++) {
    if (!isNaN(filenames[i])) {
      let rawFile = fs.readFileSync(`${basePath}/build/json/${filenames[i]}.json`);
      let data = JSON.parse(rawFile);
      writingPromises.push(fs.promises.writeFile(`${basePath}/build/json/${data.edition}.json`, JSON.stringify(data, null, 2)))
      allMetadata.push(data);
    } 
  }
  writingPromises.push(fs.promises.writeFile(`${buildDir}/json/_metadata.json`, JSON.stringify(allMetadata, null, 2)))
  Promise.all(writingPromises).catch(console.error)
  console.log(`Ordered all items numerically in _metadata.json. Saved in ${basePath}/build/json`);
}

const saveMetaDataSingleFile = (_editionCount) => {
  let metadata = metadataList.find((meta) => meta.edition == _editionCount);
  if (debugLogs) console.log(`Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`);
  fs.writeFileSync(
    `${buildDir}/json/${_editionCount}.json`,
    JSON.stringify(metadata, null, 2)
  );
};

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

const traitCount = (_layers) => {
  let count = new Object();
  _layers.forEach((layer) => {
    layer.elements.forEach((element) => {
      count[element.name] = element.weight;
    });
  });
  return count;
};

const allLayersOrders = () => {
  let layerList = [];
  for (let i = 0; i < layerConfigurations.length; i++) {
    const layers = layersSetup(
      layerConfigurations[i].layersOrder
    );
    
    layers.forEach((layer) => {
      return layerList.push(layer);
    });
  };
  return layerList;
}

const allLayerSizes = () => {
  let layerList = new Object();
  for (let i = 0; i < layerConfigurations.length; i++) {
    const layers = layersSetup(
      layerConfigurations[i].layersOrder
    );
    
    layers.forEach((layer) => {
      layerList[layer.name] = layerConfigurations[i].growEditionSizeTo
    });
  };
  return layerList;
}

const createVariation = (_variations) => {
  let setVariant = [];
  _variations.forEach((variant) => {
    var totalWeight = 0;
    variant.Weight.forEach((Weight) => {
      totalWeight += Weight;
    });
    // number between 0 - totalWeight
    let random = Math.floor(Math.random() * totalWeight);
    for (var i = 0; i < variant.Weight.length; i++) {
      // subtract the current weight from the random weight until we reach a sub zero value.
      random -= variant.Weight[i];
      if (random < 0) {
        return setVariant.push(
          `${variant.name}:${variant.variations[i]}`
        );
      }
    }
  });
  return setVariant.join(DNA_DELIMITER);
};

const startCreating = async () => {
  if (exactWeight) {
    let allLayers = allLayersOrders();
    allTraitsCount = traitCount(allLayers);
  }
  let layerConfigIndex = 0;
  let editionCount = 1;
  let failedCount = 0;
  let abstractedIndexes = [];
  for (
    let i = network == NETWORK.sol ? 0 : 1;
    i <= layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo;
    i++
  ) {
    abstractedIndexes.push(i);
  }
  if (shuffleLayerConfigurations) {
    abstractedIndexes = shuffle(abstractedIndexes);
  }
  if (debugLogs) console.log('Editions left to create: ', abstractedIndexes);

  let doSizeConvert = false;
  let collectSizes = [0];
  layerConfigurations.forEach((layerConfig, index) => {
    if (layerConfig.growEditionSizeTo <= collectSizes[index]) doSizeConvert = true;
    collectSizes.push(layerConfig.growEditionSizeTo);
  });
  if (doSizeConvert)
    for (let index = 0; index < layerConfigurations.length; index += 1) {
      if (index != 0)
        layerConfigurations[index].growEditionSizeTo =
          layerConfigurations[index - 1].growEditionSizeTo + layerConfigurations[index].growEditionSizeTo;
    }

  while (layerConfigIndex < layerConfigurations.length) {
    const layers = layersSetup(
      layerConfigurations[layerConfigIndex].layersOrder
    );
    while (
      editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo && editionCount <= toCreateNow
    ) {

      // let currentEdition = editionCount - 1;
      // let remainingInLayersOrder = layerConfigurations[layerConfigIndex].growEditionSizeTo - currentEdition;
      
      if (exactWeight && namedWeight) {
        throw new Error(`namedWeight and exactWeight can't be used together. Please mark one or both as false in config.js`);
      }

      let newVariant = createVariation(layerVariations);
      let variant = newVariant.split(':').pop();
      let variantName = newVariant.split(':')[0];

      // let newDna = (exactWeight) ? createDnaExact(layers, remainingInLayersOrder, currentEdition, variant) : (namedWeight) ? createDnaNames(layers, variant) : createDna(layers, variant);
      let newDna = namedWeight ? createDnaNames(layers, variant) : createDna(layers, variant);

      let duplicatesAllowed = (allowDuplicates) ? true : isDnaUnique(dnaList, newDna);

      // if (isDnaUnique(dnaList, newDna)) {
      if (duplicatesAllowed) {
        let results = constructLayerToDna(newDna, layers);

        if (exactWeight) {
          results.forEach((layer) => {
            allTraitsCount[layer.selectedElement.name]--;
          })
        }

        let loadedElements = [];

        results.forEach((layer) => {
          loadedElements.push(loadLayerImg(layer));
        });

        await Promise.all(loadedElements).then((renderObjectArray) => {
          debugLogs ? console.log("Clearing canvas") : null;
          ctx.clearRect(0, 0, format.width, format.height);
          if (gif.export) {
            hashlipsGiffer = new HashlipsGiffer(
              canvas,
              ctx,
              `${buildDir}/gifs/${abstractedIndexes[0]}.gif`,
              gif.repeat,
              gif.quality,
              gif.delay
            );
            hashlipsGiffer.start();
          }
          if (background.generate) {
            drawBackground();
          }
          let variantMetadata = false
          renderObjectArray.forEach((renderObject, index) => {
            Object.keys(renderObject.layer).forEach(key => {
              if (renderObject.layer.layerVariations !== undefined) {
                variantMetadata = true;
              }
            })
            
            drawElement(
              renderObject,
              index,
              layerConfigurations[layerConfigIndex].layersOrder.length
            );
            if (gif.export) {
              hashlipsGiffer.add();
            }
          });
          extraAttributes.forEach((attr) => {
            attributesList.push(attr);
          });
          if (variantMetadata) {
            attributesList.push({
              trait_type: variantName,
              value: variant,
            });
          }
          if (enableStats) {
            addStats();
            statList.forEach((stat) => {
              attributesList.push(stat);
            });
            statList = [];
          }
          if (gif.export) {
            hashlipsGiffer.stop();
          }
          if (debugLogs) console.log("Editions left to create: ", abstractedIndexes)
          saveImage(abstractedIndexes[0]+resumeNum);
          addMetadata(newDna, abstractedIndexes[0]+resumeNum);
          saveMetaDataSingleFile(abstractedIndexes[0]+resumeNum);
          console.log(
            `Created edition: ${abstractedIndexes[0]+resumeNum}, with DNA: ${sha1(
              newDna
            )}`
          );
        });
        dnaList.add(filterDNAOptions(newDna));
        editionCount++;
        abstractedIndexes.shift();
      } else {
        console.log("DNA exists!");
        failedCount++;
        if (failedCount >= uniqueDnaTorrance) {
          console.log(
            `More then ${uniqueDnaTorrance} duplicates created! You need more layers or elements to grow your edition to ${layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
          );
          process.exit();
        }
      }
    }
    layerConfigIndex++;
  }
  // writeMetaData(JSON.stringify(metadataList, null, 2));
  sortedMetadata();
};

module.exports = { startCreating, buildSetup, getElements };