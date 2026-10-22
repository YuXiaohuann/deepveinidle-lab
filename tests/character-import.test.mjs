import {createCharacterUpdater} from '../src/character-auto-import.js';
import {readCharacterInventory} from '../src/character-inventory.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {captureHarness} from './helpers/capture-harness.mjs';
import {importCharacter,importWarningText} from '../src/character-import.js';
import {game,defaults,preset,slots,normalize} from '../src/model.js';
const fixture=()=>({version:2,worldBuffsVersion:1,capturedAt:Date.now(),player:{lastTick:100,skills:{melee:game.levelXp(37)+20,ranged:game.levelXp(82),magic:0,defence:game.levelXp(42),hitpoints:game.levelXp(51)},equipment:Object.fromEntries(slots.map(k=>[k,null])),foodItemId:game.withRarity(64,2),eatAt:.75,foodMaxTier:3,foodPerTrip:-2,brews:{warrior:200,haste:100,fed:200,rooted:99,blessing:200},brewTier:{warrior:2},house:{post:90,storeroom:4,target:50},houseFurniture:{post:{placed:true}},masteries:{xp:9,move:7},perks:{pockets:3,meals:4,rest:2},guildBonus:.12,homeBank:null,ironman:true}});
test('nine categories import into existing manual rules, including sparse maps and inactive buffs',()=>{
 const old=preset('ranged');old.manual.weeklyXp=17;old.manual.simulationHours=6;old.manual.customSimulation=true;old.manual.hotSetting='off';old.manual.enemySelection=`monster-${game.monsters[0].id}`;old.manual.vendorValues=true;old.manual.valuationMode='vendor';
 const result=importCharacter(old,fixture()),s=result.state;
 assert.equal(result.applied.length,9);assert.equal(s.levels.melee,37);assert.equal(s.levels.ranged,82);
 assert.equal(s.style,'melee');assert.ok(slots.every(k=>s.gear[k].id===0));
 assert.deepEqual(s.food,{id:64,tier:2});assert.equal(s.eatAt,75);assert.equal(s.manual.foodPerTrip,-2);
 assert.equal(s.brews.warrior,2);assert.equal(s.brews.haste,-1);assert.equal(s.fed,true);assert.equal(s.rooted,false);
 assert.equal(s.house.post,90);assert.equal(s.house.target,0);assert.equal(s.house.storeroom,4);
 assert.equal(s.masteries.xp,9);assert.equal(s.masteries.rare,0);assert.equal(s.meals,4);
 assert.equal(s.manual.guildXp,12);assert.equal(s.manual.weeklyXp,0);assert.equal(s.manual.blessing,true);
 assert.equal(s.homeBank,0);assert.equal(s.manual.ironman,true);
 assert.equal(s.manual.simulationHours,6);assert.equal(s.manual.customSimulation,true);assert.equal(s.manual.hotSetting,'off');assert.equal(s.manual.enemySelection,old.manual.enemySelection);assert.equal(s.manual.vendorValues,true);
 assert.ok(result.warnings.includes('guild: weeklyXp.reset'));assert.equal(old.levels.melee,85);
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
 assert.equal(r.state.manual.allGear,true);assert.deepEqual(r.state.gear.ring,defaults().gear.ring);
 assert.ok(r.warnings.includes('equipment: equipment.ring'));
});
test('brew buckets choose current tier rather than highest stored tier; malformed buckets reset config',()=>{
 const snap=fixture();snap.player.brews.warrior=150;snap.player.brewTier.warrior=4;snap.player.brewBuckets={warrior:[0,100,0,0,20]};
 assert.equal(importCharacter(preset('ranged'),snap).state.brews.warrior,1);
 const old=preset('ranged');old.brews.warrior=3;snap.player.brewBuckets.warrior=[1,-1,0,0,2];
 const r=importCharacter(old,snap);assert.equal(r.state.brews.warrior,-1);assert.ok(r.warnings.includes('potions: brewBuckets.warrior'));
});
test('food priority, fountain-only and missing fields preserve unsupported choices explicitly',()=>{
 for(const [id,rule]of [[null,1],[-2,2]]){const snap=fixture();snap.player.foodItemId=id;const old=preset('ranged');assert.deepEqual(importCharacter(old,snap).state.food,old.food);assert.equal(importCharacter(old,snap).state.manual.foodRule,rule);}
 const snap=fixture();snap.player.eatAt=0;assert.equal(importCharacter(preset('ranged'),snap).state.manual.foodRule,3);
 delete snap.player.masteries;const old=preset('ranged');old.masteries.xp=13;
 const r=importCharacter(old,snap);assert.equal(r.state.masteries.xp,0);assert.ok(!r.applied.includes('masteries'));assert.ok(r.warnings.length);
});

