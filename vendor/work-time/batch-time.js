import {gatheringSkills} from './domain.js';
import {callRule,requireCapability,tickMilliseconds} from './adapter.js';

// The phase transitions in pN / RN / WOo of the reviewed 1.0.1214 snapshot.
// This is an analytical approximation: initial pack is empty, all materials are
// available, the main-city warehouse is the origin, and the last batch is banked.
// Rare bonus drops and future level/brew changes do not alter batch capacity.
export const batchTimeModel=Object.freeze({sourceVersion:'1.0.1214',version:3,
 initialCraftTicks:5,initialGatherTicks:2,turnoverTicks:6,finishTicks:2,walkStartTicks:1});
export function createBatchTimeEstimator(game,{resolveMovement}={}){
const routes=new Map(),siteRoutes=new Map();
const checked=value=>{if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)throw Error('quantityOverflow');return value;};
const unknown=(workSeconds,reason)=>({status:'unknownTime',seconds:null,workSeconds,overheadSeconds:null,batches:null,reason,sourceVersion:batchTimeModel.sourceVersion});

function routeLeg(from,target){
 // pN keeps the current tile when it already borders the destination. Otherwise
 // Ht chooses by Chebyshev proximity before k1 finds the actual walkable path.
 if(Math.abs(from.x-target.x)<=1&&Math.abs(from.y-target.y)<=1)return {point:from,distance:0};
 const feature='estimateBatchTime.route';
 const point=callRule(game,'siteEntrance',feature,game.world,target.x,target.y,0,from);if(!point)return null;
 if(!Number.isSafeInteger(point.x)||!Number.isSafeInteger(point.y)||Math.abs(point.x-target.x)>1||Math.abs(point.y-target.y)>1)throw Error('invalidResult');
 const path=callRule(game,'walkPath',feature,game.world,from.x,from.y,point.x,point.y);
 if(path===null)return null;
 if(!Array.isArray(path))throw Error('invalidResult');
 return {point,distance:path.length};
}

function siteRoute(site,bank,origin){
 if(siteRoutes.has(site.id))return siteRoutes.get(site.id);
 const legs=[],seen=new Map();let point=origin,route=null;
 // After each return the character occupies one of the depot's eight adjacent
 // tiles. Detect that finite state cycle once, independently of task quantity.
 for(;;){
  const key=`${point.x}:${point.y}`;
  if(seen.has(key)){
   const cycleStart=seen.get(key),cycle=legs.slice(cycleStart);
   route={siteId:site.id,bankId:bank.id,distance:legs[0].outwardDistance,returnDistance:legs[0].returnDistance,
    cycleStart,cycleLength:cycle.length,
    cycleOutwardDistance:cycle.reduce((sum,leg)=>sum+leg.outwardDistance,0),
    cycleReturnDistance:cycle.reduce((sum,leg)=>sum+leg.returnDistance,0),legs};
   route.cycleDistance=route.cycleOutwardDistance+route.cycleReturnDistance;break;
  }
  seen.set(key,legs.length);
  const outward=routeLeg(point,site);if(!outward)break;
  const returning=routeLeg(outward.point,bank);if(!returning)break;
  legs.push({bankStart:point,workPoint:outward.point,bankEnd:returning.point,
   outwardDistance:outward.distance,returnDistance:returning.distance});
  point=returning.point;
 }
 siteRoutes.set(site.id,route);return route;
}

