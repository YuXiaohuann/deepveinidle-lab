import * as game from './upstream.js';
import {normalize} from './model.js';
import {simulateMonster} from './simulation.js';
import {valueRewards,validPrice} from './item-prices.js';

export const optimizerTracks=['xp','move','hp','maxhit','accuracy','rare'];
export const optimizerEfforts={standard:240,deep:720};
export const screeningSeeds=[20261023,798997366];
export const reviewSeeds=[1426429260,20261024,371993,100718,20261025];
const zero=()=>Object.fromEntries(game.masteries.map(m=>[m.id,0]));
const key=r=>game.masteries.map(m=>r[m.id]).join(',');
const cost=r=>game.masteriesTotalCost(r);
function readRanks(raw){
 const ranks=zero();
 for(const m of game.masteries){const n=raw?.[m.id];if(!Number.isSafeInteger(n)||n<0||n>game.masteryRankLimit)throw Error('invalidOptimizerRanks');ranks[m.id]=n;}
 return ranks;
}
function allocationFloor(allocationMode,current,totalPoints){
 if(allocationMode==='reset')return zero();
 if(allocationMode!=='remaining')throw Error('invalidOptimizerMode');
 const floor=readRanks(current);
 if(cost(floor)>totalPoints)throw Error('optimizerCurrentOverBudget');
 return floor;
}
export function affordableRank(points){
 let lo=0,hi=game.masteryRankLimit;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(game.masteryTotalCost(mid)<=points)lo=mid;else hi=mid-1;}
 return lo;
}
export function optimizerInput(raw){
 if(!raw||raw.objective!=='combatIncome')throw Error('unsupportedObjective');
 if(!Number.isSafeInteger(raw.totalPoints)||raw.totalPoints<0)throw Error('invalidOptimizerPoints');
 if(!Object.hasOwn(optimizerEfforts,raw.effort))throw Error('invalidOptimizerEffort');
 const monster=game.monsters.find(m=>m.id===raw.monsterId);if(!monster)throw Error('invalidOptimizerMonster');
 const current=readRanks(raw.current),allocationMode=raw.allocationMode===undefined?'reset':raw.allocationMode;
 const floor=allocationFloor(allocationMode,current,raw.totalPoints);
 if(!raw.combat||typeof raw.combat!=='object'||!Number.isSafeInteger(raw.now)||raw.now<=0)throw Error('invalidOptimizerScenario');
 return {...raw,allocationMode,current,availablePoints:raw.totalPoints-cost(floor),combat:normalize(raw.combat),monster};
}
// All possible income items, including qualities absent from one random trial.
export function combatIncomeItems(combat,monster){
 const ids=new Set([monster.bonus.itemId,game.combatPetItem(monster.id),game.voidShardItemId]);
 for(let tier=0;tier<=4;tier++){ids.add(game.withRarity(monster.drop,tier));if(!combat.manual.ironman)ids.add(game.withRarity(game.mountItemId,tier));}
 return [...ids];
}
export function checkOptimizerPrices(input,prices){
 const missing=combatIncomeItems(input.combat,input.monster).filter(id=>!game.isPet(id)&&!validPrice(prices?.[id]?.price));
 if(missing.length){const error=Error('missingOptimizerPrices');error.itemIds=missing;throw error;}
}
export function sampleStats(values){
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 const sd=values.length>1?Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/(values.length-1)):0;
 return {mean,sd,se:sd/Math.sqrt(values.length)};
}
// Search is score-agnostic so budget handling and candidate quality can be
// checked independently against exhaustive small examples.
export function searchMasteryAllocations({totalPoints,current,allocationMode='reset',maxCandidates,evaluate}){
 if(!Number.isSafeInteger(totalPoints)||totalPoints<0||!Number.isSafeInteger(maxCandidates)||maxCandidates<1)throw Error('invalidOptimizerPoints');
 const floor=allocationFloor(allocationMode,current,totalPoints),available=totalPoints-cost(floor);
 const seen=new Map();
 const rank=(a,b)=>b.score-a.score||a.cost-b.cost||key(a.ranks).localeCompare(key(b.ranks));
 function visit(ranks){
  const id=key(ranks);if(seen.has(id))return seen.get(id);
  if(seen.size>=maxCandidates||cost(ranks)>totalPoints||game.masteries.some(m=>ranks[m.id]<floor[m.id]||!optimizerTracks.includes(m.id)&&ranks[m.id]!==floor[m.id]))return null;
  const result={ranks:{...ranks},cost:cost(ranks),score:evaluate({...ranks})};seen.set(id,result);return result;
 }
 // Enumerate only if the complete space fits the declared search allowance.
 const exhaustive=[];
 function enumerate(index,left,ranks){
  if(exhaustive.length>maxCandidates)return;
  if(index===optimizerTracks.length){exhaustive.push({...ranks});return;}
  const id=optimizerTracks[index],base=game.masteryTotalCost(floor[id]),max=affordableRank(left+base);
  for(let n=floor[id];n<=max&&exhaustive.length<=maxCandidates;n++){ranks[id]=n;enumerate(index+1,left-(game.masteryTotalCost(n)-base),ranks);}
  ranks[id]=floor[id];
 }
 enumerate(0,available,{...floor});
 if(exhaustive.length<=maxCandidates){for(const r of exhaustive)visit(r);return {candidates:[...seen.values()].sort(rank),exhaustive:true};}
 visit({...floor});
 if(current&&cost(current)<=totalPoints)visit({...floor,...Object.fromEntries(optimizerTracks.map(id=>[id,current[id]??0]))});
 const even={...floor};for(const id of optimizerTracks)even[id]=affordableRank(game.masteryTotalCost(floor[id])+Math.floor(available/optimizerTracks.length));visit(even);
 const extraRanks=id=>affordableRank(game.masteryTotalCost(floor[id])+available)-floor[id];
 for(const id of optimizerTracks)visit({...floor,[id]:floor[id]+extraRanks(id)});
 const steps=[];for(let step=2**Math.floor(Math.log2(Math.max(1,...optimizerTracks.map(extraRanks))));step>=1;step/=2)steps.push(step);
 for(const [stage,step]of steps.entries()){
  const limit=Math.min(maxCandidates,seen.size+Math.ceil((maxCandidates-seen.size)/(steps.length-stage)));
  let beam=[...seen.values()].sort(rank).slice(0,3),round=0;
  while(seen.size<limit&&beam.length){
   const before=seen.size,pool=[];
   // Round-robin across starting points avoids spending a stage on one root.
   for(let offset=0;offset<optimizerTracks.length&&seen.size<limit;offset++)for(const root of beam){
    const id=optimizerTracks[(offset+stage+round)%optimizerTracks.length];
    for(const direction of [1,-1]){
     if(seen.size>=limit)break;
     const r={...root.ranks},next=r[id]+direction*step;
     if(next<floor[id]||next>game.masteryRankLimit)continue;r[id]=next;const result=visit(r);if(result)pool.push(result);
    }
    for(const donor of optimizerTracks){
     if(seen.size>=limit)break;if(donor===id||root.ranks[donor]===floor[donor])continue;
     const r={...root.ranks};r[donor]=Math.max(floor[donor],r[donor]-step);r[id]=0;
     r[id]=affordableRank(totalPoints-cost(r));const result=visit(r);if(result)pool.push(result);
    }
   }
   beam=[...beam,...pool].sort(rank).filter((r,i,all)=>all.findIndex(x=>key(x.ranks)===key(r.ranks))===i).slice(0,3);
   if(seen.size===before)break;round++;
  }
 }
 return {candidates:[...seen.values()].sort(rank),exhaustive:false};
}