test('malformed sparse ranks reset to defaults with explicit warnings',()=>{
 const old=preset('ranged');old.masteries.xp=7;old.meals=4;old.house.post=18;
 const snap=fixture();snap.player.masteries.xp=null;snap.player.perks.meals=-1;snap.player.house.post='90';
 const r=importCharacter(old,snap);
 assert.equal(r.state.masteries.xp,0);assert.equal(r.state.meals,0);assert.equal(r.state.house.post,0);
 assert.ok(r.warnings.includes('masteries: masteries.xp'));assert.ok(r.warnings.includes('perks: perks.meals'));assert.ok(r.warnings.includes('home: house.post'));
});

const script=fs.readFileSync(new URL('../src/character-import.user.js',import.meta.url),'utf8');
function gameScript(save){
 const h=captureHarness((key,value)=>key==='dvi-character-snapshot-v2'?save?.():undefined),stored=[];
 const original=h.context.GM_setValue;
 h.context.GM_setValue=(key,value)=>{if(key==='dvi-character-snapshot-v2')stored.push(structuredClone(value));return original(key,value);};
 const frame=(socket,you,t='snapshot',extra={},tick=100)=>socket.receive([{t,you,chat:['private'],...extra}],tick);
 return {...h,stored,frame,doc:h.context.document,hasHideTimer:()=>/captured/i.test(h.badge()?.textContent??'')&&[...h.timers.values()].some(t=>t.ms===5000)};
}
test('userscript captures required own-role fields without unrelated data or credentials',async()=>{
 const {page,stored,frame}=gameScript(),socket=new page.WebSocket('wss://deepveinidle.com/ws?c=secret');
 const p={...fixture().player,password:'secret',token:'secret',bank:{64:100},name:'Alice'};
 frame(socket,p,'enter');assert.equal(stored.length,0);frame(socket,p,'welcome');await new Promise(resolve=>setImmediate(resolve));assert.equal(stored.length,1);assert.equal(stored[0].prediction,undefined);
 assert.equal(stored[0].player.skills.melee,p.skills.melee);assert.equal(stored[0].player.password,undefined);assert.deepEqual(JSON.parse(JSON.stringify(stored[0].player.bank)),{64:100});assert.equal(stored[0].player.name,undefined);
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

test('success badge hides after five seconds without reappearing on redraws or later snapshots',async()=>{
 const g=gameScript(),socket=new g.page.WebSocket('wss://deepveinidle.com/ws');
 g.frame(socket,fixture().player,'welcome');await new Promise(resolve=>setImmediate(resolve));
 assert.match(g.badge().textContent,/角色配置已读取/);g.hideBadge();assert.equal(g.badge(),null);
 g.removeBadge();assert.equal(g.badge(),null);
 g.frame(socket,fixture().player);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(g.stored.length,2);assert.equal(g.badge(),null);
 new g.page.WebSocket('wss://deepveinidle.com/ws');assert.equal(g.badge().textContent,'等待游戏数据 / Waiting for game data');
 assert.match(script,/^\/\/ @version\s+2\.9\.0$/m);
});

const weeklyWindow=(label='Weekly goal: gathered',fromTick=100,toTick=200,xpMult=1.1)=>({label,fromTick,toTick,xpMult});
test('weekly goals use inclusive server tick boundaries and additive combat XP',()=>{
 const snap=fixture();snap.worldTick=100;
 snap.worldBuffs=[weeklyWindow(),weeklyWindow('Weekly goal: felled',0,100),weeklyWindow('Weekly goal: gathered',101),weeklyWindow('Weekly goal: felled',0,99)];
 const old=preset('ranged');old.manual.weeklyXp=17;
 const r=importCharacter(old,snap);assert.equal(r.state.manual.weeklyXp,20);assert.ok(!r.warnings.includes('guild: weeklyXp.reset'));
 assert.equal(importCharacter(old,snap).state.manual.weeklyXp,20);
 for(const windows of [[],[weeklyWindow('Weekly goal: gathered',101)]]){snap.worldBuffs=windows;assert.equal(importCharacter(old,snap).state.manual.weeklyXp,0);}
});
test('missing or invalid world data resets weekly XP with an explicit warning',()=>{
 const old=preset('ranged');old.manual.weeklyXp=17;
 for(const [tick,windows]of [[undefined,[]],[100,undefined],[-1,[]],[100,[weeklyWindow(undefined,200,100)]],[100,[weeklyWindow(undefined,0,200,NaN)]]]){
  const snap={...fixture(),worldTick:tick,worldBuffs:windows},r=importCharacter(old,snap);
  assert.equal(r.state.manual.weeklyXp,0);assert.ok(r.warnings.includes('guild: weeklyXp.reset'));
 }
});
test('userscript captures complete world windows and refreshes standalone windows',async()=>{
 const g=gameScript(),socket=new g.page.WebSocket('wss://deepveinidle.com/ws');
 g.frame(socket,fixture().player,'welcome',{seed:42,windows:[weeklyWindow(),weeklyWindow('Event',0,200,2)]});
 await new Promise(resolve=>setImmediate(resolve));
 let snap=structuredClone(g.stored.at(-1));assert.equal(snap.worldBuffs.length,2);assert.equal(snap.worldTick,100);
 assert.equal(importCharacter(preset('ranged'),snap).state.manual.weeklyXp,110);
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
  for(const error of ['scriptMissing','scriptOutdated','scriptReadFailed','noSnapshot','invalidSnapshot','incompleteSnapshot'])assert.notEqual(page.importStatusText(language,{error}),error);
  assert.equal(page.importStatusText(language,{error:'unexpected detail'}),'unexpected detail');
 }
});


test('combat import controls omit snapshot action and explanation in both languages',()=>{
 const page=simulatorWorld(new EventTarget());
 for(const language of ['zh','en']){
  const html=page.importControls(language);
  assert.match(html,/id="import-character"/);
  assert.match(html,/<details[^>]+id="character-import-settings" open>/);
  assert.doesNotMatch(html,/import-snapshot|导入快照|Import snapshot/);
 }
 assert.doesNotMatch(script,/auditedBuilds|predictorRead|observePlayer|page.JSON/);
});

test('ordinary character requests ignore former debug responses and keep waiting for the role bridge',async()=>{
 const doc=new EventTarget();let timeout;
 const page=simulatorWorld(doc,{setInterval:()=>1,setTimeout:fn=>(timeout=fn,2),clearInterval(){},clearTimeout(){}});
 doc.addEventListener('dvi-character-request',event=>{
  const request=JSON.parse(event.detail);
  const detail=JSON.stringify({source:'dvi-debug-script',id:request.id,version:'2.4',snapshot:fixture()});
  doc.dispatchEvent(new DomEvent('dvi-character-response',{detail}));
  doc.dispatchEvent(new DomEvent('dvi-debug-response',{detail}));
 });
 const pending=page.requestCharacter('read');timeout();await assert.rejects(pending,/scriptMissing/);
});

test('hidden guild identity survives save/load, clears old imports and resets malformed identities',()=>{
 const guild={name:'Deep miners',tag:'DM',members:[{name:'private'}],chat:['private']};
 const old=preset('melee'),snap={...fixture(),guild};
 const imported=importCharacter(old,snap).state;
 assert.deepEqual(imported.guild,{name:guild.name,tag:guild.tag});
 assert.deepEqual(normalize(JSON.parse(JSON.stringify(imported))).guild,imported.guild);
 assert.equal(importCharacter(imported,fixture()).state.guild,null);
 assert.equal(importCharacter(imported,{...fixture(),guild:null}).state.guild,null);
 for(const guild of [false,[],{}, {name:'Guild',tag:4}]){
  const result=importCharacter(imported,{...fixture(),guild});assert.equal(result.state.guild,null);assert.ok(result.warnings.includes('guild: guild'));
 }
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

test('partial imports retain simulation settings and unavailable food fields while resetting other settings',()=>{
 const old=preset('magic');
 old.guild={name:'SakuraSpring',tag:'SAKI'};old.eatAt=75;old.fed=true;old.rooted=true;
 old.manual.foodRule=2;old.manual.foodMaxTier=2;old.manual.foodPerTrip=10;
 old.manual.enemySelection=`monster-${game.monsters[0].id}`;old.manual.simulationHours=6.5;old.manual.customSimulation=true;old.manual.hotSetting='off';old.manual.vendorValues=true;old.manual.valuationMode='vendor';old.manual.allGear=true;
 old.manual.guildXp=20;old.manual.weeklyXp=17;old.manual.blessing=true;old.manual.ironman=true;old.homeBank=2;
 old.brews.warrior=4;old.brews.gatherer=4;old.house.post=90;old.house.mine=50;old.masteries.xp=7;old.masteries.gather=8;old.meals=4;old.manual.perks.rest=3;
 const before=structuredClone(old),expected=defaults();
 for(const key of ['food','eatAt','fed','rooted'])expected[key]=structuredClone(old[key]);
 for(const key of ['foodRule','foodMaxTier','foodPerTrip','enemySelection','simulationHours','customSimulation','hotSetting','vendorValues','valuationMode'])expected.manual[key]=old.manual[key];
 const result=importCharacter(old,{version:2,capturedAt:Date.now(),player:{lastTick:100}});
 assert.deepEqual(result.state,normalize(expected));assert.deepEqual(old,before);
 assert.deepEqual(normalize(JSON.parse(JSON.stringify(result.state))),result.state);
 assert.ok(result.warnings.includes('skills: skills.melee'));assert.ok(result.warnings.includes('equipment: equipment'));
});
test('invalid food fields preserve existing food settings while valid food fields still import',()=>{
 const old=preset('ranged');old.eatAt=75;old.fed=true;old.rooted=true;
 old.manual.foodRule=2;old.manual.foodMaxTier=2;old.manual.foodPerTrip=10;
 const snap=fixture();snap.player.foodItemId=999999;snap.player.eatAt=.9;snap.player.foodMaxTier=-1;snap.player.foodPerTrip=7;snap.player.brews.fed=-1;snap.player.brews.rooted=-1;
 const result=importCharacter(old,snap).state;
 for(const key of ['food','eatAt','fed','rooted'])assert.deepEqual(result[key],old[key]);
 for(const key of ['foodRule','foodMaxTier','foodPerTrip'])assert.equal(result.manual[key],old.manual[key]);
 const valid=importCharacter(old,fixture()).state;
 assert.deepEqual(valid.food,{id:64,tier:2});assert.equal(valid.eatAt,75);assert.equal(valid.manual.foodRule,0);assert.equal(valid.manual.foodMaxTier,3);assert.equal(valid.manual.foodPerTrip,-2);
 assert.equal(valid.fed,true);assert.equal(valid.rooted,false);
});
test('imports recalculate mixed gear toggle and whole-import failures never clear current settings',()=>{
 const old=preset('ranged');old.manual.allGear=true;old.manual.vendorValues=true;old.manual.valuationMode='vendor';old.manual.simulationHours=24;
 assert.equal(importCharacter(old,fixture()).state.manual.allGear,false);
 const before=structuredClone(old);
 for(const patch of [{version:1},{capturedAt:Date.now()+90000},{player:null}])assert.throws(()=>importCharacter(old,{...fixture(),...patch}),/invalidSnapshot/);
 assert.deepEqual(old,before);
});

test('food buffs import independently when only one value is invalid',()=>{
 const old=preset('ranged');old.fed=true;old.rooted=true;
 const snap=fixture();snap.player.brews.fed=-1;
 const result=importCharacter(old,snap);
 assert.equal(result.state.fed,true);assert.equal(result.state.rooted,false);
 assert.ok(result.warnings.includes('food: food.fed'));
});

test('import warning text separates food and groups other failed categories without internal field names',()=>{
 assert.equal(importWarningText('zh',[]),'');
 assert.equal(importWarningText('zh',['food: foodItemId','food: eatAt']), '【食物】部分配置未导入，已保留原值，请手动检查');
 assert.equal(importWarningText('zh',['equipment: equipment.ring','skills: skills.magic','equipment: equipment.weapon']), '【技能、装备】导入失败，请手动配置');
 const warnings=['potions: brewBuckets.warrior','food: foodItemId','guild: weeklyXp.reset','potions: brews'];
 assert.equal(importWarningText('zh',warnings),'【食物】部分配置未导入，已保留原值，请手动检查\n【药水、公会与祝福】导入失败，请手动配置');
 assert.equal(importWarningText('en',warnings),'[Food] Some settings were not imported; previous values were kept. Please check manually.\n[Potions, Guild & blessing] import failed. Please configure manually.');
});


test('automatic food import follows native warehouse selection and keeps simulation strategy',()=>{
 const old=preset('ranged'),snap=fixture(),normal=64,rare=game.withRarity(64,2);
 snap.player.bank={[normal]:10,[rare]:20};
 for(const [strategy,expected,rule] of [[null,rare,1],[0,rare,1],[-2,normal,2]]){
  snap.player.foodItemId=strategy;
  const result=importCharacter(old,snap);
  assert.deepEqual(result.state.food,{id:64,tier:game.itemTier(expected)});
  assert.equal(result.state.manual.foodRule,rule);
  assert.equal(result.warnings.some(w=>w.startsWith('food:')),false);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(result.state))),result.state);
 }
 snap.player.foodItemId=null;snap.player.foodMaxTier=0;
 assert.deepEqual(importCharacter(old,snap).state.food,{id:64,tier:0});
 assert.deepEqual(old,preset('ranged'));
});

