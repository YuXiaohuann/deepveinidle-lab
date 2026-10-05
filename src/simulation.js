import {manualWindows} from './manual-settings.js';
import {game,makePlayer} from './model.js';
export const HOUR_TICKS=3600000/game.tickMs;
export const TRIALS=1;
export const START_TICK=game.predictionStartTick;
const add=(obj,key,amount=1)=>{obj[key]=(obj[key]??0)+amount;};

export function createScenario(raw,monster=null){
 if(raw?.format)throw Error('角色快照模式已移除 / Character snapshot mode has been removed');
 const {state,player:p}=makePlayer(raw),zone=monster&&game.world.zones.find(z=>z.monsterId===monster.id);
 if(monster&&!zone)throw Error('No combat zone for monster '+monster.id);
 const target=zone?game.combatTargetTile(zone,state.manual.playerId):game.world.banks[0];
 const bank=state.homeBank?game.world.bankById.get(state.homeBank):game.homeBank({world:game.world},target);
 if(!bank)throw Error('No starting depot');
 const foodId=game.withRarity(state.food.id,state.food.tier);
 Object.assign(p,{
  id:state.manual.playerId,x:bank.x,y:bank.y,homeBank:bank.id,skills:{...Object.fromEntries(game.allSkills.map(k=>[k,0])),...p.skills},
  pack:[],bank:{[foodId]:1e9},overflow:{},bankOrder:[],route:null,enhance:null,plots:{},queue:[],tunics:[],guide:{},
  perks:{quick:0,rest:0,pockets:0,hands:0,...p.perks},housePoints:{},houseCells:[],houseBuild:null,houseUpgrades:{},
  quests:{day:0,week:0,daily:[],weekly:[]},path:null,streak:{},tally:{items:{},monsters:{},coinsEarned:0},collection:{},collections:{},achievements:{},titles:[],
  coins:state.manual.coins,hp:game.maxHp(p),unlimitedBank:state.manual.unlimitedBank,bankSlotsBought:state.manual.bankSlotsBought,offlineCapTicks:HOUR_TICKS*2,foodMaxTier:state.manual.foodMaxTier,foodItemId:state.manual.foodRule===0?foodId:state.manual.foodRule===2?-2:null,foodPerTrip:state.manual.foodPerTrip,eatAt:state.eatAt/100,
  ironman:state.manual.ironman,activity:'idle',pathIndex:0,stride:0,strideSpeed:1000,actionIndex:0,rollIndex:{},foeIndex:null,foeHp:0,foeTicks:0,attemptTicks:0,stunUntil:0,workSiteId:null,workJobId:null,
 });
 const m=state.manual;
 if(m.foodRule===3)p.eatAt=0;
 const context={...game.createContext(game.world,m.seed),windows:manualWindows(START_TICK,START_TICK+HOUR_TICKS,m.weeklyXp),hypothetical:true};
 return {player:p,context};
}

export function simulateMonster(raw,monster){
 const scenario=createScenario(raw,monster),context=scenario.context;
 let p;
 // Reuse all original predictor initialization without modifying its source.
 game.predict(scenario.player,context,prepared=>{p=prepared;return false;});
 const zone=game.world.zones.find(z=>z.monsterId===monster.id);
 if(!zone||!game.startFight(p,context,zone.id))throw Error('No combat route for monster '+monster.id);
 const initialSkills={...p.skills};
 const result={key:`monster-${monster.id}`,trials:1,homeBank:game.homeBank(context,p)?.id??null,kills:0,xp:0,coins:0,normal:0,rare:0,food:0,deaths:0,bySkill:{},normalItems:{},rareItems:{},elapsedTicks:0,movingTicks:0,restocks:0,endedEarly:false};
 for(let tick=1;tick<=HOUR_TICKS;tick++){
  if(p.activity==='walking')result.movingTicks++;
  const events=[];
  game.tick(p,context,START_TICK+tick,events);
  for(const e of events){
   if(e.kind==='killed'){result.kills++;result.coins+=e.coins;}
   if(e.kind==='ate')result.food++;
   if(e.kind==='died')result.deaths++;
   if(e.kind==='withdrew')result.restocks++;
   if(e.kind==='produced'&&e.itemId!==game.coinItemId){result.normal+=e.qty??1;add(result.normalItems,e.itemId,e.qty??1);}
   if(['bonus','pet','mount','voidshard'].includes(e.kind)){result.rare+=e.qty??1;add(result.rareItems,e.itemId,e.qty??1);}
  }
  result.elapsedTicks=tick;
  if(tick%game.predictionChunkTicks===0&&(result.deaths>0||p.route===null)){result.endedEarly=true;break;}
 }
 for(const [skill,xp]of Object.entries(initialSkills)){const gain=p.skills[skill]-xp;if(gain){result.bySkill[skill]=gain;result.xp+=gain;}}
 // Only XP is extrapolated by the original menu; event counts are observed totals.
 result.xp=Math.round(result.xp*(result.deaths?1:HOUR_TICKS/result.elapsedTicks));
 return result;
}
