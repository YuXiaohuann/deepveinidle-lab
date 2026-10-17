import * as game from './upstream.js';
import {craftingDefaults,craftingPlayer,normalizeCrafting,importCrafting,craftingSkills} from './crafting-model.js';
import {gatheringDefaults,gatheringPlayer,normalizeGathering,importGathering,gatheringSkills} from './gathering-model.js';
import {manualWindows} from './manual-settings.js';
import {workQualities} from './work-expectation.js';
import {readWorldBuffs} from './world-buffs.js';
import {combatHot,combatHotWindows} from './combat-hot.js';
import {epoch} from './hot-forecast.js';

export const collectionStorageKey='dvi-collection-v1';
export const collectionSkills=[...gatheringSkills,...craftingSkills];
export const collectionIds=[...game.collectionItems].sort((a,b)=>a-b).flatMap(base=>Array.from({length:game.itemSupportsRarity(base)?5:1},(_,tier)=>game.withRarity(base,tier)));
const idSet=new Set(collectionIds),record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function collectionInteger(value,max=Number.MAX_SAFE_INTEGER){
 if(!['number','string'].includes(typeof value)||String(value).trim()==='')throw Error('invalidInteger');
 const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>max)throw Error('invalidInteger');return n;
}
export function collectionNumber(value,min=0,max=1e7){
 if(!['number','string'].includes(typeof value)||String(value).trim()==='')throw Error('invalidNumber');
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error('invalidNumber');return n;
}
const configGroups=['levels','gear','brews','house','masteries','perks'];
function mergeConfig(gather,craft){
 const config={};
 for(const group of configGroups)config[group]={...gather[group],...craft[group]};
 for(const key of ['guild','guildXp','weeklyXp','worldRarity','blessing','ironman','homeBank','hotSetting'])config[key]=gather[key];
 return config;
}
export function collectionDefaults(){return {version:1,initialized:false,capturedAt:null,edited:false,importWarnings:[],counts:{},buyMode:'ask',sellMode:'bid',config:mergeConfig(gatheringDefaults(),craftingDefaults())};}
export function collectionWorkConfig(state,kind){
 const config=(kind==='gather'?normalizeGathering:normalizeCrafting)(state.config);
 config.weeklyXp=state.config.weeklyXp;
 return config;
}
function validateCounts(raw){
 if(!record(raw))throw Error('incompleteSnapshot');
 const counts={};for(const [key,n]of Object.entries(raw)){
  const id=Number(key);if(String(id)!==key||typeof n!=='number'||!Number.isSafeInteger(n)||n<0)throw Error('invalidSnapshot');
  // The game can log valid items outside the visible collection catalogue.
  try{if(game.itemTier(id)>4||game.item(id).id!==id||id!==game.withRarity(game.baseItemId(id),game.itemTier(id)))throw Error();}catch{throw Error('invalidSnapshot');}
  if(idSet.has(id))counts[id]=n;
 }return counts;
}
export function validateCollection(raw){
 if(!record(raw)||raw.version!==1||typeof raw.initialized!=='boolean'||typeof raw.edited!=='boolean'||!['bid','vendor'].includes(raw.sellMode))throw Error('invalidConfiguration');
 if(raw.capturedAt!==null&&(!Number.isSafeInteger(raw.capturedAt)||raw.capturedAt<=0||raw.capturedAt>Date.now()+60000))throw Error('invalidConfiguration');
 const buyMode=raw.buyMode;
 if(!['ask','bid','vendor'].includes(buyMode))throw Error('invalidConfiguration');
 const importWarnings=raw.importWarnings;
 if(!Array.isArray(importWarnings)||importWarnings.some(w=>!['worldBuffs.upgrade','weeklyXp.reset'].includes(w)))throw Error('invalidConfiguration');
 const state={version:1,initialized:raw.initialized,edited:raw.edited,capturedAt:raw.capturedAt,sellMode:raw.sellMode,buyMode,importWarnings:[...importWarnings],counts:validateCounts(raw.counts),config:null};
 if(!record(raw.config))throw Error('invalidConfiguration');
 const gather=normalizeGathering(raw.config),craft=normalizeCrafting(raw.config);
 state.config=mergeConfig(gather,craft);
 for(const group of configGroups)for(const [key,value]of Object.entries(state.config[group])){
  if(JSON.stringify(raw.config[group]?.[key])!==JSON.stringify(value))throw Error('invalidConfiguration');
 }
 for(const key of ['guildXp','weeklyXp','worldRarity'])state.config[key]=collectionNumber(raw.config[key]);
 for(const key of ['blessing','ironman'])if(typeof raw.config[key]!=='boolean')throw Error('invalidConfiguration');
 if(raw.config.homeBank!==state.config.homeBank||!['game','current','off'].includes(raw.config.hotSetting))throw Error('invalidConfiguration');

 return state;
}
export function importCollection(current,snapshot){
 if(!record(snapshot)||snapshot.version!==2||!Number.isSafeInteger(snapshot.capturedAt)||snapshot.capturedAt<=0||snapshot.capturedAt>Date.now()+60000||!record(snapshot.player))throw Error('invalidSnapshot');
 const counts=validateCounts(snapshot.player.collections),craft=importCrafting(collectionWorkConfig(current,'craft'),snapshot),gather=importGathering(collectionWorkConfig(current,'gather'),snapshot);
 const warnings=[...craft.warnings,...gather.warnings].filter(k=>/^(skills|equipment|house|masteries|perks|ironman|homeBank|brews|brewBuckets|brewTier|blessing|guildBonus)/.test(k));
 if(warnings.length)throw Error('incompleteSnapshot');
 const world=readWorldBuffs(snapshot);
 gather.state.weeklyXp=world.weeklyXp;gather.state.worldRarity=world.worldRarity;
 return validateCollection({...current,initialized:true,capturedAt:snapshot.capturedAt,edited:false,importWarnings:world.warning?[world.warning]:[],counts,config:mergeConfig(gather.state,craft.state)});
}
export function collectionTarget(state,id,target){
 const current=state.counts[id]??0,base=game.baseItemId(id),thresholds=game.collectionThresholds(base);
 const goal=target??thresholds.find(n=>n>current)??null;
 if(goal===null)return {current,target:null,missing:0,points:0,complete:true};
 if(!thresholds.includes(goal))throw Error('invalidTarget');
 return {current,target:goal,missing:Math.max(0,goal-current),points:Math.max(0,game.collectionPoints(goal,game.itemTier(id),base)-game.collectionPoints(current,game.itemTier(id),base)),complete:goal<=current};
}
export function pointsForProduction(id,current,quantity){return game.collectionPoints(current+quantity,game.itemTier(id),game.baseItemId(id))-game.collectionPoints(current,game.itemTier(id),game.baseItemId(id));}
export function collectionRoutes(id){
 const base=game.baseItemId(id);
 return game.recipes.filter(j=>j.output.itemId===base&&!j.retired&&collectionSkills.includes(j.skill));
}
export function collectionPrice(id,prices,side,sellMode='bid',buyMode='ask'){
 if(!game.canSell(id)&&side==='sell')return {price:0,source:'untradeable',time:null};
 const manual=prices.prices[id];if(manual?.source==='manual'&&manual.price!==null)return {price:manual.price,source:'manual',time:manual.updatedAt};
 if(side==='sell'&&sellMode==='vendor')return {price:game.vendorPrice(id),source:'vendor',time:null};
 if(side==='buy'&&buyMode==='vendor')return {price:game.canSell(id)?game.vendorPrice(id):null,source:'vendor',time:null};
 const source=side==='buy'?buyMode:'bid',quote=prices.quotes[id]?.[source];
 return {price:quote&&!quote.invalid&&quote.value!==null?quote.value:null,source,time:quote?.capturedAt??null};
}
export function priceCollection(result,prices,sellMode='bid',buyMode='ask'){
 const priceList=(items,side)=>Object.entries(items).map(([id,qty])=>({id:Number(id),qty,...collectionPrice(Number(id),prices,side,sellMode,buyMode)}));
 const materials=priceList(result.materials??{},'buy'),outputs=priceList(result.outputs??{},'sell'),potions=priceList(result.potionItems??{},'buy');
 const overflowFields=[];
 const total=(rows,field)=>{
  let sum=0,missing=false;
  for(const row of rows){
   if(!Number.isFinite(row.qty)||row.qty<0)throw Error('quantityOverflow');
   if(row.qty>0&&row.price===null)missing=true;
   sum+=row.qty*(row.price??0);
  }
  if(!Number.isFinite(sum)||sum>Number.MAX_SAFE_INTEGER){overflowFields.push(field);return null;}
  return missing?null:sum;
 };
 const cost=total(materials,'cost'),value=total(outputs,'value'),potionCost=total(potions,'potions');
 let investment=cost===null||potionCost===null?null:cost+potionCost;
 if(investment!==null&&investment>Number.MAX_SAFE_INTEGER){overflowFields.push('investment');investment=null;}
 const net=investment===null||value===null?null:investment-value;
 return {...result,materialsPriced:materials,outputsPriced:outputs,potionsPriced:potions,overflowFields,cost,value,potionCost,investment,net,costPerPoint:result.points>0&&cost!==null?cost/result.points:null,profitPerPoint:result.points>0&&net!==null?(net===0?0:-net/result.points):null};
}
export function collectionPotionItems(config,seconds){
 if(!Number.isFinite(seconds)||seconds<0)throw Error('invalidDuration');
 return Object.fromEntries(game.potions.filter(p=>(config.brews[p.kind]??-1)>=0).map(p=>[game.withRarity(p.itemId,config.brews[p.kind]),seconds/(game.potionDurationTicks*game.tickMs/1000)]));
}
export function collectionWindows(config,skill,ticks,now){
 const start=game.predictionStartTick,windows=manualWindows(start,start+ticks,config.weeklyXp,config.hotSetting!=='game',skill,config.worldRarity??0);
 if(config.hotSetting==='current')windows.push(...combatHotWindows(combatHot(now,Math.max(1,Math.ceil(ticks*game.tickMs/60000))/60,skill)));
 return windows;
}
export function collectionPlayers(state,now=Date.now()){
 const configs={craft:collectionWorkConfig(state,'craft'),gather:collectionWorkConfig(state,'gather')};
 return {craft:craftingPlayer(configs.craft).player,gather:gatheringPlayer(configs.gather).player,configs,now};
}
export function estimateCollection(state,id,job,players=collectionPlayers(state),goal){
 if(!job)throw Error('invalidRoute');
 const target=collectionTarget(state,id,goal),base={id,jobId:job.id,skill:job.skill,...target,seconds:null,secondsPerPoint:null,materials:{},outputs:{},attempts:null,status:'uninitialized'};
 if(!state.initialized)return {...base,status:'uninitialized'};
 if(target.complete)return {...base,status:'complete'};
 const gathering=gatheringSkills.includes(job.skill),kind=gathering?'gather':'craft',p=players[kind],config=players.configs[kind];
 if(game.level(p.skills[job.skill])<job.levelReq)return {...base,status:'levelTooLow'};
 if(!game.world.sites.some(s=>s.jobIds.includes(job.id)))return {...base,status:'noSites'};
 const tier=game.itemTier(id),chance=game.workChance(job,p),burn=game.burnChance(job,p),caught=game.caughtChance(job,p);
 const at=config.hotSetting==='current'?Math.floor((players.now-epoch)/game.tickMs):game.predictionStartTick;
 const context={windows:manualWindows(at,at,config.weeklyXp,config.hotSetting==='off',job.skill,config.worldRarity??0)};
 const qualities=gathering&&game.itemSupportsRarity(job.output.itemId)?workQualities(p,context,job,at):[1];
 const quality=gathering?qualities[tier]:1;
 const success=(1-burn)*(1-caught)*quality;
 if(!(chance>0&&success>0))return {...base,status:'unreachable'};
 const successes=Math.ceil(target.missing/job.output.qty),attempts=successes/success,quantity=successes*job.output.qty;
 const seconds=attempts*(game.tickMs/1000/chance+caught*Math.max(0,(job.caught?.stunTicks??0)-1)*game.tickMs/1000);
 const points=pointsForProduction(id,target.current,quantity),materials=Object.fromEntries(game.recipeInputs(job,tier).map(i=>[i.itemId,i.qty*attempts]));
 const outputs=gathering?Object.fromEntries(qualities.map((q,t)=>[game.withRarity(job.output.itemId,t),attempts*(1-caught)*job.output.qty*q]).filter(([,n])=>n>0)):{[id]:quantity};
 if(!gathering&&job.burn&&burn>0)outputs[job.burn.itemId]=(outputs[job.burn.itemId]??0)+attempts*burn;
 if(!Number.isFinite(seconds)||!Number.isFinite(attempts)||Object.values(materials).some(n=>!Number.isFinite(n)||n>Number.MAX_SAFE_INTEGER))throw Error('quantityOverflow');
 return {...base,status:'ok',seconds,secondsPerPoint:seconds/points,points,quantity,attempts,materials,outputs,potionItems:collectionPotionItems(config,seconds),blessing:config.blessing,burn,caught,quality,actionSeconds:game.tickMs/1000/chance};
}
export function collectionRows(state,{now=Date.now()}={}){
 const players=collectionPlayers(state,now);
 return collectionIds.flatMap(id=>{
  const routes=collectionRoutes(id),future=game.collectionThresholds(game.baseItemId(id)).filter(n=>n>(state.counts[id]??0));
  return routes.flatMap(job=>(future.length?future:[undefined]).map(goal=>estimateCollection(state,id,job,players,goal)));
 });
}