test('automatic food failures retain selection and still import independent fields',()=>{
 const old=preset('ranged');old.food={id:64,tier:4};
 for(const [bank,warning] of [[undefined,'food.bankMissing'],[{},'food.noCandidate'],[{64:0},'food.noCandidate'],[{64:-1},'food.bankInvalid'],[{999999999:1},'food.bankInvalid'],[{64:'2'},'food.bankInvalid'],[{[game.withRarity(64,4)]:1},'food.noCandidate']]){
  const snap=fixture();snap.player.foodItemId=null;snap.player.bank=bank;
  const result=importCharacter(old,snap);
  assert.deepEqual(result.state.food,old.food);assert.equal(result.state.eatAt,75);
  assert.equal(result.state.manual.foodRule,1);assert.ok(result.warnings.includes(`food: ${warning}`));
  for(const language of ['zh','en'])assert.ok(!importWarningText(language,result.warnings).includes(warning));
 }
 const snap=fixture();snap.player.foodItemId=null;snap.player.bank={64:5};snap.player.foodMaxTier=-1;
 assert.deepEqual(importCharacter(old,snap).state.food,old.food);
 assert.ok(importCharacter(old,snap).warnings.includes('food: foodMaxTier'));
});

test('fountain-only import needs no food selection or warehouse; specified food needs no stock',()=>{
 const old=preset('ranged'),snap=fixture();snap.player.eatAt=0;delete snap.player.foodItemId;
 const result=importCharacter(old,snap);
 assert.equal(result.state.manual.foodRule,3);assert.deepEqual(result.state.food,old.food);
 assert.equal(result.state.eatAt,old.eatAt);assert.equal(result.warnings.some(w=>w.startsWith('food:')),false);
 const specified=fixture();specified.player.foodMaxTier=0;
 assert.deepEqual(importCharacter(old,specified).state.food,{id:64,tier:2});
});

