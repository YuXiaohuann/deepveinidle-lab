import {priceStorageKey,priceDefaults,normalizePriceState} from './item-prices.js';
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
