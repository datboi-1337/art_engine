'use strict';

const path = require('path');
const isLocal = typeof process.pkg === 'undefined';
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require('fs');

/*
* * * * Options for removal * * * *
* Change any to true that you want to remove
*/
let removeDna = true;
let removeEdition = false;
let removeDate = true;
let removeCompiler = false;

// Keep backup directory clean by deleting oldest backup if more than 10 exist
let backupDir = `${basePath}/backup`;
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}
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

// Remove selected data
data.forEach((item) => {
  var tempEdition=item.edition;
  if (removeDna) {
    delete item.dna;
  }  
  if (removeEdition) {
    delete item.edition;
  }
  if (removeDate) {
    delete item.date;
  }
  if (removeCompiler) {
    delete item.compiler;
  }
  fs.writeFileSync(`${basePath}/build/json/${tempEdition}.json`, JSON.stringify(item, null, 2));
});

fs.writeFileSync(`${basePath}/build/json/_metadata.json`, JSON.stringify(data, null, 2));

let removedString = '';
if (removeDna) {
  removedString += '| Dna |';
}
if (removeEdition) {
  removedString += '| Edition |';
}
if (removeDate) {
  removedString += '| Date |';
}
if (removeCompiler) {
  removedString += '| Compiler |';
}
console.log(`Removed ${removedString} from metadata`);