import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {priceDefaults,normalizePriceState,validItemId,setItemPrice,lockItemPrices,clearUnlockedPrices,importItemPrices,validateMarketSnapshot,mergeQuotes,valueItems,valueRewards} from '../src/item-prices.js';
import {normalizeManual} from '../src/manual-settings.js';
import {normalizeGathering,importGathering} from '../src/gathering-model.js';
import {enhancementDefaults,validateEnhancement,resolveEnhancementPrices,calculateEnhancement} from '../src/enhancement.js';
const at=Date.now()-1000;
const side=value=>({value,capturedAt:at});
const snapshot=quotes=>({version:1,quotes,invalid:0});
const policy=(state,categories,fallback=false)=>({...state,preferences:{categories:Object.fromEntries(Object.entries({...state.preferences.categories,...categories}).map(([key,mode])=>[key,fallback&&mode==='bid'?'bidVendor':mode]))}});

test('category defaults use vendor floors while saved category choices remain intact',()=>{
 const state=priceDefaults();assert.deepEqual(Object.entries(state.preferences.categories).filter(([,mode])=>mode==='off').map(([key])=>key),['weapons','armour','jewellery','tools','mounts']);assert.ok(Object.entries(state.preferences.categories).filter(([,mode])=>mode!=='off').every(([,mode])=>mode==='bidVendor'));
 assert.equal(state.preferences.vendorFallback,undefined);state.preferences.categories.ore='off';state.preferences.categories.materials='ask';state.preferences.categories.weapons='bidVendor';
 assert.deepEqual(normalizePriceState(state).preferences,state.preferences);
});
test('complete item IDs are independent and unsupported rarity/enhancement fail',()=>{
 let s=priceDefaults();for(const [id,value]of [[110,10],[4110,30],[50110,20]])s=setItemPrice(s,id,value);
 assert.equal(s.prices[110].price,10);assert.equal(s.prices[4110].price,30);assert.equal(s.prices[50110].price,20);
 assert.equal(validItemId(5110),false);assert.equal(validItemId(10001),false);assert.throws(()=>setItemPrice(s,5110,1),/invalidPrice/);
 assert.deepEqual(normalizePriceState(s),s);
});
test('blank, zero and invalid manual prices are distinct; edits retain locks',()=>{
 let s=lockItemPrices(priceDefaults(),[1],true).state;s=setItemPrice(s,1,0);assert.equal(s.prices[1].locked,true);assert.equal(s.prices[1].price,0);
 s=setItemPrice(s,1,null);assert.equal(s.prices[1].price,null);
 for(const value of [-1,Infinity,NaN,'12',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>setItemPrice(s,1,value),/invalidPrice/);
});
test('bulk locks are idempotent and never modify price provenance or timestamps',()=>{
 let s=setItemPrice(priceDefaults(),1,7,at);const before=s.prices[1];let result=lockItemPrices(s,[1,1,1001],true);
 assert.equal(result.changed,2);assert.deepEqual(result.state.prices[1],{...before,locked:true});assert.equal(result.state.prices[1001].price,null);
 assert.equal(lockItemPrices(result.state,[1,1001],true).changed,0);
 result=lockItemPrices(result.state,[1,1001],false);assert.equal(result.changed,2);assert.deepEqual(result.state.prices[1],before);
});
test('mixed categories choose ask or bid; locked values survive imports',()=>{
 let s=policy(priceDefaults(),{ore:'bid',weapons:'ask'});s=setItemPrice(s,1,99);s=lockItemPrices(s,[1001],true).state;
 const r=importItemPrices(s,snapshot({1:{ask:side(8),bid:side(4)},1001:{bid:side(5)},110:{ask:side(50),bid:side(20)},20:{ask:side(6)}}));
 assert.equal(r.state.prices[1].price,4);assert.equal(r.state.prices[110].price,50);assert.equal(r.state.prices[1001].price,null);assert.equal(r.state.prices[20],undefined);assert.equal(r.stats.locked,1);
});
test('vendor floor applies to absent and low bids but leaves uncaptured and ask prices intact',()=>{
 let s=policy(priceDefaults(),{ore:'bid',weapons:'ask'},true);s=setItemPrice(s,2,99);s=setItemPrice(s,3,77);s=setItemPrice(s,110,55);
 const r=importItemPrices(s,snapshot({1:{bid:side(null)},2:{ask:side(50)},3:{bid:side(1)},110:{ask:side(null)}}));
 assert.equal(r.state.prices[1].price,game.vendorPrice(1));assert.equal(r.state.prices[1].source,'vendor');assert.equal(r.state.prices[1].quoteCapturedAt,at);
 assert.equal(r.state.prices[2].price,99);assert.equal(r.state.prices[3].price,game.vendorPrice(3));assert.equal(r.state.prices[3].source,'vendor');assert.equal(r.state.prices[110].price,55);assert.equal(r.stats.vendor,2);
 s.preferences.categories.ore='bid';assert.equal(importItemPrices(s,snapshot({1:{bid:side(null)}})).state.prices[1],undefined);
});
test('untradable captured items cannot use fallback',()=>{
 const id=game.items.find(i=>{try{return game.marketFamily(game.baseItemId(i.id))&&!game.canSell(i.id);}catch{return false;}})?.id;
 assert.ok(id);const s=policy(priceDefaults(),{[game.marketFamily(game.baseItemId(id))]:'bid'},true),r=importItemPrices(s,snapshot({[id]:{bid:side(null)}}));
 assert.equal(r.state.prices[id],undefined);assert.ok(r.stats.unavailable>0);
});
test('missing and malformed observations do not zero, erase or silently reuse cache',()=>{
 let s=policy(setItemPrice(priceDefaults(),1,30),{ore:'bid'},true);s.quotes={1:{bid:side(50)}};
 let r=importItemPrices(s,snapshot({1:{ask:side(40)}}));assert.equal(r.state.prices[1].price,30);
 r=importItemPrices(s,snapshot({1:{bid:{invalid:true,capturedAt:at}}}));assert.equal(r.state.prices[1].price,30);assert.equal(r.stats.vendor,0);assert.ok(r.stats.invalid>0);
 assert.equal(validateMarketSnapshot(snapshot({9999999:{bid:side(1)}})).invalid,1);
 assert.throws(()=>importItemPrices(s,{version:9,quotes:{},invalid:0}),/invalidMarketData/);assert.equal(s.prices[1].price,30);
});
test('quotes and imported prices cannot move backwards, including fallback',()=>{
 let s=policy(priceDefaults(),{ore:'bid'},true);s=importItemPrices(s,snapshot({1:{bid:side(25)}})).state;
 const older={value:null,capturedAt:at-100};const r=importItemPrices(s,snapshot({1:{bid:older}}));assert.equal(r.state.prices[1].price,25);assert.equal(r.stats.stale,1);
 assert.equal(mergeQuotes(s.quotes,{1:{bid:older}})[1].bid.value,25);
});
test('valuation uses exact quantities and IDs, propagates missing prices and rejects overflow',()=>{
 const prices={1:{price:10},1001:{price:0}};
 assert.deepEqual(valueItems({1:2,1001:3},'custom',prices),{value:20,partial:20,missing:[]});
 assert.deepEqual(valueItems({1:2,1001:3,2:4},'custom',prices),{value:null,partial:20,missing:[2]});
 const result={coins:7,normalItems:{1:2},rareItems:{1001:3}};assert.equal(valueRewards(result,'custom',prices).totalIncome,27);assert.equal(valueRewards({...result,rareItems:{2:3}},'custom',prices).totalIncome,null);assert.equal(valueRewards(result,'quantity',prices),result);
 assert.throws(()=>valueItems({1:2},'custom',{1:{price:Number.MAX_SAFE_INTEGER}}),/priceOverflow/);
});
test('valuation modes default independently of old toggles',()=>{
 assert.equal(normalizeManual({vendorValues:true}).valuationMode,'quantity');assert.equal(normalizeManual({vendorValues:false}).valuationMode,'quantity');assert.equal(normalizeManual({valuationMode:'custom'}).vendorValues,true);
 assert.equal(normalizeGathering({valuationMode:'custom'}).valuationMode,'custom');assert.equal(normalizeGathering({vendorValues:true}).valuationMode,'quantity');
});
test('enhancement resolves explicit price modes and binds owned bases',()=>{
 const prices={208:{price:2},359:{price:3},110:{price:4},111:{price:9}};let s=enhancementDefaults();let resolved=resolveEnhancementPrices(s,prices);
 assert.deepEqual([resolved.shardPrice,resolved.scrollPrice,resolved.basePrice],[2,3,4]);assert.notEqual(calculateEnhancement(resolved).taxedGold,null);
 const missing={...s};delete missing.priceModes;assert.throws(()=>validateEnhancement(missing),/invalidPrice/);const unbound={...s};delete unbound.basePriceItem;assert.throws(()=>validateEnhancement(unbound),/invalidPrice/);
 s=validateEnhancement({...s,shardPrice:7,basePrice:8,priceModes:{shardPrice:'manual',scrollPrice:'global',basePrice:'manual'},basePriceItem:110});assert.equal(resolveEnhancementPrices(s,prices).basePrice,8);
 s=validateEnhancement({...s,itemId:111});assert.equal(s.priceModes.basePrice,'global');assert.equal(resolveEnhancementPrices(s,prices).basePrice,9);assert.equal(resolveEnhancementPrices(s,prices).shardPrice,7);
 s.priceModes.basePrice='owned';s.basePriceItem=111;assert.equal(resolveEnhancementPrices(s,prices).basePrice,0);s=validateEnhancement({...s,current:1});assert.equal(s.priceModes.basePrice,'global');assert.equal(resolveEnhancementPrices(s,prices).basePrice,null);
});

test('bid floor chooses the maximum and counts ties as vendor fallback',()=>{
 const vendor=game.vendorPrice(3);assert.ok(vendor>1);
 for(const [bid,expected,source]of [[vendor-1,vendor,'vendor'],[vendor,vendor,'vendor'],[vendor+1,vendor+1,'bid']]){
  const state=policy(priceDefaults(),{ore:'bid'},true),result=importItemPrices(state,snapshot({3:{bid:side(bid)}}));
  assert.equal(result.state.prices[3].price,expected);assert.equal(result.state.prices[3].source,source);assert.equal(result.state.prices[3].quoteCapturedAt,at);assert.equal(result.stats.vendor,source==='vendor'?1:0);
 }
 const disabled=policy(priceDefaults(),{ore:'bid'},false);assert.equal(importItemPrices(disabled,snapshot({3:{bid:side(vendor-1)}})).state.prices[3].price,vendor-1);
 const locked=lockItemPrices(setItemPrice(policy(priceDefaults(),{ore:'bid'},true),3,1),[3],true).state;
 const result=importItemPrices(locked,snapshot({3:{bid:side(vendor-1)}}));assert.equal(result.state.prices[3].price,1);assert.equal(result.stats.vendor,0);assert.equal(result.stats.locked,1);
});

test('old price formats are rejected and independent categories do not share floors',()=>{
 const old={...priceDefaults(),version:1};old.preferences.vendorFallback=true;assert.throws(()=>normalizePriceState(old),/invalidPriceStorage/);
 const s=policy(priceDefaults(),{ore:'bidVendor',weapons:'bid'});
 const r=importItemPrices(s,snapshot({3:{bid:side(1)},110:{bid:side(1)}}));assert.equal(r.state.prices[3].source,'vendor');assert.equal(r.state.prices[110].price,1);assert.equal(r.state.prices[110].source,'bid');
});

test('clearing removes all unlocked prices including zero and preserves locked records and quote settings',()=>{
 let state=setItemPrice(setItemPrice(setItemPrice(priceDefaults(),1,0),2,17),3,88);state=lockItemPrices(state,[3,1001],true).state;state.quotes={1:{bid:side(36)}};
 const before=structuredClone(state),r=clearUnlockedPrices(state);assert.equal(r.cleared,2);assert.deepEqual(Object.keys(r.state.prices),['3','1001']);assert.deepEqual(r.state.prices[3],before.prices[3]);assert.deepEqual(r.state.prices[1001],before.prices[1001]);assert.deepEqual(r.state.quotes,before.quotes);assert.deepEqual(r.state.preferences,before.preferences);assert.deepEqual(state,before);assert.equal(clearUnlockedPrices(r.state).cleared,0);
});
