import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {gatheringDefaults,gatheringPlayer,gatheringJobs,gatheringSkills,normalizeGathering,selectedGatheringSites,importGathering} from '../src/gathering-model.js';
import {createGatheringScenario,simulateGatheringSite} from '../src/gathering-simulation.js';
import {craftingDefaults,importCrafting} from '../src/crafting-model.js';
import {importCharacter} from '../src/character-import.js';
import {defaults} from '../src/model.js';
import {worldBuffWarningText} from '../src/world-buffs.js';
import {questlessOffline} from '../scripts/native-questless.mjs';
import {workQualities} from '../src/work-expectation.js';
import {START_TICK} from '../src/simulation.js';

const window=(xpMult=1,rarityMult=1,fromTick=0,toTick=200)=>({xpMult,rarityMult,fromTick,toTick,label:'Same event'});
const snapshot=windows=>({version:2,worldBuffsVersion:1,capturedAt:Date.now(),player:gatheringPlayer(gatheringDefaults()).player,worldTick:100,worldBuffs:windows});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('gathering world inputs preserve fractions and old settings gain zero rarity',()=>{
 assert.equal(gatheringDefaults().worldRarity,0);assert.equal(normalizeGathering({weeklyXp:17}).worldRarity,0);
 const state=normalizeGathering({weeklyXp:35.25,worldRarity:70.75});
 assert.equal(state.weeklyXp,35.25);assert.equal(state.worldRarity,70.75);
 assert.deepEqual(normalizeGathering(JSON.parse(JSON.stringify(state))),state);
 assert.equal(normalizeGathering({weeklyXp:1e9,worldRarity:1e9}).worldRarity,1e7);
 assert.equal(normalizeGathering({weeklyXp:-1,worldRarity:Infinity}).weeklyXp,0);
 assert.equal(normalizeGathering({worldRarity:Infinity}).worldRarity,0);
});

test('gathering imports the same arbitrary, duplicate and boundary windows as combat',()=>{
 const snap=snapshot([window(1.1,1,100),window(1.2525,1.5,0,100),{fromTick:0,toTick:200,rarityMult:1.2075},window(3,3,101),window(3,3,0,99)]);
 const previous={...gatheringDefaults(),weeklyXp:99,worldRarity:88},actual=importGathering(previous,snap),combat=importCharacter(defaults(),snap);
 assert.equal(actual.state.weeklyXp,35.25);assert.equal(actual.state.worldRarity,70.75);
 assert.equal(actual.state.weeklyXp,combat.state.manual.weeklyXp);assert.equal(actual.state.worldRarity,combat.state.manual.worldRarity);
 assert.ok(!actual.warnings.some(w=>/worldBuffs|weeklyXp/.test(w)));assert.equal(previous.weeklyXp,99);
 for(const windows of [[],[window(2,2,101)],[{fromTick:0,toTick:100}]]){
  const result=importGathering(previous,snapshot(windows));assert.equal(result.state.weeklyXp,0);assert.equal(result.state.worldRarity,0);
  assert.ok(!result.warnings.some(w=>/worldBuffs|weeklyXp/.test(w)));
 }
 const maximum=importGathering(previous,snapshot([window(100001,100001)])).state;
 assert.equal(maximum.weeklyXp,1e7);assert.equal(maximum.worldRarity,1e7);
});

test('legacy or malformed world captures reset both gathering fields and still import the character',()=>{
 const previous={...gatheringDefaults(),weeklyXp:25,worldRarity:75};
 const legacy=snapshot([window(2,2)]);delete legacy.worldBuffsVersion;legacy.player.skills.mining=game.levelXp(42);
 const old=importGathering(previous,legacy);assert.equal(old.state.weeklyXp,0);assert.equal(old.state.worldRarity,0);assert.equal(old.state.levels.mining,42);
 assert.ok(old.warnings.includes('worldBuffs.upgrade'));
 for(const windows of [undefined,null,[null],[window(NaN)],[window(1,Infinity)],[window(1,.5)],[window(1,1,200,100)],[window(1,1,-1)],[window(100001),window(100001)],[window(1,100002)]]){
  const result=importGathering(previous,snapshot(windows));assert.equal(result.state.weeklyXp,0);assert.equal(result.state.worldRarity,0);assert.ok(result.warnings.includes('weeklyXp.reset'));
 }
 const invalidTick=snapshot([]);invalidTick.worldTick=Number.MAX_SAFE_INTEGER+1;
 assert.ok(importGathering(previous,invalidTick).warnings.includes('weeklyXp.reset'));
 for(const language of ['zh','en']){
  assert.match(worldBuffWarningText(language,'worldBuffs.upgrade'),/2\.8\.0/);
  assert.match(worldBuffWarningText(language,'weeklyXp.reset'),language==='zh'?/重置为 0%/:/reset to 0%/);
 }
});

