'use strict';

const path = require('path');
const isLocal = typeof process.pkg === 'undefined';
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require('fs');

let removeValue = [ "None", "Test" ] //Enter values you want to remove here. (ie: "None")
let removeTraitType = [ "Head" ] //Enter a Traits you want to remove here. (ie: "Head")

// Read json data
let rawData = fs.readFileSync(`${basePath}/build/json/_metadata.json`);
let rawImgData = fs.readFileSync(`${basePath}/build/json/_metadata.json`);
let data = JSON.parse(rawData);
let imgData = JSON.parse(rawImgData);

// Create new directory if it doesn't already exist
const dir = `${basePath}/build_new/json`;
if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir, {
		recursive: true
	});
}

data.forEach((item) => {
  removeValue.forEach((traitValue) => {
    let newValue = item.attributes.filter(obj=> obj.value !== traitValue);
    item.attributes = newValue;
  })
  removeTraitType.forEach((traitType) => {
    let newValue = item.attributes.filter(obj=> obj.trait_type !== traitType);
    item.attributes = newValue;
  })
  fs.writeFileSync(`${basePath}/build_new/json/${item.edition}.json`, JSON.stringify(item, null, 2));
});

imgData.forEach((item) => {
  removeValue.forEach((traitValue) => {
    let newValue = item.attributes.filter(obj=> obj.value !== traitValue);
    item.attributes = newValue;
  })
  removeTraitType.forEach((traitType) => {
    let newValue = item.attributes.filter(obj=> obj.trait_type !== traitType);
    item.attributes = newValue;
  })
});

fs.writeFileSync(`${basePath}/build_new/json/_metadata.json`, JSON.stringify(data, null, 2));
fs.writeFileSync(`${basePath}/build_new/json/_metadata.json`, JSON.stringify(imgData, null, 2));

console.log(`Removed all traits with ${removeValue} value(s) and ${removeTraitType} trait_type(s)`);