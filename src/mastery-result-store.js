import {game} from './model.js';
import {optimizerInput,optimizerScenario,optimizerPolicy,checkOptimizerPrices} from './mastery-optimizer.js';
import {gatheringJobs} from './gathering-model.js';

export const masteryResultStorageKey='dvi-mastery-results-v1';
// Bump when simulation, search, valuation, or upstream rules change incompatibly.
export const masteryResultEngine='mastery-1/game-1.0.1212';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const number=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')?Number(v):NaN;
function requireValue(ok){if(!ok)throw Error('invalidSavedMasteryResult');}
function ranks(value){requireValue(object(value)&&game.masteries.every(m=>integer(value[m.id])&&value[m.id]<=game.masteryRankLimit));}
function stats(value){requireValue(object(value)&&['mean','sd','se'].every(k=>Number.isFinite(value[k]))&&value.sd>=0&&value.se>=0);}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(object(value))return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 return value;
}
export function optimizerContext(raw){
 const gathering=optimizerPolicy(raw.objective).gathering;
 return {objective:raw.objective,allocationMode:raw.allocationMode,totalPoints:number(raw.totalPoints),current:Object.fromEntries(game.masteries.map(m=>[m.id,number(raw.current?.[m.id])])),effort:raw.effort,
  ...(gathering?{jobId:raw.jobId,gathering:optimizerScenario(raw.objective,{...raw.gathering,skill:gatheringJobs.find(j=>j.id===raw.jobId)?.skill})}:{monsterId:raw.monsterId,combat:optimizerScenario(raw.objective,raw.combat)})};
}
export function optimizerContextKey(raw){return JSON.stringify(stable(optimizerContext(raw)));}
export function validateMasteryResult(record){
 requireValue(object(record));
 if(record.engine!==masteryResultEngine)throw Error('savedMasteryVersion');
 requireValue(integer(record.savedAt)&&record.savedAt>0&&object(record.input)&&object(record.plan)&&object(record.baseline));
 const raw=record.input;requireValue(integer(raw.now)&&raw.now>0&&object(raw.current));ranks(raw.current);
 requireValue(integer(raw.totalPoints)&&object(raw.prices));
 const input=optimizerInput(raw);checkOptimizerPrices(input,raw.prices);
 const {now,prices,...context}=raw;
 requireValue(JSON.stringify(stable(context))===JSON.stringify(stable(optimizerContext(raw))));
 const plan=record.plan,base=record.baseline;ranks(plan.ranks);ranks(base.ranks);stats(plan.stats);
 requireValue(plan.cost===game.masteriesTotalCost(plan.ranks)&&plan.cost<=input.totalPoints);
 requireValue(base.cost===game.masteriesTotalCost(base.ranks)&&base.overBudget===(base.cost>input.totalPoints)&&typeof base.viable==='boolean');
 requireValue(JSON.stringify(stable(base.ranks))===JSON.stringify(stable(input.current)));
 if(base.viable)stats(base.stats);else requireValue(base.stats===null);
 if(plan.paired!==null)stats(plan.paired);
 requireValue(plan.paired===null||base.viable&&!base.overBudget);
 if(input.allocationMode==='remaining'){
  requireValue(game.masteries.every(m=>plan.ranks[m.id]>=input.current[m.id]));
  requireValue(plan.additionalCost===plan.cost-base.cost);
 }else requireValue(plan.additionalCost===null);
 return record;
}
export function createMasteryResult(request,result,index=0,savedAt=Date.now()){
 requireValue(object(result)&&result.objective===request.objective&&result.allocationMode===request.allocationMode&&result.totalPoints===request.totalPoints&&Array.isArray(result.plans));
 const plan=result.plans[index];requireValue(object(plan));
 const input={...optimizerContext(request),now:request.now,prices:structuredClone(request.prices)};
 return structuredClone(validateMasteryResult({engine:masteryResultEngine,savedAt,input,baseline:result.baseline,plan:{ranks:plan.ranks,cost:plan.cost,additionalCost:plan.additionalCost,stats:plan.stats,paired:plan.paired}}));
}
export function emptyMasteryResults(){return {version:1,revision:0,selected:'auto',manual:null,auto:null};}
function validateStore(value){
 requireValue(object(value));if(value.version!==1)throw Error('savedMasteryVersion');
 requireValue(integer(value.revision)&&['manual','auto'].includes(value.selected));
 for(const slot of ['manual','auto'])if(value[slot]!==null)validateMasteryResult(value[slot]);
 return value;
}
export function readMasteryResults(storage){
 const raw=storage.getItem(masteryResultStorageKey);return raw===null?emptyMasteryResults():validateStore(JSON.parse(raw));
}
export function writeMasteryResults(storage,previous,next){
 const current=readMasteryResults(storage);
 if(JSON.stringify(current)!==JSON.stringify(previous))throw Error('savedMasteryConflict');
 const value=validateStore({...next,version:1,revision:current.revision+1});
 storage.setItem(masteryResultStorageKey,JSON.stringify(value));return value;
}
