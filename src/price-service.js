import {priceState,priceSaveError,updatePrices,subscribePrices,refreshMarketPrices,importAutomaticPrices} from './item-price-store.js';
import {priceDefaults,setItemPrice,lockItemPrices,clearUnlockedPrices,marketFamilies} from './item-prices.js';
import {createPriceSnapshot,priceProtocolVersion} from './price-protocol.js';
export {priceProtocolVersion};
export const getSaveError=priceSaveError;
let revision=0,cachedSnapshot;
const listeners=new Set();
subscribePrices(change=>{
 revision++;cachedSnapshot=undefined;
 const event=Object.freeze({...change,revision});
 for(const listener of listeners)listener(event);
});
export function getSnapshot(ids){
 if(ids!==undefined)return createPriceSnapshot(priceState(),ids,revision);
 return cachedSnapshot??=createPriceSnapshot(priceState(),undefined,revision);
}
export function getItem(id){return getSnapshot().getItem(id);}
export function subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
export function setPrice(id,value){updatePrices(lockItemPrices(setItemPrice(priceState(),id,value),[id],true).state);}
export function setLocked(ids,locked){const result=lockItemPrices(priceState(),ids,locked);updatePrices(result.state);return result.changed;}
export function clearPrices(){const result=clearUnlockedPrices(priceState());updatePrices(result.state);return result.cleared;}
export function getPreferences(){return structuredClone(priceState().preferences);}
export function setPreferences(preferences){
 if(typeof preferences?.autoImport!=='boolean'||marketFamilies.some(f=>!['off','ask','bid','vendor'].includes(preferences.categories?.[f.key])||typeof preferences.vendorFallback?.[f.key]!=='boolean'))throw Error('invalidPricePreferences');
 updatePrices({...priceState(),preferences:structuredClone(preferences)});
}
export function resetPreferences(){setPreferences(priceDefaults().preferences);}
export function importPrices(preferences=getPreferences()){return refreshMarketPrices(preferences).then(({stats})=>({stats}));}
export function refreshMarket(){return refreshMarketPrices(undefined,{quotesOnly:true}).then(()=>undefined);}
export async function importAutomatically(){const result=await importAutomaticPrices();return result?{stats:result.stats}:null;}
