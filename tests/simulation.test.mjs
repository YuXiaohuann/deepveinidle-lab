import test from 'node:test';
import assert from 'node:assert/strict';
import {game,defaults,preset,normalize,masteryValue,masteryRank} from '../src/model.js';
import {simulateMonster,createScenario,START_TICK,HOUR_TICKS} from '../src/simulation.js';

test('effective mastery values preserve existing ranks and original units',()=>{
 for(const m of game.masteries)for(const rank of [0,1,13,20000])assert.equal(masteryRank(m.id,masteryValue(m.id,rank)),rank);
 assert.equal(masteryValue('accuracy',1),0.5);assert.equal(masteryRank('accuracy',10.5),21);
 assert.equal(masteryRank('enhance',0.5),2);assert.equal(masteryValue('enhance',1),0.25);assert.equal(masteryValue('offline',1),0.12);
});
test('all monsters match the original predictor XP, timing, deaths and regular loot',()=>{
 const state=preset('ranged');
 for(const monster of game.monsters){
  const scenario=createScenario(state,monster),zone=game.world.zones.find(z=>z.monsterId===monster.id);
  const expected=game.predict(scenario.player,scenario.context,p=>game.startFight(p,scenario.context,zone.id));
  const actual=simulateMonster(state,monster);
  assert.equal(Math.round(actual.xp),expected.xpPerHour,monster.name);
  assert.deepEqual(actual.bySkill,expected.bySkill,monster.name);
  assert.equal(actual.deaths,expected.deaths);assert.equal(actual.elapsedTicks,expected.ticks);
  for(const [id,qty]of Object.entries(actual.normalItems))assert.equal(qty,expected.itemsGained[id]);
 }
});
test('full tick event counts agree with original offline report and food inventory ledger',()=>{
 const state=preset('ranged'),monster=game.monsters.find(m=>m.id===20),scenario=createScenario(state);
 let p;game.predict(scenario.player,scenario.context,prepared=>{p=prepared;return false;});
 assert.equal(p.lastTick,START_TICK);assert.equal(p.pack.length,0);
 game.startFight(p,scenario.context,game.world.zones.find(z=>z.monsterId===monster.id).id);
 const report=game.offline(p,scenario.context,START_TICK+HOUR_TICKS),actual=simulateMonster(state,monster);
 assert.equal(actual.kills,report.kills);assert.equal(actual.coins,report.coins);
 const food=game.withRarity(state.food.id,state.food.tier),left=(p.bank[food]??0)+p.pack.filter(x=>x.itemId===food).reduce((n,x)=>n+x.qty,0);
 assert.equal(actual.food,1e9-left);assert.ok(actual.food>0);assert.ok(actual.restocks>1);assert.ok(actual.movingTicks>0);
});
test('death follows predictor check boundaries without lifetime extrapolation',()=>{
 const r=simulateMonster(defaults(),game.monsters.find(m=>m.id===20));
 assert.equal(r.deaths,1);assert.ok(r.elapsedTicks<HOUR_TICKS);assert.equal(r.elapsedTicks%game.predictionChunkTicks,0);assert.equal(r.kills,0);
});
test('movement potion and mastery affect real travel and yields',()=>{
 const state=preset('ranged'),monster=game.monsters.find(m=>m.id===20),base=simulateMonster(state,monster);
 state.brews.swift=4;const swift=simulateMonster(state,monster);assert.ok(swift.movingTicks<base.movingTicks);assert.ok(swift.kills>base.kills);
 state.brews.swift=-1;state.masteries.move=100;const mastery=simulateMonster(state,monster);assert.ok(mastery.movingTicks<base.movingTicks);
});
test('starting depot changes travel and repeated simulation preserves input',()=>{
 const state=preset('magic'),before=JSON.stringify(state),monster=game.monsters[0];
 const a=simulateMonster(state,monster),b=simulateMonster(state,monster);assert.deepEqual(a,b);assert.equal(JSON.stringify(state),before);
 state.homeBank=2;assert.notEqual(simulateMonster(state,monster).movingTicks,a.movingTicks);
});
test('buffs, food expiry and movement remain aligned with original prediction',()=>{
 const state=preset('magic');state.food={id:171,tier:2};state.fed=true;state.rooted=true;state.brews.haste=3;state.brews.swift=2;state.masteries.xp=20;state.masteries.move=10;
 const monster=game.monsters.find(m=>m.id===20),scenario=createScenario(state);
 const expected=game.predict(scenario.player,scenario.context,p=>game.startFight(p,scenario.context,game.world.zones.find(z=>z.monsterId===monster.id).id));
 const result=simulateMonster(state,monster);
 assert.equal(Math.round(result.xp),expected.xpPerHour);assert.deepEqual(result.bySkill,expected.bySkill);assert.equal(result.deaths,expected.deaths);
});

