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
  zindexDelimiter,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  text,
  collectionName,
  symbol,
  network,
  solanaMetadata,
  SEIMetadata,
  gif,
  resumeNum,
  rarity_config,
  collectionSize,
  exactWeight,
  importOldDna,
  allowDuplicates,
  enableStats,
  statBlocks,
  extraAttributes,
  bypassZeroProtection,
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
const incompatible = `${basePath}/compatibility/incompatibilities.json`
const { traitCounts, incompatibleNest, compatibleNest } = require(`${basePath}/modules/isCompatible.js`);
const cliProgress = require('cli-progress');
let incompatibilities;

let hashlipsGiffer = null;
let allTraitsCount;

const buildSetup = () => {
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
    fs.mkdirSync(`${buildDir}/assets`);
    fs.mkdirSync(`${buildDir}/json`);
    fs.mkdirSync(`${buildDir}/opensea-drop`);
    fs.mkdirSync(`${buildDir}/opensea-drop/json`);
    fs.mkdirSync(`${buildDir}/images`);
  } else {
    fs.rmSync(buildDir, { recursive: true } );
    fs.mkdirSync(buildDir);
    fs.mkdirSync(`${buildDir}/assets`);
    fs.mkdirSync(`${buildDir}/json`);
    fs.mkdirSync(`${buildDir}/opensea-drop`);
    fs.mkdirSync(`${buildDir}/opensea-drop/json`);
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
  let rawCompatibleData = fs.readFileSync(incompatible);
  incompatibilities = JSON.parse(rawCompatibleData);
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function cleanDna(_str) {
  const withoutOptions = removeQueryStrings(_str);
  var dna = Number(withoutOptions.split(":").shift());
  return dna;
}

const cleanName = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  let nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  let nameWithoutZindex = nameWithoutWeight.split(zindexDelimiter).pop();
  return nameWithoutZindex;
};

const getZIndex = (_str) => {
  let zindex = Number(_str.split(zindexDelimiter).shift().slice(1));
  return zindex;
};

const getRarityWeight = (_str) => {
  let weight = capitalizeFirstLetter(_str.slice(0, -4).split(rarityDelimiter).pop());
  if (exactWeight) {
    var finalWeight = weight;
  } else if (isNaN(weight)) {
    // Ensure non-number weights appropriately adhere to rarity_config
    if (!rarity_config[weight]) {
      throw new Error(`'${weight}' contained in ${_str} is not a valid rarity.` +
      ` Please ensure your weights adhere to rarity_config.`);
    }
    let rarity = Object.keys(rarity_config);
      for (let i = 0; i < rarity.length; i++) {
        if (rarity[i] == weight && i == 0) {
          var finalWeight = rarity_config[weight];
        } else if (rarity[i] == weight) {
          let min = rarity_config[rarity[i - 1]];
          let max = rarity_config[rarity[i]];
          var finalWeight = Math.floor(Math.random() * (max - min) + min);
        }
      }
    
  } else {
    var finalWeight = weight;
  }
  return Number(finalWeight);
};

const getElements = (path, _zindex) => {
  return fs
    .readdirSync(path)
    .filter((item) => {
      const fullPath = path + item;
      return fs.statSync(fullPath).isFile() && !/(^|\/)\.[^\/\.]/g.test(item);
    })
    .map((i, index) => {
      if (i.includes("-")) {
        throw new Error(`layer name can not contain dashes, please fix: ${i}`);
      }
      let zindex = getZIndex(i);
      // console.log(i);
      return {
        id: index,
        name: cleanName(i),
        filename: i,
        path: `${path}${i}`,
        weight: getRarityWeight(i),
        weightLocked: false,
        zindex: !isNaN(zindex) ? zindex : _zindex * 10,
      };
    });
};

const layersSetup = (layersOrder) => {
  const layers = layersOrder.map((layerObj, index) => ({
    id: index,
    elements: getElements(`${layersDir}/${layerObj.name}/`, index),
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
    ogName: layerObj.name,
    subTraits: 
      layerObj.options?.["subTraits"] != undefined
        ? layerObj.options?.["subTraits"]
        : false,
    exclude: 
        layerObj.options?.["exclude"] != undefined
        ? layerObj.options?.["exclude"]
        : false,
  }));
  return layers;
};

