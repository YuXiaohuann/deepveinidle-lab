import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {gatheringDefaults,gatheringJobs,gatheringPlayer,normalizeGathering,selectedGatheringSites} from '../src/gathering-model.js';
import {simulateGatheringJob} from '../src/gathering-simulation.js';
import {workQualities} from '../src/work-expectation.js';
import {collectionDefaults,estimateCollection} from '../src/collection-model.js';
import {translatedName} from '../src/i18n.js';
const coal=gatheringJobs.find(j=>j.id===5),pure=gatheringJobs.find(j=>j.id===344);
const config=()=>{const s=gatheringDefaults();s.levels.mining=99;s.simulationHours=1;s.hotSetting='off';s.worldRarity=100;s.masteries.rare=200;s.gear.pickaxe={id:game.tools.find(t=>t.slot==='pickaxe').itemId,tier:4,plus:20};return s;};

test('1204 pure coal is a separate compatible task with ordinary coal stats',()=>{
 assert.equal(pure.plain,true);assert.equal(translatedName(pure.name,'zh'),'纯净煤矿');assert.equal(translatedName(pure.name,'en'),'Pure coal');
 for(const key of ['skill','levelReq','baseTicks','xp','output','bonus'])assert.deepEqual(pure[key],coal[key]);
 for(const id of [5,344])assert.equal(normalizeGathering({...config(),jobSelection:id}).jobSelection,id);
 for(const homeBank of [0,1,2])assert.deepEqual(selectedGatheringSites({...config(),homeBank},pure).map(s=>s.id),[395]);
});

test('1204 plain affects main quality only, retaining bonus rarity and ordinary coal luck',()=>{
 const {player}=gatheringPlayer(config()),context={hypothetical:true,windows:[]};
 assert.deepEqual(workQualities(player,context,pure,0),[1]);
 const ordinary=workQualities(player,context,coal,0);assert.ok(ordinary[1]>0);
 assert.deepEqual(workQualities(player,context,pure,0,{bonus:true}),ordinary);
 for(const discardGathered of [false,true]){
  const result=simulateGatheringJob({...config(),discardGathered},pure,{seed:314});
  assert.ok(result.completed>0);assert.equal(result.xp,result.completed*pure.xp);assert.deepEqual(Object.keys(result.normalItems),['5']);
  assert.equal(result.normalItems[5],result.normal);assert.equal(result.normalValue,result.normal*game.vendorPrice(5));
  assert.equal(result.totalIncome,result.normalValue+result.rareValue+result.coins);
  assert.ok(!Object.keys(result.sampleItems).some(id=>game.baseItemId(Number(id))===5&&Number(id)!==5));
  assert.ok(Object.entries(result.rareItems).some(([id,qty])=>game.baseItemId(Number(id))===100&&game.itemTier(Number(id))>0&&qty>0));
 }
});

test('1204 pure coal collection route can reach common targets only',()=>{
 const state={...collectionDefaults(),initialized:true};state.config.levels.mining=99;
 assert.equal(estimateCollection(state,5,pure).status,'ok');
 assert.equal(estimateCollection(state,game.withRarity(5,1),pure).status,'unreachable');
 assert.equal(estimateCollection(state,game.withRarity(5,1),coal).status,'ok');
});
