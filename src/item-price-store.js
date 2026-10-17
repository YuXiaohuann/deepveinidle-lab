import {requestMarket} from './market-import.js';
import {priceStorageKey,priceDefaults,normalizePriceState,validateMarketSnapshot,importItemPrices} from './item-prices.js';
let state=priceDefaults(),saveError=null,initialized=false;const listeners=new Set();
function initialize(){if(initialized)return;initialized=true;
 try{const raw=localStorage.getItem(priceStorageKey);if(raw)state=normalizePriceState(JSON.parse(raw));}catch(error){saveError=error.message==='invalidPriceStorage'?'invalidPriceStorage':'priceReadFailed';}
}
export function priceState(){initialize();return state;}
export function priceSaveError(){initialize();return saveError;}
export function updatePrices(next){initialize();state=next;
 try{localStorage.setItem(priceStorageKey,JSON.stringify(state));saveError=null;}catch{saveError='priceSaveFailed';}
 for(const listener of listeners)listener();
}
export function subscribePrices(listener){listeners.add(listener);return ()=>listeners.delete(listener);}

let marketRequest;
export async function refreshMarketPrices(preferences=priceState().preferences,{quotesOnly=false}={}){
 const selected=structuredClone(preferences);
 marketRequest??=requestMarket().finally(()=>{marketRequest=null;});
 const response=await marketRequest;
 if(!response.snapshot)throw Error('noMarketData');
 const parsed=validateMarketSnapshot(response.snapshot);
 if(!Object.keys(parsed.quotes).length)throw Error(parsed.invalid?'invalidMarketData':'noMarketData');
 const latest=Math.max(0,...Object.values(priceState().quotes).flatMap(q=>Object.values(q).map(side=>side.capturedAt)));
 const incoming=Math.max(...Object.values(parsed.quotes).flatMap(q=>Object.values(q).map(side=>side.capturedAt)));
 if(incoming<latest)throw Error('marketStale');
 if(quotesOnly){updatePrices({...priceState(),quotes:parsed.quotes});return {state:priceState()};}
 const result=importItemPrices(priceState(),response.snapshot,selected);
 updatePrices({...result.state,quotes:parsed.quotes});
 return result;
}
