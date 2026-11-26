import test from 'node:test';
import assert from 'node:assert/strict';
import {preset} from '../src/model.js';
import {masteryPlanMetrics,masteryPlanHistoryNote} from '../src/mastery-plan-view.js';
import {masteryDefaults} from '../src/mastery.js';
import {craftingDefaults,craftingJobs} from '../src/crafting-model.js';
import {gatheringDefaults,gatheringJobs} from '../src/gathering-model.js';
import {optimizerInput,optimizerIncomeItems} from '../src/mastery-optimizer.js';
import {masteryResultStorageKey,masteryResultEngine,emptyMasteryResults,createMasteryResult,validateComputedMasteryResult,readMasteryResults,writeMasteryResults,optimizerTaskKey,validateSavedMasteryPlan,masteryResultHistory} from '../src/mastery-result-store.js';

function fixture(){
 const current=masteryDefaults().current;
 const request={...optimizerInput({objective:'combatCollection',allocationMode:'reset',totalPoints:123,current,effort:'fast',monsterId:7,combat:preset('ranged'),gathering:gatheringDefaults(),now:1794096000000}),prices:{}};
 const stats={mean:100,sd:2,se:1};
 const baseline={ranks:current,cost:0,overBudget:false,viable:true,stats};
 const plans=[{ranks:{...current,maxhit:1},cost:40,additionalCost:null,stats,paired:{mean:10,sd:2,se:1}},{ranks:{...current,accuracy:1},cost:40,additionalCost:null,stats:{...stats,mean:95},paired:{mean:5,sd:2,se:1}}];
 return {request,result:{objective:request.objective,allocationMode:'reset',totalPoints:123,baseline,plans}};
}
function storage(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}

