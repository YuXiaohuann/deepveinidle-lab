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
const player=()=>({lastTick:100,skills:Object.fromEntries(['melee','ranged','magic','defence','hitpoints','enhancing','mining','fishing','woodcutting','thieving','cooking','smithing','fletching','herblore','crafting'].map(k=>[k,game.levelXp(30)])),equipment:{weapon:null,mount:null},foodItemId:null,eatAt:.75,foodMaxTier:0,foodPerTrip:-1,brews:{},brewTier:{},brewBuckets:{},house:{lectern:2},houseFurniture:{lectern:{cell:1}},masteries:{},perks:{},guildBonus:0,homeBank:null,ironman:false,bank:{64:100,110:1},bankLocked:[64],pack:[{itemId:80,qty:1}],overflow:{81:1},collections:{64:25},forgeLog:{0:1},name:'not needed',history:Array(100).fill('not needed'),token:'secret'});

for(const hasUnsafeWindow of [true,false])test(`capture ${hasUnsafeWindow?'prefers unsafeWindow over a separate window':'falls back to page window when unsafeWindow is absent'}`,async()=>{
 const h=captureHarness(undefined,{hasUnsafeWindow});
 if(hasUnsafeWindow){
  new h.context.window.WebSocket('wss://deepveinidle.com/ws').receive([{t:'welcome',you:player()}]);
  await flush();assert.equal(h.writes.length,0);
 }else assert.equal(Object.hasOwn(h.context,'unsafeWindow'),false);
 new h.page.WebSocket('wss://deepveinidle.com/ws').receive([{t:'welcome',you:player()}]);
 await flush();assert.deepEqual(h.storage.get(key).player.skills,player().skills);assert.match(h.badge().textContent,/Character captured/);
});

for(const host of ['deepveinidle.com','cn.deepveinidle.com'])test(`${host} captures only same-origin game sockets`,async()=>{
 const h=captureHarness(undefined,{origin:`https://${host}`});
 const other=host==='deepveinidle.com'?'cn.deepveinidle.com':'deepveinidle.com';
 new h.page.WebSocket(`wss://${other}/ws`).receive([{t:'welcome',you:player()}]);
 await flush();assert.equal(h.storage.has(key),false);
 new h.page.WebSocket(`wss://${host}/ws`).receive([{t:'welcome',you:player()}]);
 await flush();assert.deepEqual(h.storage.get(key).player.skills,player().skills);
});

test('complete you preserves unknown fields and all five import consumers',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');
 const you=player(),windows=[{label:'Weekly goal: gathered',fromTick:0,toTick:200,xpMult:1.1,token:'secret'}],guild={name:'Guild',tag:'G',members:['private']};
 s.receive([{t:'welcome',you,windows,guild}],100);await flush();
 assert.deepEqual(h.storage.get(key).player.bankLocked,[64]);
 const snapshot=h.storage.get(key),original={...snapshot,player:you,worldBuffs:windows};
 for(const [read,config]of [[importCharacter,defaults()],[importEnhancement,enhancementDefaults()],[importMastery,masteryDefaults()],[importGathering,gatheringDefaults()],[importCrafting,craftingDefaults()]])assert.deepEqual(read(config,snapshot),read(config,original));
 for(const field of ['bank','pack','overflow','collections','forgeLog'])assert.deepEqual(snapshot.player[field],you[field]);
 assert.deepEqual(snapshot.player,you);assert.equal(snapshot.worldBuffs[0].token,undefined);assert.deepEqual(snapshot.guild,{name:'Guild',tag:'G'});
});

test('capture runs without Worker or Blob APIs',async()=>{
 const h=captureHarness();
 assert.equal(h.context.Worker,undefined);assert.equal(h.context.Blob,undefined);
 const s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.receive([{t:'welcome',you:player()}]);await flush();assert.ok(h.storage.get(key));
});

test('one frame aggregates player, guild and world windows into one saved result',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');
 s.receive([{t:'welcome',you:player(),guild:null},{t:'guild',info:{name:'Latest',tag:'L'}},{t:'windows',windows:[]}],100);await flush();
 assert.equal(h.writes.filter(w=>w.key===key).length,1);assert.equal(h.storage.get(key).guild.name,'Latest');assert.deepEqual(h.storage.get(key).worldBuffs,[]);
});

