import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {priceDefaults,priceCategories,itemCategory,pricePolicy,applyPricePreferences,normalizePriceState,setItemPrice,lockItemPrices,importItemPrices,hasPriceImports,validatePricePreferences} from '../src/item-prices.js';
import {createPriceSnapshot} from '../src/price-protocol.js';
import {legacyPriceState} from './fixtures/legacy-price-state.mjs';
const at=Date.now()-1000;
const quote=(ask,bid)=>({ask:{value:ask,capturedAt:at},bid:{value:bid,capturedAt:at}});
const preferences=(state,change)=>{const next=structuredClone(state.preferences);change(next);return next;};
const apply=(state,change)=>applyPricePreferences(state,preferences(state,change),at+1);
function cached(){
 let state=priceDefaults();state.quotes={1:quote(90,40),2:quote(80,null),110:quote(100,60),293:quote(200,120),1001:quote(300,130),10110:quote(400,180)};
 return importItemPrices(state,{version:1,quotes:state.quotes,invalid:0}).state;
}

test('primary pricing categories come from the game market with gems only under resources',()=>{
 assert.deepEqual(priceCategories,game.marketCategories.filter(category=>category.key!=='gems'));
 assert.deepEqual(priceCategories.map(c=>c.key),['resources','consumables','equipment','tools','valuables']);
 assert.equal(itemCategory(293),'resources');assert.equal(itemCategory(328),'tools');
 for(const family of game.marketFamilies)assert.equal(priceCategories.filter(category=>category.families.includes(family.key)).length,1,family.key);
 for(const id of [1,1001,110,10110])assert.equal(itemCategory(id),itemCategory(game.baseItemId(id)));
 assert.throws(()=>validatePricePreferences(preferences(priceDefaults(),p=>p.categories.all=null)),/invalidPricePreferences/);
 assert.throws(()=>validatePricePreferences(preferences(priceDefaults(),p=>p.categories.ore='ask')),/invalidPricePreferences/);
});

test('All changes update inherited prices, preserve overrides and locked zero/blank values and old snapshots',()=>{
 let state=cached();state=lockItemPrices(setItemPrice(setItemPrice(state,1,0),2,null),[1,2],true).state;
 state=apply(state,p=>p.categories.equipment='vendor');
 const snapshot=createPriceSnapshot(state),previous=structuredClone(state);
 const next=apply(state,p=>p.categories.all='bid');
 assert.equal(next.prices[1].price,0);assert.equal(next.prices[2].price,null);
 assert.equal(next.prices[293].price,120);assert.equal(next.prices[1001].price,130);
 assert.equal(next.prices[110].price,game.vendorPrice(110));assert.equal(next.prices[10110].price,game.vendorPrice(10110));
 assert.equal(snapshot.getItem(293).price,200);assert.equal(createPriceSnapshot(next).getItem(293).price,120);
 assert.deepEqual(state,previous);assert.equal(next.quotes,state.quotes);
});

test('category overrides and restoring inheritance immediately update exact variants and provenance',()=>{
 let state=cached();state=apply(state,p=>p.categories.resources='bid');
 assert.equal(state.prices[1].price,40);assert.equal(state.prices[1001].price,130);assert.equal(state.prices[293].price,120);
 assert.equal(state.prices[110].price,100);
 state=apply(state,p=>p.categories.resources=null);
 assert.equal(state.prices[1].price,90);assert.equal(state.prices[293].price,200);assert.equal(state.prices[1].source,'ask');
 state=apply(state,p=>p.categories.equipment='bid');assert.equal(state.prices[10110].price,180);
});

test('switching source removes missing, unread and invalid unlocked values, never inventing zero or a fallback',()=>{
 let state=cached();state=setItemPrice(state,3,42);state.quotes[1001].bid={invalid:true,capturedAt:at};
 const next=apply(state,p=>p.categories.resources='bid');
 for(const id of [2,3,1001])assert.equal(createPriceSnapshot(next).getItem(id).price,null,String(id));
 assert.equal(next.prices[1].price,40);assert.equal(next.prices[293].price,120);
 const floored=apply(next,p=>p.vendorFallback.resources=true);
 assert.equal(floored.prices[2].price,game.vendorPrice(2));
 assert.equal(createPriceSnapshot(floored).getItem(3).price,null);assert.equal(createPriceSnapshot(floored).getItem(1001).price,null);
});

test('vendor floor inherits as a pair and category overrides use their own saved floor',()=>{
 let state=cached();state.quotes[3]=quote(1,1);
 state=apply(state,p=>p.vendorFallback.all=true);assert.equal(state.prices[3].price,game.vendorPrice(3));
 state=apply(state,p=>p.categories.resources='ask');assert.equal(state.prices[3].price,1);
 state=apply(state,p=>p.vendorFallback.resources=true);assert.equal(state.prices[3].price,game.vendorPrice(3));
 state=apply(state,p=>p.categories.resources=null);
 assert.deepEqual(pricePolicy(state.preferences,'resources'),{mode:'ask',fallback:true});
 assert.equal(state.preferences.vendorFallback.resources,true);
});

test('Skip retains values, inherited Skip disables requests while a category override enables them',()=>{
 const state=cached(),skipped=apply(state,p=>p.categories.all='off');
 assert.deepEqual(skipped.prices,state.prices);assert.equal(hasPriceImports(skipped.preferences),false);
 const enabled=apply(skipped,p=>p.categories.equipment='bid');
 assert.equal(enabled.prices[110].price,60);assert.equal(enabled.prices[1].price,90);assert.equal(hasPriceImports(enabled.preferences),true);
 const restored=apply(enabled,p=>p.categories.equipment=null);assert.equal(restored.prices[110].price,60);
});

test('legacy conflicting families retain prices and quotes and require an explicit choice before updates',()=>{
 for(const version of [2,3,4]){
  const old=setItemPrice(legacyPriceState(version),1,77);old.preferences.categories.ore='bid';old.quotes={1:quote(90,40)};
  const next=normalizePriceState(old);
  assert.deepEqual(next.preferences.reviewCategories,['resources']);assert.equal(next.prices[1].price,77);
  assert.equal(pricePolicy(next.preferences,'resources').mode,'off');
  const imported=importItemPrices(next,{version:1,quotes:{1:quote(90,40)},invalid:0}).state;
  assert.equal(imported.prices[1].price,77);
  const confirmed=apply(imported,p=>{p.reviewCategories=[];p.categories.resources=null;});
  assert.equal(confirmed.prices[1].price,90);assert.deepEqual(normalizePriceState(confirmed),confirmed);
 }
 const old=legacyPriceState(4);old.preferences.vendorFallback.ore=true;
 assert.deepEqual(normalizePriceState(old).preferences.reviewCategories,['resources']);
});

test('automatic checkbox is independent and resetting preferences revalues from cache, preserving locks',()=>{
 const state=cached(),disabled=apply(state,p=>p.autoImport=false);
 assert.equal(disabled.prices,state.prices);assert.equal(disabled.quotes,state.quotes);
 let changed=apply(disabled,p=>p.categories.all='bid');changed=lockItemPrices(setItemPrice(changed,1,0),[1],true).state;
 const reset=applyPricePreferences(changed,priceDefaults().preferences);
 assert.equal(reset.prices[1].price,0);assert.equal(reset.prices[293].price,200);assert.equal(reset.preferences.autoImport,true);
});