test('automatic food ties use item id order and ignore nonfood stock',()=>{
 assert.equal(game.item(60).heals,game.item(170).heals);
 for(const strategy of [null,-2]){
  const snap=fixture();snap.player.foodItemId=strategy;snap.player.bank={170:5,60:1,110:10};
  assert.deepEqual(importCharacter(preset('ranged'),snap).state.food,{id:60,tier:0});
 }
 const warnings=['food: food.bankMissing','food: food.noCandidate'];
 assert.match(importWarningText('zh',warnings),/仓库数据缺失；仓库没有符合策略及稀有度上限的食物/);
 assert.match(importWarningText('en',warnings),/Warehouse data is missing; No warehouse food matches/);
});

test('userscripts match project preview channels and bridge on preview routes',async()=>{
 for(const [source,version]of [[script,'2.4']]){
  const matches=[...source.matchAll(/^\/\/ @match\s+(\S+)$/gm)].map(m=>new RegExp('^'+m[1].replace(/[.+?^${}()|[\]\\]/g,'\\$&').replaceAll('*','.*')+'$'));
  for(const host of ['deepveinidle.com','cn.deepveinidle.com'])assert.ok(matches.some(m=>m.test(`https://${host}/`)));
  assert.ok(!matches.some(m=>m.test('https://other.deepveinidle.com/')));
  for(const host of ['dvi-lab.pages.dev','preview.dvi-lab.pages.dev','feature-x.dvi-lab.pages.dev','b32d355e.dvi-lab.pages.dev'])assert.ok(matches.some(m=>m.test(`https://${host}/gather`)));
  assert.ok(!matches.some(m=>m.test('https://another-project.pages.dev/gather')));
  for(const pathname of ['/gather','/debug','/debug/']){
   const doc=new EventTarget(),page=simulatorWorld(doc),reads=[],snapshot=fixture();
   vm.runInNewContext(source,{document:doc,location:{origin:'https://preview.dvi-lab.pages.dev',pathname},CustomEvent:DomEvent,GM_getValue:async key=>{reads.push(key);return snapshot;}});
   const probe=await page.requestCharacter('probe');assert.equal(probe.ready,true);assert.equal(probe.version,version);assert.equal(reads.length,0);
   const response=await page.requestCharacter('read');assert.equal(response.snapshot.version,2);assert.deepEqual(reads,['dvi-character-snapshot-v2']);
  }
 }
});

test('shared character importer reads configuration and inventory once through the userscript DOM bridge',async()=>{
 const doc=new EventTarget(),page=simulatorWorld(doc);let count=0,inventory,busy=false;
 userscriptWorld(doc,async()=>{count++;const s=fixture();s.player.bank={1:2};s.player.pack=[{itemId:1,qty:3}];return s;});
 const errors=[],updater=createCharacterUpdater({storage:{getItem:()=>null,setItem(){}},page:'craft',inventory:true,read:()=>page.requestCharacter('read'),onBusy:value=>busy=value,onError:error=>errors.push(error.message),apply:(snapshot,flags)=>{assert.deepEqual(flags,{config:true,inventory:true});inventory=readCharacterInventory(snapshot);}});
 updater.configure({inventory:false});updater.setActive(true);await updater.read({config:true,inventory:true});
 assert.deepEqual(errors,[]);assert.deepEqual(inventory.items,{1:5});assert.equal(busy,false);assert.equal(count,1);
});
