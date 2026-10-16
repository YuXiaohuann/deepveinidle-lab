import test from 'node:test';
import assert from 'node:assert/strict';
import {captureHarness,flushCapture as flush} from './helpers/capture-harness.mjs';
import * as game from '../src/upstream.js';
import {defaults} from '../src/model.js';
import {importCharacter} from '../src/character-import.js';
import {enhancementDefaults,importEnhancement} from '../src/enhancement.js';
import {masteryDefaults,importMastery} from '../src/mastery.js';
import {gatheringDefaults,importGathering} from '../src/gathering-model.js';
import {craftingDefaults,importCrafting} from '../src/crafting-model.js';
const key='dvi-character-snapshot-v2',marketKey='dvi-market-quotes-v1';
const player=()=>({lastTick:100,skills:Object.fromEntries(['melee','ranged','magic','defence','hitpoints','enhancing','mining','fishing','woodcutting','thieving','cooking','smithing','fletching','herblore','crafting'].map(k=>[k,game.levelXp(30)])),equipment:{weapon:null,mount:null},foodItemId:null,eatAt:.75,foodMaxTier:0,foodPerTrip:-1,brews:{},brewTier:{},brewBuckets:{},house:{lectern:2},houseFurniture:{lectern:{cell:1}},masteries:{},perks:{},guildBonus:0,homeBank:null,ironman:false,bank:{64:100,110:1},pack:[{itemId:80,qty:1}],overflow:{81:1},collections:{64:25},forgeLog:{0:1},name:'not needed',history:Array(100).fill('not needed'),token:'secret'});

test('Worker selection preserves all five import consumers and removes unrelated data',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');
 const you=player(),windows=[{label:'Weekly goal: gathered',fromTick:0,toTick:200,xpMult:1.1,token:'secret'}],guild={name:'Guild',tag:'G',members:['private']};
 s.receive([{t:'welcome',you,windows,guild}],100);await flush();
 const snapshot=h.storage.get(key),original={...snapshot,player:you,worldBuffs:windows};
 for(const [read,config]of [[importCharacter,defaults()],[importEnhancement,enhancementDefaults()],[importMastery,masteryDefaults()],[importGathering,gatheringDefaults()],[importCrafting,craftingDefaults()]])assert.deepEqual(read(config,snapshot),read(config,original));
 for(const field of ['bank','pack','overflow','collections','forgeLog'])assert.deepEqual(snapshot.player[field],you[field]);
 assert.equal(snapshot.player.name,undefined);assert.equal(snapshot.player.history,undefined);assert.equal(JSON.stringify(snapshot).includes('secret'),false);assert.deepEqual(snapshot.guild,{name:'Guild',tag:'G'});
});

test('main thread forwards raw messages without calling JSON.parse',async()=>{
 const h=captureHarness();h.context.JSON={parse(){throw Error('Main thread parse forbidden');}};
 const s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.receive([{t:'welcome',you:player()}]);await flush();assert.ok(h.storage.get(key));
});

test('one frame aggregates player, guild and world windows into one saved result',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');
 s.receive([{t:'welcome',you:player(),guild:null},{t:'guild',info:{name:'Latest',tag:'L'}},{t:'windows',windows:[]}],100);await flush();
 assert.equal(h.writes.filter(w=>w.key===key).length,1);assert.equal(h.storage.get(key).guild.name,'Latest');assert.deepEqual(h.storage.get(key).worldBuffs,[]);
});

test('slow role storage requests only the latest state after an ongoing save',async()=>{
 let release,hold=true;const h=captureHarness(async k=>{if(k===key&&hold){hold=false;await new Promise(r=>release=r);}});
 const s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.receive([{t:'welcome',you:player()}]);await flush();
 const pulls=h.workers[0].sent.filter(m=>m.type==='pull').length;
 for(let i=0;i<100;i++){const you=player();you.lastTick=200+i;s.receive([{t:'snapshot',you}]);}
 await flush();assert.equal(h.workers[0].sent.filter(m=>m.type==='pull').length,pulls);
 release();await flush();assert.equal(h.writes.filter(w=>w.key===key).length,2);
 assert.equal(h.storage.get(key).player.lastTick,299);
});

test('capture deadline is fixed while updates continue, then saves latest role',async()=>{
 const h=captureHarness(undefined,{autoSave:false}),s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.receive([{t:'welcome',you:player()}]);await flush();
 const scheduled=[...h.timers].filter(([,t])=>t.ms===100).map(([id])=>id);
 for(let i=0;i<5;i++){const you=player();you.lastTick=101+i;s.receive([{t:'snapshot',you}]);await flush();}
 assert.deepEqual([...h.timers].filter(([,t])=>t.ms===100).map(([id])=>id),scheduled);
 h.fire(100);await flush();assert.equal(h.storage.get(key).player.lastTick,105);assert.equal(h.writes.filter(w=>w.key===key).length,1);
});

test('Worker creation, startup, execution and message errors stop capture visibly',async()=>{
 const blocked=captureHarness(undefined,{workerFailure:true});assert.match(blocked.badge().textContent,/Worker blocked/);assert.equal(blocked.urls.size,0);
 const startup=captureHarness();startup.fire(5000);await flush();assert.match(startup.badge().textContent,/startup timed out/);assert.ok(startup.workers[0].terminated);
 for(const event of ['onerror','onmessageerror']){
  const h=captureHarness();await flush();h.workers[0][event]();assert.match(h.badge().textContent,/读取失败/);assert.ok(h.workers[0].terminated);assert.equal(h.timers.size,0);
 }
});

