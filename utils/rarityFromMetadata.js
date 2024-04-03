'use strict';

const path = require('path');
const isLocal = typeof process.pkg === 'undefined';
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require('fs');

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
* Rarity distribution can be adjusted
* It's reccomended to keep range [0 - 10,000]
* Because weight is up to 10,000, percentages can determined up to 
* two decimal places. ie: 10.15% would be 1015
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
const rarity_config = {
  Mythic: { ranks: [0, 100] }, //, fileName: 'Mythic.png' },
  Legendary: { ranks: [100, 600] }, //, fileName: 'Legendary.png' },
  Epic: { ranks: [600, 1500] }, //, fileName: 'Epic.png' },
  Rare: { ranks: [1500, 3100] }, //, fileName: 'Rare.png' },
  Uncommon: { ranks: [3100, 5600] }, //, fileName: 'Uncommon.png' },
  Common: { ranks: [5600, 10000] }, //, fileName: 'Common.png' },
};

/* **********************
******** Options ********
********************** */
const scoreAttribute = false; // Add score to attributes
const scoreElement = false; // Add score as new element

const rankAttribute = false; // Add rank to attributes
const rankElement = true; // Add rank as new element

const rarityAttribute = true; // Add rarity to attributes
const rarityElement = false; // Add rarity as new element

const includeTraitPercentages = false;

// Read json data
let rawdata = fs.readFileSync(`${basePath}/build/json/_metadata.json`);
let data = JSON.parse(rawdata);
let editionSize = data.length;

// Create new directories if it doesn't already exist
const dir = `${basePath}/rarity/json`;
if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir, {
		recursive: true
	});
}
const newDir = `${basePath}/build_new/json`;
if (!fs.existsSync(newDir)) {
	fs.mkdirSync(newDir, {
		recursive: true
	});
}
const newDirDrop = `${basePath}/build_new/json-drop`;
if (!fs.existsSync(newDirDrop)) {
	fs.mkdirSync(newDirDrop, {
		recursive: true
	});
}

