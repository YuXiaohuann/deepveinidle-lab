import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as game from '../src/upstream.js';
import {priceDefaults,itemFamily,setItemPrice,lockItemPrices,clearUnlockedPrices,validateMarketSnapshot,mergeQuotes} from '../src/item-prices.js';
const source=fs.readFileSync(new URL('../src/item-price-controls.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function mountItemPrices','function mountItemPrices');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(requestMarket){
 const state=priceDefaults();state.quotes={1:{bid:{value:36,capturedAt:Date.now()-1000}}};
 const frames=[];
 const controls=new Map(),element=()=>({focus(){},scrollTop:0,textContent:''});
 const dialog={open:false,innerHTML:'',showModal(){this.open=true;},setAttribute(){},addEventListener(){},querySelector(selector){if(!controls.has(selector))controls.set(selector,element());return controls.get(selector);},querySelectorAll(){return [];}};
 const button={};const document={createElement:()=>dialog,body:{append(){}},getElementById:()=>button};let current=state,subscriber;
 const ctx=vm.createContext({game,marketFamilies:game.marketFamilies,translatedName:s=>s,validItemId:()=>true,itemFamily,setItemPrice,lockItemPrices,clearUnlockedPrices,validateMarketSnapshot,mergeQuotes,document,Date,Set,Number,Object,String,structuredClone,requestAnimationFrame:fn=>frames.push(fn),requestMarket,priceState:()=>current,priceSaveError:()=>null,updatePrices:next=>{current=next;subscriber?.();},subscribePrices:fn=>subscriber=fn});
 vm.runInContext(source,ctx);ctx.mountItemPrices('zh');return {dialog,button,controls,ctx,nextFrame(){for(const fn of frames.splice(0))fn();},runFrames(){while(frames.length)this.nextFrame();}};
}
for(const [error,label]of [['marketMissing','未连接市场脚本'],['noMarketData','未读取市场报价']])test(`${error} replaces cached summary with a highlighted persistent notice`,async()=>{
 const h=harness(async()=>{throw Error(error);});h.button.onclick();h.runFrames();await flush();
 const summary=h.dialog.innerHTML.match(/<p id="price-market-status"[^>]*>(.*?)<\/p>/s)?.[0];
 assert.match(summary,/price-market-warning/);assert.match(summary,/role="alert"/);assert.ok(summary.includes(label));assert.equal(summary.includes('已捕获'),false);
 assert.match(h.dialog.innerHTML,/<p id="price-status" class="micro import-status" role="status"><\/p>/);
 assert.ok(h.dialog.innerHTML.indexOf('id="price-market-status"')<h.dialog.innerHTML.indexOf('id="price-status"'));
 assert.ok(h.dialog.innerHTML.indexOf('id="price-status"')<h.dialog.innerHTML.indexOf('class="price-categories"'));
 h.controls.get('#price-bulk-lock').onclick();assert.ok(h.dialog.innerHTML.includes(label));
});
test('a successful retry replaces the warning with updated captured counts',async()=>{
 let fail=true;const h=harness(async()=>{if(fail)throw Error('noMarketData');return {snapshot:{version:1,invalid:0,quotes:{1:{bid:{value:36,capturedAt:Date.now()}}}}};});
 h.button.onclick();h.runFrames();await flush();fail=false;h.button.onclick();h.runFrames();await flush();
 const summary=h.dialog.innerHTML.match(/<p id="price-market-status"[^>]*>(.*?)<\/p>/s)?.[0];assert.match(summary,/>已捕获 1 个物品变体 · 最近报价：.+ · 距今 0 分钟<\/p>$/);assert.equal(summary.includes('price-market-warning'),false);
});

test('opening renders immediately and reads after two frames; closing before reading cancels it',async()=>{
 let reads=0;const h=harness(async()=>{reads++;return {snapshot:{version:1,invalid:0,quotes:{1:{bid:{value:36,capturedAt:Date.now()}}}}};});
 h.button.onclick();assert.equal(h.dialog.open,true);assert.match(h.dialog.innerHTML,/item-prices-title/);assert.equal(reads,0);
 h.nextFrame();assert.equal(reads,0);h.nextFrame();assert.equal(reads,1);await flush();
 h.button.onclick();h.dialog.open=false;h.runFrames();assert.equal(reads,1);
});

test('clear prices requires confirmation and preserves state on cancellation',async()=>{
 const h=harness(async()=>{throw Error('noMarketData');});h.button.onclick();h.runFrames();await flush();
 const state=h.ctx.priceState();h.ctx.updatePrices(setItemPrice(state,1,0));let prompted='';h.ctx.confirm=message=>{prompted=message;return false;};
 h.controls.get('#price-clear').onclick();assert.match(prompted,/不限当前筛选/);assert.equal(h.ctx.priceState().prices[1].price,0);
 h.ctx.confirm=()=>true;h.controls.get('#price-clear').onclick();assert.equal(h.ctx.priceState().prices[1],undefined);assert.match(h.dialog.innerHTML,/已清空 1 件未锁定/);assert.deepEqual(h.ctx.priceState().quotes,state.quotes);
});
