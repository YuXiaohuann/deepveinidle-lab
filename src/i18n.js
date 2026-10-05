import {game} from './model.js';
// Supplement names absent from upstream dictionaries; retain upstream translations elsewhere.
export const dictionary={...game.uiTranslations,...game.worldTranslations,...game.translations,...game.homeTranslations,
"Gatherer's draught":"采集者药剂","Hunter's brew":"猎手药剂","Warrior's tonic":"战士补剂"};
export const translatedName=(text,language)=>language==='zh'?(dictionary[text]??text):text;
