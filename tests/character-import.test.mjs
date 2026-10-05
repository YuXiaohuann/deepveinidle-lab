import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {importCharacter,importTypes} from '../src/character-import.js';
import {game,preset,slots} from '../src/model.js';
const fixture=()=>({version:1,capturedAt:Date.now(),player:{lastTick:100,skills:{melee:game.levelXp(37)+20,ranged:game.levelXp(82),magic:0,defence:game.levelXp(42),hitpoints:game.levelXp(51)},equipment:Object.fromEntries(slots.map(k=>[k,null])),foodItemId:game.withRarity(64,2),eatAt:.75,foodMaxTier:3,foodPerTrip:-2,brews:{warrior:200,haste:100,fed:200,rooted:99,blessing:200},brewTier:{warrior:2},house:{post:90,storeroom:4,target:50},houseFurniture:{post:{placed:true}},masteries:{xp:9,move:7},perks:{pockets:3,meals:4,rest:2},guildBonus:.12,homeBank:null,ironman:true}});
const all=importTypes.map(([id])=>id);
test('nine categories import into existing manual rules, including sparse maps and inactive buffs',()=>{
 const old=preset('ranged');old.manual.weeklyXp=17;
 const result=importCharacter(old,fixture(),all),s=result.state;
 assert.equal(result.applied.length,9);assert.equal(s.levels.melee,37);assert.equal(s.levels.ranged,82);
 assert.equal(s.style,'melee');assert.ok(slots.every(k=>s.gear[k].id===0));
 assert.deepEqual(s.food,{id:64,tier:2});assert.equal(s.eatAt,75);assert.equal(s.manual.foodPerTrip,-2);
 assert.equal(s.brews.warrior,2);assert.equal(s.brews.haste,-1);assert.equal(s.fed,true);assert.equal(s.rooted,false);
 assert.equal(s.house.post,90);assert.equal(s.house.target,0);assert.equal(s.house.storeroom,4);
 assert.equal(s.masteries.xp,9);assert.equal(s.masteries.rare,0);assert.equal(s.meals,4);
 assert.equal(s.manual.guildXp,12);assert.equal(s.manual.weeklyXp,17);assert.equal(s.manual.blessing,true);
 assert.equal(s.homeBank,0);assert.equal(s.manual.ironman,true);
 assert.ok(result.warnings.includes('guild: weeklyXp.retained'));assert.equal(old.levels.melee,85);
});
test('unselected categories are preserved and empty selection or incompatible snapshots fail atomically',()=>{
 const old=preset('ranged'),s=importCharacter(old,fixture(),['skills']).state;
 assert.deepEqual({...s,levels:old.levels},old);
 assert.throws(()=>importCharacter(old,fixture(),[]),/noTypes/);
 assert.throws(()=>importCharacter(old,{...fixture(),version:2},all),/invalidSnapshot/);
 assert.throws(()=>importCharacter(old,{...fixture(),capturedAt:Date.now()+90000},all),/invalidSnapshot/);
});
test('encoded gear retains quality and enhancement; mixed armour is exposed and unsupported slots keep original',()=>{
 const snap=fixture();snap.player.equipment.weapon=game.encode(game.withRarity(110,3),17);
 const armour=game.equipment.find(g=>g.slot==='body'&&g.style==='ranged');snap.player.equipment.body=armour.itemId;
 snap.player.equipment.mount=game.encode(game.withRarity(328,4),8);snap.player.equipment.ring=9999;
 const old=preset('ranged'),r=importCharacter(old,snap,['equipment']);
 assert.deepEqual(r.state.gear.weapon,{id:110,tier:3,plus:17});assert.deepEqual(r.state.gear.mount,{id:328,tier:4,plus:8});
 assert.equal(r.state.manual.allGear,true);assert.deepEqual(r.state.gear.ring,old.gear.ring);
 assert.ok(r.warnings.includes('equipment: equipment.ring'));
});
test('brew buckets choose current tier rather than highest stored tier; malformed buckets preserve config',()=>{
 const snap=fixture();snap.player.brews.warrior=150;snap.player.brewTier.warrior=4;snap.player.brewBuckets={warrior:[0,100,0,0,20]};
 assert.equal(importCharacter(preset('ranged'),snap,['potions']).state.brews.warrior,1);
 const old=preset('ranged');old.brews.warrior=3;snap.player.brewBuckets.warrior=[1,-1,0,0,2];
 const r=importCharacter(old,snap,['potions']);assert.equal(r.state.brews.warrior,3);assert.ok(r.warnings.includes('potions: brewBuckets.warrior'));
});
test('food priority, fountain-only and missing fields preserve unsupported choices explicitly',()=>{
 for(const [id,rule]of [[null,1],[-2,2]]){const snap=fixture();snap.player.foodItemId=id;const old=preset('ranged');assert.deepEqual(importCharacter(old,snap,['food']).state.food,old.food);assert.equal(importCharacter(old,snap,['food']).state.manual.foodRule,rule);}
 const snap=fixture();snap.player.eatAt=0;assert.equal(importCharacter(preset('ranged'),snap,['food']).state.manual.foodRule,3);
 delete snap.player.masteries;const old=preset('ranged');old.masteries.xp=13;
 const r=importCharacter(old,snap,['masteries']);assert.equal(r.state.masteries.xp,13);assert.equal(r.applied.length,0);assert.ok(r.warnings.length);
});

