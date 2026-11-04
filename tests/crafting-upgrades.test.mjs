import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from '../src/model.js';
import {craftingJobs,craftingDefaults,normalizeCrafting,craftingPlan,craftingMaterials,materialRequirements,materialBudget,importCrafting,craftingPlayer} from '../src/crafting-model.js';
import {simulateCrafting,simulateCraftingWindow} from '../src/crafting-simulation.js';

const upgrades=craftingJobs.filter(j=>j.upgrade);
test('17 upgrade recipes share the recipe catalogue without retired tasks or ID collisions',()=>{
 assert.equal(upgrades.length,17);assert.equal(new Set(craftingJobs.map(j=>j.id)).size,craftingJobs.length);
 assert.ok(craftingJobs.every(j=>!j.retired));
 assert.ok(craftingJobs.some(j=>j.id===271));assert.ok(craftingJobs.some(j=>j.id==='upgrade-271'));
});
test('old plans migrate quality and counts to +0 upgrades, preserve ordinary plans and merge safely',()=>{
 const raw={plans:{'301:4':2,'271:4':7,'upgrade-271:4':3,'299:2':4},owned:{4114:1}};
 const s=normalizeCrafting(raw);
 assert.deepEqual(s.plans,{'271:4':7,'upgrade-271:4':5,'upgrade-280:2':4});assert.equal(s.upgradeMigration,true);
 assert.deepEqual(normalizeCrafting(JSON.parse(JSON.stringify(s))),s);
 assert.deepEqual(raw.plans,{'301:4':2,'271:4':7,'upgrade-271:4':3,'299:2':4});
 assert.throws(()=>normalizeCrafting({plans:{'301:0':1,'upgrade-271:0':Number.MAX_SAFE_INTEGER}}),/quantityOverflow/);
});
test('legendary upgrade materials include same-quality +0 base and exact extra quantities',()=>{
 const blade=upgrades.find(j=>j.id==='upgrade-271'),bow=upgrades.find(j=>j.id==='upgrade-264');
 assert.deepEqual(craftingMaterials(blade,4,2),{4114:2,4252:4});
 assert.deepEqual(craftingMaterials(bow,4,3),{4145:3,4251:3});
 const s=craftingDefaults();s.plans={'upgrade-271:4':2,'upgrade-264:4':3};s.owned={4114:1};
 assert.deepEqual(materialRequirements(s),{4114:2,4252:4,4145:3,4251:3});
 const row=materialBudget(s,{}).rows.find(r=>r.id===4114);assert.equal(row.required,2);assert.equal(row.purchase,1);
});
test('every upgrade quality runs at a station, is deterministic, +0 and grants unmodified fixed XP',()=>{
 const s=craftingDefaults();for(const k of Object.keys(s.levels))s.levels[k]=99;
 s.masteries.xp=100;s.brews.elixir=4;s.guildXp=50;s.weeklyXp=100;s.hotSetting='current';
 for(const job of upgrades)for(let tier=0;tier<5;tier++){
  const r=simulateCrafting(s,job,tier,3,{seed:314});
  assert.equal(r.complete,true);assert.ok(r.elapsedTicks>0);assert.ok(r.workingTicks>0);assert.equal(r.xp,job.xp*3);
  assert.deepEqual(r.items,{[game.withRarity(job.output.itemId,tier)]:3});
  assert.deepEqual(r.consumed,craftingMaterials(job,tier,3));assert.equal(r.completed,3);
  const rate=simulateCraftingWindow({...s,simulationHours:1},job,tier);assert.ok(rate.complete);assert.ok(rate.completed>3);assert.equal(rate.xp,job.xp*rate.completed);
 }
});
test('locked upgrades still require materials and imports retain upgrade plans; overflow fails',()=>{
 const s=craftingDefaults(),job=upgrades[0];s.plans={[job.id+':4']:2};
 assert.ok(Object.keys(materialRequirements(s)).length>0);assert.throws(()=>simulateCrafting(s,job,4,2),/levelTooLow/);
 const p=craftingPlayer(s).player,r=importCrafting(s,{version:2,capturedAt:Date.now(),player:p});assert.deepEqual(r.state.plans,s.plans);
 s.levels.smithing=99;assert.throws(()=>simulateCrafting(s,upgrades.find(j=>j.upgrade.id===271),0,Number.MAX_SAFE_INTEGER),/quantityOverflow/);
 assert.equal(craftingPlan(s)[0].job.id,job.id);
});

test('upgrade speed changes station time and a short order reports incomplete',()=>{
 const s=craftingDefaults(),job=upgrades.find(j=>j.id==='upgrade-271');
 s.levels.smithing=99;
 const base=simulateCrafting(s,job,0,10),fast=simulateCrafting({...s,masteries:{craft:200}},job,0,10);
 assert.ok(fast.elapsedTicks<base.elapsedTicks);
 const partial=simulateCrafting(s,job,0,10,{maxTicks:base.elapsedTicks-1});
 assert.equal(partial.error,'timeLimit');assert.equal(partial.complete,false);
 assert.equal(partial.completed,9);assert.deepEqual(partial.consumed,craftingMaterials(job,0,9));
});
