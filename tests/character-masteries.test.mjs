import test from 'node:test';
import assert from 'node:assert/strict';
import {characterMasteries} from '../src/character-masteries.js';
import {importCharacter} from '../src/character-import.js';
import {craftingDefaults,importCrafting} from '../src/crafting-model.js';
import {gatheringDefaults,importGathering} from '../src/gathering-model.js';
import {enhancementDefaults,importEnhancement} from '../src/enhancement.js';
import {masteryDefaults,importMastery} from '../src/mastery.js';
import {game,preset} from '../src/model.js';

const snapshot=()=>({version:2,capturedAt:Date.now(),player:{
 lastTick:0,equipment:{weapon:null},skills:{enhancing:0},house:{},houseFurniture:{},
 collections:{},forgeLog:{},masteryGrant:1000,
 masteryPage:1,masteries:{xp:2,enhance:3},masteryAway:{2:{xp:7,enhance:8}},
 masterySkills:{melee:2,ranged:1,magic:2,mining:2,smithing:2,enhancing:2},
}});

test('uses the active page as the fallback and accepts an empty owned page',()=>{
 const {player}=snapshot();
 for(const input of [{masteries:player.masteries},{...player,masterySkills:{}},{...player,masteryAway:{},masterySkills:{mining:1}}]){
  assert.deepEqual(characterMasteries(input,'mining'),{ranks:player.masteries,source:{page:null}});
 }
 for(const patch of [{masteryAway:{}},{masteryAway:{2:null}},{masteryAway:{2:[]}},{masterySkills:{mining:'2'}},{masterySkills:{mining:0}}]){
  assert.deepEqual(characterMasteries({...player,...patch},'mining'),{ranks:player.masteries,source:{page:null,fallback:true}});
 }
 assert.deepEqual(characterMasteries({...player,masteryAway:{2:{}}},'mining'),{ranks:{},source:{page:2,skill:'mining'}});
 const swapped={...player,masteryPage:2,masteries:player.masteryAway[2],masteryAway:{1:player.masteries}};
 assert.deepEqual(characterMasteries(swapped,'ranged'),{ranks:player.masteries,source:{page:1,skill:'ranged'}});
 assert.deepEqual(characterMasteries(swapped,'mining'),{ranks:player.masteryAway[2],source:{page:2,skill:'mining'}});
});

test('combat selects the imported weapon skill, including empty and unreadable weapons',()=>{
 const data=snapshot(),previous=preset('ranged');
 const weapon=skill=>game.equipment.find(item=>item.slot==='weapon'&&item[skill]).itemId;
 for(const [id,skill,page,xp]of [[null,'melee',2,7],[weapon('ranged'),'ranged',1,2],[weapon('magic'),'magic',2,7],[999999999,null,null,2]]){
  data.player.equipment.weapon=id;
  const {state,masterySource}=importCharacter(previous,data);
  assert.equal(state.style,skill??'melee');
  assert.equal(state.masteries.xp,xp);
  assert.deepEqual(masterySource,skill?{page,skill}:{page});
 }
});

test('work and enhancement import the selected page while planning reads the active page',()=>{
 const data=snapshot(),gather=gatheringDefaults(),craft=craftingDefaults(),enhance=enhancementDefaults();
 assert.equal(importGathering(gather,data).state.masteries.xp,7);
 assert.equal(importGathering({...gather,skill:'fishing'},data).state.masteries.xp,2);
 assert.equal(importCrafting(craft,data).state.masteries.xp,2);
 assert.equal(importCrafting({...craft,skill:'smithing'},data).state.masteries.xp,7);
 assert.equal(importEnhancement(enhance,data).state.mastery,8);
 const plan=masteryDefaults();plan.planned=true;plan.target.xp=9;
 const {state}=importMastery(plan,data);
 assert.equal(state.current.xp,2);
 assert.equal(state.target.xp,9);

 data.player.masteryAway[2]={};
 assert.equal(importGathering({...gather,masteries:{xp:9}},data).state.masteries.xp,0);
 assert.equal(importEnhancement(enhance,data).state.mastery,0);
});

test('bound ranks retain each page’s existing invalid-level handling',()=>{
 const data=snapshot(),gather=gatheringDefaults();
 gather.masteries.xp=11;
 data.player.masteryAway[2]={xp:game.masteryRankLimit+1,enhance:-1};
 const combat=importCharacter(preset('ranged'),data);
 assert.equal(combat.state.masteries.xp,0);
 assert.ok(combat.warnings.includes('masteries: masteries.xp'));
 const gathering=importGathering(gather,data);
 assert.equal(gathering.state.masteries.xp,11);
 assert.ok(gathering.warnings.includes('masteries.xp'));
 assert.throws(()=>importEnhancement(enhancementDefaults(),data),/invalidSnapshot/);
});
