import * as game from './upstream.js';
import {validItemId} from './item-prices.js';

export const priceProtocolVersion=1;
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
const fieldStatus=(side,quantity=false)=>{
 if(!side)return 'unread';
 if(quantity)return side.quantityInvalid?'invalid':side.quantity===undefined?'unread':'available';
 return side.invalid?'invalid':side.value===null?'noOrders':'available';
};
const volumeStatus=side=>!side?'unread':side.invalid?'invalid':Number.isSafeInteger(side.value)&&side.value>=0?'available':'invalid';
// The captured copy is private. Lazy item reads keep even broad simulations on
// one immutable revision without enumerating every rarity/enhancement variant.
export function createPriceSnapshot(state,ids,revision=0){
 const captured=structuredClone({prices:state.prices,quotes:state.quotes}),cache=new Map();
 const getItem=rawId=>{
  const id=Number(rawId);if(!validItemId(id))throw Error('invalidPriceItem');
  if(cache.has(id))return cache.get(id);
  const p=captured.prices[id],q=captured.quotes[id],ask=q?.ask,bid=q?.bid,avg7d=q?.avg7d,avg30d=q?.avg30d,volume7d=q?.volume7d,volume30d=q?.volume30d;
  const item=freeze({itemId:id,price:p?.price??null,vendorPrice:game.canSell(id)?game.vendorPrice(id):null,
   sellPrice:ask&&!ask.invalid?ask.value:null,sellQuantity:ask&&!ask.quantityInvalid?ask.quantity??null:null,
   buyPrice:bid&&!bid.invalid?bid.value:null,buyQuantity:bid&&!bid.quantityInvalid?bid.quantity??null:null,
   avg7d:avg7d&&!avg7d.invalid?avg7d.value:null,avg30d:avg30d&&!avg30d.invalid?avg30d.value:null,
   volume7d:volume7d&&!volume7d.invalid?volume7d.value:null,volume30d:volume30d&&!volume30d.invalid?volume30d.value:null,
   configured:{locked:p?.locked??false,source:p?.source??null,updatedAt:p?.updatedAt??null},
   market:{generatedAt:Math.max(ask?.capturedAt??0,bid?.capturedAt??0,avg7d?.capturedAt??0,avg30d?.capturedAt??0,volume7d?.capturedAt??0,volume30d?.capturedAt??0)||null,status:{avg7d:fieldStatus(avg7d),avg30d:fieldStatus(avg30d),sellPrice:fieldStatus(ask),sellQuantity:fieldStatus(ask,true),buyPrice:fieldStatus(bid),buyQuantity:fieldStatus(bid,true),volume7d:volumeStatus(volume7d),volume30d:volumeStatus(volume30d)}}});
  cache.set(id,item);return item;
 };
 const snapshot={version:priceProtocolVersion,revision,getItem};
 if(ids!==undefined)snapshot.items=Object.fromEntries([...new Set(ids)].map(id=>[id,getItem(id)]));
 return freeze(snapshot);
}