test('slow role storage saves only the latest state after an ongoing write',async()=>{
 let release,hold=true;const h=captureHarness(async k=>{if(k===key&&hold){hold=false;await new Promise(r=>release=r);}});
 const s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.receive([{t:'welcome',you:player()}]);await flush();
 const writes=h.writes.length;
 for(let i=0;i<100;i++){const you=player();you.lastTick=200+i;s.receive([{t:'snapshot',you}]);}
 await flush();assert.equal(h.writes.length,writes);
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

test('malformed JSON is ignored, incompatible role stops without showing success',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.raw('not json');await flush();assert.match(h.badge().textContent,/Waiting/);
 s.receive([{t:'welcome',you:null}]);await flush();assert.match(h.badge().textContent,/Incompatible/);assert.equal(h.storage.has(key),false);
});

test('page exit clears pending saves and observers; hidden badge stops DOM observation',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.receive([{t:'welcome',you:player()}]);await flush();h.hideBadge();assert.equal(h.observing(),false);
 s.receive([{t:'snapshot',you:player()}]);h.pagehide();await flush();assert.equal(h.timers.size,0);assert.equal(h.writes.length,1);assert.equal(h.observing(),false);
});

test('connection replacement discards pending saves and ignores old socket messages',async()=>{
 const h=captureHarness(undefined,{autoSave:false}),first=new h.page.WebSocket('wss://deepveinidle.com/ws');
 first.receive([{t:'welcome',you:player()}]);
 const second=new h.page.WebSocket('wss://deepveinidle.com/ws');first.receive([{t:'welcome',you:{}}]);
 h.fire(100);await flush();assert.equal(h.writes.length,0);assert.match(h.badge().textContent,/Waiting/);
 const next=player();next.lastTick=500;second.receive([{t:'welcome',you:next}]);h.fire(100);await flush();
 assert.equal(h.storage.get(key).player.lastTick,500);assert.match(h.badge().textContent,/Character captured/);
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

test('prototype hook preserves constructor, listener options, removal, return value and native exceptions',async()=>{
 const h=captureHarness();assert.equal(h.page.WebSocket,h.NativeSocket);
 const s=new h.page.WebSocket('wss://deepveinidle.com/ws',{listen:false});
 let calls=0,receiver,eventSeen;const listener=function(event){calls++;receiver=this;eventSeen=event;};
 assert.equal(s.addEventListener('message',listener,{once:true}),undefined);
 s.addEventListener('message',listener,{once:true});
 const removed=()=>assert.fail('removed listener was invoked');s.addEventListener('message',removed);s.removeEventListener('message',removed);
 s.receive([{t:'welcome',you:player()}]);await flush();
 s.receive([{t:'snapshot',you:player()}]);await flush();
 assert.equal(calls,1);assert.equal(receiver,s);assert.equal(typeof eventSeen.data,'string');
 assert.equal(h.writes.length,2);assert.equal([...h.timers.values()].filter(t=>t.ms===5000).length,1);
 assert.throws(()=>h.page.WebSocket.prototype.addEventListener.call({},'message',()=>{}),TypeError);
});

test('discovery requires a message listener and old sockets cannot become current again',async()=>{
 const h=captureHarness(),first=new h.page.WebSocket('wss://deepveinidle.com/ws',{listen:false});
 first.addEventListener('open',()=>{});first.receive([{t:'welcome',you:player()}]);await flush();assert.equal(h.writes.length,0);
 first.addEventListener('message',()=>{});first.receive([{t:'welcome',you:player()}]);await flush();
 const second=new h.page.WebSocket('wss://deepveinidle.com/ws');
 first.addEventListener('message',()=>{});first.receive([{t:'snapshot',you:null}]);
 const you=player();you.lastTick=777;second.receive([{t:'welcome',you}]);await flush();
 assert.equal(h.storage.get(key).player.lastTick,777);
});

test('unknown nested fields are preserved and sparse you replaces all old fields',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');
 const you={future:{array:[{email:'raw value',unknown:42}]}};
 s.receive([{t:'welcome',you:{...player(),...you}}]);await flush();
 assert.deepEqual(h.storage.get(key).player.future,you.future);
 s.receive([{t:'snapshot',you}]);await flush();assert.deepEqual(h.storage.get(key).player,you);
 assert.throws(()=>importCharacter(defaults(),h.storage.get(key)),/invalidSnapshot/);
});

test('deferred DOM mount uses latest status and page exit removes readiness listener',async()=>{
 const h=captureHarness(undefined,{ready:false});assert.equal(h.badge(),null);
 const s=new h.page.WebSocket('wss://deepveinidle.com/ws');s.receive([{t:'welcome',you:player()}]);await flush();
 h.ready();assert.match(h.badge().textContent,/Character captured/);
 const exited=captureHarness(undefined,{ready:false});exited.pagehide();exited.ready();assert.equal(exited.badge(),null);
});

test('capture failure remains visible after success notice has hidden',async()=>{
 const h=captureHarness(),s=new h.page.WebSocket('wss://deepveinidle.com/ws');
 s.receive([{t:'welcome',you:player()}]);await flush();h.hideBadge();
 s.receive([{t:'snapshot',you:[]}]);assert.match(h.badge().textContent,/Capture failed/);
});