function workRoute(jobId,siteId){
 const feature='estimateBatchTime.route',world=game.world;
 let candidates;
 if(siteId!==undefined){
  if(!Number.isSafeInteger(siteId))return null;
  requireCapability(typeof world?.siteById?.get==='function',feature,'world.siteById.get');
  const site=world.siteById.get(siteId);if(!site)return null;
  if(!Array.isArray(site.jobIds)||site.id!==siteId)throw Error('invalidResult');
  if(!site.jobIds.includes(jobId))return null;
  candidates=[site];
 }else{
  requireCapability(Array.isArray(world?.sites),feature,'world.sites');
  candidates=world.sites.filter(site=>{
   if(!site||!Array.isArray(site.jobIds))throw Error('invalidResult');
   return site.jobIds.includes(jobId);
  });
 }
 if(candidates.length===0)return null;
 // The task starts and finishes at the main-city depot, independent of the
 // character's current position or preferred bank. Its reviewed world ID is 1.
 requireCapability(typeof world.bankById?.get==='function',feature,'world.bankById.get');
 const bank=world.bankById.get(1);if(!bank)return null;
 if(!Number.isSafeInteger(bank.x)||!Number.isSafeInteger(bank.y))throw Error('invalidResult');
 const cacheKey=`${jobId}:${siteId??'default'}`;
 if(routes.has(cacheKey))return routes.get(cacheKey);
 const origin=callRule(game,'siteEntrance',feature,world,bank.x,bank.y,0);if(!origin)return null;
 if(!Number.isSafeInteger(origin.x)||!Number.isSafeInteger(origin.y)||Math.abs(origin.x-bank.x)>1||Math.abs(origin.y-bank.y)>1)throw Error('invalidResult');
 let best=null;
 // Default selection minimizes the real first walk from this fixed origin;
 // the game UI can choose another site from the live character's position.
 for(const site of candidates){
  if(!Number.isSafeInteger(site.id)||!Number.isSafeInteger(site.x)||!Number.isSafeInteger(site.y))throw Error('invalidResult');
  const candidate=siteRoute(site,bank,origin);
  if(candidate&&(best===null||candidate.distance<best.distance||candidate.distance===best.distance&&candidate.siteId<best.siteId))best=candidate;
 }
 routes.set(cacheKey,best);return best;
}

function walking(route,batches,strideSpeed){
 // La resets stride on each new path; rounding the entire route would carry a
 // remainder across legs that Vko discards when the character arrives.
 const ticks=distance=>Math.ceil(distance*1000/strideSpeed);
 const costs=route.legs.map(leg=>({walk:ticks(leg.outwardDistance)+ticks(leg.returnDistance),
  starts:Number(leg.outwardDistance>0)+Number(leg.returnDistance>0)}));
 const sum=(start,end,key)=>costs.slice(start,end).reduce((total,cost)=>total+cost[key],0);
 const prefix=Math.min(batches,route.cycleStart),remaining=batches-prefix;
 const cycles=Math.floor(remaining/route.cycleLength),tail=remaining%route.cycleLength;
 const total=key=>checked(sum(0,prefix,key)+cycles*sum(route.cycleStart,costs.length,key)+sum(route.cycleStart,route.cycleStart+tail,key));
 return {walkTicks:ticks(route.distance),returnWalkTicks:ticks(route.returnDistance),totalWalkTicks:total('walk'),walkStarts:total('starts')};
}

function movement(player){
 const feature='estimateBatchTime.movement';
 if(!player||!Number.isInteger(player.perks?.pockets)||player.perks.pockets<0||player.perks.pockets>5
  ||!player.equipment||!Object.hasOwn(player.equipment,'mount')||!Number.isInteger(player.masteries?.move)||player.masteries.move<0
  ||!player.brews||!player.brewTier||!Number.isSafeInteger(player.lastTick)||player.lastTick<0)return null;
 requireCapability(Number.isSafeInteger(game.masteryRankLimit)&&game.masteryRankLimit>=0,feature,'masteryRankLimit');
 if(player.masteries.move>game.masteryRankLimit)return null;
 const mount=player.equipment.mount;
 if(mount!==null){
  if(!Number.isSafeInteger(mount))return null;
  if(callRule(game,'tool',feature,mount)?.slot!=='mount')return null;
 }
 const swiftUntil=player.brews.swift;
 if(swiftUntil!==undefined&&(!Number.isSafeInteger(swiftUntil)||swiftUntil<0))return null;
 let swiftMultiplier=1;
 if(swiftUntil>player.lastTick){
  if(!Number.isInteger(player.brewTier.swift)||player.brewTier.swift<0||player.brewTier.swift>4)return null;
  requireCapability(Number.isFinite(game.swiftSpeedBonus)&&game.swiftSpeedBonus>=0,feature,'swiftSpeedBonus');
  const strength=callRule(game,'brewStrength',feature,player,'swift');
  if(!Number.isFinite(strength)||strength<0)throw Error('invalidResult');
  swiftMultiplier+=game.swiftSpeedBonus*strength;
 }
 const stride=callRule(game,'mountStride',feature,player),mastery=callRule(game,'masteryMultiplier',feature,player.masteries,'move');
 if(!Number.isFinite(stride)||!Number.isFinite(mastery))throw Error('invalidResult');
 const strideSpeed=Math.round(stride*swiftMultiplier*mastery);
 if(!Number.isFinite(strideSpeed)||strideSpeed<=0)return null;
 const slots=callRule(game,'inventoryCapacity',feature,player);
 if(!Number.isSafeInteger(slots)||slots<0)throw Error('invalidResult');
 return {strideSpeed,slots};
}