const saveImage = (_editionCount) => {
  fs.writeFileSync(
    `${buildDir}/images/${_editionCount}.png`,
    canvas.toBuffer("image/png", {
      resolution: format.dpi,
    }),
  );
  if (network == NETWORK.sol || network == NETWORK.sei) {
    fs.writeFileSync(
      `${buildDir}/assets/${_editionCount}.png`,
      canvas.toBuffer("image/png", {
        resolution: format.dpi,
      }),
    );
  }
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

// const addMetadata = (_dna, _edition) => {
const addMetadata = (_dna, _name, _desc, _edition) => {
  let tempMetadata = {
    name: `${_name} #${_edition}`,
    description: _desc,
    image: `${baseUri}/${_edition}.png`,
    animation_url: ``,
    edition: _edition,
    ...extraMetadata,
    attributes: attributesList,
    dna: sha1(_dna),
    compiler: "datboi1337 Art Engine (Hashlips fork)",
  };
  if (network == NETWORK.sol) {
    tempMetadata = {
      name: tempMetadata.name,
      symbol: symbol,
      description: tempMetadata.description,
      seller_fee_basis_points: solanaMetadata.seller_fee_basis_points,
      image: `${_edition}.png`,
      animation_url: ``,
      external_url: solanaMetadata.external_url,
      edition: _edition,
      ...extraMetadata,
      attributes: tempMetadata.attributes,
      collection: solanaMetadata.collection,
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
  } else if (network == NETWORK.sei) {
    tempMetadata = {
      name: `${_name} #${_edition}`,
      symbol: symbol,
      collection: collectionName,
      description: _desc,
      image: `${_edition}.png`,
      animation_url: ``,
      edition: _edition,
      ...extraMetadata,
      attributes: attributesList,
      dna: sha1(_dna),
      compiler: "datboi1337 Art Engine (Hashlips fork)",
    }
  }
  metadataList.push(tempMetadata);
  attributesList = [];
};

const addAttributes = (_element) => {
  let selectedElement = _element.selectedElement;
  attributesList.push({
    trait_type: _element.name,
    value: selectedElement.name,
    imgData: {
      path: selectedElement.path,
      blend: _element.blend,
      opacity: _element.opacity,
      zindex: _element.zindex,
    },
    exclude: _element.exclude
  });
  // Add additional imgData for subTraits
  if (_element.subTraits.length > 0) {
    _element.subTraits.forEach((subTrait) => {
      attributesList.push({
        imgData: {
          path: subTrait.path,
          blend: subTrait.blend,
          opacity: subTrait.opacity,
          zindex: subTrait.zindex,
        }
      })
    })
  }
};

const addStats = () => {
    statBlocks.forEach((stat) => {
    let min = stat.minValue;
    let max = stat.maxValue;
    // let updatedValue = Math.floor(Math.random() * (max - min + 1)) + min;
    let updatedValue = (Math.random() * (max - min + 1) + min).toFixed(1);
    console.log(updatedValue);
    let newTrait = stat.attribute
    newTrait.value = updatedValue;
    statList.push(newTrait);
  });
}

const addText = (_sig, x, y, size) => {
  ctx.fillStyle = text.color;
  ctx.font = `${text.weight} ${size}pt ${text.family}`;
  ctx.textBaseline = text.baseline;
  ctx.textAlign = text.align;
  ctx.fillText(_sig, x, y);
};

// For reference
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

const checkVariant = (_variant, _traitObj) => {
  let tempObj = {..._traitObj};

  // Clean layer path
  let layerPath = tempObj.path.replace(`${tempObj.filename}`, '');

  // Filter for variant folders
  let variantFolders = fs
    .readdirSync(`${layerPath}`)
    .filter((item) => {
      const fullPath = layerPath + item;
      return fs.statSync(fullPath).isDirectory() && !/(^|\/)\.[^\/\.]/g.test(item);
    });
  
  // Pull variant trait if it exists, do nothing if it doesn't
  if (variantFolders.length > 0) {
    variantFolders.forEach((folder) => {
      if (folder == _variant) {
        let variantTraits = fs.readdirSync(`${layerPath}${_variant}`);
        let cleanTraits = variantTraits.map((file) => cleanName(file));
        cleanTraits.forEach((variant, index) => {
          if (variant == tempObj.name) {
            let variantPath = `${layerPath}${_variant}/${variantTraits[index]}`;
            let variantExists = fs.existsSync(variantPath);
            if (variantExists) {
              tempObj.path = variantPath;
              tempObj.filename = variantTraits[index];
            } else {
              return;
            }
          }
        });
      }
    });
  }

  return tempObj;
}

const checkSubTraits = (layer, _traitObj) => {
  // need to return elements array with subtraits appended?
  let tempArr = [];
  let tempObj = {..._traitObj};

  // console.log(tempObj);

  // Clean layer path
  let layerPath = tempObj.path.replace(`${tempObj.filename}`, '');

  // console.log('path');
  // console.log(layerPath);

  // Filter for subTrait folders
  let subTraitFolders = fs
    .readdirSync(`${layerPath}`)
    .filter((item) => {
      // console.log('item');
      // console.log(item);
      const fullPath = layerPath + item;
      return fs.statSync(fullPath).isDirectory() && !/(^|\/)\.[^\/\.]/g.test(item);
    });

    // console.log(subTraitFolders);
  
  // Pull variant trait if it exists, do nothing if it doesn't
  if (subTraitFolders.length > 0) {
    subTraitFolders.forEach((folder) => {
      if (folder == tempObj.name) {
        let subTraits = fs.readdirSync(`${layerPath}${tempObj.name}`);
        let cleanTraits = subTraits.map((file) => cleanName(file));
        cleanTraits.forEach((subTrait, index) => {
          let subObj = {};
          let subTraitfilename = subTraits[index];
          let subTraitPath = `${layerPath}${tempObj.name}/${subTraitfilename}`;
          let subTraitExists = fs.existsSync(subTraitPath);
          let subTraitZindex = getZIndex(subTraitfilename);
          
          if (subTraitExists) {
            subObj.name = subTrait;
            subObj.filename = subTraitfilename;
            subObj.path = subTraitPath;
            subObj.blend = layer.subTraits.blend ? layer.subTraits.blend : layer.blend;
            subObj.opacity = layer.subTraits.opacity ? layer.subTraits.opacity : layer.opacity;
            subObj.zindex = !isNaN(subTraitZindex) ? subTraitZindex : layer.subTraits.zindex ? layer.subTraits.zindex : tempObj.zindex;
          } else {
            return;
          }
          tempArr.push(subObj);
        });
      }
    });
  }

  return tempArr;
}

const constructLayerToDna = (_dna = "", _layers = []) => {
  let variant = '';
  let mappedDnaToLayers = _layers.map((layer, index) => {

    // console.log(layer);

    if (_dna.split(DNA_DELIMITER)[index] == undefined) {
      console.log(_dna);
      console.log(allTraitsCount);
      throw new Error(`Blank DNA. This can be caused by multiple traits with the same cleanName. `+
        `Please review the trait files in your ${layer.name} folder. If you're still running into`+
        ` issues, please send details to @datboi for assistance`);
    }

    let selectedElement = layer.elements.find(
      (e) => e.id == cleanDna(_dna.split(DNA_DELIMITER)[index])
    );

    if (index == 0 && selectedElement.path.includes("Variant")) {
      variant = selectedElement.name;
    }

    // Update selectedElement with variant paths for imgData
    selectedElement = checkVariant(variant, { ...selectedElement });

    let selectedSubTraits = checkSubTraits(layer, selectedElement);

    // console.log(selectedElement);
    // console.log(selectedSubTraits);

    if (_dna.search(selectedElement.name) < 0) {
      console.log(allTraitsCount);
      console.log(_dna);
      console.log(selectedElement);
      throw new Error(`${selectedElement.name} missing from DNA. This error should not happen anymore. Please send @datboi details`);
    }

    return {
      name: layer.name,
      blend: layer.blend,
      opacity: layer.opacity,
      selectedElement: selectedElement,
      ogName: layer.ogName,
      zindex: selectedElement.zindex,
      subTraits: selectedSubTraits,
      exclude: layer.exclude,
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

const createDnaExact = (_layers, layerConfigIndex) => {
  let randNum = [];
  let nestLookup = [];

  const incompatibleTraits = Object.keys(incompatibilities);

  let restrictedGeneration = false;

  if (incompatibleTraits.length > 0) {
    restrictedGeneration = true;

    var compatibleChild, pIndex, parentIndex, compatibleCount;
    incompatibleTraits.forEach((incompatibility) => {
      let parentIndexes = Object.keys(incompatibilities[incompatibility]);
      
      if (parentIndexes.length > 0) {
        parentIndexes.forEach((index) => {
          if (incompatibilities[incompatibility][index].layerIndex == layerConfigIndex) {
            pIndex = index;
            compatibleChild = [];
            compatibleChild.push(incompatibility);
            parentIndex = incompatibilities[incompatibility][index].parentIndex;
            compatibleCount = allTraitsCount[_layers[incompatibilities[incompatibility][index].childIndex].name][compatibleChild[0]];
            
            if(compatibleCount == 0) {
              debugLogs ? console.log(`All ${compatibleChild} distributed`) : null;
              delete incompatibilities[incompatibility][index];
            }
          }
        });
      } else {
        delete incompatibilities[incompatibility];
      }
    });
  }

  _layers.forEach((layer, index) => {
    let nest = {};
    
    if (restrictedGeneration && compatibleCount > 0) {
      nest = incompatibleNest[layerConfigIndex][compatibleChild]
      if (layer.id === parentIndex) {
        incompatibilities[compatibleChild[0]][pIndex].maxCount--;
      }
    } else {
      nest = compatibleNest[layerConfigIndex];
    }

    let compatibleTraits = Object.keys(nestLookup.reduce(
      (a, trait) => a[trait], nest
    ));

    // console.log(compatibleTraits);

    let elements = []
    for (let i = 0; i < compatibleTraits.length; i++) {
      for (let j = 0; j < layer.elements.length; j++) {
        if (layer.elements[j].name == compatibleTraits[i]) {
          tempElement = {
            id: layer.elements[j].id,
            name: layer.elements[j].name,
            weight: layer.elements[j].weight
          }
          elements.push(tempElement);
        }
      }
    }

    var totalWeight = 0;

    elements.forEach((element) => {
      totalWeight += allTraitsCount[layer.name][element.name];
    });

    // We keep the random function here to ensure we don't generate all the same layers back to back.
    let random = Math.floor(Math.random() * totalWeight);
    for (var i = 0; i < elements.length; i++) {
      // Check allTraitsCount for the selected element 
      let lookup = allTraitsCount[layer.name][elements[i].name];
      if (lookup > 0) {
        random -= allTraitsCount[layer.name][elements[i].name];
      }
      // Subtract the current weight from random until we reach a sub zero value.
      if (random < 0) {
        // Append new layer information to nestLookup
        nestLookup.push(elements[i].name);
        debugLogs ? console.log(`${elements[i].name} chosen for ${layer.name}`) : null;
        return randNum.push(
          `${elements[i].id}:${elements[i].name}` +
          `${layer.bypassDNA ? "?bypassDNA=true" : ""}`
        );
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

function countInstances(structure, targetTrait) {
  let count = 0;

  function traverse(obj, path) {
    for (const key in obj) {
      const currentPath = path.concat(key);
      
      if (currentPath.includes(targetTrait) && count <= collectionSize) {
        if (typeof obj[key] === 'object' && Object.keys(obj[key]).length === 0) {
          count++;
        }
      }
      
      
      if (typeof obj[key] === 'object' && count <= collectionSize) {
        traverse(obj[key], currentPath);
      }
    }
  }

  traverse(structure, []);
  return count;
}

// For reference
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
      // Subtract the current weight from the random weight until we reach a sub zero value.
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
  fs.writeFileSync(`${buildDir}/json/_imgData.json`, _data);
};

const sortedMetadata = () => {
  let files = fs.readdirSync(`${buildDir}/json`);
  let filenames  = [];
  let allMetadata = [];
  let csvData = [];
  let attributeTraitTypes = new Set();

  files.forEach(file => {
    const str = file
    const filename = Number(str.split('.').slice(0, -1).join('.'));
    return filenames.push(filename);
  })

  filenames.sort(function(a, b) {
    return a - b;
  });

  for (let i = 0; i < filenames.length; i++) {
    if (!isNaN(filenames[i]) && filenames[i] != -1) {
      let rawFile = fs.readFileSync(`${basePath}/build/json/${filenames[i]}.json`);
      let data = JSON.parse(rawFile);

      // Clean metadata to only include trait_type and value for final output
      for (let i = data.attributes.length - 1; i >= 0; i--) {
        delete data.attributes[i].imgData;
        if (!Object.keys(data.attributes[i]).length > 0 || data.attributes[i].exclude) {
          data.attributes.splice(i, 1);
        } else {
          delete data.attributes[i].exclude;
        }
      }

      data.attributes.forEach(attr => {
        attributeTraitTypes.add(attr.trait_type);
      });
    }
  }

  for (let i = 0; i < filenames.length; i++) {
    if (!isNaN(filenames[i]) && filenames[i] != -1) {
      let rawFile = fs.readFileSync(`${basePath}/build/json/${filenames[i]}.json`);
      let data = JSON.parse(rawFile);
      
      // Clean metadata to only include trait_type and value for final output
      for (let i = data.attributes.length - 1; i >= 0; i--) {
        delete data.attributes[i].imgData;
        if (!Object.keys(data.attributes[i]).length > 0 || data.attributes[i].exclude) {
          data.attributes.splice(i, 1);
        } else {
          delete data.attributes[i].exclude;
        }
      }

      fs.writeFileSync(`${basePath}/build/json/${data.edition}.json`, JSON.stringify(data, null, 2));
      // Save metadata & images together for Solana / SEI
      if (network == NETWORK.sol || network == NETWORK.sei) {
        fs.writeFileSync(`${basePath}/build/assets/${data.edition}.json`, JSON.stringify(data, null, 2))
      }
      // Save copy without file extension for opensea drop contracts
      fs.writeFileSync(`${basePath}/build/opensea-drop/json/${data.edition}`, JSON.stringify(data, null, 2));

      allMetadata.push(data);

      let csvRow = {};

      csvRow.tokenID = data.edition;

      csvRow.file_name = `${data.edition}.png`;

      attributeTraitTypes.forEach(traitType => {
        const attribute = data.attributes.find(attr => attr.trait_type === traitType);
        csvRow[`attributes[${traitType}]`] = attribute ? attribute.value : null;
      });

      Object.keys(data).forEach(key => {
        if (key !== 'edition' && key !== 'image' &&  key !== 'attributes' ) {
          csvRow[key] = data[key];
        }
      });

      csvData.push(csvRow);
    } 
  }
  fs.writeFileSync(`${buildDir}/json/_metadata.json`, JSON.stringify(allMetadata, null, 2));

  let csvHeaders = Object.keys(csvData[0]).join(',') + '\n';
  let csvRows = csvData.map(row => Object.values(row).join(',')).join('\n');
  let csvContent = csvHeaders + csvRows;
  fs.writeFileSync(`${buildDir}/opensea-drop/_metadata.csv`, csvContent);

  console.log(`Ordered all items numerically in _metadata.json. Saved in ${basePath}/build/json`);
}

const saveMetaDataSingleFile = (_editionCount) => {
  let metadata = metadataList.find((meta) => meta.edition == _editionCount);
  debugLogs
    ? console.log(
        `Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`
      )
    : null;
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

const forcedCombinationsSetup = () => {
  //Slightly reformatting incompatibilities for forced combination
  let combinations = {}
  for (const incompatibility in incompatibilities) {
    for (const pIndex in incompatibilities[incompatibility]) {
      let current = incompatibilities[incompatibility][pIndex];
      if (current.forced) {
        let tempObj = {
          child: incompatibility,
          parent: current.parents[0],
          childIndex: current.childIndex,
          parentIndex: current.parentIndex,
          layerIndex: current.layerIndex
        }
        combinations[current.parents[0]] = tempObj;
      } 
    }
  }
  return combinations;
}

let layers = [];

const scaleWeight = (layer, layerWeight, layerConfigIndex, forcedCombinations) => {
  // console.log(layer);
  const totalWeight = layer.elements.reduce((sum, element) => sum + element.weight, 0);

  // Grab any forced traits so we can set both weights together
  let forcedParents = Object.keys(forcedCombinations);

  if (layer.elements.length > layerWeight && !bypassZeroProtection) {
    throw new Error(
      `Your ${layer.name} layer contains more traits than your current growEditionSizeTo (${layerWeight})!`+
      ` To avoid 0 count traits, you must set growEditionSizeTo to a minimum of ${layer.elements.length}.`);
  }

  if (totalWeight !== layerWeight) {
    if (exactWeight) {
      throw new Error(`Total weight in ${layer.name} (${totalWeight}) does not match amount specified in 
      layerConfigurations (${layerWeight}). Please adjust weights in ${layer.name} to ensure the add up to ${layerWeight}.`);
    }

    let allCounts = new Object();
    let maxCount = 0;

    layer.elements.forEach((element) => {
      const scaledWeight = Math.max(1, Math.round((element.weight / totalWeight) * layerWeight));
      maxCount = traitCounts[layerConfigIndex][layer.ogName][element.name];

      allCounts[element.name] = maxCount;

      if (!element.weightLocked) {
        if (scaledWeight == 0) {
          element.weight = 1;
        } else if (scaledWeight > maxCount) {
          element.weight = maxCount;
        } else {
          element.weight = scaledWeight;
        }
      }

      // console.log(element);
    });

    if (debugLogs) {
      console.log(`Max counts for ${layer.name}:`);
      console.log(allCounts);
    }

    // Validate and adjust weights to make sure they add up to layerWeight
    let adjustedTotalWeight = layer.elements.reduce((sum, element) => sum + element.weight, 0);
    let weightDifference = layerWeight - adjustedTotalWeight;

    // While there's a difference, adjust weights proportionally
    let isDifference = true;
    let maxTries = 0;
    while (isDifference) {
      if (maxTries > uniqueDnaTorrance) {
        throw new Error(`Weights could not be reconciled at current collection size (${collectionSize})`+
        ` Please review your weights, and adjust.`);
      }
      layer.elements.forEach((element) => {
        if (!element.weightLocked) {
          if (Math.abs(weightDifference) < 0.0001) {
            isDifference = false;
            return;
          } else if (weightDifference < 0) { 
            let newWeight = element.weight - 1;
            // Ensure that if reducing weight, it doesn't go to zero.
            if (newWeight > 0) {
              element.weight--;
              weightDifference++;
            }
          } else if (weightDifference > 0) {
            let newWeight = element.weight + 1;
            // Ensure that if increasing weight, it doesn't go past maxCount
            if (newWeight <= maxCount) {
              element.weight++;
              weightDifference--;
            }
          } else {
            throw new Error(`This error should only show if math has changed`);
          }
        } 
      });
      maxTries++;
    }
    // Keep forced children weight in line with parent's weight
    layer.elements.forEach((element) => {
      if (forcedParents.includes(element.name)) {
        let tempChildren = layers[forcedCombinations[element.name].childIndex].elements
        tempChildren.forEach((child) => {
          if (child.name == forcedCombinations[element.name].child) {
            tempChildren[child.id].weight = element.weight;
            tempChildren[child.id].weightLocked = true;
          }
        });
      }
    });
  } else if (exactWeight) {
    layer.elements.forEach((element) =>{
      maxCount = traitCounts[layerConfigIndex][layer.ogName][element.name];

      if (element.weight > maxCount) {
        throw new Error(`Your ${element.name} trait's weight (${element.weight}) exceeds the maximum it`+
          `can be generated with given incompatibilities and collection size. Please adjust`+
          ` ${element.name}'s weight to a maximum of ${maxCount}, and adjust other weights accordingly.`);
      }
    })
  }
};

const traitCount = (_layers) => {
  const incompatibleTraits = Object.keys(incompatibilities);
  let count = new Object();
  _layers.forEach((layer) => {
    let tempCount = {};
    layer.elements.forEach((element) => {
      // console.log(element);
      tempCount[element.name] = element.weight;
    });
    count[layer.name] = tempCount;
  });
  
  // Now that all weights are finalized, update 'maxCount' for incompatibilities
  const countArr = Object.keys(count);
  if (incompatibleTraits.length > 0) {
    incompatibleTraits.forEach((incompatibility) => {
      let parentIndexes = Object.keys(incompatibilities[incompatibility]);
      parentIndexes.forEach((index) => {
        let parentIndex = parseInt(index);
        let max = count[countArr[incompatibilities[incompatibility][parentIndex].childIndex]][incompatibility];

        let maxPerIndex = Math.floor(max / parentIndexes.length);
        let remaining = max % parentIndexes.length;

        for (let i = 0; i < parentIndexes.length; i++) {
          if (i < remaining) {
            incompatibilities[incompatibility][parentIndexes[i]].maxCount = maxPerIndex + 1;
          } else {
            incompatibilities[incompatibility][parentIndexes[i]].maxCount = maxPerIndex;
          }
        }
      });
    });
  }
  return count;
};

const startCreating = async () => {
  let layerConfigIndex = 0;
  let editionCount = 1;
  let cumulativeEditionSize = 0;
  let failedCount = 0;
  let abstractedIndexes = [];
  const startNum = network == NETWORK.sol || network == NETWORK.sei ? 0 : 1;
  for (
    let i = startNum;
    i <= collectionSize;
    i++
  ) {
    abstractedIndexes.push(i);
  }
  // console.log(abstractedIndexes);
  if (shuffleLayerConfigurations) {
    abstractedIndexes = shuffle(abstractedIndexes);
  }
  debugLogs
    ? console.log("Editions left to create: ", abstractedIndexes)
    : null;

  let growSizes = 0;
  layerConfigurations.forEach((layerConfig) => {
    growSizes += layerConfig.growEditionSizeTo;
  })

  if (growSizes != collectionSize) {
    throw new Error(`Your collectionSize (${collectionSize}) does not match the total of your growEditionSizeTo in layerConfigurations `+
    `(${growSizes}). Please ensure that collectionSize is defined in config.js, and double check your growEditionSizeTo to ensure they `+
    `add up to ${collectionSize}. `);
  }

  const forcedCombinations = forcedCombinationsSetup();

  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(collectionSize, 0);

  while (layerConfigIndex < layerConfigurations.length) {
    layers = layersSetup(
      layerConfigurations[layerConfigIndex].layersOrder
    );

    let layersOrderSize = layerConfigurations[layerConfigIndex].growEditionSizeTo;
    cumulativeEditionSize += layersOrderSize;
    layers.forEach((layer) => {
      scaleWeight(layer, layersOrderSize, layerConfigIndex, forcedCombinations);
    });
    allTraitsCount = traitCount(layers);
    // console.log(allTraitsCount)
    debugLogs ? console.log(allTraitsCount) : null;
    while (
      editionCount <= cumulativeEditionSize
    ) {
      let newDna = createDnaExact(layers, layerConfigIndex);

      let duplicatesAllowed = (allowDuplicates) ? true : isDnaUnique(dnaList, newDna);

      if (duplicatesAllowed) {
        
        let results = constructLayerToDna(newDna, layers);
        // Add metadata from layers
        results.forEach((layer) => {
          // Deduct selected layers from allTraitscount
          allTraitsCount[layer.name][layer.selectedElement.name]--;
          // console.log('--------------------');
          // console.log(layer);

          addAttributes(layer);
        })

        // Add any additional metadata
        extraAttributes.forEach((attr) => {
          attributesList.push(attr);
        });
        if (enableStats) {
          addStats();
          statList.forEach((stat) => {
            attributesList.push(stat);
          });
          statList = [];
        }

        let name = layerConfigurations[layerConfigIndex].namePrefix;
        let desc = layerConfigurations[layerConfigIndex].description;

        addMetadata(newDna, name, desc, abstractedIndexes[0]+resumeNum);
        saveMetaDataSingleFile(abstractedIndexes[0]+resumeNum);

        // console.log(
        //   `Created edition: ${abstractedIndexes[0]+resumeNum}, with DNA: ${sha1(
        //     newDna
        //   )}`
        // );
        dnaList.add(filterDNAOptions(newDna));
        editionCount++;
        abstractedIndexes.shift();
        progressBar.increment();
      } else {
        // console.log("DNA exists!");
        failedCount++;
        if (failedCount >= uniqueDnaTorrance) {
          console.log(
            `You need more layers or elements to grow your edition to ${collectionSize} artworks!`
          );
          process.exit();
        }
      }
    }
    layerConfigIndex++;
  }
  progressBar.stop();
  if (network == NETWORK.sei) {
    let collectionMetadata = {
      name: collectionName,
      image: "-1.png",
    }
    fs.writeFileSync(`${basePath}/build/json/-1.json`, JSON.stringify(collectionMetadata, null, 2));
    fs.writeFileSync(`${basePath}/build/opensea-drop/json/-1`, JSON.stringify(collectionMetadata, null, 2));
  }
  writeMetaData(JSON.stringify(metadataList, null, 2));
  sortedMetadata();
};

const rarityBreakdown = () => {
  let rawdata = fs.readFileSync(`${basePath}/build/json/_metadata.json`);
  let data = JSON.parse(rawdata);
  let editionSize = data.length;

  let allLayers = [];
  let layerNames = [];

  // Get layers
  data.forEach((item) => {
    let attributes = item.attributes;
    if (attributes) {
      attributes.forEach((attribute) => {
        let traitType = attribute.trait_type;
        if(!allLayers.includes(traitType)) {
          let newLayer = [{
            trait: traitType,
            count: 0,
            occurrence: `%`,
          }]
          allLayers[traitType] = newLayer;
          if(!layerNames.includes(traitType)) {
            layerNames.push(traitType);
          }
        }
      });
    }
  });

  // Count each trait in each layer
  data.forEach((item) => {
    let attributes = item.attributes;
    if (attributes) {
      attributes.forEach((attribute) => {
        let traitType = attribute.trait_type;
        let value = attribute.value;
        if(allLayers[traitType][0].trait == traitType) {
          allLayers[traitType][0].trait = value;
          allLayers[traitType][0].count = 1;
          allLayers[traitType][0].occurrence = `${((1/editionSize) * 100).toFixed(2)}%`;
        } else {
          let layerExists = false;
          for (let i = 0; i < allLayers[traitType].length; i++) {
            if(allLayers[traitType][i].trait == value) {
              allLayers[traitType][i].count++;
              allLayers[traitType][i].occurrence = `${((allLayers[traitType][i].count/editionSize) * 100).toFixed(2)}%`;
              layerExists = true;
              break;
            }
          }
          if(!layerExists) {
            let newTrait = {
              trait: value,
              count: 1,
              occurrence: `${((1/editionSize) * 100).toFixed(2)}%`,
            }
            allLayers[traitType].push(newTrait);
          }
        }
      }); 
    }
  });

  // Prep export to review data outside of terminal
  let layerExport = [];

  for (let i = 0; i < layerNames.length; i++) {
    let layer = layerNames[i];
    layerExport.push(layer);
    layerExport.push(allLayers[layer]);
  }

  console.log(layerExport);

}

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${hours} hours, ${minutes} minutes, ${seconds} seconds`;
};

const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const createPNG = async () => {
  let rawdata = fs.readFileSync(`${basePath}/build/json/_imgData.json`);
  let data = JSON.parse(rawdata);
  let editionSize = data.length;

  debugLogs ? console.log("Clearing canvas") : null;
  ctx.clearRect(0, 0, format.width, format.height);

  if (background.generate) {
    drawBackground();
  }

  // const startTime = process.hrtime();
  // let singleImageTimeMs = 0;

  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(editionSize, 0);

  let i = 0;
  for (const item of data) {
    i++;
    debugLogs ? console.log("Clearing canvas") : null;
    ctx.clearRect(0, 0, format.width, format.height);

    if (background.generate) {
      drawBackground();
    }

    const sortedAttributes = item.attributes.sort((a, b) => a.imgData.zindex - b.imgData.zindex); 

    for (const attr of sortedAttributes) {
      if (attr.imgData) {
        ctx.globalAlpha = attr.imgData.opacity;
        ctx.globalCompositeOperation = attr.imgData.blend;

        const img = await loadImage(attr.imgData.path);

        ctx.drawImage(img, 0, 0, format.width, format.height);
      }
    }

    if (i == 1) {
      if (network == NETWORK.sei) {
        saveImage(-1);
      }
    }
    
    saveImage(item.edition);
    // console.log(`Generated photo for edition ${item.edition}`);

    // const elapsedTime = process.hrtime(startTime);
    // const elapsedMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1e6;

    // // Calculate time for one image
    // if (i === 1) {
    //   singleImageTimeMs = elapsedMs;
    //   const totalTimeMs = singleImageTimeMs * editionSize;
    //   const remainingTimeMs = totalTimeMs - singleImageTimeMs;

    //   const remainingTimeSeconds = remainingTimeMs / 1000;
    //   console.log()
    //   console.log(`Estimated time for remaining ${editionSize - 1} images: ${formatTime(remainingTimeSeconds)}`);
      
    //   // Wait for 5 seconds before continuing
    //   await delay(5000);
    // }
    progressBar.increment();
  }
  progressBar.stop();
};

module.exports = { startCreating, buildSetup, getElements, rarityBreakdown, createPNG };