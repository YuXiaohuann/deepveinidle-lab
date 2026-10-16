import test from 'node:test';
import assert from 'node:assert/strict';
import {game,defaults,normalize,slots,preset} from '../src/model.js';
import {importCharacter,importWarningText} from '../src/character-import.js';
import {createScenario,simulateMonster,START_TICK} from '../src/simulation.js';
import {captureHarness,flushCapture} from './helpers/capture-harness.mjs';

const player=()=>({lastTick:100,skills:Object.fromEntries(game.allSkills.map(k=>[k,0])),equipment:Object.fromEntries(slots.map(k=>[k,null])),brews:{},house:{},houseFurniture:{},masteries:{},perks:{},guildBonus:0,homeBank:null,ironman:false});
const window=(xpMult=1,rarityMult=1,fromTick=0,toTick=200,label='Any event')=>({xpMult,rarityMult,fromTick,toTick,label});
const snapshot=windows=>({version:2,worldBuffsVersion:1,capturedAt:Date.now(),player:player(),worldTick:100,worldBuffs:windows});

test('all active windows add XP and rarity regardless of label, including duplicate labels and both boundaries',()=>{
 const snap=snapshot([window(1.1,1,100),window(1.25,1.5,0,100),{fromTick:0,toTick:200,rarityMult:1.2},window(3,3,101),window(3,3,0,99)]);
 const old=defaults();old.manual.weeklyXp=99;old.manual.worldRarity=99;
 const result=importCharacter(old,snap);
 assert.equal(result.state.manual.weeklyXp,35);assert.equal(result.state.manual.worldRarity,70);
 assert.ok(!result.warnings.some(w=>/worldBuffs|weeklyXp/.test(w)));
 const roundtrip=normalize(JSON.parse(JSON.stringify(result.state)));
 assert.equal(roundtrip.manual.worldRarity,70);assert.equal(roundtrip.manual.weeklyXp,35);
 assert.equal(old.manual.worldRarity,99);
 for(const windows of [[],[window(2,2,101)]]){
  const s=importCharacter(old,snapshot(windows)).state;assert.equal(s.manual.weeklyXp,0);assert.equal(s.manual.worldRarity,0);
 }
 const fractional=importCharacter(old,snapshot([window(1.1025,1.2075)])).state;
 assert.equal(fractional.manual.weeklyXp,10.25);assert.equal(fractional.manual.worldRarity,20.75);
 assert.deepEqual(normalize(JSON.parse(JSON.stringify(fractional))),fractional);
 assert.equal(normalize({}).manual.worldRarity,0);
});

test('old capture capability and malformed windows reset both fields with explicit warnings',()=>{
 const old=defaults();old.manual.weeklyXp=20;old.manual.worldRarity=30;
 const legacy=snapshot([window(1.5,2)]);delete legacy.worldBuffsVersion;
 const result=importCharacter(old,legacy);
 assert.equal(result.state.manual.weeklyXp,0);assert.equal(result.state.manual.worldRarity,0);
 assert.ok(result.warnings.includes('guild: worldBuffs.upgrade'));
 for(const lang of ['zh','en'])assert.match(importWarningText(lang,result.warnings),/2\.8\.0/);
 for(const windows of [undefined,[window(NaN)],[window(1,Infinity)],[window(1,.5)],[window(1,1,200,100)],[window(100001),window(100001)]]){
  const r=importCharacter(old,snapshot(windows));assert.equal(r.state.manual.weeklyXp,0);assert.equal(r.state.manual.worldRarity,0);assert.ok(r.warnings.includes('guild: weeklyXp.reset'));
 }
});

test('new Worker captures complete effects, updates standalone windows and isolates connections',async()=>{
 const h=captureHarness(),socket=new h.page.WebSocket('wss://deepveinidle.com/ws');
 socket.receive([{t:'welcome',you:player(),windows:[window(1.25,1.5)]}],100);await flushCapture();
 let snap=h.storage.get('dvi-character-snapshot-v2');
 assert.equal(snap.worldBuffsVersion,1);assert.equal(snap.worldBuffs[0].rarityMult,1.5);
 assert.equal(importCharacter(defaults(),snap).state.manual.worldRarity,50);
 socket.receive([{t:'windows',windows:[window(1,1.75)]}],100);await flushCapture();
 snap=h.storage.get('dvi-character-snapshot-v2');assert.equal(importCharacter(defaults(),snap).state.manual.worldRarity,75);
 const next=new h.page.WebSocket('wss://deepveinidle.com/ws');next.receive([{t:'welcome',you:player(),windows:[]}],100);
 socket.receive([{t:'windows',windows:[window(5,5)]}],100);await flushCapture();
 assert.equal(importCharacter(defaults(),h.storage.get('dvi-character-snapshot-v2')).state.manual.worldRarity,0);
});

test('world effects cover initialization and end independently of all three hot modes',()=>{
 const base=preset('ranged');base.manual.simulationHours=1;
 for(const mode of ['game','current','off']){
  base.manual.hotSetting=mode;
  const buffed=structuredClone(base);buffed.manual.weeklyXp=35.25;buffed.manual.worldRarity=70.5;
  const options={now:Date.UTC(2026,9,16),seed:17},a=createScenario(base,undefined,options),b=createScenario(buffed,undefined,options);
  for(const tick of [START_TICK,START_TICK+1,START_TICK+b.durationTicks]){
   const x=game.windowModifiers(a.context.windows,tick),y=game.windowModifiers(b.context.windows,tick);
   assert.ok(Math.abs(y.xpMult-x.xpMult-.3525)<1e-12);assert.ok(Math.abs(y.rarityMult-x.rarityMult-.705)<1e-12);
   assert.ok(Math.abs(game.combatRarityMultiplier(b.player,b.context,tick)-game.combatRarityMultiplier(a.player,a.context,tick)-.705)<1e-12);
  }
 }
 base.manual.hotSetting='off';
 const buffed=structuredClone(base);buffed.manual.weeklyXp=35;buffed.manual.worldRarity=70;
 const plain=simulateMonster(base,game.monsters[0],{seed:17}),boost=simulateMonster(buffed,game.monsters[0],{seed:17});
 assert.equal(boost.kills,plain.kills);assert.ok(boost.xp>plain.xp);assert.ok(boost.rare>plain.rare);
});
