'use strict';

const path = require('path');
const isLocal = typeof process.pkg === 'undefined';
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require('fs');

// Create new directory if it doesn't already exist
const dir = `${basePath}/build/opensea-drop`;
if (!fs.existsSync(dir)) {fs.mkdirSync(dir, {recursive: true});}
const jsonDir = `${basePath}/build/opensea-drop/json`;
if (!fs.existsSync(jsonDir)) {fs.mkdirSync(jsonDir, {recursive: true});}

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

console.log(`Created CSV for Opensea studio upload in build/opensea-drop`);