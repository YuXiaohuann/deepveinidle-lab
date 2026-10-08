import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {importCharacter} from '../src/character-import.js';
import {game,preset,slots,normalize} from '../src/model.js';
const fixture=()=>({version:2,capturedAt:Date.now(),player:{lastTick:100,skills:{melee:game.levelXp(37)+20,ranged:game.levelXp(82),magic:0,defence:game.levelXp(42),hitpoints:game.levelXp(51)},equipment:Object.fromEntries(slots.map(k=>[k,null])),foodItemId:game.withRarity(64,2),eatAt:.75,foodMaxTier:3,foodPerTrip:-2,brews:{warrior:200,haste:100,fed:200,rooted:99,blessing:200},brewTier:{warrior:2},house:{post:90,storeroom:4,target:50},houseFurniture:{post:{placed:true}},masteries:{xp:9,move:7},perks:{pockets:3,meals:4,rest:2},guildBonus:.12,homeBank:null,ironman:true}});
test('nine categories import into existing manual rules, including sparse maps and inactive buffs',()=>{
 const old=preset('ranged');old.manual.weeklyXp=17;old.manual.simulationHours=6;old.manual.customSimulation=true;old.manual.hotSetting='off';
 const result=importCharacter(old,fixture()),s=result.state;
 assert.equal(result.applied.length,9);assert.equal(s.levels.melee,37);assert.equal(s.levels.ranged,82);
 assert.equal(s.style,'melee');assert.ok(slots.every(k=>s.gear[k].id===0));
 assert.deepEqual(s.food,{id:64,tier:2});assert.equal(s.eatAt,75);assert.equal(s.manual.foodPerTrip,-2);
 assert.equal(s.brews.warrior,2);assert.equal(s.brews.haste,-1);assert.equal(s.fed,true);assert.equal(s.rooted,false);
 assert.equal(s.house.post,90);assert.equal(s.house.target,0);assert.equal(s.house.storeroom,4);
 assert.equal(s.masteries.xp,9);assert.equal(s.masteries.rare,0);assert.equal(s.meals,4);
 assert.equal(s.manual.guildXp,12);assert.equal(s.manual.weeklyXp,17);assert.equal(s.manual.blessing,true);
 assert.equal(s.homeBank,0);assert.equal(s.manual.ironman,true);
 assert.equal(s.manual.simulationHours,6);assert.equal(s.manual.customSimulation,true);assert.equal(s.manual.hotSetting,'off');
 assert.ok(result.warnings.includes('guild: weeklyXp.retained'));assert.equal(old.levels.melee,85);
});
test('configuration import always covers all categories and rejects incompatible data atomically',()=>{
 const old=preset('ranged'),r=importCharacter(old,fixture());assert.equal(r.applied.length,9);
 assert.throws(()=>importCharacter(old,{...fixture(),version:1}),/invalidSnapshot/);
 assert.throws(()=>importCharacter(old,{...fixture(),capturedAt:Date.now()+90000}),/invalidSnapshot/);
 assert.equal(old.levels.melee,85);
});
test('encoded gear retains quality and enhancement; mixed armour is exposed and unsupported slots keep original',()=>{
 const snap=fixture();snap.player.equipment.weapon=game.encode(game.withRarity(110,3),17);
 const armour=game.equipment.find(g=>g.slot==='body'&&g.style==='ranged');snap.player.equipment.body=armour.itemId;
 snap.player.equipment.mount=game.encode(game.withRarity(328,4),8);snap.player.equipment.ring=9999;
 const old=preset('ranged'),r=importCharacter(old,snap);
 assert.deepEqual(r.state.gear.weapon,{id:110,tier:3,plus:17});assert.deepEqual(r.state.gear.mount,{id:328,tier:4,plus:8});
 assert.equal(r.state.manual.allGear,true);assert.deepEqual(r.state.gear.ring,old.gear.ring);
 assert.ok(r.warnings.includes('equipment: equipment.ring'));
});
test('brew buckets choose current tier rather than highest stored tier; malformed buckets preserve config',()=>{
 const snap=fixture();snap.player.brews.warrior=150;snap.player.brewTier.warrior=4;snap.player.brewBuckets={warrior:[0,100,0,0,20]};
 assert.equal(importCharacter(preset('ranged'),snap).state.brews.warrior,1);
 const old=preset('ranged');old.brews.warrior=3;snap.player.brewBuckets.warrior=[1,-1,0,0,2];
 const r=importCharacter(old,snap);assert.equal(r.state.brews.warrior,3);assert.ok(r.warnings.includes('potions: brewBuckets.warrior'));
});
test('food priority, fountain-only and missing fields preserve unsupported choices explicitly',()=>{
 for(const [id,rule]of [[null,1],[-2,2]]){const snap=fixture();snap.player.foodItemId=id;const old=preset('ranged');assert.deepEqual(importCharacter(old,snap).state.food,old.food);assert.equal(importCharacter(old,snap).state.manual.foodRule,rule);}
 const snap=fixture();snap.player.eatAt=0;assert.equal(importCharacter(preset('ranged'),snap).state.manual.foodRule,3);
 delete snap.player.masteries;const old=preset('ranged');old.masteries.xp=13;
 const r=importCharacter(old,snap);assert.equal(r.state.masteries.xp,13);assert.ok(!r.applied.includes('masteries'));assert.ok(r.warnings.length);
});

