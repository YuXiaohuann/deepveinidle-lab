import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as game from '../src/upstream.js';
import {marketErrors} from '../src/market-import.js';
import {priceDefaults,validItemId,itemFamily,setItemPrice,lockItemPrices,clearUnlockedPrices,importItemPrices,validateMarketSnapshot,mergeQuotes} from '../src/item-prices.js';
const source=fs.readFileSync(new URL('../src/item-price-controls.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function mountItemPrices','function mountItemPrices');
const refreshSource='let marketRequest;'+fs.readFileSync(new URL('../src/item-price-store.js',import.meta.url),'utf8').split('let marketRequest;')[1].replace('export async function','async function');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(requestMarket,priceInputs=[]){
 const state=priceDefaults();state.quotes={1:{bid:{value:36,capturedAt:Date.now()-1000}}};
 const frames=[];
 const controls=new Map(),element=()=>({focus(){},setAttribute(key,value){this[key]=value;},scrollTop:0,textContent:''});
 const dialog={open:false,innerHTML:'',showModal(){this.open=true;},setAttribute(){},addEventListener(){},querySelector(selector){if(!controls.has(selector))controls.set(selector,element());return controls.get(selector);},querySelectorAll(selector){return selector==='[data-price-value]'?priceInputs:[];}};
 const button={};const document={createElement:()=>dialog,body:{append(){}},getElementById:()=>button};let current=state,subscriber;
 const ctx=vm.createContext({marketErrors,game,marketFamilies:game.marketFamilies,translatedName:s=>s,validItemId,itemFamily,setItemPrice,lockItemPrices,clearUnlockedPrices,importItemPrices,validateMarketSnapshot,mergeQuotes,document,Date,Set,Number,Object,String,structuredClone,marketPricesUrl:"https://deepveinidle.com/api/market/prices.json",requestAnimationFrame:fn=>frames.push(fn),requestMarket,priceState:()=>current,priceSaveError:()=>null,updatePrices:next=>{current=next;subscriber?.();},subscribePrices:fn=>subscriber=fn});
 vm.runInContext(refreshSource,ctx);vm.runInContext(source,ctx);ctx.mountItemPrices('zh');return {dialog,button,controls,ctx,nextFrame(){for(const fn of frames.splice(0))fn();},runFrames(){while(frames.length)this.nextFrame();}};
}
function changeFilter(h,key,value){const el=h.controls.get('#price-'+key);el.value=value;el.onchange();}
test('price list includes all legal rarities without quotes and generates enhancements only on selection',()=>{
 const h=harness(async()=>{throw Error('noMarketData');});h.ctx.updatePrices(priceDefaults());h.button.onclick();
 changeFilter(h,'family','weapons');
 const ids=()=>[...h.dialog.innerHTML.matchAll(/data-price-value="(\d+)"/g)].map(match=>Number(match[1]));
 for(const id of [110,1110,2110,3110,4110])assert.ok(ids().includes(id),`missing rarity ${id}`);
 assert.equal(ids().includes(5110),false);assert.ok(ids().every(id=>id<game.encode(0,1)));
 h.ctx.updatePrices(setItemPrice(h.ctx.priceState(),50110,10));
 assert.ok(ids().includes(50110));assert.equal(ids().includes(51110),false);
 const plus=h.controls.get('#price-plus');plus.value='1';plus.onchange();
 for(const id of [10110,11110,12110,13110,14110])assert.ok(ids().includes(id),`missing enhanced rarity ${id}`);
 assert.ok(ids().every(id=>Math.floor(id/game.encode(0,1))===1));
 const tier=h.controls.get('#price-tier');tier.value='4';tier.onchange();
 assert.ok(ids().includes(14110));assert.ok(ids().every(id=>game.itemTier(id)===4));
});
for(const [error,label]of [['marketNetworkFailed','官方行情请求失败'],['noMarketData','官方接口暂无物品报价']])test(`${error} replaces cached summary with a highlighted persistent notice`,async()=>{
 const h=harness(async()=>{throw Error(error);});h.button.onclick();await h.controls.get('#price-import').onclick();
 const summary=h.dialog.innerHTML.match(/<span id="price-status"[^>]*>(.*?)<\/span>/s)?.[0];
 assert.match(summary,/price-market-warning/);assert.match(summary,/role="alert"/);assert.ok(summary.includes(label));assert.equal(summary.includes('已捕获'),false);
 assert.equal((h.dialog.innerHTML.match(/id="price-status"/g)??[]).length,1);
 assert.equal(h.dialog.innerHTML.includes('id="price-market-status"'),false);
 assert.ok(h.dialog.innerHTML.indexOf('id="price-clear"')<h.dialog.innerHTML.indexOf('id="price-import"'));
 assert.ok(h.dialog.innerHTML.indexOf('id="price-import"')<h.dialog.innerHTML.indexOf('id="price-status"'));
 h.controls.get('#price-bulk-lock').onclick();assert.ok(h.dialog.innerHTML.includes(label));
});
test('reopening preserves a warning without requesting; a successful explicit retry replaces it',async()=>{
 let requests=0;
 let fail=true;const h=harness(async()=>{requests++;if(fail)throw Error('noMarketData');return {snapshot:{version:1,invalid:0,quotes:{1:{bid:{value:36,capturedAt:Date.now()}}}}};});
 h.button.onclick();await h.controls.get('#price-import').onclick();assert.equal(requests,1);
 fail=false;h.dialog.open=false;h.button.onclick();h.runFrames();await flush();assert.equal(requests,1);assert.match(h.ctx.message(),/官方接口暂无物品报价/);
 await h.controls.get('#price-import').onclick();assert.equal(requests,2);
 const summary=h.dialog.innerHTML.match(/<span id="price-status"[^>]*>(.*?)<\/span>/s)?.[0];assert.match(summary,/>已更新 /);assert.equal(summary.includes('price-market-warning'),false);
});

test('opening, reopening and language changes render local state without requesting; only explicit import requests',async()=>{
 let reads=0;const h=harness(async()=>{reads++;return {snapshot:{version:1,invalid:0,quotes:{1:{bid:{value:36,capturedAt:Date.now()}}}}};});
 const before=h.ctx.priceState();
 h.button.onclick();assert.equal(h.dialog.open,true);assert.match(h.dialog.innerHTML,/item-prices-title/);assert.equal(reads,0);
 h.runFrames();await flush();assert.equal(reads,0);assert.equal(h.ctx.priceState(),before);assert.match(h.ctx.message(),/已读取 1 个物品变体/);
 h.ctx.mountItemPrices('en');h.dialog.open=false;h.button.onclick();h.runFrames();await flush();assert.equal(reads,0);assert.equal(h.ctx.priceState(),before);
 await h.controls.get('#price-import').onclick();assert.equal(reads,1);assert.equal(h.ctx.priceState().prices[1].price,36);
});

test('opening with no saved quotes does not show a read-success or loading message',async()=>{
 let reads=0;const h=harness(async()=>{reads++;});h.ctx.updatePrices(priceDefaults());const before=h.ctx.priceState();
 h.button.onclick();h.runFrames();await flush();assert.equal(reads,0);assert.equal(h.ctx.priceState(),before);assert.equal(h.ctx.message(),'');
 assert.doesNotMatch(h.dialog.innerHTML,/正在读取官方行情|已读取 \d/);
});

test('clear prices requires confirmation and preserves state on cancellation',async()=>{
 const h=harness(async()=>({snapshot:{version:1,invalid:0,quotes:{1:{bid:{value:36,capturedAt:Date.now()}}}}}));h.button.onclick();h.runFrames();await flush();
 const state=h.ctx.priceState();h.ctx.updatePrices(setItemPrice(state,1,0));let prompted='';h.ctx.confirm=message=>{prompted=message;return false;};
 h.controls.get('#price-clear').onclick();assert.match(prompted,/不限当前筛选/);assert.equal(h.ctx.priceState().prices[1].price,0);
 h.ctx.confirm=()=>true;h.controls.get('#price-clear').onclick();assert.equal(h.ctx.priceState().prices[1],undefined);assert.match(h.dialog.innerHTML,/已清空 1 件未锁定/);assert.deepEqual(h.ctx.priceState().quotes,state.quotes);
});

test('category radios place vendor price immediately before skip in both languages',()=>{
 const h=harness(async()=>{throw Error('noMarketData');});h.button.onclick();
 for(const [language,label]of [['zh','商人价'],['en','Vendor price']]){
  h.ctx.mountItemPrices(language);
  const options=[...h.dialog.innerHTML.matchAll(/name="price-category-ore"[^>]*value="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(options,['ask','bid','bidVendor','vendor','off']);assert.ok(h.dialog.innerHTML.includes(label));
 }
});

test('manual edits lock immediately, including zero and blank; invalid edits preserve state and users can unlock',()=>{
 const input={dataset:{priceValue:'1'},value:'42',valueAsNumber:42,validity:{badInput:false},nextElementSibling:{textContent:''},setAttribute(){},removeAttribute(){}};
 const h=harness(async()=>{throw Error('noMarketData');},[input]);h.button.onclick();
 changeFilter(h,'family','ore');
 for(const [value,number,expected]of [['42',42,42],['0',0,0],['',NaN,null]]){
  input.value=value;input.valueAsNumber=number;input.oninput();
  assert.equal(h.ctx.priceState().prices[1].price,expected);assert.equal(h.ctx.priceState().prices[1].locked,true);
  assert.equal(h.controls.get('[data-price-lock="1"]').checked,true);assert.equal(input.nextElementSibling.textContent,'手动');
 }
 const before=h.ctx.priceState();input.value='-1';input.valueAsNumber=-1;input.oninput();assert.equal(h.ctx.priceState(),before);
 input.value='bad';input.validity.badInput=true;input.oninput();assert.equal(h.ctx.priceState(),before);
 const unlocked=lockItemPrices(before,[1],false).state;h.ctx.updatePrices(unlocked);assert.equal(h.ctx.priceState().prices[1].locked,false);
 input.validity.badInput=false;input.value='8';input.valueAsNumber=8;input.onchange();assert.equal(h.ctx.priceState().prices[1].locked,true);assert.equal(h.ctx.priceState().prices[1].price,8);
});

test('opening preserves cache and prices; explicit imports replace full snapshots and reject older data',async()=>{
 let at=Date.now(),items={1:{bid:{value:50,capturedAt:at},ask:{value:60,capturedAt:at}}};
 const h=harness(async()=>({snapshot:{version:1,invalid:0,quotes:items}}));
 const state=setItemPrice(priceDefaults(),1,99);state.quotes={1:{bid:{value:10,capturedAt:at-1000}}};h.ctx.updatePrices(state);h.button.onclick();h.runFrames();await flush();assert.equal(h.ctx.priceState(),state);
 await h.controls.get('#price-import').onclick();assert.equal(h.ctx.priceState().prices[1].price,50);assert.equal(h.ctx.priceState().quotes[1].bid.value,50);
 const before=h.ctx.priceState();items={1:{bid:{value:1,capturedAt:at-1000}}};h.controls.get('#price-import').onclick();await flush();assert.equal(h.ctx.priceState(),before);assert.match(h.dialog.innerHTML,/官方行情早于当前缓存/);
 items={2:{bid:{value:10,capturedAt:at+1}}};h.dialog.open=false;h.button.onclick();h.runFrames();await flush();assert.equal(h.ctx.priceState(),before);
 await h.controls.get('#price-import').onclick();assert.equal(h.ctx.priceState().quotes[1],undefined);assert.equal(h.ctx.priceState().quotes[2].bid.value,10);assert.equal(h.ctx.priceState().prices[1].price,50);
});

test('import uses click-time categories but the latest manual edits and locks',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));
 h.ctx.updatePrices(priceDefaults());h.button.onclick();h.controls.get('#price-import').onclick();
 let current=structuredClone(h.ctx.priceState());current.preferences.categories.ore='off';current=lockItemPrices(setItemPrice(current,1,123),[1],true).state;h.ctx.updatePrices(current);
 resolve({snapshot:{version:1,invalid:0,quotes:{1:{bid:{value:50,capturedAt:Date.now()}},2:{bid:{value:80,capturedAt:Date.now()}}}}});await flush();
 assert.equal(h.ctx.priceState().prices[1].price,123);assert.equal(h.ctx.priceState().prices[1].locked,true);assert.equal(h.ctx.priceState().prices[2].price,80);assert.equal(h.ctx.priceState().preferences.categories.ore,'off');
});