test('malformed sparse ranks preserve current values instead of silently resetting them',()=>{
 const old=preset('ranged');old.masteries.xp=7;old.meals=4;old.house.post=18;
 const snap=fixture();snap.player.masteries.xp=null;snap.player.perks.meals=-1;snap.player.house.post='90';
 const r=importCharacter(old,snap,['masteries','perks','home']);
 assert.equal(r.state.masteries.xp,7);assert.equal(r.state.meals,4);assert.equal(r.state.house.post,18);
 assert.ok(r.warnings.includes('masteries: masteries.xp'));assert.ok(r.warnings.includes('perks: perks.meals'));assert.ok(r.warnings.includes('home: house.post'));
});

const script=fs.readFileSync(new URL('../src/character-import.user.js',import.meta.url),'utf8');
function gameScript(save){
 const stored=[],sockets=[];class Socket{constructor(url){this.url=url;this.listeners={};sockets.push(this);}addEventListener(k,fn){this.listeners[k]=fn;}send(){throw new Error('script must never send');}}
 const page={WebSocket:Socket};let badge=null,observer,hideTimer;
 const doc={documentElement:{append(el){badge=el;}},createElement(){return {style:{},setAttribute(){},remove(){badge=null;observer();}};},getElementById(){return badge;}};
 const context={setTimeout:(fn,ms)=>{hideTimer={fn,ms};return hideTimer;},clearTimeout:()=>{hideTimer=null;},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},unsafeWindow:page,location:{origin:'https://deepveinidle.com',host:'deepveinidle.com',href:'https://deepveinidle.com/'},URL,Date,console,GM_setValue:(k,v)=>{stored.push(v);return save?.();},document:doc};
 vm.runInNewContext(script,context);
 const frame=(socket,you,t='snapshot',extra={},tick=100)=>socket.listeners.message({data:JSON.stringify({tick,m:[{t,you,chat:['private'],...extra}]})});
 return {page,sockets,stored,frame,doc,badge:()=>badge,hasHideTimer:()=>hideTimer!==undefined&&hideTimer!==null,removeBadge(){badge=null;observer();},hideBadge(){assert.equal(hideTimer.ms,15000);hideTimer.fn();}};
}
test('userscript passively observes only own-role frames and stores whitelisted configuration without chat or credentials',()=>{
 const {page,stored,frame}=gameScript(),socket=new page.WebSocket('wss://deepveinidle.com/ws?c=secret');
 const p={...fixture().player,password:'secret',token:'secret',bank:{64:100},name:'Alice'};
 frame(socket,p,'enter');assert.equal(stored.length,0);frame(socket,p,'welcome');assert.equal(stored.length,1);
 assert.equal(stored[0].player.skills.melee,p.skills.melee);assert.equal(stored[0].player.password,undefined);assert.equal(stored[0].player.bank,undefined);assert.equal(stored[0].player.name,undefined);
 assert.equal(JSON.stringify(stored).includes('secret'),false);assert.equal(JSON.stringify(stored).includes('private'),false);
 assert.equal(importCharacter(preset('ranged'),structuredClone(stored[0]),all).applied.length,9);
});
test('new connections and characters replace snapshots rather than merging previous data',()=>{
 const {page,stored,frame}=gameScript(),first=new page.WebSocket('wss://deepveinidle.com/ws');frame(first,fixture().player,'welcome');
 const second=new page.WebSocket('wss://deepveinidle.com/ws');frame(first,fixture().player);assert.equal(stored.length,1);
 frame(second,{lastTick:101,skills:{melee:0},equipment:{weapon:null}},'welcome');assert.equal(stored.length,2);assert.equal(stored[1].player.masteries,undefined);
});
class DomEvent extends Event{constructor(type,{detail}){super(type);this.detail=detail;}}
const controls=fs.readFileSync(new URL('../src/import-controls.js',import.meta.url),'utf8').replace(/^import .*;\n/,'').replaceAll('export function','function');
function simulatorWorld(document,timers={setTimeout,clearTimeout,setInterval,clearInterval}){
 const context=vm.createContext({document,window:{world:'page'},CustomEvent:DomEvent,Date,console,...timers});
 vm.runInContext(controls,context);return context;
}
function userscriptWorld(document,getValue){
 const context=vm.createContext({document,window:{world:'sandbox'},location:{origin:'http://127.0.0.1:4173'},CustomEvent:DomEvent,GM_getValue:getValue});
 vm.runInContext(script,context);return context;
}
test('shared DOM bridge works across different windows and awaits asynchronous script storage',async()=>{
 const doc=new EventTarget(),page=simulatorWorld(doc),sandbox=userscriptWorld(doc,async()=>fixture());
 assert.notEqual(page.window,sandbox.window);
 const response=await page.requestCharacter('read');assert.equal(response.snapshot.version,1);assert.equal(response.version,'1.0');
});
test('bridge ignores malformed requests and reports asynchronous storage rejection',async()=>{
 const doc=new EventTarget(),page=simulatorWorld(doc);let reads=0;
 userscriptWorld(doc,async()=>{reads++;throw new Error('storage blocked');});
 for(const detail of ['invalid JSON',JSON.stringify({source:'other',action:'read',id:'1'})])doc.dispatchEvent(new DomEvent('dvi-character-request',{detail}));
 assert.equal(reads,0);await assert.rejects(page.requestCharacter('read'),/scriptReadFailed/);
});
test('a script starting after the first probe is detected on retry, with timers stopped after success',async()=>{
 const doc=new EventTarget();let retry,timeout,clearedRetry=0,clearedTimeout=0;
 const page=simulatorWorld(doc,{setInterval:fn=>(retry=fn,1),setTimeout:fn=>(timeout=fn,2),clearInterval:()=>clearedRetry++,clearTimeout:()=>clearedTimeout++});
 const response=page.requestCharacter('probe');userscriptWorld(doc,()=>null);retry();
 assert.equal((await response).ready,true);assert.equal(clearedRetry,1);assert.equal(clearedTimeout,1);
});
test('unanswered requests fail after the bounded deadline and stop retries',async()=>{
 const doc=new EventTarget();let timeout,cleared=0;
 const page=simulatorWorld(doc,{setInterval:()=>1,setTimeout:fn=>(timeout=fn,2),clearInterval:()=>cleared++,clearTimeout(){}});
 const response=page.requestCharacter('read');timeout();await assert.rejects(response,/scriptMissing/);assert.equal(cleared,1);
});
test('capture badge survives DOM removal and displays success only after storage is complete',async()=>{
 let finish;const stored=new Promise(resolve=>finish=resolve);
 const g=gameScript(()=>stored),socket=new g.page.WebSocket('wss://deepveinidle.com/ws');
 assert.ok(g.badge());g.frame(socket,fixture().player,'welcome');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');assert.equal(g.hasHideTimer(),false);finish();await new Promise(resolve=>setImmediate(resolve));
 assert.match(g.badge().textContent,/角色配置已读取/);g.removeBadge();assert.match(g.badge().textContent,/角色配置已读取/);
 assert.equal(g.badge().id,'dvi-character-capture');
});
test('script metadata provides English and simplified Chinese names',()=>{
 assert.match(script,/^\/\/ @name:en\s+Deep Vein Idle · Character import$/m);
 assert.match(script,/^\/\/ @name:zh-cn\s+Deep Vein Idle · 角色配置导入$/m);
});