// Helper function to aid Rarity assignment later
function scale(value) {
  let inMin = 1;
  let inMax = editionSize;
  let outMin = rarity_config['Mythic']['ranks'][0]+1;
  let outMax = rarity_config['Common']['ranks'][1];
  const result = (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;

  if (result < outMin) {
    return outMin;
  } else if (result > outMax) {
    return outMax;
  }

  return result;
}

let layers = [];
let layerNames = [];

// Get layers
data.forEach((item) => {
  let attributes = item.attributes;
  if (attributes) {
    attributes.forEach((attribute) => {
      let traitType = attribute.trait_type;
      if(!layers.includes(traitType)) {
        let newLayer = [{
          trait: traitType,
          count: 0,
          occurrence: `%`,
        }]
        layers[traitType] = newLayer;
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
      if(layers[traitType][0].trait == traitType) {
        layers[traitType][0].trait = value;
        layers[traitType][0].count = 1;
        layers[traitType][0].occurrence = `${((1/editionSize) * 100).toFixed(2)}%`;
      } else {
        let layerExists = false;
        for (let i = 0; i < layers[traitType].length; i++) {
          if(layers[traitType][i].trait == value) {
            layers[traitType][i].count++;
            layers[traitType][i].occurrence = `${((layers[traitType][i].count/editionSize) * 100).toFixed(2)}%`;
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
          layers[traitType].push(newTrait);
        }
      }
    }); 
  }
});

// Append trait values with their occurrence percentage if options is selected
if(includeTraitPercentages) {
  data.forEach((item) => {
    let attributes = item.attributes;
    let tempAttributes = [];
    if (attributes) {
      attributes.forEach((attribute) => {
        let displayType = attribute.display_type;
        // console.log(displayType);
        let traitType = attribute.trait_type;
        let value = attribute.value;
        if (traitType !== 'rarityScore' && traitType !== 'Rank' && traitType !== 'Rarity') {
          for (let i = 0; i < layers[traitType].length; i++) {
            if(layers[traitType][i].trait == value) {
              let updatedTrait = displayType == undefined ? 
              {
                trait_type: traitType,
                value: attribute.value += ` (${layers[traitType][i].occurrence})`,
              }
              :
              {
                display_type: displayType,
                trait_type: traitType,
                value: attribute.value,
              } 
              tempAttributes.push(updatedTrait);
            }    
          }
        }
      });
    }
    item.attributes = tempAttributes;
    fs.writeFileSync(`${basePath}/build_new/json/${item.edition}.json`, JSON.stringify(item, null, 2));
    fs.writeFileSync(`${basePath}/build_new/json-drop/${item.edition}`, JSON.stringify(item, null, 2));
  });
}

// Calculate score for each item based on trait counts 
let scores = []; 
data.forEach((item) => {
  let rarityScore = 0
  let attributes = item.attributes;
  if (attributes) {
    attributes.forEach((attribute) => {
      let traitType = attribute.trait_type;
      let value = '';
      if (isNaN(attribute.value)) {
        if (attribute.value.includes(' (')) {
          value = attribute.value.split(' (')[0];
        } else {
          value = attribute.value;
        }
      } else {
        value = attribute.value.toString();
      }
      // console.log(value);
      // let value = attribute.value.split(' (')[0];
      for (let i = 0; i < layers[traitType].length; i++) {
        if(layers[traitType][i].trait == value) {
          rarityScore -= layers[traitType][i].count;
        }    
      }
    });
  }
  let scoreTrait = {
    trait_type: "rarityScore",
    value: rarityScore,
  }
  item.attributes.push(scoreTrait);
  scores.push(rarityScore);
  fs.writeFileSync(`${basePath}/build_new/json/${item.edition}.json`, JSON.stringify(item, null, 2));
  fs.writeFileSync(`${basePath}/build_new/json-drop/${item.edition}`, JSON.stringify(item, null, 2));
});

fs.writeFileSync(`${basePath}/build_new/json/_metadata.json`, JSON.stringify(data, null, 2));

// Sort scores decending
scores.sort((a,b) => b-a);

const mod = (scores[(scores.length)-1] * -1) + 1;

for(let i = 0; i < scores.length; i++) {
  scores[i] += mod;
}

// Read new json data to pull scores
let newRawdata = fs.readFileSync(`${basePath}/build_new/json/_metadata.json`);
let newData = JSON.parse(newRawdata);

let rank = editionSize;

// Rank each item based on score
for(let i = rank; i = scores.length; i--) {
  let score = scores[i-1];
  newData.forEach((item) => {
    let attributes = item.attributes;
    if (attributes) {
      attributes.forEach((attribute) => {
        if(attribute.trait_type == 'rarityScore' && attribute.value == (score - mod)) {
          let rankTrait = {
            trait_type: "Rank",
            value: rank,
          }
          item.attributes.push(rankTrait);
          item.attributes.filter(obj => obj.trait_type == 'rarityScore')[0].value += mod;
          rank--;
          scores.pop();
          fs.writeFileSync(`${basePath}/build_new/json/${item.edition}.json`, JSON.stringify(item, null, 2));
          fs.writeFileSync(`${basePath}/build_new/json-drop/${item.edition}`, JSON.stringify(item, null, 2));
        }
      })
    }
  })
}

// Assign rarity to each item based on rank
newData.forEach((item) => {
  let attributes = item.attributes;
  if (attributes) {
    attributes.forEach((attribute) => {
      if(attribute.trait_type == 'Rank') {
        let value = attribute.value;
        let scaledRank = Math.ceil(scale(value));
        for (const key in rarity_config) {
          let rankLower = rarity_config[key]['ranks'][0];
          let rankUpper = rarity_config[key]['ranks'][1]
          if (scaledRank >= rankLower && scaledRank <= rankUpper) {
            let rarityTrait = {
              trait_type: "Rarity",
              value: key,
            }
            item.attributes.push(rarityTrait);
            fs.writeFileSync(`${basePath}/build_new/json/${item.edition}.json`, JSON.stringify(item, null, 2));
            fs.writeFileSync(`${basePath}/build_new/json-drop/${item.edition}`, JSON.stringify(item, null, 2));
          }
        }
      }
    });
  }
});

// Add new rarity/rank elements 
newData.forEach((item) => {
  let tempScore = item.attributes.filter(obj => obj.trait_type == 'rarityScore')[0].value;
  let tempRank = item.attributes.filter(obj => obj.trait_type == 'Rank')[0].value;
  let tempRarity = item.attributes.filter(obj => obj.trait_type == 'Rarity')[0].value;
  let rarityElements = {};
  let addScore = scoreElement ? rarityElements['Score'] = tempScore : void(0);
  let addRank = rankElement ? rarityElements['Rank'] = tempRank : void(0);
  let addRarity = rarityElement ? rarityElements['Rarity'] = tempRarity : void(0);
  
  let tempMetadata = {
    name: item.name,
    description: item.description,
    image: item.image,
    dna: item.dna,
    edition: item.edition,
    date: item.date,
    ...rarityElements,
    attributes: item.attributes,
    compiler: item.compiler,
  };

  for (var member in item) delete item[member];

  Object.assign(item, tempMetadata);
});

// Remove any unwanted traits from metadata
newData.forEach((item) => {
  if (!scoreAttribute) {
    let result = item.attributes.filter(obj => obj.trait_type !== 'rarityScore');
    item.attributes = result;
  }
  if (!rankAttribute) {
    let result = item.attributes.filter(obj => obj.trait_type !== 'Rank');
    item.attributes = result;
  }
  if (!rarityAttribute) {
    let result = item.attributes.filter(obj => obj.trait_type !== 'Rarity');
    item.attributes = result;
  }
  fs.writeFileSync(`${basePath}/build_new/json/${item.edition}.json`, JSON.stringify(item, null, 2));
  fs.writeFileSync(`${basePath}/build_new/json-drop/${item.edition}`, JSON.stringify(item, null, 2));
})

fs.writeFileSync(`${basePath}/build_new/json/_metadata.json`, JSON.stringify(newData, null, 2));

// Prep export to review data outside of terminal
let layerExport = [];

for (let i = 0; i < layerNames.length; i++) {
  let layer = layerNames[i];
  layerExport.push(layer);
  layerExport.push(layers[layer]);
}

console.log(layerExport);

fs.writeFileSync(`${basePath}/rarity/json/rarityBreakdown.json`, JSON.stringify(layerExport));

if (scoreAttribute) {
  console.log(`Added 'rarityScore' to metadata`);
}
if (rankAttribute) {
  console.log(`Added 'Rank' to metadata`);
}
if (rarityAttribute) {
  console.log(`Added 'Rarity' to metadata`);
}
if (includeTraitPercentages) {
  console.log(`Added occurrence % to each trait in metadata`);
}
if (scoreElement && scoreAttribute) {
  console.log(`Please note that both scoreElement and scoreAttribute are set to true, meaning the information is duplicated in the metadata and attributes.
    It's recommended to set one or the other to false.`)
}
if (scoreElement && rankAttribute) {
  console.log(`Please note that both rankElement and rankAttribute are set to true, meaning the information is duplicated in the metadata and attributes. 
    It's recommended to set one or the other to false.`)
}
if (scoreElement && rarityAttribute) {
  console.log(`Please note that both rarityElement and rarityAttribute are set to true, meaning the information is duplicated in the metadata and attributes. 
    It's recommended to set one or the other to false.`)
}
console.log(`This data can also be viewed in ${basePath}/rarity/json/rarityBreakdown.json`);