test('failed import leaves prices and cache intact and removes market userscript instructions in both languages',async()=>{
 const h=harness(async()=>{throw Error('marketNetworkFailed');});h.button.onclick();const before=h.ctx.priceState();await h.controls.get('#price-import').onclick();assert.equal(h.ctx.priceState(),before);
 for(const language of ['zh','en']){h.ctx.mountItemPrices(language);assert.doesNotMatch(h.dialog.innerHTML,/https:\/\/deepveinidle.com\/api\/market\/prices.json|Official market API|官方行情 API|character-import.user.js|userscript|未捕获|Not captured/);}
});

test('one toolbar status shows loading once and remains outside the market category details',async()=>{
 let resolve,requests=0;const h=harness(()=>{requests++;return new Promise(r=>resolve=r);});h.button.onclick();const pending=h.controls.get('#price-import').onclick();await h.controls.get('#price-import').onclick();assert.equal(requests,1);
 assert.equal((h.dialog.innerHTML.match(/正在读取官方行情…/g)??[]).length,1);
 assert.ok(h.dialog.innerHTML.indexOf('</details>')<h.dialog.innerHTML.indexOf('id="price-import"'));
 assert.match(h.dialog.innerHTML,/<\/button><button id="price-import"[^>]*>一键导入价格<\/button><span id="price-status"/);
 resolve({snapshot:{version:1,invalid:0,quotes:{1:{bid:{value:36,capturedAt:Date.now()}}}}});await pending;
 assert.match(h.ctx.message(),/已更新/);assert.doesNotMatch(h.ctx.message(),/未自动导入|异常或未适配/);
});

