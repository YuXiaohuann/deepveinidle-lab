import {validItemId,itemFamily,validPrice} from './item-prices.js';

export const marketPricesUrl='https://deepveinidle.com/api/market/prices.json';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function parseMarketPrices(raw){
 const at=typeof raw?.generatedAt==='string'?Date.parse(raw.generatedAt):NaN;
 if(!record(raw)||raw.game!=='Deep Vein Idle'||!Number.isSafeInteger(at)||at<=0||at>Date.now()+60000||!Number.isSafeInteger(raw.refreshSeconds)||raw.refreshSeconds<=0||!record(raw.items))throw Error('invalidMarketData');
 const quotes={};let invalid=0;
 for(const [key,item]of Object.entries(raw.items)){
  const id=Number(key);
  if(String(id)!==key||!validItemId(id)||!itemFamily(id)||!record(item)){invalid++;continue;}
  const quote={};
  for(const [side,field]of [['ask','lowestSell'],['bid','highestBuy']]){
   const value=item[field];
   quote[side]=value===null||validPrice(value)&&value>0?{value,capturedAt:at}:{invalid:true,capturedAt:at};
  }
  quotes[key]=quote;
 }
 if(!Object.keys(quotes).length)throw Error(Object.keys(raw.items).length?'invalidMarketData':'noMarketData');
 return {version:1,quotes,invalid};
}
export async function requestMarket(){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(marketPricesUrl,{signal:controller.signal,credentials:'omit'});
  if(!response.ok)throw Error('marketHttpFailed');
  let raw;try{raw=await response.json();}catch(error){if(controller.signal.aborted)throw error;throw Error('invalidMarketData');}
  return {snapshot:parseMarketPrices(raw)};
 }catch(error){
  if(controller.signal.aborted)throw Error('marketTimeout');
  if(['marketHttpFailed','invalidMarketData','noMarketData'].includes(error.message))throw error;
  throw Error('marketNetworkFailed');
 }finally{clearTimeout(timeout);}
}