test('mount stacks with movement buffs and matches original full prediction',()=>{
 const s=preset('ranged'),monster=game.monsters.find(m=>m.id===20),base=simulateMonster(s,monster);
 s.gear.mount={id:328,tier:2,plus:5};
 const mounted=simulateMonster(s,monster);assert.ok(mounted.movingTicks<base.movingTicks);
 s.brews.swift=0;s.masteries.move=10;
 const scenario=createScenario(s,monster),zone=game.world.zones.find(z=>z.monsterId===monster.id);
 const expected=game.predict(scenario.player,scenario.context,p=>{
  const started=game.startFight(p,scenario.context,zone.id);
  return started;
 });
 const walking=createScenario(s);let prepared;
 game.predict(walking.player,walking.context,p=>{prepared=p;return false;});
 game.startFight(prepared,walking.context,zone.id);
 let walk;
 for(let tick=1;tick<=100&&!walk;tick++){
  const events=[];game.tick(prepared,walking.context,START_TICK+tick,events);walk=events.find(e=>e.kind==='walkStarted');
 }
 // Round(1473 * 1.20 * 1.05): mount is rounded before the other multipliers.
 assert.ok(walk);assert.equal(walk.speed,1856);
 const result=simulateMonster(s,monster);
 assert.equal(Math.round(result.xp),expected.xpPerHour);assert.deepEqual(result.bySkill,expected.bySkill);
 assert.equal(result.deaths,expected.deaths);assert.equal(result.elapsedTicks,expected.ticks);
 assert.ok(result.movingTicks<mounted.movingTicks);
});


test('depot defaults to automatic and valid saved choices survive',()=>{
 assert.equal(defaults().homeBank,0);
 for(const homeBank of [undefined,0,-1,99,'automatic'])assert.equal(normalize({homeBank}).homeBank,0);
 for(const homeBank of [1,2])assert.equal(normalize({homeBank}).homeBank,homeBank);
});
test('automatic depots vary by target and match explicit choices',()=>{
 const s=preset('ranged'),before=JSON.stringify(s);
 // The Cairns lies next to depot 2; The Chalk Steps lies north of depot 1.
 assert.equal(createScenario(s,game.monsters.find(m=>m.id===4)).player.homeBank,2);
 assert.equal(createScenario(s,game.monsters.find(m=>m.id===20)).player.homeBank,1);
 const chosen=new Set();
 for(const monster of game.monsters){
  const automatic=simulateMonster(s,monster);chosen.add(automatic.homeBank);
  assert.deepEqual(automatic,simulateMonster({...s,homeBank:automatic.homeBank},monster),monster.name);
 }
 assert.deepEqual([...chosen].sort(),[1,2]);assert.equal(JSON.stringify(s),before);
 for(const homeBank of [1,2])for(const monster of game.monsters)assert.equal(createScenario({...s,homeBank},monster).player.homeBank,homeBank);
});
test('removed manual reproduction overrides use fixed defaults',()=>{
 const s=preset('ranged');s.manual.playerId=54321;s.manual.seed=813;s.manual.currentTick=2000000;
 const n=normalize(s);assert.equal(n.manual.playerId,1);assert.equal(n.manual.seed,0);assert.equal(n.manual.currentTick,START_TICK);
 assert.deepEqual(simulateMonster(s,game.monsters[3]),simulateMonster(preset('ranged'),game.monsters[3]));
});

test('named food above the quality cap is eaten and matches native prediction',()=>{
 const state=preset('ranged'),monster=game.monsters.find(m=>m.id===12);
 state.food={id:64,tier:4};state.manual.foodRule=0;state.manual.foodMaxTier=0;
 for(const slot of ['helmet','body','legs'])state.gear[slot]={id:0,tier:0,plus:0};
 const before=JSON.stringify(state),actual=simulateMonster(state,monster);
 assert.ok(actual.food>0);assert.ok(actual.kills>0);assert.equal(actual.deaths,0);
 const uncapped=structuredClone(state);uncapped.manual.foodMaxTier=4;
 assert.deepEqual(actual,simulateMonster(uncapped,monster));
 const {player,context}=createScenario(state,monster),zone=game.world.zones.find(z=>z.monsterId===monster.id);
 const expected=game.predict(player,context,p=>game.startFight(p,context,zone.id));
 assert.equal(actual.xp,expected.xpPerHour);assert.deepEqual(actual.bySkill,expected.bySkill);
 assert.equal(actual.deaths,expected.deaths);assert.equal(actual.elapsedTicks,expected.ticks);
 assert.equal(JSON.stringify(state),before);
});

test('food priorities still enforce the quality cap and fountain-only never eats',()=>{
 const state=preset('ranged'),monster=game.monsters.find(m=>m.id===12);
 state.food={id:64,tier:4};state.manual.foodMaxTier=0;
 for(const slot of ['helmet','body','legs'])state.gear[slot]={id:0,tier:0,plus:0};
 for(const foodRule of [1,2]){
  state.manual.foodRule=foodRule;
  const capped=simulateMonster(state,monster);assert.equal(capped.food,0);
  const uncapped=structuredClone(state);uncapped.manual.foodMaxTier=4;
  assert.ok(simulateMonster(uncapped,monster).food>0);
 }
 state.manual.foodRule=3;state.manual.foodMaxTier=4;
 assert.equal(simulateMonster(state,monster).food,0);
});
