const basePath = process.cwd();
const { NETWORK } = require(`${basePath}/constants/network.js`);
const fs = require("fs");

const {
  collectionName,
  symbol,
  baseUri,
  network,
  solanaMetadata,
} = require(`${basePath}/src/config.js`);

// read json data
let rawdata = fs.readFileSync(`${basePath}/build/json/_metadata.json`);
let data = JSON.parse(rawdata);

data.forEach((item) => {
  if (network == NETWORK.sol) {
    item.symbol = symbol;
    item.creators = solanaMetadata.creators;
    item.collection = solanaMetadata.collection;
  } else if (network == NETWORK.sei) {
    item.symbol = symbol;
    item.collection = collectionName;
  } else {
    item.image = `${baseUri}/${item.edition}.png`;
  }
  fs.writeFileSync(
    `${basePath}/build/json/${item.edition}.json`,
    JSON.stringify(item, null, 2)
  );
  fs.writeFileSync(
    `${basePath}/build/json-drop/${item.edition}`,
    JSON.stringify(item, null, 2)
  );
});

fs.writeFileSync(
  `${basePath}/build/json/_metadata.json`,
  JSON.stringify(data, null, 2)
);

if (network == NETWORK.sol) {
  console.log(`Updated symbol to ${symbol}`);
  console.log(
    `Updated creators to ===> ${JSON.stringify(
      solanaMetadata.creators
    )}`
  );
  console.log(`Updated collection to ===> ${JSON.stringify(
    solanaMetadata.collection
    )}`
  );
} else if (network == NETWORK.sei) {
  console.log(`Updated symbol to ${symbol}`);
  console.log(`Updated collection to ${collectionName}`);
} else {
  console.log(`Updated baseUri for images to ===> ${baseUri}`);
}
