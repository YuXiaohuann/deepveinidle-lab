import test from 'node:test';
import assert from 'node:assert/strict';
import {game,defaults,normalize,makePlayer,calculate,slots} from '../src/model.js';
import {importCharacter} from '../src/character-import.js';
import {craftingDefaults,craftingJobs,craftingPlayer,craftingMaterials,calculateUpgrade} from '../src/crafting-model.js';
import {createScenario} from '../src/simulation.js';

test('1205 amulet retains every quality and enhancement without total level warnings',()=>{
 assert.equal(game.equipment.find(g=>g.itemId===357).totalLevel,750);
 for(let tier=0;tier<5;tier++)for(const plus of [0,17,100])for(const level of [1,241]){
  const s=defaults();s.gear.amulet={id:357,tier,plus};for(const k of Object.keys(s.levels))s.levels[k]=level;
  const restored=normalize(JSON.parse(JSON.stringify(s))),r=calculate(restored),id=game.encode(game.withRarity(357,tier),plus);
  assert.equal(r.player.equipment.amulet,id);
  assert.deepEqual(r.issues.filter(i=>i.slot==='amulet'),[]);
  assert.equal(createScenario(restored,game.monsters[0]).player.equipment.amulet,id);
  assert.equal(r.stats.evasion,game.evasion(r.player));
 }
 const s=defaults();s.gear.amulet.id=186;assert.deepEqual(makePlayer(s).issues.filter(i=>i.slot==='amulet'),[]);
});

test('1205 imported worn amulet is retained without claiming total level eligibility',()=>{
 const snapshot={version:2,worldBuffsVersion:1,capturedAt:Date.now(),player:{lastTick:100,skills:{melee:0,ranged:0,magic:0,defence:0,hitpoints:game.levelXp(10),mining:game.levelXp(99)},equipment:Object.fromEntries(slots.map(k=>[k,k==='amulet'?game.encode(game.withRarity(357,4),17):null]))}};
 const imported=importCharacter(defaults(),snapshot).state;
 assert.deepEqual(imported.gear.amulet,{id:357,tier:4,plus:17});
 assert.deepEqual(makePlayer(imported).issues.filter(i=>i.slot==='amulet'),[]);
});

test('1205 upgrade capacity accepts last slot and rejects net growth beyond capacity atomically',()=>{
 const s=craftingDefaults();s.levels.fletching=99;const job=craftingJobs.find(j=>j.upgrade?.id===264),from=145,to=629;
 const player=filled=>{const p=craftingPlayer(s).player;p.unlimitedBank=false;p.bank=craftingMaterials(job,0,2);for(let id=1;Object.keys(p.bank).length<filled;id++)if(!Object.hasOwn(p.bank,id)&&id!==to)p.bank[id]=1;return p;};
 const full=player(75),before=structuredClone(full);assert.equal(game.applyUpgrade(full,job.upgrade,from),'full');assert.deepEqual(full,before);
 const free=player(74);free.bank[280]=1;assert.equal(game.applyUpgrade(free,job.upgrade,from),'ok');assert.equal(free.bank[to],1);
 const last=player(74);assert.equal(game.applyUpgrade(last,job.upgrade,from),'ok');assert.equal(last.bank[to],1);assert.equal(Object.keys(last.bank).length,75);
 // A second upgrade consumes the last base/material stacks and reuses the existing result stack.
 assert.equal(game.applyUpgrade(last,job.upgrade,from),'ok');assert.equal(last.bank[to],2);assert.equal(last.bank[from],undefined);
 for(const tier of [0,4]){const one=calculateUpgrade(s,job,tier,1),batch=calculateUpgrade(s,job,tier,10);assert.equal(batch.xp,one.xp*10);assert.deepEqual(batch.consumed,craftingMaterials(job,tier,10));assert.equal(batch.items[game.withRarity(to,tier)],10);assert.equal(batch.elapsedTicks,0);}
});
