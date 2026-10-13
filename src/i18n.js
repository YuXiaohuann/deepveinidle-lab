import {game} from './model.js';
// Supplement names absent from upstream dictionaries; retain upstream translations elsewhere.
export const dictionary={...game.uiTranslations,...game.worldTranslations,...game.translations,...game.homeTranslations,
"Gatherer's draught":"采集者药剂","Hunter's brew":"猎手药剂","Warrior's tonic":"战士补剂",
"Upgrades":"升级",
"Pickaxe":"镐","Fishing rod":"鱼竿","Axe":"斧",
"Pan":"平底锅","Hammer":"锤","Knife":"刀","Mortar":"研钵","Needle":"针"};
export const translatedName=(text,language)=>language==='zh'?(dictionary[text]??text):text;
// Rarity is displayed separately; translate the original base item name.
export const translatedItemName=(id,language)=>translatedName(game.item(game.baseItemId(id)).name,language);
