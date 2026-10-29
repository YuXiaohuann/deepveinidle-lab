import {marketFamilies} from '../../src/upstream.js';
// Real pre-v5 shape, independent of the current defaults.
export function legacyPriceState(version=4){return {version,prices:{},quotes:{},preferences:{autoImport:true,categories:Object.fromEntries(marketFamilies.map(f=>[f.key,'ask'])),vendorFallback:Object.fromEntries(marketFamilies.map(f=>[f.key,false]))}};}
