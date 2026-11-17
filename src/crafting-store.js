import {craftingStorageKey,craftingDefaults,normalizeCrafting} from './crafting-model.js';
const legacyKeys=['dvi-crafting-orders-v1','dvi-crafting-v1'];
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function build(raw){
 if(!record(raw)||!record(raw.levels)||!record(raw.gear))throw Error('savedInvalid');
 return normalizeCrafting(raw);
}
export function saveCraftingConfig(storage,state){
 storage.setItem(craftingStorageKey,JSON.stringify({version:1,build:normalizeCrafting(state)}));
 for(const key of legacyKeys)storage.removeItem(key);
}
export function loadCraftingConfig(storage){
 const saved=storage.getItem(craftingStorageKey);
 if(saved!==null){const raw=JSON.parse(saved);if(raw?.version!==1)throw Error('savedInvalid');return build(raw.build);}
 for(const key of legacyKeys){
  const saved=storage.getItem(key);if(saved===null)continue;
  const raw=JSON.parse(saved);
  if(key===legacyKeys[0]&&raw?.version!==1)throw Error('savedInvalid');
  const state=build(key===legacyKeys[0]?raw.build:raw);
  try{saveCraftingConfig(storage,state);}catch(error){error.craftingState=state;throw error;}return state;
 }
 return craftingDefaults();
}
export function resetCraftingConfig(storage){
 storage.removeItem(craftingStorageKey);for(const key of legacyKeys)storage.removeItem(key);
}
