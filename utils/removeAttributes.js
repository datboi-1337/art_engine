'use strict';

const path = require('path');
const isLocal = typeof process.pkg === 'undefined';
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require('fs-extra');
const { NETWORK } = require(`${basePath}/constants/network.js`);
const { network } = require(`${basePath}/src/config.js`);

let removeValue = [ "None", "Red" ] //Enter values you want to remove here. (ie: "None")
let removeTraitType = [ "Head" ] //Enter a Traits you want to remove here. (ie: "Head")

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
let rawData = fs.readFileSync(`${basePath}/build/json/_metadata.json`);
let data = JSON.parse(rawData);

let csvData = [];
let attributeTraitTypes = new Set();

// Capture all attributes for csv generation
data.forEach((item) => {
  item.attributes.forEach(attr => {
    attributeTraitTypes.add(attr.trait_type);
  });
});

data.forEach((item) => {
  removeValue.forEach((traitValue) => {
    let newValue = item.attributes.filter(obj=> obj.value !== traitValue);
    item.attributes = newValue;
  })
  removeTraitType.forEach((traitType) => {
    let newValue = item.attributes.filter(obj=> obj.trait_type !== traitType);
    item.attributes = newValue;
  })
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

console.log(`Removed all traits with ${removeValue} value(s) and ${removeTraitType} trait_type(s)`);