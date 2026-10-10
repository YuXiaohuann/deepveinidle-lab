import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {gatheringDefaults,gatheringJobs,gatheringSkills,normalizeGathering,gatheringPlayer,selectedGatheringSites,gatheringStats,importGathering} from '../src/gathering-model.js';
import {createGatheringScenario,simulateGatheringSite,simulateGatheringJob,averageGatheringSites} from '../src/gathering-simulation.js';
import {combatHot,combatHotWindows} from '../src/combat-hot.js';
import {manualWindows} from '../src/manual-settings.js';
import {nativeDay} from './native-day.mjs';
const jobFor=skill=>gatheringJobs.find(j=>j.skill===skill);

test('gathering scope, normalization, tools and independent skill settings',()=>{
 assert.deepEqual(gatheringSkills.map(s=>gatheringJobs.filter(j=>j.skill===s).length),[8,8,6,8]);
 const d=gatheringDefaults();assert.equal(d.simulationHours,24);assert.equal(d.siteSelection,0);
 const s=normalizeGathering({...d,skill:'fishing',jobSelection:1,siteSelection:1,gear:{rod:{id:89,tier:4,plus:10}},levels:{mining:85,fishing:40},perks:{quick:100}});
 assert.equal(s.jobSelection,'all');assert.equal(s.siteSelection,0);assert.equal(s.levels.mining,85);assert.equal(s.levels.fishing,40);assert.equal(s.perks.quick,10);
 const p=gatheringPlayer(s).player;assert.equal(p.equipment.rod,game.encode(game.withRarity(89,4),10));assert.equal(p.skills.fishing,game.levelXp(40));assert.equal(p.eatAt,0);assert.deepEqual(p.bank,{});
 assert.ok(gatheringStats(s).toolBonus>0);assert.equal(gatheringStats(s).capacity,28);
 assert.equal(normalizeGathering({...d,simulationHours:0,hotSetting:'bad'}).hotSetting,'game');
});

test('all point average uses actual counts, fractions, item quality and elapsed ratios',()=>{
 const row=(id,qty,xp,elapsed,moving)=>({siteId:id,durationTicks:6000,startLevel:1,endLevel:2,endedEarly:false,completed:qty,attempts:qty,caught:0,stunnedTicks:0,xp,coins:3,normal:qty,rare:1,elapsedTicks:elapsed,workingTicks:elapsed-moving,movingTicks:moving,deposits:1,normalItems:{1:qty},rareItems:{100:1}});
 const a=averageGatheringSites([row(1,2,10,100,20),row(2,5,30,200,10)]);
 assert.equal(a.completed,3.5);assert.equal(a.xp,20);assert.equal(a.normalItems[1],3.5);assert.equal(a.rareItems[100],1);assert.equal(a.coins,3);assert.equal(a.movingRatio,.1);
 assert.equal(a.totalIncome,a.coins+a.normalValue+a.rareValue);
 assert.throws(()=>averageGatheringSites([row(1,1,1,1,1)],2),/incompleteSites/);
 assert.throws(()=>averageGatheringSites([row(1,1,1,1,1),row(1,1,1,1,1)]),/incompleteSites/);
 const zero=averageGatheringSites([row(1,0,0,0,0)]);assert.equal(zero.movingRatio,null);
 const bad=row(1,1,1,1,1);bad.xp=NaN;assert.throws(()=>averageGatheringSites([bad]),/invalidResult/);
});

for(const skill of gatheringSkills)test(`${skill}: adapter matches independent original offline reports, upgrades and banking`,()=>{
 const s=gatheringDefaults();s.skill=skill;s.simulationHours=1;s.hotSetting='off';s.perks.pockets=5;s.perks.quick=10;s.masteries.gather=100;s.brews.gatherer=2;
 const job=jobFor(skill),site=selectedGatheringSites(s,job)[0],scenario=createGatheringScenario(s,job,site);
 const native=nativeDay(scenario.player,scenario.context,p=>game.startWork(p,scenario.context,site.id,job.id,'bank',null),scenario.durationTicks);
 const actual=simulateGatheringSite(s,job,site);
 assert.equal(actual.xp,native.bySkill[skill]);assert.equal(actual.elapsedTicks,native.ticks);
 const expected={...actual.normalItems};for(const [id,qty]of Object.entries(actual.rareItems))expected[id]=(expected[id]??0)+qty;if(actual.coins)expected[game.coinItemId]=actual.coins;
 assert.deepEqual(expected,native.itemsGained);assert.ok(actual.endLevel>actual.startLevel);assert.ok(actual.completed>0);
 if(skill!=='thieving')assert.ok(actual.deposits>0);else{assert.ok(actual.caught>0);assert.equal(actual.attempts,actual.completed+actual.caught);assert.ok(actual.stunnedTicks>0);assert.equal(actual.normal,0);}
});

