import * as game from './upstream.js';
import {normalizeManual} from './manual-settings.js';
import {createScenario} from './simulation.js';
import {readGuild} from './guild.js';

export const gatheringStorageKey='dvi-gathering-v1';
export const gatheringSkills=['mining','fishing','woodcutting','thieving'];
export const toolSlots={mining:'pickaxe',fishing:'rod',woodcutting:'axe',thieving:'gloves'};
export const gatheringSlots=[...Object.values(toolSlots),'amulet','mount'];
export const gatheringJobs=game.recipes.filter(r=>gatheringSkills.includes(r.skill));
export const gatheringPotions=game.potions.filter(p=>['gatherer','hunter','elixir','swift'].includes(p.kind)).sort((a,b)=>game.recipes.find(r=>r.output.itemId===a.itemId)?.levelReq-game.recipes.find(r=>r.output.itemId===b.itemId)?.levelReq);
export const gatheringRooms=game.rooms.filter(r=>r.bonus.kind==='rareChance'||r.bonus.kind==='gatherSpeed'&&gatheringSkills.includes(r.bonus.skill));
export const gatheringMasteries=game.masteries.filter(m=>['gather','xp','move','rare'].includes(m.id));
export const gatheringPerks=game.perks.filter(p=>['pockets','quick','hands'].includes(p.id));
const integer=(v,min,max,fallback=min)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.floor(Number(v)))):fallback;
export const slotItems=slot=>slot==='amulet'?game.equipment.filter(g=>g.slot===slot):game.tools.filter(g=>g.slot===slot);
export const gatheringGear=(slot,id)=>slot==='amulet'?game.gear(id):game.tool(id);
export const sitesForJob=job=>game.world.sites.filter(s=>s.jobIds.includes(job.id));
export function gatheringDefaults(){return {
 skill:'mining',levels:Object.fromEntries(gatheringSkills.map(k=>[k,1])),
 gear:Object.fromEntries(gatheringSlots.map(k=>[k,{id:0,tier:0,plus:0}])),
 brews:Object.fromEntries(gatheringPotions.map(p=>[p.kind,-1])),
 house:Object.fromEntries(gatheringRooms.map(r=>[r.id,0])),masteries:Object.fromEntries(gatheringMasteries.map(m=>[m.id,0])),
 perks:Object.fromEntries(gatheringPerks.map(p=>[p.id,0])),guild:null,guildXp:0,weeklyXp:0,blessing:false,ironman:false,homeBank:0,
 jobSelection:'all',siteSelection:0,simulationHours:24,customSimulation:false,hotSetting:'game',vendorValues:false,
};}
export function normalizeGathering(raw){
 const s=gatheringDefaults();if(!raw||typeof raw!=='object')return s;
 s.skill=gatheringSkills.includes(raw.skill)?raw.skill:s.skill;
 for(const k of gatheringSkills)s.levels[k]=integer(raw.levels?.[k]??1,1,game.maxLevel);
 for(const slot of gatheringSlots){const v=raw.gear?.[slot];if(v&&slotItems(slot).some(g=>g.itemId===Number(v.id)))s.gear[slot]={id:Number(v.id),tier:integer(v.tier??0,0,4),plus:integer(v.plus??0,0,game.maxEnhancement)};}
 for(const p of gatheringPotions)s.brews[p.kind]=integer(raw.brews?.[p.kind]??-1,-1,4,-1);
 for(const r of gatheringRooms)s.house[r.id]=integer(raw.house?.[r.id]??0,0,Number.MAX_SAFE_INTEGER);
 for(const m of gatheringMasteries)s.masteries[m.id]=integer(raw.masteries?.[m.id]??0,0,game.masteryRankLimit);
 for(const p of gatheringPerks)s.perks[p.id]=integer(raw.perks?.[p.id]??0,0,p.ranks);
 const manual=normalizeManual(raw);for(const k of ['guildXp','weeklyXp','blessing','ironman','simulationHours','customSimulation','hotSetting','vendorValues'])s[k]=manual[k];
 s.homeBank=game.world.banks.some(b=>b.id===Number(raw.homeBank))?Number(raw.homeBank):0;
 s.guild=readGuild(raw.guild);
 const job=gatheringJobs.find(j=>j.id===Number(raw.jobSelection)&&j.skill===s.skill);
 s.jobSelection=job?job.id:'all';s.siteSelection=raw.siteSelection==='nearest'?'nearest':job&&sitesForJob(job).some(p=>p.id===Number(raw.siteSelection))?Number(raw.siteSelection):0;
 return s;
}
export function selectedGatheringJobs(raw){const s=normalizeGathering(raw);return gatheringJobs.filter(j=>j.skill===s.skill&&(s.jobSelection==='all'||j.id===s.jobSelection));}
export function selectedGatheringSites(raw,job){
 const s=normalizeGathering(raw),all=sitesForJob(job);
 if(s.siteSelection==='nearest'){
  const {player}=gatheringPlayer(s),context=game.createContext(game.world,0);let prepared;
  game.predict(player,context,p=>{prepared=p;return false;});
  const id=game.nearestWorkSite(context,job.id,prepared.x,prepared.y);
  return all.filter(p=>p.id===id);
 }
 return s.jobSelection===job.id&&s.siteSelection?all.filter(p=>p.id===s.siteSelection):all;
}
// The combat scenario owns the common manual character initialization. Override
// only gathering-specific skills, equipment and buffs before predictor cloning.
export function gatheringPlayer(raw){
 const s=normalizeGathering(raw);
 const scenario=createScenario({levels:{},gear:{amulet:s.gear.amulet,mount:s.gear.mount},brews:s.brews,house:s.house,masteries:s.masteries,homeBank:s.homeBank,manual:{...s,perks:s.perks,foodRule:3,hotSetting:'game'}});
 const p=scenario.player;
 for(const k of gatheringSkills)p.skills[k]=game.levelXp(s.levels[k]);
 for(const slot of gatheringSlots){const v=s.gear[slot];p.equipment[slot]=v.id?game.encode(game.withRarity(v.id,v.tier),v.plus):null;}
 p.bank={};p.brews={};p.brewTier={};p.eatAt=0;p.fallback=null;
 for(const [kind,tier]of Object.entries(s.brews))if(tier>=0){p.brews[kind]=Number.MAX_SAFE_INTEGER;p.brewTier[kind]=tier;}
 if(s.blessing)p.brews.blessing=Number.MAX_SAFE_INTEGER;
 return {state:s,player:p};
}
export function gatheringStats(raw){const {state:s,player:p}=gatheringPlayer(raw),mod=game.workModifiers(p,s.skill),v=s.gear[toolSlots[s.skill]],tool=v.id?game.tool(game.encode(game.withRarity(v.id,v.tier),v.plus)):null;
 const luck=(v.id?game.toolLuck(p.equipment[toolSlots[s.skill]]):0)+game.equipmentLuck(p.equipment);
 const luckBonus=(1+luck)*game.combine(game.brewRarityMultiplier(p),game.houseRarityMultiplier(p),game.masteryMultiplier(p.masteries,'rare'))-1;
 return {level:s.levels[s.skill],toolBonus:tool?.bonus??0,speedBonus:mod.combined-1,luck,luckBonus,moveSpeed:Math.round(game.mountSpeed(p)*(1+.2*game.brewScale(p,'swift'))*(1+s.masteries.move*.005))/1000,capacity:game.packCapacity(p)};
}
export function gatheringJobStats(raw,job){const {player:p}=gatheringPlayer(raw),chance=game.workChance(job,p);return {chance,seconds:game.tickMs/1000/chance,caught:game.caughtChance(job,p)};}
export function importGathering(current,snapshot){
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),valid=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,int=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>valid(v,min,max)&&Number.isInteger(v);
 if(!record(snapshot)||snapshot.version!==2||!int(snapshot.capturedAt,1)||snapshot.capturedAt>Date.now()+60000||!record(snapshot.player)||!int(snapshot.player.lastTick))throw Error('invalidSnapshot');
 const s=normalizeGathering(current),p=snapshot.player,warnings=[];
 const put=(field,value,check,set)=>{if(check(value))set(value);else warnings.push(field);};
 for(const k of gatheringSkills)put(`skills.${k}`,p.skills?.[k],v=>valid(v),v=>s.levels[k]=game.level(v));
 for(const slot of gatheringSlots){const id=p.equipment?.[slot];if(id===null){s.gear[slot]={id:0,tier:0,plus:0};continue;}
  put(`equipment.${slot}`,id,v=>int(v,1)&&gatheringGear(slot,v)?.slot===slot&&int(game.itemTier(v),0,4)&&int(Math.floor(v/game.encode(0,1)),0,game.maxEnhancement),v=>s.gear[slot]={id:game.baseItemId(v),tier:game.itemTier(v),plus:Math.floor(v/game.encode(0,1))});
 }
 for(const {kind}of gatheringPotions){
  if(!record(p.brews)||!int(p.brews[kind]??0)){warnings.push(`brews.${kind}`);continue;}
  if((p.brews[kind]??0)<=p.lastTick){s.brews[kind]=-1;continue;}
  const buckets=p.brewBuckets?.[kind];let tier=p.brewTier?.[kind]??0;
  if(buckets!==undefined){if(!Array.isArray(buckets)||buckets.length!==5||!buckets.every(v=>int(v))){warnings.push(`brewBuckets.${kind}`);continue;}const elapsed=Math.max(0,p.lastTick-(p.brews[kind]-buckets.reduce((a,b)=>a+b,0)));let sum=0;tier=-1;for(let i=4;i>=0;i--){sum+=buckets[i];if(elapsed<sum){tier=i;break;}}}
  put(`brewTier.${kind}`,tier,v=>int(v,0,4),v=>s.brews[kind]=v);
 }
 for(const r of gatheringRooms){if(!record(p.house)||!record(p.houseFurniture)){warnings.push(`house.${r.id}`);continue;}put(`house.${r.id}`,p.house[r.id]??0,v=>int(v),v=>s.house[r.id]=record(p.houseFurniture[r.id])?v:0);}
 for(const m of gatheringMasteries)put(`masteries.${m.id}`,p.masteries?.[m.id]??(record(p.masteries)?0:undefined),v=>int(v,0,game.masteryRankLimit),v=>s.masteries[m.id]=v);
 for(const perk of gatheringPerks)put(`perks.${perk.id}`,p.perks?.[perk.id]??(record(p.perks)?0:undefined),v=>int(v,0,perk.ranks),v=>s.perks[perk.id]=v);
 put('guildBonus',p.guildBonus,v=>valid(v,0,1e5),v=>s.guildXp=v*100);
 if(record(p.brews)&&int(p.brews.blessing??0))s.blessing=(p.brews.blessing??0)>p.lastTick;else warnings.push('blessing');
 put('homeBank',p.homeBank,v=>v===null||game.world.banks.some(b=>b.id===v),v=>s.homeBank=v??0);
 put('ironman',p.ironman,v=>typeof v==='boolean',v=>s.ironman=v);
 if(int(snapshot.worldTick)&&Array.isArray(snapshot.worldBuffs)&&snapshot.worldBuffs.every(w=>record(w)&&int(w.fromTick)&&int(w.toTick,w.fromTick)&&valid(w.xpMult??1,1,1e5)))s.weeklyXp=Math.round(snapshot.worldBuffs.filter(w=>['Weekly goal: gathered','Weekly goal: felled'].includes(w.label)&&w.fromTick<=snapshot.worldTick&&snapshot.worldTick<=w.toTick).reduce((sum,w)=>sum+(w.xpMult-1)*100,0));else warnings.push('weeklyXp');
 try{s.guild=readGuild(snapshot.guild);}catch{warnings.push('guild');}
 Object.assign(s,{jobSelection:'all',siteSelection:0,simulationHours:24,customSimulation:false,hotSetting:'game',vendorValues:false});
 return {state:normalizeGathering(s),capturedAt:snapshot.capturedAt,warnings};
}