test('import summary keeps four main counts and appends only nonzero exceptional counts in both languages',()=>{
 const h=harness(async()=>{});h.button.onclick();
 vm.runInContext('status={stats:{updated:3,vendor:1,locked:2,missing:4,unavailable:0,stale:0,invalid:0}}',h.ctx);
 assert.equal(h.ctx.message(),'已更新 3 项价格 · 商人价 1 · 锁定跳过 2 · 缺报价 4');
 vm.runInContext('status.stats.unavailable=2;status.stats.invalid=1;',h.ctx);
 assert.equal(h.ctx.message(),'已更新 3 项价格 · 商人价 1 · 锁定跳过 2 · 缺报价 4 · 无法兜底 2 · 异常 1');
 h.ctx.mountItemPrices('en');assert.equal(h.ctx.message(),'Updated 3 prices · Vendor price 1 · Locked 2 · Missing 4 · No fallback 2 · Invalid 1');
});

test('quote errors survive clear and valid manual edits; invalid input updates the same accessible status',async()=>{
 const input={dataset:{priceValue:'1'},value:'42',valueAsNumber:42,validity:{badInput:false},nextElementSibling:{textContent:''},setAttribute(){},removeAttribute(){}};
 const h=harness(async()=>{throw Error('marketTimeout');},[input]);h.button.onclick();await h.controls.get('#price-import').onclick();
 changeFilter(h,'family','ore');
 input.oninput();assert.match(h.controls.get('#price-status').textContent,/官方行情请求超时/);assert.equal(h.controls.get('#price-status').role,'alert');
 h.ctx.confirm=()=>true;h.controls.get('#price-clear').onclick();assert.match(h.ctx.message(),/官方行情请求超时/);
 vm.runInContext('marketError=null',h.ctx);input.value='-1';input.valueAsNumber=-1;input.oninput();assert.match(h.controls.get('#price-status').textContent,/单价必须为空/);assert.equal(h.controls.get('#price-status').role,'alert');
 input.value='0';input.valueAsNumber=0;input.oninput();assert.match(h.controls.get('#price-status').textContent,/已读取/);assert.equal(h.controls.get('#price-status').role,'status');
});