function capacity(job,tier,slots){
 // q_ limits how many inputs the game withdraws, including a reserved output stack.
 // This may be lower than the theoretical limit after consuming the first inputs.
 const feature='estimateBatchTime.capacity';
 const inputs=callRule(game,'recipeInputs',feature,job,tier);
 if(!Array.isArray(inputs)||inputs.some(input=>!input||!Number.isSafeInteger(input.itemId)||!Number.isSafeInteger(input.qty)||input.qty<0))throw Error('invalidResult');
 const stacked=id=>{
  const item=callRule(game,'item',feature,id);
  if(typeof item?.stackable!=='boolean')throw Error('invalidResult');
  return item.stackable;
 };
 const nonstacked=inputs.filter(input=>!stacked(input.itemId)).reduce((sum,input)=>sum+input.qty,0);
 const stacks=new Set(inputs.filter(input=>stacked(input.itemId)).map(input=>input.itemId)).size;
 const output=callRule(game,'recipeOutput',feature,job,tier);
 if(!Number.isSafeInteger(output))throw Error('invalidResult');
 const stackedOutput=stacked(output);
 if(nonstacked>0)return Math.floor((slots-stacks-(stackedOutput?1:0))/nonstacked);
 if(stackedOutput)return slots>=stacks+1?Infinity:0;
 if(!Number.isSafeInteger(job.output?.qty)||job.output.qty<=0)throw Error('invalidJob');
 return Math.floor((slots-stacks)/job.output.qty);
}

function estimateBatchTime({job,tier=0,count,player,actionSeconds,discard=false,siteId}){
  if(!Number.isInteger(tier)||tier<0||tier>4)throw Error('invalidTier');
 if(!Number.isFinite(count)||count<=0||count>Number.MAX_SAFE_INTEGER)throw Error('invalidQuantity');
 if(!Number.isFinite(actionSeconds)||actionSeconds<0)return unknown(null,'actionTime');
 const workSeconds=checked(count*actionSeconds),base={workSeconds,sourceVersion:batchTimeModel.sourceVersion};
 if((discard&&gatheringSkills.includes(job.skill))||job.skill==='thieving'||job.upgrade)return {...base,status:'ok',seconds:workSeconds,overheadSeconds:0,batches:0,batchCapacity:null};
 const travel=resolveMovement?resolveMovement(player):movement(player);if(!travel)return unknown(workSeconds,'movementConfiguration');
 const route=workRoute(job.id,siteId);if(!route)return unknown(workSeconds,'workLocation');
 const batchCapacity=capacity(job,tier,travel.slots);
 if(batchCapacity<=0)return {...base,status:'unreachable',seconds:null,overheadSeconds:null,batches:null,batchCapacity};
 const batches=batchCapacity===Infinity?1:Math.ceil(Math.ceil(count)/batchCapacity);
 const walks=walking(route,batches,travel.strideSpeed);
 if(!Array.isArray(job.inputs))throw Error('invalidJob');
 const initialTicks=job.inputs.length?batchTimeModel.initialCraftTicks:batchTimeModel.initialGatherTicks;
 const overheadSeconds=checked((initialTicks+batchTimeModel.finishTicks+(batches-1)*batchTimeModel.turnoverTicks+walks.totalWalkTicks+walks.walkStarts*batchTimeModel.walkStartTicks)*tickMilliseconds(game,'estimateBatchTime')/1000);
 const {legs,...geometry}=route;
 return {...base,...geometry,...travel,...walks,originAssumption:'main-city-bank',status:'ok',seconds:checked(workSeconds+overheadSeconds),overheadSeconds,batches,batchCapacity:batchCapacity===Infinity?null:batchCapacity};
}

return estimateBatchTime;
}