test('success badge hides after fifteen seconds without reappearing on redraws or later snapshots',async()=>{
 const g=gameScript(),socket=new g.page.WebSocket('wss://deepveinidle.com/ws');
 g.frame(socket,fixture().player,'welcome');await new Promise(resolve=>setImmediate(resolve));
 assert.match(g.badge().textContent,/角色配置已读取/);g.hideBadge();assert.equal(g.badge(),null);
 g.removeBadge();assert.equal(g.badge(),null);
 g.frame(socket,fixture().player);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(g.stored.length,2);assert.equal(g.badge(),null);
 new g.page.WebSocket('wss://deepveinidle.com/ws');assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');
 assert.match(script,/^\/\/ @version\s+1\.0$/m);
});

const weeklyWindow=(label='Weekly goal: gathered',fromTick=100,toTick=200,xpMult=1.1)=>({label,fromTick,toTick,xpMult});
test('weekly goals use inclusive server tick boundaries and additive combat XP',()=>{
 const snap=fixture();snap.worldTick=100;
 snap.worldBuffs=[weeklyWindow(),weeklyWindow('Weekly goal: felled',0,100),weeklyWindow('Weekly goal: gathered',101),weeklyWindow('Weekly goal: felled',0,99)];
 const old=preset('ranged');old.manual.weeklyXp=17;
 const r=importCharacter(old,snap,['guild']);assert.equal(r.state.manual.weeklyXp,20);assert.ok(!r.warnings.includes('guild: weeklyXp.retained'));
 assert.equal(importCharacter(old,snap,['skills']).state.manual.weeklyXp,17);
 for(const windows of [[],[weeklyWindow('Weekly goal: gathered',101)]]){snap.worldBuffs=windows;assert.equal(importCharacter(old,snap,['guild']).state.manual.weeklyXp,0);}
});
test('missing or invalid world data keeps weekly XP with an explicit warning',()=>{
 const old=preset('ranged');old.manual.weeklyXp=17;
 for(const [tick,windows]of [[undefined,[]],[100,undefined],[-1,[]],[100,[weeklyWindow('Event')]],[100,[weeklyWindow(undefined,200,100)]],[100,[weeklyWindow(undefined,0,200,NaN)]]]){
  const snap={...fixture(),worldTick:tick,worldBuffs:windows},r=importCharacter(old,snap,['guild']);
  assert.equal(r.state.manual.weeklyXp,17);assert.ok(r.warnings.includes('guild: weeklyXp.retained'));
 }
});
test('userscript captures whitelisted weekly sources and refreshes standalone world windows',()=>{
 const g=gameScript(),socket=new g.page.WebSocket('wss://deepveinidle.com/ws');
 g.frame(socket,fixture().player,'welcome',{windows:[{...weeklyWindow(),rarityMult:3,private:'secret'},weeklyWindow('Event',0,200,2)]});
 let snap=structuredClone(g.stored.at(-1));assert.deepEqual(snap.worldBuffs,[weeklyWindow()]);assert.equal(snap.worldTick,100);
 assert.equal(importCharacter(preset('ranged'),snap,['guild']).state.manual.weeklyXp,10);
 g.frame(socket,undefined,'windows',{windows:[weeklyWindow(),weeklyWindow('Weekly goal: felled')]},200);
 snap=structuredClone(g.stored.at(-1));assert.equal(snap.worldTick,200);assert.equal(importCharacter(preset('ranged'),snap,['guild']).state.manual.weeklyXp,20);
 g.frame(socket,fixture().player,'snapshot',{},201);
 assert.equal(importCharacter(preset('ranged'),structuredClone(g.stored.at(-1)),['guild']).state.manual.weeklyXp,0);
 g.frame(socket,undefined,'windows',{windows:[weeklyWindow('Event')]});assert.deepEqual(structuredClone(g.stored.at(-1).worldBuffs),[]);
 g.frame(socket,undefined,'windows',{windows:[weeklyWindow(undefined,200,100)]});assert.equal(g.stored.at(-1).worldBuffs,undefined);
 g.frame(socket,undefined,'windows',{windows:[weeklyWindow()]});g.frame(socket,undefined,'windows');assert.equal(g.stored.at(-1).worldBuffs,undefined);
 g.frame(socket,fixture().player,'welcome');assert.equal(g.stored.at(-1).worldBuffs,undefined);
 const second=new g.page.WebSocket('wss://deepveinidle.com/ws');g.frame(second,fixture().player);assert.equal(g.stored.at(-1).worldBuffs,undefined);
});

test('waiting badge persists before game data and storage, including page redraws',async()=>{
 let finish;const g=gameScript(()=>new Promise(resolve=>finish=resolve));
 assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');assert.equal(g.hasHideTimer(),false);
 g.removeBadge();assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');
 const socket=new g.page.WebSocket('wss://deepveinidle.com/ws');
 g.frame(socket,fixture().player,'enter');assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');assert.equal(g.hasHideTimer(),false);
 g.frame(socket,fixture().player,'welcome');await new Promise(resolve=>setImmediate(resolve));
 g.removeBadge();assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');assert.equal(g.hasHideTimer(),false);
 finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(g.badge().textContent,'角色配置已读取 / Character configuration captured');
 g.hideBadge();assert.equal(g.badge(),null);
});
test('an old connection completing storage cannot dismiss the new connection waiting badge',async()=>{
 let finish;const g=gameScript(()=>new Promise(resolve=>finish=resolve));
 const first=new g.page.WebSocket('wss://deepveinidle.com/ws');g.frame(first,fixture().player,'welcome');
 new g.page.WebSocket('wss://deepveinidle.com/ws');finish();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');assert.equal(g.hasHideTimer(),false);
});
