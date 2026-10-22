import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as game from '../src/upstream.js';
import {enhancementDefaults,enhanceableItems,validateEnhancement,enhancementSteps,calculateEnhancement,importEnhancement} from '../src/enhancement.js';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);

test('1198 reviewed full snapshot and retired lectern match source metadata',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../vendor/manifest.json',import.meta.url)));
 assert.equal(manifest.changelogVersion,'1.0.1198');assert.deepEqual(manifest.overrides,[]);
 assert.equal(manifest.sha256,'1254dd60c7ad5eabd246b401fb0953da31dd493bec72ac9bcdd44519c26936cc');
 assert.equal(game.rooms.find(r=>r.id==='lectern').retired,true);
 assert.deepEqual(game.bosses.map(b=>b.exclusive.chance),[1/500,1/1000,1/500]);
});
test('1198 piecewise chance crosses +13 with no floor and ignores retired home bonuses',()=>{
 for(const [level,mastery]of [[1,0],[99,200],[42,9],[99,201]]){
  const state={...enhancementDefaults(),level,mastery,target:20,lectern:999};
  const steps=enhancementSteps(state);
  for(const k of [0,12,13,14,19])near(steps[k].chance,Math.min(1,(k<=13?1-.06*k:.22*.95**(k-13))*(1+.002*(level-1))*(1+Math.min(.5,.0025*mastery))));
  assert.deepEqual(calculateEnhancement(state),calculateEnhancement({...state,lectern:0}));
 }
 assert.ok(enhancementSteps({...enhancementDefaults(),target:20})[19].chance<.2);
});
test('1198 all six recipe tiers and five rarities use tier shards and XP at 30 seconds',()=>{
 const boundaries=[15,30,50,75,90],shards=[2,2,4,6,8,10],xp=[1,1.25,1.5,1.75,2,2.5],quality=[1,1.5,3,8,25],seen=new Set();
 for(const item of enhanceableItems){
  const level=game.recipes.find(r=>r.output.itemId===item.id)?.levelReq??game.upgradeRecipes.find(r=>r.to.includes(item.id))?.levelReq;
  const index=level===undefined?3:boundaries.filter(n=>level>=n).length;seen.add(index);
  for(let tier=0;tier<5;tier++){
   const state={...enhancementDefaults(),itemId:item.id,tier,target:4};
   for(const step of enhancementSteps(state)){
    assert.equal(step.shards,shards[index]*(step.from+1));
    assert.equal(step.xp,Math.round(20*(step.from+1)*quality[tier]*xp[index]));
   }
   const result=calculateEnhancement(state);assert.equal(result.totals.seconds,result.totals.attempts*30);
  }
 }
 assert.equal(seen.size,6);assert.equal(game.skillPetChance('enhancing'),12.5/3e6);
 assert.equal(game.skillPetChance('mining'),1/3e6);
});
test('1198 old settings discard lectern while retaining prices, target and raw mastery',()=>{
 const legacy={...enhancementDefaults(),lectern:999,mastery:201,target:20,shardPrice:123};
 const normalized=validateEnhancement(JSON.parse(JSON.stringify(legacy)));
 const {lectern,...expected}=legacy;assert.deepEqual(normalized,expected);
 assert.deepEqual(validateEnhancement(JSON.parse(JSON.stringify(normalized))),expected);
});
test('1198 import needs no house fields and ignores stale retired furniture',()=>{
 const state={...enhancementDefaults(),lectern:500},snapshot={version:2,capturedAt:Date.now(),player:{skills:{enhancing:game.levelXp(42)},masteries:{enhance:201},equipment:{},bank:{},pack:[],overflow:{}}};
 const result=importEnhancement(state,snapshot);assert.equal(result.state.level,42);assert.equal(result.state.mastery,201);assert.equal(result.state.lectern,undefined);
 assert.deepEqual(importEnhancement(state,{...snapshot,player:{...snapshot.player,house:{lectern:-1},houseFurniture:{lectern:null}}}),result);
 assert.equal(state.lectern,500);
});
