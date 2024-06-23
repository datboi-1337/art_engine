'use strict';

const path = require('path');
const isLocal = typeof process.pkg === 'undefined';
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require('fs-extra');
const { NETWORK } = require(`${basePath}/constants/network.js`);
const { network } = require(`${basePath}/src/config.js`);

let valueBefore = [ "FishHead", "Purple" ] //Enter old values here
let valueAfter = [ "StandardHead", "Lavender" ] //Enter new values here
let traitTypeBefore = [ "test", "Color" ] //Enter old trait_types here
let traitTypeAfter = [ "Hat", "Skin" ] //Enter new trait_trypes here

// Keep backup directory clean by deleting oldest backup if more than 10 exist
let backupDir = `${basePath}/backup`;
let backupFolders = fs.readdirSync(backupDir);

if (backupFolders.length > 10) {
  let oldestFolder = backupFolders.sort((a, b) => a.localeCompare(b))[0];
  fs.removeSync(`${backupDir}/${oldestFolder}`);
}

// Backup existing metadata
const dateTime = new Date().toISOString().replace(/[-:.]/g, '_');
const sourceDir = `${basePath}/build/json`;
const destinationDir = `${basePath}/backup/${dateTime}`;

fs.mkdirSync(destinationDir, { recursive: true });
fs.copy(sourceDir, destinationDir);

// Read json data
let rawdata = fs.readFileSync(`${basePath}/build/json/_metadata.json`);
let data = JSON.parse(rawdata);

if (valueBefore.length !== valueAfter.length) {
  throw new Error(`Arrays must have the same number of items! valueBefore count (${valueBefore.length}) must match valueAfter count (${valueAfter.length})`)
}

if (traitTypeBefore.length !== traitTypeAfter.length) {
  throw new Error(`Arrays must have the same number of items! traitTypeBefore count (${traitTypeBefore.length}) must match traitTypeAfter count (${traitTypeAfter.length})`)
}

let csvData = [];
let attributeTraitTypes = new Set();

// Capture all attributes for csv generation
data.forEach((item) => {
  item.attributes.forEach(attr => {
    attributeTraitTypes.add(attr.trait_type);
  });
});

data.forEach((item) => {
  let attributes = item.attributes;
  attributes.forEach((attribute) => {
    // Update values
    for (let i = 0; i < valueBefore.length; i++) {
      if (attribute.value.includes(valueBefore[i])) {
        let updatedValue = attribute.value.replace(valueBefore[i], valueAfter[i]);
        attribute.value = updatedValue;
      }
    }
    // Update trait_types
    for (let i = 0; i < traitTypeBefore.length; i++) {
      if (attribute.trait_type.includes(traitTypeBefore[i])) {
        let updatedTraitType = attribute.trait_type.replace(traitTypeBefore[i], traitTypeAfter[i]);
        attribute.trait_type = updatedTraitType;
      }
    }
  });

  fs.writeFileSync(`${basePath}/build/json/${item.edition}.json`, JSON.stringify(item, null, 2));
  // Add metadata to assets folder for Solana / SEI
  if (network == NETWORK.sol || network == NETWORK.sei) {
    fs.writeFileSync(`${basePath}/build/assets/${item.edition}.json`, JSON.stringify(data, null, 2))
  }
  // Save copy without file extension for opensea drop contracts
  fs.writeFileSync(`${basePath}/build/opensea-drop/json/${item.edition}`, JSON.stringify(data, null, 2));

  let csvRow = {};

  csvRow.tokenID = item.edition;

  csvRow.file_name = `${item.edition}.png`;

  attributeTraitTypes.forEach(traitType => {
    const attribute = item.attributes.find(attr => attr.trait_type === traitType);
    csvRow[`attributes[${traitType}]`] = attribute ? attribute.value : null;
  });

  Object.keys(item).forEach(key => {
    if (key !== 'edition' && key !== 'image' &&  key !== 'attributes' ) {
      csvRow[key] = item[key];
    }
  });

  csvData.push(csvRow);
});

fs.writeFileSync(`${basePath}/build/json/_metadata.json`, JSON.stringify(data, null, 2));

let csvHeaders = Object.keys(csvData[0]).join(',') + '\n';
let csvRows = csvData.map(row => Object.values(row).join(',')).join('\n');
let csvContent = csvHeaders + csvRows;
fs.writeFileSync(`${basePath}/build/opensea-drop/_metadata.csv`, csvContent);

for (let i = 0; i < valueBefore.length; i++) {
  console.log(`Updated ${valueBefore[i]} to ${valueAfter[i]}`);
}
for (let i = 0; i < traitTypeBefore.length; i++) {
  console.log(`Updated ${traitTypeBefore[i]} to ${traitTypeAfter[i]}`);
}

console.log(`Updated metadata saved in ${basePath}/build/json`)