test('saved plan freezes only relevant input and selected recommendation; round trip is independent of live configuration',()=>{
 const {request,result}=fixture(),record=createMasteryResult(request,result,1);
 request.combat.gear.weapon.plus=0;result.plans[1].ranks.accuracy=2;
 assert.equal(record.plan.ranks.accuracy,1);assert.equal(record.input.combat.gear.weapon.plus,5);
 assert.equal(record.input.gathering,undefined);assert.equal(record.input.monster,undefined);assert.equal(record.plan.samples,undefined);
 const db=storage(),saved=writeMasteryResults(db,emptyMasteryResults(),{...emptyMasteryResults(),manual:record});
 assert.deepEqual(readMasteryResults(db),saved);assert.equal(saved.revision,1);
});
test('updating automatic best preserves the independent manual plan',()=>{
 const {request,result}=fixture(),manual=createMasteryResult(request,result,1),auto=createMasteryResult(request,result,0);
 const db=storage();let state=writeMasteryResults(db,emptyMasteryResults(),{...emptyMasteryResults(),manual});
 state=writeMasteryResults(db,state,{...state,auto});assert.deepEqual(state.manual,manual);assert.equal(state.auto.plan.ranks.maxhit,1);
 state=writeMasteryResults(db,state,{...state,auto:null});assert.deepEqual(state.manual,manual);
});
test('failed writes preserve original stored result and revision',()=>{
 const db=storage(),{request,result}=fixture();const state=writeMasteryResults(db,emptyMasteryResults(),{...emptyMasteryResults(),auto:createMasteryResult(request,result)}),before=db.getItem(masteryResultStorageKey);
 db.setItem=()=>{throw Error('quota');};assert.throws(()=>writeMasteryResults(db,state,{...state,manual:state.auto}),/quota/);assert.equal(db.getItem(masteryResultStorageKey),before);
});
test('new calculation records require compatible engine, consistent input and valid metrics',()=>{
 const {request,result}=fixture(),valid=createMasteryResult(request,result);
 for(const change of [r=>r.engine='old',r=>r.plan.ranks.maxhit=201,r=>r.plan.cost=0,r=>r.plan.stats.mean=null,r=>r.input.combat.gear.weapon.id=999999,r=>r.baseline.ranks.hp=1,r=>r.input.totalPoints=0,r=>r.input.now=0,r=>r.plan.paired.se=-1]){
  const record=structuredClone(valid);change(record);assert.throws(()=>validateComputedMasteryResult(record));
 }
});
test('corrupt storage or unsupported container schema preserves original data',()=>{
 const db=storage();for(const raw of ['{','null',JSON.stringify({...emptyMasteryResults(),version:9}),JSON.stringify({...emptyMasteryResults(),auto:{engine:masteryResultEngine}})]){
  db.setItem(masteryResultStorageKey,raw);assert.throws(()=>readMasteryResults(db));assert.equal(db.getItem(masteryResultStorageKey),raw);
 }
});
test('stale tab cannot overwrite another tab result',()=>{
 const db=storage(),stale=readMasteryResults(db),{request,result}=fixture(),record=createMasteryResult(request,result);
 const current=writeMasteryResults(db,stale,{...stale,auto:record});
 assert.throws(()=>writeMasteryResults(db,stale,{...stale,manual:record}),/savedMasteryConflict/);assert.deepEqual(readMasteryResults(db),current);
});
test('running task key accepts numeric drafts and ignores unused page/task but rejects blank totals and actual equipment changes',()=>{
 const {request}=fixture(),key=optimizerTaskKey(request);
 assert.equal(optimizerTaskKey({...request,totalPoints:'123',jobId:99,gathering:{},language:'en',target:{xp:4}}),key);
 assert.notEqual(optimizerTaskKey({...request,totalPoints:''}),optimizerTaskKey({...request,totalPoints:0}));
 const changed=structuredClone(request);changed.combat.gear.weapon.plus++;assert.notEqual(optimizerTaskKey(changed),key);
});
test('gathering task key uses the selected job skill even when source page selects a different skill',()=>{
 const raw={objective:'gatherCollection',allocationMode:'reset',current:masteryDefaults().current,totalPoints:0,effort:'fast',jobId:gatheringJobs.find(j=>j.skill==='fishing'&&j.levelReq===1).id,gathering:gatheringDefaults(),now:1794096000000};
 assert.equal(optimizerTaskKey(raw),optimizerTaskKey(optimizerInput(raw)));
 assert.notEqual(optimizerTaskKey(raw),optimizerTaskKey({...raw,workMode:'fast'}));
});
test('income records retain their original effective prices, accept zero and reject missing prices',()=>{
 const {request,result}=fixture();request.objective='combatIncome';result.objective='combatIncome';
 request.prices=Object.fromEntries(optimizerIncomeItems(optimizerInput(request)).map(id=>[id,{price:0}]));
 const record=createMasteryResult(request,result),id=Object.keys(request.prices)[0];request.prices[id].price=100;
 assert.equal(record.input.prices[id].price,0);assert.equal(validateComputedMasteryResult(record),record);
 delete record.input.prices[id];assert.throws(()=>validateComputedMasteryResult(record),/missingOptimizerPrices/);
});
test('running task key ignores source UI filters, overridden masteries, guild identity and search effort',()=>{
 const {request}=fixture(),changed=structuredClone(request),key=optimizerTaskKey(request);
 changed.effort='deep';changed.combat.masteries.maxhit=5;changed.combat.guild={name:'Another guild',tag:'TAG'};
 Object.assign(changed.combat.manual,{enemySelection:'monster-7',allGear:true,simulationHours:1,customSimulation:true});
 assert.equal(optimizerTaskKey(changed),key);
 const jobId=gatheringJobs.find(j=>j.skill==='mining'&&j.levelReq===1).id;
 const gathering={...request,objective:'gatherCollection',jobId,gathering:gatheringDefaults()};
 const other=structuredClone(gathering);Object.assign(other.gathering,{jobSelection:jobId,guild:{name:'Another guild',tag:'TAG'},simulationHours:3,customSimulation:true});other.gathering.masteries.gather=5;
 assert.equal(optimizerTaskKey(other),optimizerTaskKey(gathering));
});
test('running task key retains whole levels/equipment and other simulation input groups',()=>{
 const {request}=fixture(),key=optimizerTaskKey(request);
 for(const change of [s=>s.levels.magic++,s=>s.gear.weapon.plus++,s=>s.brews.warrior=1,s=>s.house.post=1,s=>s.manual.perks.pockets=1,s=>s.food.tier=1,s=>s.manual.guildXp=5,s=>s.manual.weeklyXp=5,s=>s.manual.worldRarity=5,s=>s.manual.blessing=true,s=>s.manual.hotSetting='off',s=>s.manual.ironman=true,s=>s.eatAt=75]){
  const changed=structuredClone(request);change(changed.combat);assert.notEqual(optimizerTaskKey(changed),key);
 }
 const jobId=gatheringJobs.find(j=>j.skill==='mining'&&j.levelReq===1).id;
 const gathering={...request,objective:'gatherCollection',jobId,gathering:gatheringDefaults()},gatherKey=optimizerTaskKey(gathering);
 for(const change of [s=>s.levels.fishing++,s=>s.brews.gatherer=1,s=>s.house.mine=1,s=>s.perks.pockets=1,s=>s.guildXp=5,s=>s.weeklyXp=5,s=>s.worldRarity=5,s=>s.discardGathered=true,s=>s.ironman=true]){
  const changed=structuredClone(gathering);change(changed.gathering);assert.notEqual(optimizerTaskKey(changed),gatherKey);
 }
});
test('task input normalization still validates and retains full stored input including effort and filters',()=>{
 const {request,result}=fixture();request.combat.manual.enemySelection='monster-7';request.combat.masteries.maxhit=2;
 const record=createMasteryResult(request,result);assert.equal(record.input.effort,'fast');assert.equal(record.input.combat.manual.enemySelection,'monster-7');assert.equal(record.input.combat.masteries.maxhit,2);
 const db=storage(),value=writeMasteryResults(db,emptyMasteryResults(),{...emptyMasteryResults(),auto:record});assert.deepEqual(readMasteryResults(db),value);
 assert.equal(optimizerTaskKey({...request,effort:'deep',combat:{...request.combat,masteries:masteryDefaults().current}}),optimizerTaskKey(record.input));
});

