import test from 'node:test';
import assert from 'node:assert/strict';
import {game,preset,calculate} from '../src/model.js';
import {createScenario,simulateMonster,START_TICK} from '../src/simulation.js';
import {importSnapshot} from '../src/character-snapshot.js';
import {importCharacter} from '../src/character-import.js';
function fixture(){
 const p=createScenario(preset('ranged')).player;
 p.id=127;p.lastTick=1500000;p.skills.ranged+=10000;p.bank={64:13,65:21,66:37};p.pack=[{itemId:64,qty:4}];p.bankLocked=[65];p.unlimitedBank=false;
 p.brews.warrior=p.lastTick+100;p.brewTier.warrior=2;p.brewBuckets={warrior:[0,0,100,0,0]};
 return {version:2,capturedAt:Date.now(),player:structuredClone(p),prediction:{source:'predictor',clientBuild:'index-C3S-5Yeu.js',capturedAt:Date.now(),player:p,seed:314,windows:[{fromTick:START_TICK,toTick:START_TICK+6000,xpMult:1.1,rarityMult:1.2}]}};
}
test('complete snapshot preserves exact character and context without sharing mutable references',()=>{
 const input=fixture(),result=importSnapshot(input),scenario=createScenario({format:'snapshot',snapshot:result});
 assert.deepEqual(scenario.player,input.prediction.player);assert.equal(scenario.context.seed,314);assert.deepEqual(scenario.context.windows,input.prediction.windows);
 assert.equal(scenario.durationTicks,6000);assert.equal(createScenario({format:'snapshot',snapshot:result,simulationHours:.5}).durationTicks,3000);scenario.player.bank[66]=0;scenario.context.windows[0].xpMult=9;
 assert.equal(result.player.bank[66],37);assert.equal(input.prediction.windows[0].xpMult,1.1);
 const view=calculate(preset('ranged'),result.player);assert.equal(view.player.skills.ranged,result.player.skills.ranged);
});
test('snapshot defaults match the native predictor and trial XP/items/death totals match exactly',()=>{
 const input=importSnapshot(fixture());
 for(const monster of [game.monsters[0],game.monsters[10],game.monsters.at(-1)]){
  const c={...game.createContext(game.world,input.seed),windows:structuredClone(input.windows)};
  const zone=game.world.zones.find(z=>z.monsterId===monster.id);
  const native=game.predict(input.player,c,p=>game.startFight(p,c,zone.id));
  const result=simulateMonster({format:'snapshot',snapshot:input},monster);
  assert.deepEqual(result.bySkill,native.bySkill);assert.equal(result.xp,Object.values(native.bySkill).reduce((a,b)=>a+b,0));assert.equal(result.elapsedTicks,native.ticks);assert.equal(result.deaths,native.deaths);
  const items={...result.normalItems};for(const [id,qty]of Object.entries(result.rareItems))items[id]=(items[id]??0)+qty;
  if(native.itemsGained[game.coinItemId])items[game.coinItemId]=result.kills;
  assert.deepEqual(items,native.itemsGained);
 }
});
test('snapshot errors reject old protocols, server-only data, incomplete fields and invalid context',()=>{
 assert.throws(()=>importSnapshot({version:1}),/invalidSnapshot/);
 assert.throws(()=>importSnapshot({version:2,player:fixture().player}),/predictionMissing/);
 const unsupported=fixture();unsupported.prediction.clientBuild='index-unreviewed.js';assert.throws(()=>importSnapshot(unsupported),/incompatibleClient/);
 const bad=fixture();delete bad.prediction.player.bankLocked;assert.throws(()=>importSnapshot(bad),/incompleteSnapshot/);
 const noSeed=fixture();delete noSeed.prediction.seed;assert.throws(()=>importSnapshot(noSeed),/invalidSnapshot/);
 const badWindow=fixture();badWindow.prediction.windows[0].toTick=-1;assert.throws(()=>importSnapshot(badWindow),/invalidSnapshot/);
});
test('configuration import has no category selection and resets simulation preferences',()=>{
 const old=preset('magic');old.manual.hotSetting='off';old.manual.simulationHours=24;
 const result=importCharacter(old,fixture());assert.equal(result.applied.length,9);assert.equal(result.state.manual.hotSetting,'game');assert.equal(result.state.manual.simulationHours,1);
 assert.equal(result.state.levels.ranged,game.level(fixture().player.skills.ranged));assert.equal(result.state.style,'ranged');assert.equal(old.style,'magic');
});

test('snapshot preview preserves prior fallback fields and preferences',()=>{
 const old=preset('magic');old.manual.vendorValues=true;old.manual.enemySelection='custom';old.manual.simulationHours=24;old.manual.hotSetting='off';old.masteries.xp=7;
 const snap=fixture();delete snap.player.masteries;
 const result=importCharacter(old,snap,{preview:true});
 assert.equal(result.state.manual.vendorValues,true);assert.equal(result.state.manual.simulationHours,24);assert.equal(result.state.manual.hotSetting,'off');assert.equal(result.state.masteries.xp,7);
 assert.equal(old.masteries.xp,7);
});
