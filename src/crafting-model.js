import * as game from './upstream.js';
import {createScenario} from './simulation.js';
import {normalizeManual} from './manual-settings.js';
import {readGuild} from './guild.js';
import {slotItems,gatheringGear} from './gathering-model.js';
import {importWorkConfig} from './work-import.js';
import {validItemId,valuationPrice} from './item-prices.js';

export const craftingStorageKey='dvi-crafting-v1';
export const craftingSkills=['cooking','smithing','fletching','herblore','crafting'];
export const craftingToolSlots={cooking:'pan',smithing:'hammer',fletching:'knife',herblore:'mortar',crafting:'needle'};
export const craftingSlots=[...Object.values(craftingToolSlots),'mount'];
export const craftingJobs=game.recipes.filter(r=>craftingSkills.includes(r.skill));
export const craftingPotions=game.potions.filter(p=>['elixir','swift'].includes(p.kind));
export const craftingRooms=game.rooms.filter(r=>r.bonus.kind==='craftSpeed'&&craftingSkills.includes(r.bonus.skill));
export const craftingMasteries=game.masteries.filter(m=>['craft','xp','move'].includes(m.id));
export const craftingPerks=game.perks.filter(p=>['pockets','quick','hands'].includes(p.id));
export const planKey=(jobId,tier)=>`${jobId}:${tier}`;
export const validQuantity=value=>Number.isSafeInteger(value)&&value>=0;
export const safeAdd=(a,b)=>{const value=a+b;if(!Number.isSafeInteger(value)||value<0)throw Error('quantityOverflow');return value;};
export const safeMultiply=(a,b)=>{const value=a*b;if(!Number.isSafeInteger(value)||value<0)throw Error('quantityOverflow');return value;};
const integer=(v,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.floor(Number(v)))):min;
export function craftingDefaults(){return {
 period:'day',skill:'cooking',levels:Object.fromEntries(craftingSkills.map(k=>[k,1])),gear:Object.fromEntries(craftingSlots.map(k=>[k,{id:0,tier:0,plus:0}])),
 brews:Object.fromEntries(craftingPotions.map(p=>[p.kind,-1])),house:Object.fromEntries(craftingRooms.map(r=>[r.id,0])),masteries:Object.fromEntries(craftingMasteries.map(m=>[m.id,0])),
 perks:Object.fromEntries(craftingPerks.map(p=>[p.id,0])),guild:null,guildXp:0,weeklyXp:0,blessing:false,homeBank:0,hotSetting:'game',plans:{},tiers:Object.fromEntries(craftingJobs.map(j=>[j.id,0])),owned:{},
};}
export function normalizeCrafting(raw){
 const s=craftingDefaults();if(!raw||typeof raw!=='object')return s;
 s.period=raw.period==='hour'?'hour':'day';
 s.skill=craftingSkills.includes(raw.skill)?raw.skill:s.skill;
 for(const k of craftingSkills)s.levels[k]=integer(raw.levels?.[k]??1,1,game.maxLevel);
 for(const slot of craftingSlots){const v=raw.gear?.[slot];if(v&&slotItems(slot).some(g=>g.itemId===Number(v.id)))s.gear[slot]={id:Number(v.id),tier:integer(v.tier??0,0,4),plus:integer(v.plus??0,0,game.maxEnhancement)};}
 for(const p of craftingPotions)s.brews[p.kind]=integer(raw.brews?.[p.kind]??-1,-1,4);
 for(const r of craftingRooms)s.house[r.id]=integer(raw.house?.[r.id]??0,0,Number.MAX_SAFE_INTEGER);
 for(const m of craftingMasteries)s.masteries[m.id]=integer(raw.masteries?.[m.id]??0,0,game.masteryRankLimit);
 for(const p of craftingPerks)s.perks[p.id]=integer(raw.perks?.[p.id]??0,0,p.ranks);
 const manual=normalizeManual(raw);for(const k of ['guildXp','weeklyXp','blessing','hotSetting'])s[k]=manual[k];
 s.homeBank=game.world.banks.some(b=>b.id===Number(raw.homeBank))?Number(raw.homeBank):0;s.guild=readGuild(raw.guild);
 for(const job of craftingJobs){s.tiers[job.id]=integer(raw.tiers?.[job.id]??0,0,4);for(let tier=0;tier<=4;tier++){const key=planKey(job.id,tier),n=raw.plans?.[key];if(validQuantity(n)&&n>0)s.plans[key]=n;}}
 for(const [id,n]of Object.entries(raw.owned??{}))if(validItemId(Number(id))&&validQuantity(n)&&n>0)s.owned[id]=n;
 return s;
}
export function craftingPlan(raw){
 const s=normalizeCrafting(raw);return craftingJobs.flatMap(job=>Array.from({length:5},(_,tier)=>({job,tier,key:planKey(job.id,tier),count:s.plans[planKey(job.id,tier)]??0})).filter(p=>p.count>0));
}
export function craftingMaterials(job,tier,count){
 if(!validQuantity(count)||!Number.isInteger(tier)||tier<0||tier>4)throw Error('invalidQuantity');
 return Object.fromEntries(game.recipeInputs(job,tier).map(i=>[i.itemId,safeMultiply(i.qty,count)]));
}
export function materialRequirements(raw){
 const items={};for(const p of craftingPlan(raw))for(const [id,n]of Object.entries(craftingMaterials(p.job,p.tier,p.count)))items[id]=safeAdd(items[id]??0,n);return items;
}
const money=v=>{if(!Number.isFinite(v)||v<0||v>Number.MAX_SAFE_INTEGER)throw Error('priceOverflow');return v;};
export function priceItems(items,prices){
 let value=0;const missing=[];
 for(const [id,n]of Object.entries(items)){if(!validQuantity(n))throw Error('quantityOverflow');const p=valuationPrice(Number(id),prices);value=money(value+money(n*p.price));if(n>0&&p.fallback)missing.push(Number(id));}
 return {value,missing};
}
export function materialBudget(raw,prices){
 const s=normalizeCrafting(raw);let total=0;
 const rows=Object.entries(materialRequirements(s)).map(([id,required])=>{
  const owned=s.owned[id]??0,purchase=Math.max(0,required-owned),p=valuationPrice(Number(id),prices),cost=money(purchase*p.price);total=money(total+cost);
  return {id:Number(id),required,owned,purchase,price:p.price,fallback:p.fallback,cost};
 });return {rows,total,missing:rows.filter(r=>r.purchase>0&&r.fallback).map(r=>r.id)};
}
export function craftingPlayer(raw){
 const s=normalizeCrafting(raw),{player:p}=createScenario({levels:{},gear:{mount:s.gear.mount},brews:s.brews,house:s.house,masteries:s.masteries,homeBank:s.homeBank,manual:{...s,perks:s.perks,foodRule:3,hotSetting:'game'}});
 for(const k of craftingSkills)p.skills[k]=game.levelXp(s.levels[k]);
 for(const slot of craftingSlots){const v=s.gear[slot];p.equipment[slot]=v.id?game.encode(game.withRarity(v.id,v.tier),v.plus):null;}
 p.bank={};p.brews={};p.brewTier={};p.eatAt=0;p.fallback=null;
 for(const [kind,tier]of Object.entries(s.brews))if(tier>=0){p.brews[kind]=Number.MAX_SAFE_INTEGER;p.brewTier[kind]=tier;}
 if(s.blessing)p.brews.blessing=Number.MAX_SAFE_INTEGER;
 return {state:s,player:p};
}
export function craftingStats(raw){
 const {state:s,player:p}=craftingPlayer(raw);return {level:s.levels[s.skill],speedBonus:game.workModifiers(p,s.skill).combined-1,
 xpBonus:game.combine(game.workXpMultiplier(p,false),game.masteryMultiplier(p.masteries,'xp'),1+s.weeklyXp/100)-1,
 moveSpeed:Math.round(game.mountSpeed(p)*(1+.2*game.brewScale(p,'swift'))*(1+s.masteries.move*.005))/1000,capacity:game.packCapacity(p)};
}
export function importCrafting(current,snapshot){return importWorkConfig(current,snapshot,{skills:craftingSkills,slots:craftingSlots,potions:craftingPotions,rooms:craftingRooms,masteries:craftingMasteries,perks:craftingPerks,normalize:normalizeCrafting,gear:gatheringGear,ironman:false,reset:{homeBank:0,hotSetting:'game'}});}