test('opening result storage leaves character and mastery drafts untouched',()=>{
 const db=storage(),character=JSON.stringify({language:'zh',state:preset('ranged')}),mastery=JSON.stringify({...masteryDefaults(),totalPoints:123});
 db.setItem('dvi-simulator-v1',character);db.setItem('dvi-mastery-v1',mastery);
 assert.deepEqual(readMasteryResults(db),emptyMasteryResults());assert.equal(db.getItem(masteryResultStorageKey),null);
 assert.equal(db.getItem('dvi-simulator-v1'),character);assert.equal(db.getItem('dvi-mastery-v1'),mastery);
});

test('XP records round-trip without prices; crafting context tracks recipe, rarity and build, excluding orders',()=>{
 for(const objective of ['combatXp','gatherXp','craftXp']){
  const {request,result}=fixture();request.objective=result.objective=objective;
  request.jobId=gatheringJobs.find(j=>j.levelReq===1).id;
  request.crafting=craftingDefaults();request.recipeId=craftingJobs.find(j=>j.levelReq===1).id;request.tier=0;
  const record=createMasteryResult(request,result),db=storage();
  writeMasteryResults(db,emptyMasteryResults(),{...emptyMasteryResults(),auto:record,manual:record});
  assert.deepEqual(readMasteryResults(db).auto,record);
  assert.deepEqual(record.input.prices,{});
  if(objective!=='craftXp')continue;
  const key=optimizerTaskKey(record.input),changed=structuredClone(record.input);
  changed.crafting.plans={'1:0':999};changed.crafting.owned={1:100};changed.crafting.tiers={1:4};changed.crafting.simulationHours=1;
  assert.equal(optimizerTaskKey(changed),key);
  changed.tier=1;assert.notEqual(optimizerTaskKey(changed),key);changed.tier=0;
  changed.crafting.levels.cooking=2;assert.notEqual(optimizerTaskKey(changed),key);
  assert.equal(record.input.combat,undefined);assert.equal(record.input.gathering,undefined);
  const legacy=structuredClone(record);delete legacy.input.workMode;
  assert.equal(masteryResultHistory(legacy).workMode,'standard');
  assert.equal(validateComputedMasteryResult(legacy),legacy);
 }
});

test('saved allocation validation is independent of engine and damaged historical information',()=>{
 const {request,result}=fixture(),record=createMasteryResult(request,result),db=storage();
 for(const change of [r=>r.engine='mastery-1/game-previous',r=>r.input=null,r=>r.plan.stats.mean=null,r=>r.input.prices=null,r=>r.baseline=null]){
  const old=structuredClone(record);change(old);assert.equal(validateSavedMasteryPlan(old),old);
  db.setItem(masteryResultStorageKey,JSON.stringify({...emptyMasteryResults(),manual:old}));
  assert.deepEqual(readMasteryResults(db).manual,old);
  const saved=writeMasteryResults(db,readMasteryResults(db),{...readMasteryResults(db),auto:old});assert.deepEqual(saved.auto,old);
 }
 const old={...record,engine:'mastery-1/game-previous'};assert.equal(masteryResultHistory(old).oldEngine,true);assert.equal(masteryResultHistory(old).available,true);
 for(const broken of [{...record,input:null},{...record,baseline:null},{...record,plan:{...record.plan,stats:null}}])assert.equal(masteryResultHistory(broken).available,false);
 for(const ranks of [{...record.plan.ranks,unknown:0},{...record.plan.ranks,xp:201},{...record.plan.ranks,xp:'1'},{}]){
  const raw=JSON.stringify({...emptyMasteryResults(),manual:{...record,plan:{...record.plan,ranks}}});db.setItem(masteryResultStorageKey,raw);assert.throws(()=>readMasteryResults(db));assert.equal(db.getItem(masteryResultStorageKey),raw);
 }
});

test('plan metrics use current total points but retain the original objective and estimate',()=>{
 const {request,result}=fixture(),record=createMasteryResult(request,result);
 const enough=masteryPlanMetrics(record,123,'zh'),short=masteryPlanMetrics(record,0,'zh');
 assert.match(enough,/方案总投入/);assert.match(enough,/当前剩余/);assert.match(enough,/>83</);assert.match(enough,/计算时评分/);assert.match(enough,/>100</);
 assert.match(short,/当前缺口/);assert.match(short,/缺少 40 点/);assert.match(short,/>100</);
 assert.match(masteryPlanMetrics(record,'','en'),/>—</);
 assert.match(masteryPlanHistoryNote({...record,engine:'previous'},'zh'),/历史计算版本/);
 assert.match(masteryPlanHistoryNote({...record,input:null},'zh'),/分配方案仍可使用/);
});
