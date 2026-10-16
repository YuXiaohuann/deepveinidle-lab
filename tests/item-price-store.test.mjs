import test from 'node:test';
import assert from 'node:assert/strict';
import {priceDefaults,setItemPrice} from '../src/item-prices.js';

let sequence=0;
async function withStore(storage,run){
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
 try{await run(await import(`../src/item-price-store.js?test=${++sequence}`));}
 finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage;}
}
test('price store round trip restores zero prices, locks and preferences',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const state=setItemPrice(priceDefaults(),1,0);state.prices[1].locked=true;state.preferences.categories.ore='bid';
 await withStore(storage,store=>store.updatePrices(state));
 await withStore(storage,store=>assert.deepEqual(store.priceState(),state));
});
test('invalid saved price data remains untouched until an explicit update',async()=>{
 let writes=0;
 await withStore({getItem:()=>'{"version":9}',setItem:()=>writes++},store=>{
  assert.deepEqual(store.priceState(),priceDefaults());assert.equal(store.priceSaveError(),'invalidPriceStorage');assert.equal(writes,0);
 });
});
test('failed save exposes an error while notifying consumers of the usable memory state',async()=>{
 await withStore({getItem:()=>null,setItem:()=>{throw Error('quota');}},store=>{
  let notifications=0;const unsubscribe=store.subscribePrices(()=>notifications++),state=setItemPrice(priceDefaults(),1,36);
  store.updatePrices(state);assert.equal(store.priceState(),state);assert.equal(store.priceSaveError(),'priceSaveFailed');assert.equal(notifications,1);
  unsubscribe();store.updatePrices(state);assert.equal(notifications,1);
 });
});
test('published v2 migrates prices, locks and preferences, discarding game quotes and their time baseline',async()=>{
 const state=setItemPrice(priceDefaults(),1,0);state.version=2;state.prices[1].locked=true;
 state.prices[2]={price:99,locked:false,source:'bid',updatedAt:Date.now(),quoteCapturedAt:Date.now()};state.quotes={2:{bid:{value:99,capturedAt:Date.now()}}};state.preferences.categories.ore='ask';
 const saved=JSON.stringify(state);let writes=0,latest;
 await withStore({getItem:()=>saved,setItem:(key,value)=>{writes++;latest=JSON.parse(value);}},store=>{
  const current=store.priceState();assert.equal(writes,0);assert.equal(store.priceSaveError(),null);assert.equal(current.version,3);assert.deepEqual(current.quotes,{});assert.equal(current.prices[1].price,0);assert.equal(current.prices[1].locked,true);assert.equal(current.prices[2].price,99);assert.equal(current.prices[2].source,'bid');assert.equal(current.prices[2].quoteCapturedAt,null);assert.equal(current.preferences.categories.ore,'ask');
  store.updatePrices(current);assert.equal(writes,1);assert.equal(latest.version,3);
 });
});
