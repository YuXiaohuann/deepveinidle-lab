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
