import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {craftingDefaults,normalizeCrafting,craftingPlayer,craftingJobs,craftingSkills,craftingStats,importCrafting} from '../src/crafting-model.js';
import {createCraftingScenario,simulateCrafting} from '../src/crafting-simulation.js';
import {START_TICK} from '../src/simulation.js';
import {questlessOffline} from '../scripts/native-questless.mjs';
import {worldBuffWarningText} from '../src/world-buffs.js';

const snapshot=worldBuffs=>({version:2,worldBuffsVersion:1,capturedAt:Date.now(),player:craftingPlayer(craftingDefaults()).player,worldTick:100,worldBuffs});
const window=(xpMult=1,rarityMult=1,fromTick=0,toTick=200)=>({label:'Any event',xpMult,rarityMult,fromTick,toTick});

test('crafting XP fractions and ironman survive normalization and old storage',()=>{
 assert.equal(normalizeCrafting({weeklyXp:17}).ironman,false);
 const state=normalizeCrafting({weeklyXp:35.25,ironman:true});
 assert.equal(state.weeklyXp,35.25);assert.equal(craftingPlayer(state).player.ironman,true);
 assert.deepEqual(normalizeCrafting(JSON.parse(JSON.stringify(state))),state);
 assert.equal(normalizeCrafting({weeklyXp:1e9}).weeklyXp,1e7);
 for(const weeklyXp of [-1,Infinity,NaN])assert.equal(normalizeCrafting({weeklyXp}).weeklyXp,0);
});

test('crafting imports all active XP windows and ironman into the crafting build',()=>{
 const previous={...craftingDefaults(),weeklyXp:99};
 const snap=snapshot([window(1.1,1,100),window(1.2525,1.5,0,100),{fromTick:0,toTick:200,rarityMult:2},window(5,1,101),window(5,1,0,99)]);
 snap.player.ironman=true;
 const result=importCrafting(previous,snap);
 assert.equal(result.state.weeklyXp,35.25);assert.equal(result.state.ironman,true);
 assert.ok(!('worldRarity' in result.state));
 assert.equal(previous.weeklyXp,99);assert.deepEqual(result.warnings,[]);
 for(const windows of [[],[window(2,1,101)]])assert.equal(importCrafting(previous,snapshot(windows)).state.weeklyXp,0);
 assert.equal(importCrafting(previous,snapshot([window(100001)])).state.weeklyXp,1e7);
 delete snap.worldBuffsVersion;
 assert.ok(importCrafting(previous,snap).warnings.includes('worldBuffs.upgrade'));
 for(const windows of [null,[null],[window(NaN)],[window(1,Infinity)],[window(1,.5)],[window(1,1,200,100)],[window(100001),window(100001)]]){
  const result=importCrafting(previous,snapshot(windows));assert.equal(result.state.weeklyXp,0);assert.ok(result.warnings.includes('weeklyXp.reset'));
 }
 for(const language of ['zh','en'])for(const warning of ['worldBuffs.upgrade','weeklyXp.reset']){
  const text=worldBuffWarningText(language,warning,{rarity:false});assert.doesNotMatch(text,/稀有|rarity/);assert.match(text,/0%/);
 }
});

for(const skill of craftingSkills)test(`${skill}: full world XP and ironman match original offline work`,()=>{
 const job=craftingJobs.find(j=>j.skill===skill&&!j.upgrade),state={...craftingDefaults(),skill,weeklyXp:35.25,hotSetting:'off',ironman:true};
 const options={maxTicks:6000,seed:19};
 const scenario=createCraftingScenario(state,job,0,20,options),initial=scenario.player.skills[skill];
 const report=questlessOffline(game,scenario.player,scenario.context,START_TICK+options.maxTicks);
 const result=simulateCrafting(state,job,0,20,options);
 assert.equal(result.xp,scenario.player.skills[skill]-initial);assert.deepEqual(result.sampleItems,report.itemsGained);
 assert.equal(Object.keys(result.items).some(id=>game.baseItemId(Number(id))===game.mountItemId),false);
 const normal=simulateCrafting({...state,ironman:false},job,0,20,options);
 assert.ok(Object.keys(normal.items).some(id=>game.baseItemId(Number(id))===game.mountItemId));
 assert.equal(normal.completed,result.completed);assert.equal(normal.xp,result.xp);
 for(const hotSetting of ['game','current','off']){
  const plain=createCraftingScenario({...state,weeklyXp:0,hotSetting},job,0,20,options);
  const buffed=createCraftingScenario({...state,hotSetting},job,0,20,options);
  for(const tick of [START_TICK,START_TICK+1,START_TICK+options.maxTicks])assert.ok(Math.abs(game.windowModifiers(buffed.context.windows,tick).xpMult-game.windowModifiers(plain.context.windows,tick).xpMult-.3525)<1e-9);
 }
 assert.ok(Math.abs(craftingStats(state).xpBonus-craftingStats({...state,weeklyXp:0}).xpBonus-.3525)<1e-9);
});

test('current crafting recipes have no random quality rewards; station upgrades ignore world XP',()=>{
 assert.ok(craftingJobs.filter(j=>!j.upgrade).every(j=>j.inputs.length>0&&!j.bonus));
 const job=craftingJobs.find(j=>j.upgrade),state=craftingDefaults();state.levels[job.skill]=game.maxLevel;
 assert.deepEqual(simulateCrafting({...state,weeklyXp:123.45,ironman:true},job,0,1),simulateCrafting(state,job,0,1));
});