test('every copper point is simulated, manual point and bank retained',()=>{
 const s={...gatheringDefaults(),simulationHours:1/60},job=jobFor('mining');let count=0;
 const r=simulateGatheringJob(s,job,{onSite:()=>count++});assert.equal(count,3);assert.equal(r.siteCount,3);assert.equal(r.completed,r.sites.reduce((sum,p)=>sum+p.completed,0)/3);
 const selected={...s,jobSelection:job.id,siteSelection:r.sites[0].siteId,homeBank:2};
 const one=simulateGatheringJob(selected,job);assert.equal(one.siteCount,1);assert.equal(one.sites[0].homeBank,2);
 assert.throws(()=>simulateGatheringSite(s,gatheringJobs.find(j=>j.levelReq>1),game.world.sites[0]),/invalidSite|levelTooLow/);
});

test('skill-specific hot windows cancel only matching skill and map current schedule',()=>{
 const start=game.predictionStartTick,end=start+144000;
 for(const skill of gatheringSkills){const windows=manualWindows(start,end,10,true,skill);for(let tick=start;tick<end;tick+=1000){const hot=game.hotSkill(tick),xp=windows.filter(w=>w.fromTick<=tick&&tick<=w.toTick).reduce((a,w)=>a+(w.xpMult-1),1);assert.ok(Math.abs(xp+(hot.skill===skill&&hot.kind==='xp'?hot.mult-1:0)-1.1)<1e-10);}
  const schedule=combatHot(Date.now(),24,skill);assert.ok(schedule.entries.every(h=>h.skill===skill));assert.equal(combatHotWindows(schedule).length,schedule.entries.length);
 }
});

test('configuration import maps gathering fields and restores simulation defaults',()=>{
 const d=gatheringDefaults(),p=gatheringPlayer(d).player;p.skills.mining=game.levelXp(85)+10;p.equipment.pickaxe=game.encode(game.withRarity(84,3),5);p.brews.gatherer=p.lastTick+100;p.brewTier.gatherer=2;p.perks.hands=8;p.masteries.gather=7;
 const snapshot={version:2,capturedAt:Date.now(),player:p,worldTick:p.lastTick,worldBuffs:[]};
 const r=importGathering({...d,simulationHours:1,jobSelection:1,siteSelection:1},snapshot);
 assert.equal(r.state.levels.mining,85);assert.deepEqual(r.state.gear.pickaxe,{id:84,tier:3,plus:5});assert.equal(r.state.brews.gatherer,2);assert.equal(r.state.perks.hands,8);assert.equal(r.state.masteries.gather,7);assert.equal(r.state.simulationHours,24);assert.equal(r.state.siteSelection,0);assert.equal(r.state.jobSelection,'all');
 p.skills.mining='bad';const partial=importGathering({...d,levels:{...d.levels,mining:90}},snapshot);assert.equal(partial.state.levels.mining,90);assert.ok(partial.warnings.includes('skills.mining'));
 assert.throws(()=>importGathering(d,{...snapshot,version:1}),/invalidSnapshot/);
});

for(const skill of gatheringSkills)test(`${skill}: every task and point matches original offline inventory and XP`,()=>{
 const s=gatheringDefaults();s.skill=skill;s.levels[skill]=100;s.simulationHours=1;s.hotSetting='off';s.gear[{mining:'pickaxe',fishing:'rod',woodcutting:'axe',thieving:'gloves'}[skill]]={id:{mining:84,fishing:89,woodcutting:94,thieving:327}[skill],tier:4,plus:5};s.gear.amulet={id:186,tier:4,plus:5};s.brews.hunter=4;s.masteries.rare=100;
 for(const job of gatheringJobs.filter(j=>j.skill===skill))for(const site of selectedGatheringSites(s,job)){
  const scenario=createGatheringScenario(s,job,site);let p;game.predict(scenario.player,scenario.context,prepared=>{p=prepared;return false;});p.offlineCapTicks=scenario.durationTicks*2;
  assert.ok(game.startWork(p,scenario.context,site.id,job.id,'bank',null));
  const initialXp=p.skills[skill];for(let tick=game.predictionChunkTicks;tick<=scenario.durationTicks;tick+=game.predictionChunkTicks)game.offline(p,scenario.context,game.predictionStartTick+tick);
  const actual=simulateGatheringSite(s,job,site),inventory={...p.bank};for(const item of p.pack)inventory[item.itemId]=(inventory[item.itemId]??0)+item.qty;for(const [id,qty]of Object.entries(p.overflow))inventory[id]=(inventory[id]??0)+qty;
  const expected={...actual.normalItems};for(const [id,qty]of Object.entries(actual.rareItems))expected[id]=(expected[id]??0)+qty;
  assert.deepEqual(expected,inventory,`${skill} job ${job.id} site ${site.id}`);assert.equal(actual.coins,p.coins);assert.equal(actual.xp,p.skills[skill]-initialXp);
 }
});

