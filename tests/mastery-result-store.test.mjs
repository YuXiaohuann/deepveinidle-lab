import test from 'node:test';
import assert from 'node:assert/strict';
import {preset} from '../src/model.js';
import {masteryDefaults} from '../src/mastery.js';
import {gatheringDefaults,gatheringJobs} from '../src/gathering-model.js';
import {optimizerInput,optimizerIncomeItems} from '../src/mastery-optimizer.js';
import {masteryResultStorageKey,masteryResultEngine,emptyMasteryResults,createMasteryResult,validateMasteryResult,readMasteryResults,writeMasteryResults,optimizerContextKey} from '../src/mastery-result-store.js';

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
 const {request,result}=fixture(),record=createMasteryResult(request,result,1,request.now+100);
 request.combat.gear.weapon.plus=0;result.plans[1].ranks.accuracy=2;
 assert.equal(record.plan.ranks.accuracy,1);assert.equal(record.input.combat.gear.weapon.plus,5);
 assert.equal(record.input.gathering,undefined);assert.equal(record.input.monster,undefined);assert.equal(record.plan.samples,undefined);
 const db=storage(),saved=writeMasteryResults(db,emptyMasteryResults(),{...emptyMasteryResults(),manual:record,selected:'manual'});
 assert.deepEqual(readMasteryResults(db),saved);assert.equal(saved.revision,1);
});
test('updating automatic best preserves manual choice and selected slot',()=>{
 const {request,result}=fixture(),manual=createMasteryResult(request,result,1),auto=createMasteryResult(request,result,0);
 const db=storage();let state=writeMasteryResults(db,emptyMasteryResults(),{...emptyMasteryResults(),manual,selected:'manual'});
 state=writeMasteryResults(db,state,{...state,auto});assert.deepEqual(state.manual,manual);assert.equal(state.auto.plan.ranks.maxhit,1);assert.equal(state.selected,'manual');
 state=writeMasteryResults(db,state,{...state,auto:null});assert.deepEqual(state.manual,manual);
});
test('failed writes preserve original stored result and revision',()=>{
 const db=storage(),{request,result}=fixture();const state=writeMasteryResults(db,emptyMasteryResults(),{...emptyMasteryResults(),auto:createMasteryResult(request,result)}),before=db.getItem(masteryResultStorageKey);
 db.setItem=()=>{throw Error('quota');};assert.throws(()=>writeMasteryResults(db,state,{...state,manual:state.auto}),/quota/);assert.equal(db.getItem(masteryResultStorageKey),before);
});
test('corrupt, incompatible and semantically invalid saves are rejected without modifying storage',()=>{
 const {request,result}=fixture(),valid=createMasteryResult(request,result);
 for(const change of [r=>r.engine='old',r=>r.plan.ranks.maxhit=201,r=>r.plan.cost=0,r=>r.plan.stats.mean=null,r=>r.input.combat.gear.weapon.id=999999,r=>r.baseline.ranks.hp=1,r=>r.input.totalPoints=0,r=>r.input.now=0,r=>r.plan.paired.se=-1]){
  const record=structuredClone(valid);change(record);assert.throws(()=>validateMasteryResult(record));
 }
 const db=storage();for(const raw of ['{','null',JSON.stringify({...emptyMasteryResults(),version:9}),JSON.stringify({...emptyMasteryResults(),auto:{engine:masteryResultEngine}})]){
  db.setItem(masteryResultStorageKey,raw);assert.throws(()=>readMasteryResults(db));assert.equal(db.getItem(masteryResultStorageKey),raw);
 }
});
test('stale tab revision cannot overwrite another tab result or selection',()=>{
 const db=storage(),stale=readMasteryResults(db);const current=writeMasteryResults(db,stale,{...stale,selected:'manual'});
 assert.throws(()=>writeMasteryResults(db,stale,{...stale,selected:'auto'}),/savedMasteryConflict/);assert.deepEqual(readMasteryResults(db),current);
});
test('input matching accepts numeric drafts and ignores unused page/task but rejects blank totals and actual equipment changes',()=>{
 const {request}=fixture(),key=optimizerContextKey(request);
 assert.equal(optimizerContextKey({...request,totalPoints:'123',jobId:99,gathering:{},language:'en',target:{xp:4}}),key);
 assert.notEqual(optimizerContextKey({...request,totalPoints:''}),optimizerContextKey({...request,totalPoints:0}));
 const changed=structuredClone(request);changed.combat.gear.weapon.plus++;assert.notEqual(optimizerContextKey(changed),key);
});
test('gathering saved input uses the selected job skill even when source page selects a different skill',()=>{
 const raw={objective:'gatherCollection',allocationMode:'reset',current:masteryDefaults().current,totalPoints:0,effort:'fast',jobId:gatheringJobs.find(j=>j.skill==='fishing'&&j.levelReq===1).id,gathering:gatheringDefaults(),now:1794096000000};
 assert.equal(optimizerContextKey(raw),optimizerContextKey(optimizerInput(raw)));
});
test('income records retain their original effective prices, accept zero and reject missing prices',()=>{
 const {request,result}=fixture();request.objective='combatIncome';result.objective='combatIncome';
 request.prices=Object.fromEntries(optimizerIncomeItems(optimizerInput(request)).map(id=>[id,{price:0}]));
 const record=createMasteryResult(request,result),id=Object.keys(request.prices)[0];request.prices[id].price=100;
 assert.equal(record.input.prices[id].price,0);assert.equal(validateMasteryResult(record),record);
 delete record.input.prices[id];assert.throws(()=>validateMasteryResult(record),/missingOptimizerPrices/);
});
