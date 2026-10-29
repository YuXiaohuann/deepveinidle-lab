import test from 'node:test';
import assert from 'node:assert/strict';

test('preference changes atomically update API, notifications, persistence and late imports without extra requests',async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),saved=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}});
 let requests=0,respond;const at=Date.now()-1000;
 const payload={game:'Deep Vein Idle',generatedAt:new Date(at).toISOString(),refreshSeconds:300,items:{1:{lowestSell:90,highestBuy:40,sellQty:1,buyQty:2},2:{lowestSell:80,highestBuy:null,sellQty:2,buyQty:0}}};
 t.mock.method(globalThis,'fetch',async()=>{requests++;return {ok:true,json:async()=>payload};});
 try{
  const service=await import('../src/price-service.js');const events=[],unsubscribe=service.subscribe(event=>events.push(event));
  await service.importPrices();const original=service.getSnapshot();
  let prefs=service.getPreferences();prefs.categories.all='bid';const count=events.length;service.setPreferences(prefs);
  assert.equal(events.length,count+1);assert.equal(events.at(-1).prices,true);assert.equal(events.at(-1).preferences,true);assert.equal(events.at(-1).market,false);
  assert.equal(service.getItem(1).price,40);assert.equal(service.getItem(2).price,null);assert.equal(original.getItem(1).price,90);assert.equal(original.getItem(2).price,80);assert.equal(requests,1);
  assert.equal(JSON.parse(saved.get('dvi-item-prices-v1')).prices[1].price,40);
  t.mock.method(globalThis,'fetch',()=>{requests++;return new Promise(resolve=>respond=resolve);});
  const pending=service.importPrices();prefs=service.getPreferences();prefs.categories.all='ask';service.setPreferences(prefs);service.setPrice(2,0);
  respond({ok:true,json:async()=>payload});await pending;
  assert.equal(service.getItem(1).price,90);assert.equal(service.getItem(2).price,0);assert.equal(service.getItem(2).configured.locked,true);assert.equal(requests,2);
  let writesFailed=true;globalThis.localStorage.setItem=(key,value)=>{if(writesFailed)throw Error('quota');saved.set(key,value);};
  prefs=service.getPreferences();prefs.categories.all='bid';service.setPreferences(prefs);
  assert.equal(service.getItem(1).price,40);assert.equal(service.getSaveError(),'priceSaveFailed');assert.equal(events.at(-1).prices,true);assert.equal(events.at(-1).storage,true);
  writesFailed=false;service.resetPreferences();assert.equal(service.getItem(1).price,90);assert.equal(service.getSaveError(),null);unsubscribe();
 }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