export function optimizeMastery(raw,{simulate=simulateMonster,onProgress=()=>{}}={}){
 const input=optimizerInput(raw);checkOptimizerPrices(input,input.prices);
 const cache=new Map();let simulations=0,excluded=0;
 const maxCandidates=optimizerEfforts[input.effort];
 const progress=(phase,candidates)=>onProgress({phase,candidates,maxCandidates,simulations,excluded});
 function trial(ranks,seed){
  const id=`${key(ranks)}:${seed}`;if(cache.has(id))return cache.get(id);
  const result=simulate({...input.combat,masteries:{...ranks}},input.monster,{seed,now:input.now});simulations++;
  let value=null;
  if(result.deaths===0&&!result.endedEarly){
   const valued=valueRewards(result,'custom',input.prices);
   if(valued.missingPrices.length)throw Error('missingOptimizerPrices');
   if(!Number.isFinite(valued.totalIncome)||valued.totalIncome<0)throw Error('invalidOptimizerIncome');value=valued.totalIncome;
  }
  cache.set(id,value);return value;
 }
 let screened=0;
 const search=searchMasteryAllocations({totalPoints:input.totalPoints,current:input.current,allocationMode:input.allocationMode,maxCandidates,evaluate:ranks=>{
  const trials=screeningSeeds.map(seed=>trial(ranks,seed));screened++;
  if(trials.includes(null))excluded++;
  progress('search',screened);return trials.includes(null)?-Infinity:sampleStats(trials).mean;
 }});
 const finalists=search.candidates.filter(c=>Number.isFinite(c.score)).slice(0,5);
 if(!finalists.length)throw Error('noViableOptimizerPlan');
 const baseSamples=reviewSeeds.map(seed=>trial(input.current,seed));
 const baseline={ranks:input.current,cost:cost(input.current),overBudget:cost(input.current)>input.totalPoints,viable:!baseSamples.includes(null),stats:baseSamples.includes(null)?null:sampleStats(baseSamples)};
 progress('review',screened);
 const reviewed=[];
 for(const candidate of finalists){
  const samples=reviewSeeds.map(seed=>trial(candidate.ranks,seed));
  if(samples.includes(null)){excluded++;continue;}
  const paired=baseline.viable&&!baseline.overBudget?sampleStats(samples.map((v,i)=>v-baseSamples[i])):null;
  reviewed.push({...candidate,samples,stats:sampleStats(samples),paired,remaining:input.totalPoints-candidate.cost,additionalCost:input.allocationMode==='remaining'?candidate.cost-baseline.cost:null});progress('review',screened);
 }
 // Keeping the current allocation is always an option in the remaining-points
 // mode, even when it was outside the five screening finalists.
 const baseCandidate=search.candidates.find(c=>key(c.ranks)===key(input.current));
 if(input.allocationMode==='remaining'&&baseline.viable&&Number.isFinite(baseCandidate?.score)&&!reviewed.some(c=>key(c.ranks)===key(input.current))){
  const candidate=baseCandidate;
  reviewed.push({...candidate,samples:baseSamples,stats:baseline.stats,paired:sampleStats(baseSamples.map(()=>0)),remaining:input.availablePoints,additionalCost:0});
 }
 reviewed.sort((a,b)=>b.stats.mean-a.stats.mean||a.cost-b.cost||key(a.ranks).localeCompare(key(b.ranks)));
 if(!reviewed.length)throw Error('noViableOptimizerPlan');
 return {objective:input.objective,allocationMode:input.allocationMode,availablePoints:input.availablePoints,totalPoints:input.totalPoints,monsterId:input.monsterId,hours:input.combat.manual.simulationHours,now:input.now,effort:input.effort,screeningSeeds:[...screeningSeeds],reviewSeeds:[...reviewSeeds],screened,simulations,excluded,exhaustive:search.exhaustive,baseline,plans:reviewed.slice(0,3)};
}