test('missing ACK and count/size overload stop without silently discarding frames',async()=>{
 const stalled=captureHarness();await flush();const worker=stalled.workers[0];worker.paused=true;
 const s=new stalled.page.WebSocket('wss://deepveinidle.com/ws');s.raw('{}');stalled.fire(10000);assert.match(stalled.badge().textContent,/unresponsive/);
 const count=captureHarness();await flush();count.workers[0].paused=true;const c=new count.page.WebSocket('wss://deepveinidle.com/ws');for(let i=0;i<129;i++)c.raw('{}');assert.match(count.badge().textContent,/backlog exceeded/);assert.ok(count.workers[0].terminated);
 const size=captureHarness();await flush();const z=new size.page.WebSocket('wss://deepveinidle.com/ws');z.raw(' '.repeat(16*1024*1024+1));assert.match(size.badge().textContent,/backlog exceeded/);assert.equal(size.workers[0].sent.filter(m=>m.type==='frame').length,0);
});

test('malformed JSON is ignored, incompatible role stops without showing success',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.raw('not json');await flush();assert.match(h.badge().textContent,/Waiting/);
 s.receive([{t:'welcome',you:{}}]);await flush();assert.match(h.badge().textContent,/Incompatible/);assert.equal(h.storage.has(key),false);
});

test('page exit releases Worker and observers; hidden badge stops DOM observation',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.receive([{t:'welcome',you:player()}]);await flush();h.hideBadge();assert.equal(h.observing(),false);
 h.pagehide();assert.ok(h.workers[0].terminated);assert.equal(h.urls.size,0);assert.equal(h.timers.size,0);
});

test('backlog bound includes pending messages across connection changes',async()=>{
 const h=captureHarness();await flush();h.workers[0].paused=true;
 const first=new h.page.WebSocket('wss://deepveinidle.com/ws');for(let i=0;i<100;i++)first.raw('{}');
 const second=new h.page.WebSocket('wss://deepveinidle.com/ws');for(let i=0;i<29;i++)second.raw('{}');
 assert.match(h.badge().textContent,/backlog exceeded/);
});

test('old-frame ACKs drain the backlog without affecting new connection state',async()=>{
 const h=captureHarness(),first=new h.page.WebSocket('wss://deepveinidle.com/ws');
 first.receive([{t:'welcome',you:{}}]);const second=new h.page.WebSocket('wss://deepveinidle.com/ws');second.receive([{t:'welcome',you:player()}]);await flush();
 assert.ok(h.storage.get(key));assert.match(h.badge().textContent,/Character captured/);assert.equal([...h.timers.values()].some(t=>t.ms===10000),false);
});

test('previous connection storage rejection cannot replace current waiting or success state',async()=>{
 let reject,block=true;const h=captureHarness(async k=>{if(k===key&&block){block=false;await new Promise((resolve,r)=>reject=r);}});
 const first=new h.page.WebSocket('wss://deepveinidle.com/ws');first.receive([{t:'welcome',you:player()}]);await flush();
 const second=new h.page.WebSocket('wss://deepveinidle.com/ws');const next=player();next.lastTick=500;second.receive([{t:'welcome',you:next}]);reject(Error('old connection error'));await flush();
 assert.equal(h.storage.get(key).player.lastTick,500);assert.match(h.badge().textContent,/Character captured/);
});

test('all market message types are ignored without storage writes or success notices',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');await flush();
 const market=[{t:'marketBook',top:{itemId:1,bid:10}},{t:'marketBooks',tops:[{itemId:2,ask:20}]},{t:'marketDepth',itemId:3,asks:[{price:30}],bids:[]}];
 s.receive(market);await flush();assert.equal(h.writes.length,0);assert.equal(h.storage.has(marketKey),false);assert.match(h.badge().textContent,/Waiting/);
 s.receive([{t:'welcome',you:player()},...market]);await flush();assert.deepEqual([...h.storage.keys()],[key]);assert.match(h.badge().textContent,/Character captured/);
 const writes=h.writes.length,timer=[...h.timers.keys()];h.hideBadge();s.receive(market);await flush();assert.equal(h.writes.length,writes);assert.equal(h.badge(),null);assert.equal(timer.length,1);
});

test('role success waits for storage and later snapshots do not repeat or extend it',async()=>{
 let release;const h=captureHarness(async()=>{await new Promise(r=>release=r);}),s=new h.page.WebSocket('wss://deepveinidle.com/ws');
 s.receive([{t:'welcome',you:player()}]);await flush();assert.match(h.badge().textContent,/Waiting/);
 release();await flush();assert.match(h.badge().textContent,/Character captured/);const timers=[...h.timers.keys()];
 s.receive([{t:'snapshot',you:player()}]);await flush();release();await flush();assert.deepEqual([...h.timers.keys()],timers);
 h.hideBadge();s.receive([{t:'snapshot',you:player()}]);await flush();release();await flush();assert.equal(h.badge(),null);
});

test('role storage rejection is explicit',async()=>{
 const h=captureHarness(async()=>{throw Error('quota');}),s=new h.page.WebSocket('wss://deepveinidle.com/ws');
 s.receive([{t:'welcome',you:player()}]);await flush();assert.match(h.badge().textContent,/Character could not be saved/);
});
