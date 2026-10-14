import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {captureHarness} from './helpers/capture-harness.mjs';
const script=fs.readFileSync(new URL('../src/character-import.user.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const harness=write=>captureHarness(write);
test('market capture stores only quotes and isolates role, orders and credentials',async()=>{
 const h=harness(),socket=new h.page.WebSocket('wss://deepveinidle.com/ws?token=secret');
 socket.receive([{t:'marketBooks',tops:[{itemId:1,ask:10,bid:2,floor:1,owner:'private',token:'secret'},{itemId:1001,ask:null,bid:null}]},{t:'chat',text:'private'},{t:'marketFilled',itemId:1,price:100,qty:2}]);await flush();
 const data=h.storage.get('dvi-market-quotes-v1');assert.equal(data.version,1);assert.equal(data.quotes[1].ask.value,10);assert.equal(data.quotes[1].bid.value,2);assert.equal(data.quotes[1001].bid.value,null);assert.equal(h.storage.has('dvi-character-snapshot-v2'),false);
 const text=JSON.stringify(data);for(const word of ['private','secret','floor','qty','owner'])assert.equal(text.includes(word),false);
});
test('absent fields, invalid quotes, depth sides and explicit no bids stay distinct',async()=>{
 const h=harness(),socket=new h.page.WebSocket('wss://deepveinidle.com/ws');
 socket.receive([{t:'marketBook',top:{itemId:1,ask:7}},{t:'marketBook',top:{itemId:2,bid:-1}},{t:'marketDepth',itemId:3,asks:[{price:10},{price:5}],bids:[]},{t:'marketDepth',itemId:4,bids:[{price:2},{price:8}]},{t:'marketBooks',tops:[null]}]);await flush();
 const q=h.storage.get('dvi-market-quotes-v1');assert.equal(q.quotes[1].bid,undefined);assert.equal(q.quotes[2].bid.invalid,true);assert.equal(q.quotes[3].ask.value,5);assert.equal(q.quotes[3].bid.value,null);assert.equal(q.quotes[4].bid.value,8);assert.equal(q.quotes[4].ask,undefined);assert.equal(q.invalid,1);
 socket.receive([{t:'marketBook',top:{itemId:1,bid:4}},{t:'marketBook',top:{itemId:1,ask:null}}]);await flush();assert.equal(h.storage.get('dvi-market-quotes-v1').quotes[1].ask.value,null);
});
test('reconnection and welcome clear old quotes; queued old writes cannot win',async()=>{
 let release,hold=false;const h=harness(async()=>{if(hold){hold=false;await new Promise(resolve=>release=resolve);}});
 const first=new h.page.WebSocket('wss://deepveinidle.com/ws');await flush();hold=true;
 first.receive([{t:'marketBook',top:{itemId:1,ask:10,bid:2}}]);await flush();
 const second=new h.page.WebSocket('wss://deepveinidle.com/ws');second.receive([{t:'marketBook',top:{itemId:2,ask:20,bid:4}}]);first.receive([{t:'marketBook',top:{itemId:3,ask:30,bid:6}}]);
 release();await flush();assert.equal(h.storage.get('dvi-market-quotes-v1').quotes[1],undefined);assert.equal(h.storage.get('dvi-market-quotes-v1').quotes[3],undefined);assert.equal(h.storage.get('dvi-market-quotes-v1').quotes[2].bid.value,4);
 second.receive([{t:'welcome',you:{lastTick:1,skills:{},equipment:{}}}]);await flush();assert.deepEqual(h.storage.get('dvi-market-quotes-v1').quotes,{});
});
test('market bridge is independent, read-only and reports storage failures',async()=>{
 class CustomEvent extends Event{constructor(type,{detail}){super(type);this.detail=detail;}}
 const document=new EventTarget(),reads=[];
 vm.runInNewContext(script,{document,location:{origin:'http://127.0.0.1:4173'},CustomEvent,GM_getValue:async key=>{reads.push(key);if(key==='dvi-market-quotes-v1')return {version:1,quotes:{},invalid:0};throw Error('blocked');}});
 const replies=[];document.addEventListener('dvi-market-response',e=>replies.push(JSON.parse(e.detail)));
 const send=data=>document.dispatchEvent(new CustomEvent('dvi-market-request',{detail:JSON.stringify(data)}));
 send({source:'dvi-simulator',action:'write',id:'x'});send({source:'other',action:'read',id:'x'});await flush();assert.equal(reads.length,0);
 send({source:'dvi-simulator',action:'read',id:'ok'});await flush();assert.deepEqual(reads,['dvi-market-quotes-v1']);assert.equal(replies[0].version,'1.0');assert.equal(replies[0].snapshot.version,1);
});
test('market capture save failure is visibly reported',async()=>{
 const h=harness(async()=>{throw Error('quota');});new h.page.WebSocket('wss://deepveinidle.com/ws');await flush();assert.match(h.badge().textContent,/Market prices could not be saved/);
});
test('shared market requests have bounded retries and reject outdated replies',async()=>{
 const document=new EventTarget();class CustomEvent extends Event{constructor(type,{detail}){super(type);this.detail=detail;}}
 let timeout,cleared=0;const source=fs.readFileSync(new URL('../src/market-import.js',import.meta.url),'utf8').replace('export function','function');
 const ctx=vm.createContext({document,CustomEvent,Date,Map,Promise,Error,setInterval:()=>1,setTimeout:fn=>(timeout=fn,2),clearInterval:()=>cleared++,clearTimeout(){}});vm.runInContext(source,ctx);
 document.addEventListener('dvi-market-request',event=>{const d=JSON.parse(event.detail);document.dispatchEvent(new CustomEvent('dvi-market-response',{detail:JSON.stringify({source:'dvi-market-script',version:'0.9',id:d.id})}));});
 const promise=ctx.requestMarket('read');timeout();await assert.rejects(promise,/marketOutdated/);assert.equal(cleared,1);
});

test('market success waits for storage, hides after five seconds and stays hidden on later quotes',async()=>{
 let finish;const h=harness(async(key,value)=>{if(key==='dvi-market-quotes-v1'&&Object.keys(value.quotes).length)await new Promise(resolve=>finish=resolve);});
 const socket=new h.page.WebSocket('wss://deepveinidle.com/ws');await flush();assert.equal(h.timers.size,0);
 socket.receive([{t:'marketBook',top:{itemId:1,ask:10,bid:null}}]);await flush();assert.match(h.badge().textContent,/Waiting for game data/);assert.equal(h.timers.size,0);
 finish();await flush();assert.equal(h.badge().textContent,'市场报价已读取 / Market prices captured');assert.equal(h.timers.size,1);
 h.hideBadge();assert.equal(h.badge(),null);socket.receive([{t:'marketBook',top:{itemId:1,ask:12}}]);await flush();finish();await flush();assert.equal(h.badge(),null);assert.equal(h.timers.size,0);
 new h.page.WebSocket('wss://deepveinidle.com/ws');await flush();assert.match(h.badge().textContent,/Waiting for game data/);
});
test('market success replaces role success without later role snapshots overwriting it',async()=>{
 const h=harness(),socket=new h.page.WebSocket('wss://deepveinidle.com/ws'),you={lastTick:1,skills:{},equipment:{}};
 socket.receive([{t:'welcome',you}]);await flush();assert.equal(h.badge().textContent,'角色配置已读取 / Character captured');
 socket.receive([{t:'marketBook',top:{itemId:1,bid:12}}]);await flush();assert.equal(h.badge().textContent,'市场报价已读取 / Market prices captured');assert.equal(h.timers.size,1);
 const text=h.badge().textContent,timer=[...h.timers.keys()][0];socket.receive([{t:'snapshot',you}]);await flush();assert.equal(h.badge().textContent,text);assert.equal([...h.timers.keys()][0],timer);
});
test('invalid quotes and old socket writes never show market success',async()=>{
 let finish;const h=harness(async(key,value)=>{if(key==='dvi-market-quotes-v1'&&value.quotes[1]?.bid?.value===12)await new Promise(resolve=>finish=resolve);});
 const first=new h.page.WebSocket('wss://deepveinidle.com/ws');await flush();first.receive([{t:'marketBook',top:{itemId:1,bid:-1}}]);await flush();assert.equal(h.timers.size,0);
 first.receive([{t:'marketBook',top:{itemId:1,bid:12}}]);await flush();new h.page.WebSocket('wss://deepveinidle.com/ws');finish();await flush();assert.match(h.badge().textContent,/Waiting for game data/);assert.equal(h.timers.size,0);
});
