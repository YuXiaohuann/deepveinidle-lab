import * as game from './upstream.js';

export const priceStorageKey='dvi-item-prices-v1';
export const marketFamilies=game.marketFamilies;
// The market offers a dedicated gems shortcut as well as gems under resources.
// Pricing uses the primary groups without that duplicate shortcut.
export const priceCategories=game.marketCategories.filter(category=>category.key!=='gems');
export function itemCategory(id){const family=itemFamily(id);return priceCategories.find(category=>category.families.includes(family))?.key??null;}
// This pricing subset does not change the market categories used by item filters.
export const monsterValuablesCategory='monsterValuables';
const monsterValuables=new Set(game.monsters.map(monster=>game.baseItemId(monster.bonus.itemId)).filter(id=>itemCategory(id)==='valuables'));
export const priceOptionCategories=[...priceCategories,{key:monsterValuablesCategory,zh:'贵重品（怪物的稀有掉落）',en:'Valuables (monster rare drops)'}];
export function itemPriceCategory(id){return monsterValuables.has(game.baseItemId(id))?monsterValuablesCategory:itemCategory(id);}
export const marketPriceModes=['avg7d','avg30d','ask','bid'];
export const marketVolumeModes=['volume7d','volume30d'];
const priceModes=[...marketPriceModes,'vendor','off'];
const priceSources=['manual',...marketPriceModes,'vendor'];
const legacyPriceModes=['ask','bid','vendor','off'];
export function pricePolicy(preferences,category){
 if(!category||preferences.reviewCategories.includes(category))return {mode:'off',fallback:false};
 const key=preferences.categories[category]===null?'all':category;
 return {mode:preferences.categories[key],fallback:preferences.vendorFallback[key]};
}
export function validatePricePreferences(preferences){
 const categories=priceOptionCategories.map(category=>category.key),keys=['all',...categories];
 if(!record(preferences)||typeof preferences.autoImport!=='boolean'||!record(preferences.categories)||!record(preferences.vendorFallback)||!Array.isArray(preferences.reviewCategories))throw Error('invalidPricePreferences');
 if(Object.keys(preferences.categories).some(key=>!keys.includes(key))||Object.keys(preferences.vendorFallback).some(key=>!keys.includes(key)))throw Error('invalidPricePreferences');
 for(const key of keys){
  const mode=preferences.categories[key],inherits=key!=='all'&&mode===null;
  if(!inherits&&!priceModes.includes(mode)||typeof preferences.vendorFallback[key]!=='boolean')throw Error('invalidPricePreferences');
 }
 const review=preferences.reviewCategories;
 if(new Set(review).size!==review.length||review.some(key=>!categories.includes(key)||preferences.categories[key]!==null))throw Error('invalidPricePreferences');
 return structuredClone(preferences);
}
export const hasPriceImports=preferences=>priceOptionCategories.some(category=>pricePolicy(preferences,category.key).mode!=='off');
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const time=v=>Number.isSafeInteger(v)&&v>0&&v<=Date.now()+60000;
export const validPrice=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;
export function validItemId(id){
 if(!Number.isSafeInteger(id)||id<=0)return false;
 try{const base=game.baseItemId(id),tier=game.itemTier(id),plus=Math.floor(id/game.encode(0,1));return tier>=0&&tier<=4&&plus<=game.maxEnhancement&&game.encode(game.withRarity(base,tier),plus)===id&&game.item(id).id===id&&(!plus||game.canEnhance(id));}catch{return false;}
}
export function itemFamily(id){try{return game.marketFamily(game.baseItemId(id));}catch{return null;}}
export function priceDefaults(){return {version:7,prices:{},quotes:{},preferences:{autoImport:true,categories:{all:'avg7d',...Object.fromEntries(priceOptionCategories.map(category=>[category.key,category.key===monsterValuablesCategory?'vendor':null]))},vendorFallback:Object.fromEntries(['all',...priceOptionCategories.map(category=>category.key)].map(key=>[key,false])),reviewCategories:[]}};}
export function normalizePriceState(raw){
 if(!record(raw)||![2,3,4,5,6,7].includes(raw.version)||!record(raw.prices)||!record(raw.quotes)||!record(raw.preferences)||!record(raw.preferences.categories))throw Error('invalidPriceStorage');
 const next=priceDefaults();
 for(const [key,p] of Object.entries(raw.prices)){
  if(String(Number(key))!==key||!validItemId(Number(key))||!record(p)||p.price!==null&&!validPrice(p.price)||typeof p.locked!=='boolean'||!priceSources.includes(p.source)||!time(p.updatedAt)||p.quoteCapturedAt!==null&&!time(p.quoteCapturedAt))throw Error('invalidPriceStorage');
  next.prices[key]={price:p.price,locked:p.locked,source:p.source,updatedAt:p.updatedAt,quoteCapturedAt:raw.version===2?null:p.quoteCapturedAt};
 }
 if(raw.version>=3){
  const parsed=validateMarketSnapshot({version:1,quotes:raw.quotes,invalid:0});
  if(parsed.invalid)throw Error('invalidPriceStorage');next.quotes=parsed.quotes;
 }
 if(raw.version>=5){
  try{
   const preferences=raw.version<7?{...raw.preferences,categories:{[monsterValuablesCategory]:'vendor',...raw.preferences.categories},vendorFallback:{[monsterValuablesCategory]:false,...raw.preferences.vendorFallback}}:raw.preferences;
   const validated=validatePricePreferences(preferences);
   if(raw.version>=6)next.preferences=validated;
   else next.preferences.autoImport=validated.autoImport;
  }catch{throw Error('invalidPriceStorage');}
  return next;
 }
 if(raw.version===4&&(typeof raw.preferences.autoImport!=='boolean'||!record(raw.preferences.vendorFallback)))throw Error('invalidPriceStorage');
 if(raw.version===4)next.preferences.autoImport=raw.preferences.autoImport;
 const legacy=raw.version<4;
 for(const family of marketFamilies){
  const mode=raw.preferences.categories[family.key];
  if(!legacyPriceModes.includes(mode)&&!(legacy&&mode==='bidVendor')||!legacy&&typeof raw.preferences.vendorFallback[family.key]!=='boolean')throw Error('invalidPriceStorage');
 }
 return next;
}
// Preference changes revalue only affected categories, from the current cache.
// Off/review categories keep their existing values, including manually unlocked ones.
export function applyPricePreferences(state,preferences,now=Date.now()){
 const next=validatePricePreferences(preferences),changed=priceOptionCategories.filter(category=>JSON.stringify(pricePolicy(state.preferences,category.key))!==JSON.stringify(pricePolicy(next,category.key)));
 if(!changed.some(category=>pricePolicy(next,category.key).mode!=='off'))return {...state,preferences:next};
 const prices={...state.prices},selected=priceDefaults().preferences;selected.categories.all='off';selected.categories[monsterValuablesCategory]='off';
 for(const category of changed){
  const policy=pricePolicy(next,category.key);if(policy.mode==='off')continue;
  selected.categories[category.key]=policy.mode;selected.vendorFallback[category.key]=policy.fallback;
  for(const [id,price]of Object.entries(prices))if(!price.locked&&itemPriceCategory(Number(id))===category.key)delete prices[id];
 }
 const result=importItemPrices({...state,prices},{version:1,quotes:state.quotes,invalid:0},selected,now);
 return {...result.state,quotes:state.quotes,preferences:next};
}
export function validateMarketSnapshot(raw){
 if(!record(raw)||raw.version!==1||!record(raw.quotes)||!Number.isSafeInteger(raw.invalid)||raw.invalid<0)throw Error('invalidMarketData');
 const quotes={};let invalid=raw.invalid;
 for(const [key,q]of Object.entries(raw.quotes)){
  const id=Number(key);if(String(id)!==key||!validItemId(id)||!itemFamily(id)||!record(q)){invalid++;continue;}
  const entry={};
  for(const side of marketPriceModes){
   if(!Object.hasOwn(q,side))continue;const v=q[side];
   if(!record(v)||!time(v.capturedAt)||!(v.invalid===true||v.value===null||validPrice(v.value)&&v.value>0)){invalid++;continue;}
   entry[side]=v.invalid===true?{invalid:true,capturedAt:v.capturedAt}:{value:v.value,capturedAt:v.capturedAt};
   if(v.quantityInvalid===true)entry[side].quantityInvalid=true;
   else if(Object.hasOwn(v,'quantity')){
    if(Number.isSafeInteger(v.quantity)&&v.quantity>=0)entry[side].quantity=v.quantity;
    else {entry[side].quantityInvalid=true;invalid++;}
   }
  }
  for(const side of marketVolumeModes){
   if(!Object.hasOwn(q,side))continue;const v=q[side];
   if(!record(v)||!time(v.capturedAt)||!(v.invalid===true||Number.isSafeInteger(v.value)&&v.value>=0)){invalid++;continue;}
   entry[side]=v.invalid===true?{invalid:true,capturedAt:v.capturedAt}:{value:v.value,capturedAt:v.capturedAt};
  }
  if(Object.keys(entry).length)quotes[key]=entry;else invalid++;
 }
 return {quotes,invalid};
}
export function mergeQuotes(current,incoming){
 const quotes=structuredClone(current);
 for(const [id,q]of Object.entries(incoming))for(const side of [...marketPriceModes,...marketVolumeModes])if(q[side]&&(!quotes[id]?.[side]||q[side].capturedAt>=quotes[id][side].capturedAt)){
  quotes[id]??={};quotes[id][side]={...q[side]};
 }
 return quotes;
}
export function setItemPrice(state,id,price,now=Date.now()){
 if(!validItemId(id)||price!==null&&!validPrice(price))throw Error('invalidPrice');
 return {...state,prices:{...state.prices,[id]:{price,locked:state.prices[id]?.locked??false,source:'manual',updatedAt:now,quoteCapturedAt:null}}};
}
export function lockItemPrices(state,ids,locked,now=Date.now()){
 if(typeof locked!=='boolean'||ids.some(id=>!validItemId(id)))throw Error('invalidPrice');
 const prices={...state.prices};let changed=0;
 for(const id of new Set(ids)){
  const old=prices[id];if((old?.locked??false)===locked)continue;
  prices[id]=old?{...old,locked}:{price:null,locked,source:'manual',updatedAt:now,quoteCapturedAt:null};changed++;
 }
 return {state:{...state,prices},changed};
}
export function clearUnlockedPrices(state){
 const prices=Object.fromEntries(Object.entries(state.prices).filter(([,p])=>p.locked));
 const cleared=Object.values(state.prices).filter(p=>!p.locked&&p.price!==null).length;
 return {state:{...state,prices},cleared};
}
export function importItemPrices(state,snapshot,preferences=state.preferences,now=Date.now()){
 const parsed=validateMarketSnapshot(snapshot),quotes=mergeQuotes(state.quotes,parsed.quotes),prices={...state.prices};
 const stats={updated:0,vendor:0,locked:0,missing:0,unavailable:0,stale:0,invalid:parsed.invalid};
 // Include configured items with no quote so missing coverage is visible.
 const ids=new Set([...game.items.filter(i=>i.id===game.baseItemId(i.id)&&itemFamily(i.id)&&game.canSell(i.id)).map(i=>i.id),...Object.keys(prices).map(Number),...Object.keys(quotes).map(Number)]);
 for(const id of ids){
  const category=itemPriceCategory(id),{mode,fallback}=pricePolicy(preferences,category);if(!marketPriceModes.includes(mode)&&mode!=='vendor')continue;const side=mode;
  const old=prices[id];if(old?.locked){stats.locked++;continue;}
  if(mode==='vendor'){
   if(!game.canSell(id)){stats.unavailable++;continue;}
   const value=game.vendorPrice(id);if(!validPrice(value))throw Error('invalidPrice');
   if(old?.price===value&&old.source==='vendor'&&old.quoteCapturedAt===null)continue;
   prices[id]={price:value,locked:false,source:'vendor',updatedAt:now,quoteCapturedAt:null};stats.updated++;stats.vendor++;continue;
  }
  // Import only this read's observations, never silently reuse a cached old side.
  const q=parsed.quotes[id]?.[side];if(!q){stats.missing++;continue;}
  if(q.invalid){stats.invalid++;continue;}
  if(q.capturedAt<(quotes[id]?.[side]?.capturedAt??0)||old?.quoteCapturedAt&&q.capturedAt<old.quoteCapturedAt){stats.stale++;continue;}
  let value=q.value,source=side;
  if(value===null&&!fallback){stats.missing++;continue;}
  if(fallback){
   if(game.canSell(id)){
    const vendor=game.vendorPrice(id);if(!validPrice(vendor))throw Error('invalidPrice');
    if(value===null||vendor>=value){value=vendor;source='vendor';}
   }else if(value===null){stats.unavailable++;continue;}
  }
  if(!validPrice(value))throw Error('invalidPrice');
  if(old?.price===value&&old.source===source&&old.quoteCapturedAt===q.capturedAt)continue;
  prices[id]={price:value,locked:false,source,updatedAt:now,quoteCapturedAt:q.capturedAt};stats.updated++;if(source==='vendor')stats.vendor++;
 }
 return {state:{...state,prices,quotes},stats};
}
export function itemPrice(id,prices){return prices.getItem?prices.getItem(Number(id)).price:prices[id]?.price??null;}
export function valuationPrice(id,prices={}){
 id=Number(id);if(game.isPet(id))return {price:0,fallback:false};
 const price=itemPrice(id,prices);
 const vendor=prices.getItem?prices.getItem(id).vendorPrice:game.canSell(id)?game.vendorPrice(id):null;
 return {price:price??vendor??0,fallback:price===null};
}
export function valueItems(items,prices={}){
 let partial=0;const missing=[];
 for(const [key,qty]of Object.entries(items)){
  if(!Number.isFinite(qty)||qty<0)throw Error('invalidDropQuantity');if(!qty)continue;
  const id=Number(key),{price,fallback}=valuationPrice(id,prices);
  if(fallback)missing.push(id);partial+=qty*price;
 }
 if(!Number.isFinite(partial)||partial>Number.MAX_SAFE_INTEGER)throw Error('priceOverflow');
 return {value:partial,partial,missing};
}
export function valueRewards(result,prices={}){
 if(!result)return result;
 const normal=valueItems(result.normalItems,prices),rare=valueItems(result.rareItems,prices);
 const totalIncome=normal.value===null||rare.value===null?null:result.coins+normal.value+rare.value;
 if(totalIncome!==null&&(!Number.isFinite(totalIncome)||totalIncome>Number.MAX_SAFE_INTEGER))throw Error('priceOverflow');
 return {...result,normalValue:normal.value,rareValue:rare.value,totalIncome,normalMissingPrices:normal.missing,rareMissingPrices:rare.missing,missingPrices:[...normal.missing,...rare.missing]};
}

export function valueCombatRewards(result,prices={}){
 const valued=valueRewards(result,prices);if(!valued)return valued;
 const food=valueItems(result.foodItems??{},prices);
 const potions=valueItems(result.potionItems??{},prices);
 const consumableCost=food.value+potions.value;
 if(!Number.isFinite(consumableCost)||consumableCost>Number.MAX_SAFE_INTEGER)throw Error('priceOverflow');
 const profit=valued.totalIncome-consumableCost;
 if(!Number.isFinite(profit)||Math.abs(profit)>Number.MAX_SAFE_INTEGER)throw Error('priceOverflow');
 return {...valued,consumableCost,consumableMissingPrices:[...food.missing,...potions.missing],foodCost:food.value,potionCost:potions.value,foodMissingPrices:food.missing,potionMissingPrices:potions.missing,profitMissingPrices:[...valued.missingPrices,...food.missing,...potions.missing],profit};
}
