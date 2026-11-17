import test from 'node:test';
import assert from 'node:assert/strict';
import {craftingDefaults,craftingStorageKey,normalizeCrafting} from '../src/crafting-model.js';
import {loadCraftingConfig,saveCraftingConfig,resetCraftingConfig} from '../src/crafting-store.js';
const memory=entries=>{const data=new Map(entries);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('legacy build migrates independently of invalid orders and inventory, retaining settings and unrelated storage',()=>{
 const build={...craftingDefaults(),skill:'smithing',simulationHours:6,weeklyXp:35.25,plans:{bad:NaN},owned:{bad:-1}};
 const storage=memory([['dvi-crafting-orders-v1',JSON.stringify({version:1,build,orders:'invalid',inventory:'invalid'})],['dvi-item-prices-v1','keep'],['dvi-character-auto-import-craft-v1','keep']]);
 const result=loadCraftingConfig(storage);assert.equal(result.skill,'smithing');assert.equal(result.simulationHours,6);assert.equal(result.weeklyXp,35.25);
 assert.equal(result.plans,undefined);assert.equal(result.owned,undefined);assert.equal(result.tiers,undefined);assert.equal(result.upgradeMigration,undefined);
 assert.deepEqual(JSON.parse(storage.getItem(craftingStorageKey)),{version:1,build:result});assert.equal(storage.getItem('dvi-crafting-orders-v1'),null);assert.equal(storage.getItem('dvi-item-prices-v1'),'keep');assert.equal(storage.getItem('dvi-character-auto-import-craft-v1'),'keep');
 assert.deepEqual(loadCraftingConfig(storage),result);
});
test('config store takes precedence and old pre-order configuration is supported',()=>{
 const storage=memory([['dvi-crafting-v1',JSON.stringify({...craftingDefaults(),simulationHours:1.5})]]);assert.equal(loadCraftingConfig(storage).simulationHours,2);
 storage.setItem('dvi-crafting-orders-v1','broken');assert.equal(loadCraftingConfig(storage).simulationHours,2);
});
test('corruption and storage errors fail explicitly without overwriting the source',()=>{
 for(const saved of ['broken','null','[]',JSON.stringify({version:1,build:null}),JSON.stringify({version:2,build:craftingDefaults()})]){
  const storage=memory([[craftingStorageKey,saved]]);assert.throws(()=>loadCraftingConfig(storage));assert.equal(storage.getItem(craftingStorageKey),saved);
 }
 const source=JSON.stringify({version:1,build:craftingDefaults()});const storage=memory([['dvi-crafting-orders-v1',source]]);storage.setItem=()=>{throw Error('quota');};assert.throws(()=>loadCraftingConfig(storage),error=>error.message==='quota'&&error.craftingState.simulationHours===24);assert.equal(storage.getItem('dvi-crafting-orders-v1'),source);
});
test('normalization ignores removed fields, resets clear all manufacturing saves only',()=>{
 const raw={...craftingDefaults(),plans:{'retired:0':Number.MAX_SAFE_INTEGER},owned:{bad:1},tiers:{bad:4}};assert.deepEqual(normalizeCrafting(raw),craftingDefaults());
 const storage=memory([['other','preserved'],['dvi-crafting-v1','legacy']]);saveCraftingConfig(storage,raw);resetCraftingConfig(storage);assert.deepEqual([...storage.data],[['other','preserved']]);
});