test('nearest strategy preserves original point order and uses the prediction depot start',()=>{
 const d=gatheringDefaults(),job=jobFor('mining');
 const automatic={...d,siteSelection:'nearest',simulationHours:1/60};
 assert.equal(normalizeGathering(automatic).siteSelection,'nearest');
 assert.equal(selectedGatheringSites(automatic,job)[0].id,1);
 assert.equal(selectedGatheringSites({...automatic,homeBank:1},job)[0].id,1);
 const second=selectedGatheringSites({...automatic,homeBank:2},job);assert.equal(second.length,1);
 const theft=jobFor('thieving');assert.equal(selectedGatheringSites({...automatic,skill:'thieving',homeBank:2},theft)[0].id,84);
 assert.equal(game.nearestWorkSite({world:{sites:[{id:3,x:1,y:0,jobIds:[1]},{id:2,x:0,y:1,jobIds:[1]}]}},1,0,0),3);
 const result=simulateGatheringJob(automatic,job);assert.equal(result.siteCount,1);assert.equal(result.sites[0].siteId,1);
 assert.equal(normalizeGathering({...automatic,jobSelection:job.id}).siteSelection,'nearest');
 assert.equal(normalizeGathering({...automatic,siteSelection:'bad'}).siteSelection,0);
});

test('gathering output names translate base items independently of all quality prefixes',async()=>{
 const {translatedItemName}=await import('../src/i18n.js');
 assert.equal(translatedItemName(game.withRarity(1,2),'zh'),'铜矿');
 assert.equal(translatedItemName(game.withRarity(1,2),'en'),'Copper');
 for(const job of gatheringJobs){if(job.output.itemId===game.coinItemId)continue;for(let tier=0;tier<5;tier++){
  const id=game.withRarity(job.output.itemId,tier),zh=translatedItemName(id,'zh');assert.match(zh,/[\u3400-\u9fff]/);assert.doesNotMatch(zh,/Normal|Uncommon|Rare|Epic|Legendary/);
 }}
});

test('luck uses only the active tool quality and amulet, separately from rare-find multipliers',()=>{
 const slots={mining:'pickaxe',fishing:'rod',woodcutting:'axe',thieving:'gloves'};
 assert.equal(gatheringStats(gatheringDefaults()).luck,0);
 for(const [skill,slot]of Object.entries(slots)){
  const s=gatheringDefaults();s.skill=skill;
  const id=game.tools.find(t=>t.slot===slot&&game.itemTier(t.itemId)===0).itemId;
  for(const [tier,expected]of [0,.25,.75,2,5].entries()){
   s.gear[slot]={id,tier,plus:0};assert.equal(gatheringStats(s).luck,expected);
   s.gear[slot].plus=10;assert.equal(gatheringStats(s).luck,expected);
  }
  const amulet=game.equipment.find(g=>g.slot==='amulet'&&game.itemTier(g.itemId)===0);
  s.gear.amulet={id:amulet.itemId,tier:2,plus:5};
  const expected=5+game.gear(game.encode(game.withRarity(amulet.itemId,2),5)).luck;
  assert.equal(gatheringStats(s).luck,expected);
  s.house.shrine=100;s.masteries.rare=10;s.brews.hunter=4;s.blessing=true;
  assert.equal(gatheringStats(s).luck,expected);
  s.gear[slot].id=0;assert.equal(gatheringStats(s).luck,game.gear(game.encode(game.withRarity(amulet.itemId,2),5)).luck);
 }
});

test('combined luck adds rarity modifiers before multiplying equipment luck',()=>{
 const s=gatheringDefaults();assert.equal(gatheringStats(s).luckBonus,0);
 s.gear.pickaxe={id:game.tools.find(t=>t.slot==='pickaxe'&&game.itemTier(t.itemId)===0).itemId,tier:2,plus:0};
 s.gear.amulet={id:game.equipment.find(g=>g.slot==='amulet'&&game.itemTier(g.itemId)===0).itemId,tier:0,plus:0};
 assert.equal(gatheringStats(s).luck,1);assert.equal(gatheringStats(s).luckBonus,1);
 s.brews.hunter=0;s.blessing=true;s.house.shrine=10;s.masteries.rare=10;
 assert.ok(Math.abs(gatheringStats(s).luckBonus-1.9)<1e-12);
 s.hotSetting='current';assert.ok(Math.abs(gatheringStats(s).luckBonus-1.9)<1e-12);
});