test('malformed sparse ranks preserve current values instead of silently resetting them',()=>{
 const old=preset('ranged');old.masteries.xp=7;old.meals=4;old.house.post=18;
 const snap=fixture();snap.player.masteries.xp=null;snap.player.perks.meals=-1;snap.player.house.post='90';
 const r=importCharacter(old,snap);
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
test('userscript passively captures complete own-role data without chat or credentials',async()=>{
 const {page,stored,frame}=gameScript(),socket=new page.WebSocket('wss://deepveinidle.com/ws?c=secret');
 const p={...fixture().player,password:'secret',token:'secret',bank:{64:100},name:'Alice'};
 frame(socket,p,'enter');assert.equal(stored.length,0);frame(socket,p,'welcome');await new Promise(resolve=>setImmediate(resolve));assert.equal(stored.length,1);assert.equal(stored[0].prediction,undefined);
 assert.equal(stored[0].player.skills.melee,p.skills.melee);assert.equal(stored[0].player.password,undefined);assert.deepEqual(JSON.parse(JSON.stringify(stored[0].player.bank)),{64:100});assert.equal(stored[0].player.name,'Alice');
 assert.equal(JSON.stringify(stored).includes('secret'),false);assert.equal(JSON.stringify(stored).includes('private'),false);
 assert.equal(importCharacter(preset('ranged'),structuredClone(stored[0])).applied.length,9);
});
test('new connections and characters replace snapshots rather than merging previous data',async()=>{
 const {page,stored,frame}=gameScript(),first=new page.WebSocket('wss://deepveinidle.com/ws');frame(first,fixture().player,'welcome');await new Promise(resolve=>setImmediate(resolve));
 const second=new page.WebSocket('wss://deepveinidle.com/ws');frame(first,fixture().player);assert.equal(stored.length,1);
 frame(second,{lastTick:101,skills:{melee:0},equipment:{weapon:null}},'welcome');await new Promise(resolve=>setImmediate(resolve));assert.equal(stored.length,2);assert.equal(stored[1].player.masteries,undefined);
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
 const response=await page.requestCharacter('read');assert.equal(response.snapshot.version,2);assert.equal(response.version,'2.4');
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
 assert.equal(g.badge().textContent,'角色配置已读取 / Character captured');g.removeBadge();assert.match(g.badge().textContent,/角色配置已读取/);
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
 assert.match(script,/^\/\/ @version\s+2\.4$/m);
});

const weeklyWindow=(label='Weekly goal: gathered',fromTick=100,toTick=200,xpMult=1.1)=>({label,fromTick,toTick,xpMult});
test('weekly goals use inclusive server tick boundaries and additive combat XP',()=>{
 const snap=fixture();snap.worldTick=100;
 snap.worldBuffs=[weeklyWindow(),weeklyWindow('Weekly goal: felled',0,100),weeklyWindow('Weekly goal: gathered',101),weeklyWindow('Weekly goal: felled',0,99)];
 const old=preset('ranged');old.manual.weeklyXp=17;
 const r=importCharacter(old,snap);assert.equal(r.state.manual.weeklyXp,20);assert.ok(!r.warnings.includes('guild: weeklyXp.retained'));
 assert.equal(importCharacter(old,snap).state.manual.weeklyXp,20);
 for(const windows of [[],[weeklyWindow('Weekly goal: gathered',101)]]){snap.worldBuffs=windows;assert.equal(importCharacter(old,snap).state.manual.weeklyXp,0);}
});
test('missing or invalid world data keeps weekly XP with an explicit warning',()=>{
 const old=preset('ranged');old.manual.weeklyXp=17;
 for(const [tick,windows]of [[undefined,[]],[100,undefined],[-1,[]],[100,[weeklyWindow(undefined,200,100)]],[100,[weeklyWindow(undefined,0,200,NaN)]]]){
  const snap={...fixture(),worldTick:tick,worldBuffs:windows},r=importCharacter(old,snap);
  assert.equal(r.state.manual.weeklyXp,17);assert.ok(r.warnings.includes('guild: weeklyXp.retained'));
 }
});
test('userscript captures complete world windows and refreshes standalone windows',async()=>{
 const g=gameScript(),socket=new g.page.WebSocket('wss://deepveinidle.com/ws');
 g.frame(socket,fixture().player,'welcome',{seed:42,windows:[weeklyWindow(),weeklyWindow('Event',0,200,2)]});
 await new Promise(resolve=>setImmediate(resolve));
 let snap=structuredClone(g.stored.at(-1));assert.equal(snap.worldBuffs.length,2);assert.equal(snap.worldTick,100);
 assert.equal(importCharacter(preset('ranged'),snap).state.manual.weeklyXp,10);
 g.frame(socket,undefined,'windows',{windows:[weeklyWindow(),weeklyWindow('Weekly goal: felled')]},200);
 await new Promise(resolve=>setImmediate(resolve));snap=structuredClone(g.stored.at(-1));assert.equal(importCharacter(preset('ranged'),snap).state.manual.weeklyXp,20);
 g.frame(socket,fixture().player,'welcome');await new Promise(resolve=>setImmediate(resolve));assert.equal(g.stored.at(-1).worldBuffs,undefined);
});

test('waiting badge persists before game data and storage, including page redraws',async()=>{
 let finish;const g=gameScript(()=>new Promise(resolve=>finish=resolve));
 assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');assert.equal(g.hasHideTimer(),false);
 g.removeBadge();assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');
 const socket=new g.page.WebSocket('wss://deepveinidle.com/ws');
 g.frame(socket,fixture().player,'enter');assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');assert.equal(g.hasHideTimer(),false);
 g.frame(socket,fixture().player,'welcome');await new Promise(resolve=>setImmediate(resolve));
 g.removeBadge();assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');assert.equal(g.hasHideTimer(),false);
 finish();await new Promise(resolve=>setImmediate(resolve));assert.match(g.badge().textContent,/角色配置已读取/);
 g.hideBadge();assert.equal(g.badge(),null);
});
test('an old connection completing storage cannot dismiss the new connection waiting badge',async()=>{
 let finish;const g=gameScript(()=>new Promise(resolve=>finish=resolve));
 const first=new g.page.WebSocket('wss://deepveinidle.com/ws');g.frame(first,fixture().player,'welcome');
 await new Promise(resolve=>setImmediate(resolve));new g.page.WebSocket('wss://deepveinidle.com/ws');finish();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');assert.equal(g.hasHideTimer(),false);
});

test('capture storage is serialized so a late old connection cannot overwrite a new character',async()=>{
 let release;const g=gameScript(()=>new Promise(resolve=>release=resolve));
 const first=new g.page.WebSocket('wss://deepveinidle.com/ws');g.frame(first,fixture().player,'welcome');await new Promise(resolve=>setImmediate(resolve));
 const second=new g.page.WebSocket('wss://deepveinidle.com/ws');const next=fixture().player;next.skills.melee=999;g.frame(second,next,'welcome');
 assert.equal(g.stored.length,1);release();await new Promise(resolve=>setImmediate(resolve));assert.equal(g.stored.at(-1).player.skills.melee,999);release();
});

test('old bridge replies do not win over the current script and are reported if no update answers',async()=>{
 const doc=new EventTarget();let timeout;
 const page=simulatorWorld(doc,{setInterval:()=>1,setTimeout:fn=>(timeout=fn,2),clearInterval(){},clearTimeout(){}});
 doc.addEventListener('dvi-character-request',event=>{const request=JSON.parse(event.detail);doc.dispatchEvent(new DomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',id:request.id,version:'2.1',snapshot:fixture()})}));});
 const old=page.requestCharacter('read');timeout();await assert.rejects(old,/scriptOutdated/);
 userscriptWorld(doc,async()=>fixture());const current=await page.requestCharacter('read');assert.equal(current.version,'2.4');
});

test('both panels share one probe and common bilingual status messages',async()=>{
 const doc=new EventTarget(),page=simulatorWorld(doc);let probes=0;
 doc.addEventListener('dvi-character-request',event=>{if(JSON.parse(event.detail).action==='probe')probes++;});
 userscriptWorld(doc,()=>null);
 const first=page.probeCharacter(),second=page.probeCharacter();assert.equal(first,second);assert.equal((await first).ready,true);assert.equal(probes,1);
 for(const language of ['zh','en']){
  assert.equal(page.importStatusText(language,null),'');
  assert.match(page.importStatusText(language,{ready:true}),language==='zh'?/脚本已连接/:/Script connected/);
  assert.match(page.importStatusText(language,{ready:true},true),language==='zh'?/正在读取角色配置/:/Reading character configuration/);
  assert.match(page.importStatusText(language,{capturedAt:1700000000000}),language==='zh'?/已导入 · 读取时间/:/Imported · Captured/);
  assert.match(page.importStatusText(language,{snapshot:true,capturedAt:1700000000000}),language==='zh'?/临时快照/:/Temporary snapshot/);
  for(const error of ['incompatibleClient','predictionMissing','scriptMissing','scriptOutdated','scriptReadFailed','noSnapshot','invalidSnapshot','incompleteSnapshot'])assert.notEqual(page.importStatusText(language,{error}),error);
  assert.equal(page.importStatusText(language,{error:'unexpected detail'}),'unexpected detail');
 }
});


test('combat import controls omit snapshot action and explanation in both languages',()=>{
 const page=simulatorWorld(new EventTarget());
 for(const language of ['zh','en']){
  const html=page.importControls(language);
  assert.match(html,/id="import-character"/);
  assert.doesNotMatch(html,/import-snapshot|导入快照|Import snapshot/);
 }
 assert.doesNotMatch(script,/auditedBuilds|predictorRead|observePlayer|page.JSON/);
});

test('debug and configuration bridges read independent storage and debug bridge only activates on debug path',async()=>{
 const debugScript=fs.readFileSync(new URL('../src/debug-capture.user.js',import.meta.url),'utf8');
 const doc=new EventTarget(),page=simulatorWorld(doc);const keys=[];
 userscriptWorld(doc,async key=>{keys.push(key);return {kind:'config'};});
 vm.runInNewContext(debugScript,{document:doc,location:{origin:'http://127.0.0.1:4173',pathname:'/debug'},CustomEvent:DomEvent,GM_getValue:async key=>{keys.push(key);return {kind:'debug'};}});
 const config=await page.requestCharacter('read'),debug=await page.requestCharacter('read',true);
 assert.equal(config.snapshot.kind,'config');assert.equal(debug.snapshot.kind,'debug');
 assert.deepEqual(keys,['dvi-character-snapshot-v2','dvi-debug-snapshot-v2']);
 const otherDoc=new EventTarget();let timeout,reads=0;
 const otherPage=simulatorWorld(otherDoc,{setInterval:()=>1,setTimeout:fn=>(timeout=fn,2),clearInterval(){},clearTimeout(){}});
 vm.runInNewContext(debugScript,{document:otherDoc,location:{origin:'http://127.0.0.1:4173',pathname:'/'},CustomEvent:DomEvent,GM_getValue:()=>{reads++;}});
 const missing=otherPage.requestCharacter('read',true);timeout();await assert.rejects(missing,/debugScriptMissing/);assert.equal(reads,0);
 otherDoc.addEventListener('dvi-debug-request',event=>{const request=JSON.parse(event.detail);otherDoc.dispatchEvent(new DomEvent('dvi-debug-response',{detail:JSON.stringify({source:'dvi-debug-script',id:request.id,version:'0.9'})}));});
 const outdated=otherPage.requestCharacter('read',true);timeout();await assert.rejects(outdated,/debugScriptOutdated/);
 for(const language of ['zh','en'])for(const error of ['debugScriptMissing','debugScriptOutdated','debugScriptReadFailed','debugNoSnapshot'])assert.notEqual(page.importStatusText(language,{error}),error);
});

test('hidden guild identity survives save/load, clears old imports and rejects malformed identities',()=>{
 const guild={name:'Deep miners',tag:'DM',members:[{name:'private'}],chat:['private']};
 const old=preset('melee'),snap={...fixture(),guild};
 const imported=importCharacter(old,snap).state;
 assert.deepEqual(imported.guild,{name:guild.name,tag:guild.tag});
 assert.deepEqual(normalize(JSON.parse(JSON.stringify(imported))).guild,imported.guild);
 assert.equal(importCharacter(imported,fixture()).state.guild,null);
 assert.equal(importCharacter(imported,{...fixture(),guild:null}).state.guild,null);
 for(const guild of [false,[],{}, {name:'Guild',tag:4}])assert.throws(()=>importCharacter(imported,{...fixture(),guild}),/invalidSnapshot/);
 assert.deepEqual(imported.guild,{name:'Deep miners',tag:'DM'});
});
test('userscript captures guild welcome/updates/leave and isolates connections without private guild data',async()=>{
 const g=gameScript(),first=new g.page.WebSocket('wss://deepveinidle.com/ws');
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 g.frame(first,fixture().player,'welcome',{guild:{name:'First',tag:'ONE',members:['private'],chat:['private']}});await flush();
 assert.deepEqual(JSON.parse(JSON.stringify(g.stored.at(-1).guild)),{name:'First',tag:'ONE'});
 g.frame(first,fixture().player);await flush();assert.equal(g.stored.at(-1).guild.name,'First');
 g.frame(first,undefined,'guild',{info:{name:'Second',tag:'TWO',bank:['private']}});await flush();assert.equal(g.stored.at(-1).guild.name,'Second');
 g.frame(first,undefined,'guild',{info:null});await flush();assert.equal(g.stored.at(-1).guild,null);
 const second=new g.page.WebSocket('wss://deepveinidle.com/ws');
 g.frame(second,fixture().player,'welcome');await flush();
 g.frame(first,undefined,'guild',{info:{name:'Stale',tag:'OLD'}});await flush();assert.equal(g.stored.at(-1).guild,null);
 assert.equal(JSON.stringify(g.stored).includes('private'),false);
});