test('crafting retains the weekly-only import contract without a capture capability marker',()=>{
 const snap=snapshot([window(1.25,2),{...window(1.1),label:'Weekly goal: gathered'}]);delete snap.worldBuffsVersion;
 const result=importCrafting(craftingDefaults(),snap);
 assert.equal(result.state.weeklyXp,10);assert.ok(!('worldRarity' in result.state));
 assert.ok(!result.warnings.some(w=>/worldBuffs|weeklyXp/.test(w)));
});

test('gathering world windows cover the full run in every hot mode and feed quality expectations',()=>{
 const job=gatheringJobs[0],now=Date.UTC(2026,9,16),state={...gatheringDefaults(),simulationHours:1};
 const site=selectedGatheringSites(state,job)[0];
 for(const hotSetting of ['game','current','off']){
  const plain=createGatheringScenario({...state,hotSetting},job,site,{now,seed:17});
  const boosted=createGatheringScenario({...state,hotSetting,weeklyXp:35.25,worldRarity:70.75},job,site,{now,seed:17});
  for(const tick of [START_TICK,START_TICK+1,START_TICK+boosted.durationTicks]){
   const a=game.windowModifiers(plain.context.windows,tick),b=game.windowModifiers(boosted.context.windows,tick);
   near(b.xpMult-a.xpMult,.3525);near(b.rarityMult-a.rarityMult,.7075);
  }
 }
 const base=createGatheringScenario({...state,hotSetting:'off'},job,site);
 const buffed=createGatheringScenario({...state,hotSetting:'off',worldRarity:100},job,site);
 // Uncommon-or-better baseline is 1/40, doubled by +100% world rarity.
 near(workQualities(base.player,base.context,job,START_TICK)[0],1-1/40);
 near(workQualities(buffed.player,buffed.context,job,START_TICK)[0],1-2/40);
});

for(const skill of gatheringSkills)for(const discardGathered of [false,true])test(`${skill}: world XP and rarity follow original offline work with discard=${discardGathered}`,()=>{
 const state={...gatheringDefaults(),skill,weeklyXp:35.25,worldRarity:70.75,simulationHours:1,hotSetting:'off',discardGathered};
 const job=gatheringJobs.find(job=>job.skill===skill),site=selectedGatheringSites(state,job)[0],scenario=createGatheringScenario(state,job,site,{seed:19});
 let p;game.predict(scenario.player,scenario.context,q=>{p=q;return false;});p.offlineCapTicks=scenario.durationTicks*2;
 assert.ok(game.startWork(p,scenario.context,site.id,job.id,discardGathered?'drop':'bank',null));
 const xp=p.skills[skill],gained={};
 for(let tick=game.predictionChunkTicks;tick<=scenario.durationTicks;tick+=game.predictionChunkTicks){
  const report=questlessOffline(game,p,scenario.context,START_TICK+tick);
  for(const [id,qty]of Object.entries(report.itemsGained))gained[id]=(gained[id]??0)+qty;
 }
 const actual=simulateGatheringSite(state,job,site,{seed:19});assert.equal(actual.xp,p.skills[skill]-xp);assert.equal(actual.coins,p.coins);assert.deepEqual(actual.sampleItems,gained);
 const inventory={...p.bank};for(const item of p.pack)inventory[item.itemId]=(inventory[item.itemId]??0)+item.qty;
 const retained=Object.entries(inventory).filter(([id])=>game.baseItemId(Number(id))===job.output.itemId).reduce((sum,[,qty])=>sum+qty,0);
 near(actual.normal,retained);
});
