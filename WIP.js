/* TODO

Order of operations for incpmatible utility:

Loop through ALL layers and traits, and create an object per trait, containing an array of all later layer's traits. ie:

[
  LAYER1: {
    trait1: [
      LAYER2: [
        trait1, trait2, trait3
      ]
      LAYER3: [
        trait1, trait2, trait3
      ]
    ]
    trait2: [
      LAYER2: [
        trait1, trait2, trait3
      ]
      LAYER3: [
        trait1, trait2, trait3
      ]
    ]
  }
  LAYER2: {
    trait1: [
      LAYER3: [
        trait1, trait2, trait3
      ]
    ]
    trait2: [
      LAYER3: [
        trait1, trait2, trait3
      ]
    ]
    trait3: [
      LAYER3: [
        trait1, trait2, trait3
      ]
    ]
  }
]

^^^^^^^^^ done. ***IDK, that doesn't seem to flow, actually, going to try:

// {
//   trait1(from layer1): {
//     trait1(from layer2): {
//       trait1(from layer 3): {
//         trait1(from layer 4),
//         trait2(from layer 4),
//         trait3(from layer 4)
//       },
//       trait2(from layer 3): {
//         trait1(from layer 4),
//         trait2(from layer 4),
//         trait3(from layer 4)
//       },
//       trait3(from layer 3): {
//         trait1(from layer 4),
//         trait2(from layer 4),
//         trait3(from layer 4)
//       }
//     }
//   }
//   trait2(from layer1): {
//     trait1(from layer2): {
//       trait1(from layer 3): {
//         trait1(from layer 4),
//         trait2(from layer 4),
//         trait3(from layer 4)
//       },
//       trait2(from layer 3): {
//         trait1(from layer 4),
//         trait2(from layer 4),
//         trait3(from layer 4)
//       },
//       trait3(from layer 3): {
//         trait1(from layer 4),
//         trait2(from layer 4),
//         trait3(from layer 4)
//       }
//     }
//   }
// }

Prompt user in terminal for first layer where incompatibility can occur (must be first layer called in layersOrder)

Prompt user in terminal for second layer where incompatibility can occur (must be AFTER first layer is called in layersOrder)

Prompt user if they already know what's incompatible. If they do, either need to display the compatible traits array, 
  then ask for input on which ones to remove, or simply direct them to the file to delete incompatible items manually. 
    -First option is nice, though it would require prompting user for which of the first trait you need to access, then 
    displaying that array, then prompting user again on which one to remove. Partial string?
    -Second option is definitely easier on me, and user would have the opportunity to simply step through everything
    if they didn't want to mess something up in there. 

Using canvas, cycle through all possibilities, displaying each in window, and prompting user if they're compatible

If yes, do nothing, if no, remove second layer's trait from first layers compatible traits array. 

Draw from this during generation. This should have the same effect as the incompatible system from nftchef, but without the
  drawback of running into more failures and with the added benefit of not having to dip into nested folder structures. 

createDna should reference compatibility json instead of looking directly in the folders


============================================================================
High priority, full refactor of code. Should resolve all of these items:
============================================================================
- Build incompatible layers system, or something comparable. 
--- This should be resolved by moving ALL generation to the exactWeight system namedWeight should simply calculate what the exactWeights should be, 
  and use those weights. This will also have the added benefit of all rarity being calculate up front, so you can review before running generation to fix any conflicts. 
- Fix named weight system. Currently needs a spread of rarities for some reason. 
- Also need to have no chance of a zero generation. Need to combine the named and exact weight systems, and
  have the traits generate exactly the number the named weight system decides. Probably throw some RNG into those 
  numbers so generating a collection twice won't have the same stuff. 
- Still want an option to generate an exact number of a trait when not using exact weights. Maybe a 
different rarityDelimiter? Like if you define a new variable as $, then when #weight, it generates normally,
but when you have $weight, it generated that number exactly?
- Should calculate all metadata first, validate rarities/generation will work upfront, then create photos. 
---
- Account for variants that may not have all colors. ie: 5 colors, but trait only has 3 colors.
  Make it an option. "Do you want to skip variants that don't exist or pick again?" - "Pick again" should be default. 
- Account for traits across multiple layers with the same name in exact weight system. Unique name was expected, 
but traits like 'None' will have their weights counted across multiple layers. Either exclude duplicate trait
names, or require a delimeter like & and use 'attributeCleanName'.
- Add option to exclude layer from metadata
- Option to regenerate collection with existing metadata. 

============================================================================
Low priority stuff, as time permits:
============================================================================
- Util to regeberate specific tokens. This should still be resolved before generation, but the option should exist for niche cases. 
- Util to 'bring to front'. This will enable people to move X number of tokens to the first # in the
collection so they can team Mint or whatever without resorting to minting with tokenId.
- Adjust scaleMints system to use *actual* # of that layerconfig, rather than cumulative. ie: if I want [10,10,10] 
I should be able to set growEditionSizeTo to [10,10,10] not [10,20,30]. Maybe even have option to set them to %?
-1of1 - similar to ultraRare feature, but allow to happen during generation with option to have all normal metadata traits
set to 1of1 name or for just a single '1of1' trait. Create separate util to create new folder structure for them?

*/

/* DONE
-work in resumeNum functionality
-work in toCreateNow functionality
-rework weight system to simply mark the weight as a rarity name (common, rare, etc.) and have rarity automatic
-work in misc utils
- Continue to build on resumeNum and enable a resumted generation? Maybe pull dna from metadata?
-option to not display none in metadata -- Solution: use removeAttribute
-rework weight system to allow exact counts to be used as weights. 
-work in variation functionality
-work in rarity calculations
-option to include rarity in metadata
- option to add numerical trait/attribute. Like a statblock
- Update all packages, and add dependancy section to readme. 
*/