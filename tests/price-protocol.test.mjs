import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {createPriceSnapshot} from '../src/price-protocol.js';
import {priceDefaults,setItemPrice,normalizePriceState,valuationPrice,valueCombatRewards} from '../src/item-prices.js';
import {parseMarketPrices} from '../src/market-import.js';
import {enhancementDefaults,resolveEnhancementPrices} from '../src/enhancement.js';
const at=Date.now()-1000;
const market=items=>parseMarketPrices({game:'Deep Vein Idle',generatedAt:new Date(at).toISOString(),refreshSeconds:300,items});

test('manual zero, vendor price and official market totals stay independent',()=>{
 const state=setItemPrice(priceDefaults(),1,0);state.prices[1].locked=true;
 state.quotes=market({1:{lowestSell:136,sellQty:12731,highestBuy:43,buyQty:135652}}).quotes;
 const snapshot=createPriceSnapshot(state,[1,1001,50110]),item=snapshot.getItem(1);
 assert.equal(snapshot.version,1);assert.equal(item.price,0);assert.equal(item.vendorPrice,game.vendorPrice(1));
 assert.equal(item.sellPrice,136);assert.equal(item.sellQuantity,12731);assert.equal(item.buyPrice,43);assert.equal(item.buyQuantity,135652);
 assert.equal(item.configured.locked,true);assert.equal(item.market.generatedAt,at);assert.equal(snapshot.items[1],item);
 assert.equal(snapshot.getItem(1001).price,null);assert.equal(snapshot.getItem(50110).price,null);
 const untradeable=game.items.find(i=>!game.canSell(i.id));assert.equal(snapshot.getItem(untradeable.id).vendorPrice,null);
 assert.throws(()=>snapshot.getItem(9999999),/invalidPriceItem/);
});
test('snapshot is immutable and lazy reads retain the same captured revision',()=>{
 const state=setItemPrice(priceDefaults(),1,7),snapshot=createPriceSnapshot(state,[1],12);
 state.prices[1].price=99;state.prices[2]={price:88};state.quotes[2]={ask:{value:8,capturedAt:at}};
 assert.equal(snapshot.revision,12);assert.equal(snapshot.getItem(1).price,7);assert.equal(snapshot.getItem(2).price,null);assert.equal(snapshot.getItem(2).sellPrice,null);
 assert.throws(()=>{snapshot.items[1].configured.locked=true;},TypeError);assert.throws(()=>{snapshot.items[1]=null;},TypeError);
});
test('legacy quantities stay unread; zero, missing, invalid and no-order fields remain distinct after persistence',()=>{
 const old=priceDefaults();old.quotes[1]={ask:{value:5,capturedAt:at}};
 let item=createPriceSnapshot(normalizePriceState(old)).getItem(1);
 assert.equal(item.sellQuantity,null);assert.equal(item.market.status.sellQuantity,'unread');assert.equal(item.market.status.buyPrice,'unread');
 const state=priceDefaults();state.quotes=market({1:{lowestSell:null,sellQty:0,highestBuy:7,buyQty:-1},2:{lowestSell:2,highestBuy:3,buyQty:0}}).quotes;
 item=createPriceSnapshot(normalizePriceState(JSON.parse(JSON.stringify(state)))).getItem(1);
 assert.equal(item.market.status.sellPrice,'noOrders');assert.equal(item.sellQuantity,0);assert.equal(item.market.status.sellQuantity,'available');
 assert.equal(item.buyPrice,7);assert.equal(item.buyQuantity,null);assert.equal(item.market.status.buyQuantity,'invalid');
 item=createPriceSnapshot(state).getItem(2);assert.equal(item.sellPrice,2);assert.equal(item.market.status.sellQuantity,'invalid');assert.equal(item.buyQuantity,0);
 for(const value of [null,'3',1.5,Infinity,Number.MAX_SAFE_INTEGER+1]){
  const parsed=market({1:{lowestSell:8,sellQty:value,highestBuy:7,buyQty:3}});
  assert.equal(parsed.quotes[1].ask.quantityInvalid,true);assert.equal(parsed.quotes[1].ask.value,8);
 }
});
test('existing valuation fallback and enhancement local overrides work with protocol snapshots',()=>{
 const state=setItemPrice(priceDefaults(),208,8),snapshot=createPriceSnapshot(state);
 assert.equal(valuationPrice(1,snapshot).fallback,true);assert.equal(valuationPrice(1,snapshot).price,game.vendorPrice(1));
 assert.equal(valueCombatRewards({coins:10,normalItems:{1:2},rareItems:{},foodItems:{},potionItems:{}},snapshot).profit,10+2*game.vendorPrice(1));
 let enhancement=enhancementDefaults();assert.equal(resolveEnhancementPrices(enhancement,snapshot).shardPrice,8);
 enhancement={...enhancement,shardPrice:0,priceModes:{...enhancement.priceModes,shardPrice:'manual'}};
 assert.equal(resolveEnhancementPrices(enhancement,snapshot).shardPrice,0);
 enhancement.shardPrice=null;assert.equal(resolveEnhancementPrices(enhancement,snapshot).shardPrice,null);
});

test('average prices are independent immutable fields with persisted status and generation time',()=>{
 const state=priceDefaults();state.quotes=market({1:{avg7d:73.25,avg30d:62},2:{avg7d:null,avg30d:'bad'}}).quotes;
 const snapshot=createPriceSnapshot(normalizePriceState(JSON.parse(JSON.stringify(state))));
 const item=snapshot.getItem(1);assert.equal(item.avg7d,73.25);assert.equal(item.avg30d,62);assert.equal(item.market.status.avg7d,'available');assert.equal(item.market.generatedAt,at);
 assert.equal(snapshot.getItem(2).market.status.avg7d,'noOrders');assert.equal(snapshot.getItem(2).market.status.avg30d,'invalid');
 assert.equal(snapshot.getItem(3).market.status.avg7d,'unread');
 state.quotes[1].avg7d.value=1;assert.equal(item.avg7d,73.25);assert.throws(()=>{item.avg30d=0;},TypeError);
});