test('unfiltered dialog hides saved prices and quotes and disables selection in both languages',()=>{
 let requests=0;const h=harness(async()=>{requests++;});h.ctx.updatePrices(lockItemPrices(setItemPrice(h.ctx.priceState(),1,0),[1],true).state);h.button.onclick();
 const before=h.ctx.priceState();
 for(const [language,prompt]of [['zh','物品数量较多，请先设置筛选条件'],['en','Many items to display; set a filter first']]){
  h.ctx.mountItemPrices(language);assert.ok(h.dialog.innerHTML.includes(prompt));assert.equal(h.ctx.candidates().length,0);assert.doesNotMatch(h.dialog.innerHTML,/data-price-value=/);
  assert.match(h.dialog.innerHTML,/id="price-select-all"[^>]*disabled/);assert.match(h.dialog.innerHTML,/id="price-bulk-lock"[^>]*disabled/);assert.match(h.dialog.innerHTML,/id="price-bulk-unlock"[^>]*disabled/);
  const options=[...h.dialog.innerHTML.match(/<select id="price-filter">(.*?)<\/select>/s)[1].matchAll(/value="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(options,['all','priced','locked']);
 }
 assert.equal(h.ctx.priceState(),before);assert.equal(requests,0);
 const preferences=structuredClone(before.preferences);preferences.categories.ore='ask';h.ctx.updatePrices({...before,preferences});assert.equal(h.ctx.candidates().length,0);
});

test('each retained filter independently activates rows, including zero rarity and zero price; clearing hides and deselects',()=>{
 const h=harness(async()=>{});h.ctx.updatePrices(lockItemPrices(setItemPrice(priceDefaults(),1,0),[1],true).state);h.button.onclick();
 for(const [key,value,reset]of [['family','ore','all'],['search','Copper',''],['tier','0','all'],['plus','1','0'],['filter','priced','all'],['filter','locked','all']]){
  changeFilter(h,key,value);assert.ok(h.ctx.candidates().length>0,key);assert.equal(h.dialog.innerHTML.includes('物品数量较多，请先设置筛选条件'),false);
  if(key==='filter')assert.deepEqual([...h.ctx.candidates()],[1]);
  h.controls.get('#price-select-all').onchange({target:{checked:true}});assert.ok(vm.runInContext('selected.size',h.ctx)>0);
  changeFilter(h,key,reset);assert.equal(h.ctx.candidates().length,0);assert.equal(vm.runInContext('selected.size',h.ctx),0);assert.ok(h.dialog.innerHTML.includes('物品数量较多，请先设置筛选条件'));
 }
});

test('whitespace search is inactive, unmatched search has a distinct message, and reopening retains active filters',()=>{
 const h=harness(async()=>{});h.button.onclick();changeFilter(h,'search','   ');assert.equal(h.ctx.candidates().length,0);assert.ok(h.dialog.innerHTML.includes('物品数量较多，请先设置筛选条件'));
 changeFilter(h,'search','no-such-dvi-item-xyz');assert.equal(h.ctx.candidates().length,0);assert.ok(h.dialog.innerHTML.includes('没有匹配物品'));assert.equal(h.dialog.innerHTML.includes('物品数量较多，请先设置筛选条件'),false);
 changeFilter(h,'search','Copper');const ids=[...h.ctx.candidates()];assert.ok(ids.length>0);h.dialog.open=false;h.button.onclick();h.ctx.mountItemPrices('en');assert.deepEqual([...h.ctx.candidates()],ids);
});

test('global import and clear work without activating the item list or discarding locked prices and quotes',async()=>{
 const h=harness(async()=>({snapshot:{version:1,invalid:0,quotes:{1:{bid:{value:50,capturedAt:Date.now()}},2:{bid:{value:80,capturedAt:Date.now()}}}}}));
 h.ctx.updatePrices(lockItemPrices(setItemPrice(priceDefaults(),1,123),[1],true).state);h.button.onclick();await h.controls.get('#price-import').onclick();assert.equal(h.ctx.priceState().prices[1].price,123);assert.equal(h.ctx.priceState().prices[2].price,80);assert.equal(h.ctx.candidates().length,0);
 h.ctx.confirm=()=>true;h.controls.get('#price-clear').onclick();assert.equal(h.ctx.priceState().prices[2],undefined);assert.equal(h.ctx.priceState().prices[1].price,123);assert.equal(h.ctx.priceState().quotes[2].bid.value,80);assert.equal(h.ctx.candidates().length,0);assert.ok(h.dialog.innerHTML.includes('物品数量较多，请先设置筛选条件'));
});
