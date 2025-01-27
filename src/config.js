const basePath = process.cwd();
const { MODE } = require(`${basePath}/constants/blend_mode.js`);
const { NETWORK } = require(`${basePath}/constants/network.js`);

const collectionSize = 30;

/* 
* Set this to true if you want to use EXACT weights. 
* Note that your weights must add up to the total number
* you want of that trait in the particular layer configuration it's in.
*/
const exactWeight = false;

// Options: eth, sol, sei
// NOTE: using 'eth' will generate metadata compatible with most EVM chains
const network = NETWORK.eth;

// General metadata. collectionName and description can be unique to each layer configuration if desired
const collectionName = "Your Collection";
const symbol = "YC";
const description = "Remember to replace this description";
const baseUri = "ipfs://TESTING";

const solanaMetadata = {
  seller_fee_basis_points: 1000, // Define how much % you want from secondary market sales 1000 = 10%
  external_url: "https://linktr.ee/datboi1337",
  creators: [
    {
      address: "8DsAhDisG5eYjBwedSiakTKwrYCWpQ4tNDRuZyniMXaX",
      share: 100,
    },
  ],
  collection: {
    name: "Your Collection",
    family: "Your Collection Family",
  }
};

// It's suggested to keep shuffle enabled to avoid the same traits generating for spans of images
const shuffleLayerConfigurations = false;

// Populate with TRAITS you want to exclude from metadata. "None" is the default value, remove if you want "None" to appear in final metadata
const excludeFromMetadata = ["None"];

const layerConfigurations = [
  // {
  //   // NOTE!! growEditionSizeTo should be set to the number of images you want generate within each layer configuration
  //   growEditionSizeTo: 50, // << This will generate 50 images with this layersOrder
  //   namePrefix: collectionName,
  //   description: description,
  //   layersOrder: [
  //     { name: "Variant", options: { displayName: "Color" } }, 
  //     { name: "Arms" },
  //     { name: "Back" },
  //     { name: "Body", 
  //       options: {
  //         subTraits: [
  //           {
  //           blend: MODE.multiply,
  //           opacity: 0.5,
  //           zindex: 25,
  //           }
  //         ],
  //         conditionalOn: [ "Arms", "Back" ],
  //       } 
  //     },
  //     { name: "Eyes",
  //       options: {
  //         subTraits: [
  //           {
  //           name: "Shadow",
  //           blend: MODE.multiply,
  //           opacity: 0.5,
  //           zindex: 35,
  //           }
  //         ]
  //       } 
  //     },
  //     { name: "Head" },
  //     { name: "Legs" },
  //     { name: "Mouth" },
  //   ],
  // },
  // {
  //   growEditionSizeTo: 15, // This will generate 15 images with this layersOrder
  //   namePrefix: `Skeletal ${collectionName}`,
  //   description: 'Alternate Description for this set of tokens',
  //   layersOrder: [
  //     { name: "SkeletalArms", options: { exclude: true } },
  //     { name: "SkeletalBack" }, 
  //     { name: "SkeletalBody" }, 
  //     { name: "SkeletalLegs" }, 
  //     { name: "SkeletalAccessories", 
  //       options: {
  //         subTraits: [
  //           {
  //           zindex: 35,
  //           }
  //         ]
  //       } 
  //     }
  //   ],
  // },
  {
    growEditionSizeTo: collectionSize, // This will generate 15 images with this layersOrder
    namePrefix: collectionName,
    description: description,
    layersOrder: [
      { name: "Background"},
      { name: "Skin" }, 
      { name: "Outfit", options: {
        conditionalOn: [ "Skin" ],
      } }, 
      { name: "Face" }, 
      { name: "Hair" },
      { name: "Action", options: {
        conditionalOn: [ "Skin", "Outfit" ],
      } },
    ],
  },
];

const format = {
  width: 512,
  height: 512,
  dpi: 72,
  smoothing: false,
};

const gif = {
  generate: false,
  numberOfFrames: 60,
  repeat: 0,
  quality: 100,
  delay: 500,
};

const extraMetadata = {};

const extraAttributes = [];

const rarityDelimiter = "#";

const zindexDelimiter = "$";

const uniqueDnaTorrance = 10000;

const enableStats = false;
const statBlocks = [
  /* 
  * These are all examples with different display_types. 
  * Please refer to Opensea metadata standards for visual examples.
  */
  {
    minValue: 1,
    maxValue: 50,
    attribute:
    {
      trait_type: "Stamina", 
      value: 0
    },
  },
  {
    minValue: 1,
    maxValue: 50,
    attribute:
    {
      trait_type: "Stamina", 
      value: 0
    },
  },
  {
    minValue: 1,
    maxValue: 999,
    attribute:
    {
      display_type: "number", 
      trait_type: "Stamina", 
      value: 0
    },
  },
  {
    minValue: 1,
    maxValue: 100,
    attribute:
    {
      display_type: "boost_percentage", 
      trait_type: "Stamina Increase", 
      value: 0
    }, 
  },
  {
    minValue: 25,
    maxValue: 75,
    attribute:
    {
      display_type: "boost_number", 
      trait_type: "Stamina Boost", 
      value: 0
    }, 
  },
];

const debugLogs = false;

// Currently disabled
const text = {
  only: true,
  color: "#ffffff",
  size: 20,
  xGap: 40,
  yGap: 40,
  align: "left",
  baseline: "top",
  weight: "regular",
  family: "Courier",
  spacer: " => ",
};

const pixelFormat = {
  ratio: 2 / 128,
};

const background = {
  generate: false,
  brightness: "80%",
  static: false,
  default: "#000000",
};

const preview = {
  thumbPerRow: 5,
  thumbWidth: 50,
  imageRatio: format.height / format.width,
  imageName: "preview.png",
};

const preview_gif = {
  numberOfImages: 5,
  order: "ASC", // ASC, DESC, MIXED
  repeat: 0,
  quality: 100,
  delay: 500,
  imageName: "preview.gif",
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
* Rarity distribution can be adjusted. The main thing to keep in mind
* when editing is the rarities relationship to eachother. 
* Common vs Mythic is 100:1 in the default state, for example.
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
const rarity_config = {
  Mythic: 1,
  Legendary: 6,
  Epic: 15,
  Rare: 31,
  Uncommon: 56,
  Common: 100,
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
* Do not use this unless 100% necessary and you understand the risk
* Generating collection in stages leads to potential duplicates. 
* 99% of the time, regenerating is the appropriate option. 
* This is here for the 1%
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
const resumeNum = 0;
const importOldDna = false;

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
* NOTE: As the name implies, this will allow duplicates to be
* generated in the collection. Do not set this to true unless
* you specifically want duplicates in your collection.
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
const allowDuplicates = false;

const bypassZeroProtection = false;

module.exports = {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  zindexDelimiter,
  preview,
  shuffleLayerConfigurations,
  excludeFromMetadata,
  debugLogs,
  extraMetadata,
  pixelFormat,
  text,
  collectionName,
  symbol,
  network,
  solanaMetadata,
  gif,
  preview_gif,
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
};
