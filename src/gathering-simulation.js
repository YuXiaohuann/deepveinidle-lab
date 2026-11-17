import {recordActivityTime} from './activity-timing.js';
import * as game from './upstream.js';
import {gatheringPlayer,gatheringPotions,selectedGatheringSites} from './gathering-model.js';
import {simulationTicks,combatHot,combatHotWindows} from './combat-hot.js';
import {manualWindows} from './manual-settings.js';
import {dropValue,START_TICK,HOUR_TICKS,simulationTick} from './simulation.js';
import {validateSimulationSeed} from './simulation-seed.js';
import {beforeWork,workQualities,expectedWorkRewards,addExpected} from './work-expectation.js';
const add=(items,id,qty)=>{items[id]=(items[id]??0)+qty;};
const metrics=['completed','attempts','caught','stunnedTicks','xp','coins','normal','rare','elapsedTicks','workingTicks','movingTicks','deposits'];
export function createGatheringScenario(raw,job,site,{now=Date.now(),seed=0}={}){
 const {state:s,player:p}=gatheringPlayer(raw);
 if(!site||!site.jobIds.includes(job.id)||job.skill!==s.skill)throw Error('invalidSite');
 if(s.levels[job.skill]<job.levelReq)throw Error('levelTooLow');
 const durationTicks=simulationTicks(s.simulationHours);
 const context={...game.createContext(game.world,validateSimulationSeed(seed)),hypothetical:true,windows:manualWindows(START_TICK,START_TICK+durationTicks,s.weeklyXp,s.hotSetting!=='game',job.skill,s.worldRarity)};
 if(s.hotSetting==='current')context.windows.push(...combatHotWindows(combatHot(now,s.simulationHours,job.skill)));
 const bank=game.world.bankById.get(p.homeBank);
 if(!bank)throw Error('unreachable');
 return {player:p,context,durationTicks,bank,discardGathered:s.discardGathered};
}
export function simulateGatheringSite(raw,job,site,options={}){
 const rewardMode=options.rewardMode??'all',collectSamples=options.collectSamples!==false;
 if(!['all','income','collection'].includes(rewardMode))throw Error('invalidRewardMode');
 const income=rewardMode!=='collection',collection=rewardMode!=='income';
 const scenario=createGatheringScenario(raw,job,site,options),{context,durationTicks,bank,discardGathered}=scenario;
 let p;game.predict(scenario.player,context,prepared=>{p=prepared;return false;});
 p.offlineCapTicks=durationTicks*2;
 if(!game.startWork(p,context,site.id,job.id,discardGathered?'drop':'bank',null))throw Error('invalidRoute');
 const initialXp=p.skills[job.skill];
 const potionItems=Object.fromEntries(gatheringPotions.filter(b=>(p.brews[b.kind]??0)>0).map(b=>[game.withRarity(b.itemId,p.brewTier[b.kind]??0),durationTicks/HOUR_TICKS]));
 const result={siteId:site.id,x:site.x,y:site.y,homeBank:bank.id,durationTicks,normalItems:{},rareItems:{},collectionItems:{},sampleItems:{},potionItems,startLevel:game.level(initialXp),endedEarly:false,...Object.fromEntries(metrics.map(k=>[k,0]))};
 result.seed=context.seed;
 // Only the main product and recipe bonus are discarded. Keep their current
 // pack segment separate from stored goods and non-discardable rewards.
 let pendingNormal={},pendingBonus={};
 const retainPending=()=>{
  for(const [id,qty]of Object.entries(pendingNormal))addExpected(result.normalItems,id,qty);
  for(const [id,qty]of Object.entries(pendingBonus))addExpected(result.rareItems,id,qty);
  pendingNormal={};pendingBonus={};
 };
 // Consume the same mathematical expectations as the Gathering page directly;
 // optimizer goals need one ledger and no separate sampled-drop trace.
 const writeReward=(id,qty)=>{
  if(collection)addExpected(result.collectionItems,id,qty);
  if(income)addExpected(discardGathered&&job.bonus&&game.baseItemId(id)===game.baseItemId(job.bonus.itemId)?pendingBonus:result.rareItems,id,qty);
 };
 for(let tick=1;tick<=durationTicks;tick++){
  recordActivityTime(result,p,START_TICK+tick);
  if(p.activity==='walking')result.movingTicks++;
  if(p.activity==='working'){if(START_TICK+tick<p.stunUntil)result.stunnedTicks++;else result.workingTicks++;}
  const at=START_TICK+tick,before=beforeWork(p,job,at),events=[];simulationTick(p,context,at,events);
  const produced=events.find(e=>e.kind==='produced');
  if(produced){
   if(produced.itemId===game.coinItemId)result.coins+=job.output.qty;
   else workQualities(p,context,job,at).forEach((prob,tier)=>{
    const id=game.withRarity(job.output.itemId,tier),qty=job.output.qty*prob;
    if(collection)addExpected(result.collectionItems,id,qty);
    if(income)addExpected(discardGathered?pendingNormal:result.normalItems,id,qty);
   });
   expectedWorkRewards(writeReward,p,context,job,at,before,produced);
  }
  for(const e of events){
   if(e.kind==='produced'){result.completed++;result.attempts++;if(collectSamples)add(result.sampleItems,e.itemId,e.qty??1);}
   if(e.kind==='caught'){result.caught++;result.attempts++;}
   if(e.kind==='deposited'){result.deposits++;if(discardGathered&&income)retainPending();}
   if(e.kind==='dropped'&&discardGathered&&income){pendingNormal={};pendingBonus={};}
   if(['bonus','pet','mount','voidshard','box'].includes(e.kind)){const id=e.kind==='box'?(e.itemId??game.lootBoxItemId):e.itemId;if(!Number.isSafeInteger(id))throw Error('invalidReward');if(collectSamples)add(result.sampleItems,id,e.qty??1);if(e.kind==='box'){if(income)addExpected(result.rareItems,id,e.qty??1);if(collection)addExpected(result.collectionItems,id,e.qty??1);}}
   if(e.kind==='routeStopped'&&!['done'].includes(e.reason))throw Error(`routeStopped:${e.reason}`);
  }
  result.elapsedTicks=tick;
  if(tick%game.predictionChunkTicks===0&&p.route===null){result.endedEarly=true;break;}
 }
 if(discardGathered&&income)retainPending();
 result.normal=Object.values(result.normalItems).reduce((a,b)=>a+b,0);result.rare=Object.values(result.rareItems).reduce((a,b)=>a+b,0);
 result.xp=p.skills[job.skill]-initialXp;result.endLevel=game.level(p.skills[job.skill]);
 result.normalValue=dropValue(result.normalItems);result.rareValue=dropValue(result.rareItems);result.totalIncome=result.coins+result.normalValue+result.rareValue;
 return result;
}
export function simulateGatheringJob(raw,job,{onSite=()=>{},...options}={}){
 const [site]=selectedGatheringSites(raw,job);if(!site)throw Error('noSites');
 let result;
 try{result=simulateGatheringSite(raw,job,site,options);}
 catch(error){onSite({siteId:site.id,x:site.x,y:site.y,error:String(error.message??error)});throw error;}
 onSite(result);
 return {key:`job-${job.id}`,jobId:job.id,...result,sites:[result],movingRatio:result.elapsedTicks?result.extraTicks/result.elapsedTicks:null};
}
