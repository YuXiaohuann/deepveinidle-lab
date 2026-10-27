import {questlessOffline} from './native-questless.mjs';
// Independently extract the complete 1.0.1203 native engine for compatibility checks.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';
import {game,preset} from '../src/model.js';
import {createScenario,START_TICK} from '../src/simulation.js';
import {gatheringDefaults,gatheringJobs} from '../src/gathering-model.js';
import {createGatheringScenario,simulateGatheringSite} from '../src/gathering-simulation.js';
import {craftingDefaults,craftingTiers,craftingJobs,craftingMaterials,craftingPlayer} from '../src/crafting-model.js';
import {createCraftingScenario,simulateCrafting} from '../src/crafting-simulation.js';
import {enhancementDefaults,enhanceableItems,enhancementSteps} from '../src/enhancement.js';
import {forecast} from '../src/hot-forecast.js';

const manifest=JSON.parse(fs.readFileSync('vendor/manifest.json'));
const metadata=manifest.overrides[0]??{...manifest,file:'vendor/game-original.js'};
const source=fs.readFileSync(metadata.file,'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'),metadata.sha256);
const declarations=new Map();
for(const node of parse(source,{ecmaVersion:'latest',sourceType:'module',ranges:true}).body){
 if(node.type==='FunctionDeclaration')declarations.set(node.id.name,{start:node.start,text:source.slice(node.start,node.end)});
 if(node.type==='VariableDeclaration')for(const d of node.declarations){
  const ids=[];const walk=n=>{if(!n)return;if(n.type==='Identifier')ids.push(n.name);else if(n.type==='ObjectPattern')n.properties.forEach(p=>walk(p.value));else if(n.type==='ArrayPattern')n.elements.forEach(walk);};walk(d.id);
  const entry={start:d.start,text:node.kind+' '+source.slice(d.start,d.end)+';'};ids.forEach(id=>declarations.set(id,entry));
 }
}
const exports={"world":"N","monsters":"qt","predict":"Oh","startFight":"cr","createContext":"AY","gear":"Pe","armourMultiplier":"w2","masteryMultiplier":"Ra","restock":"RL","offline":"DE","startWork":"Ss","applyUpgrade":"hL","enhanceCost":"uu","enhanceChance":"k2","enhanceXp":"eL","enhanceTicks":"Fs","skillPetChance":"wS","hotSkill":"Pg"};
const selected=new Set(),allowed=new Set(['WeakSet','WeakMap','Uint8Array','Uint16Array','Uint32Array','Int16Array','Int32Array','Float64Array','Math','Map','Set','Number','Object','Array','String','Error','Date','Boolean','Infinity','undefined','JSON','RegExp','parseInt','parseFloat']);
function collect(name){
 const d=declarations.get(name);if(!d)throw Error('Missing native declaration '+name);if(selected.has(d))return;selected.add(d);
 const refs=analyze(parse(d.text,{ecmaVersion:'latest',sourceType:'module',ranges:true}),{ecmaVersion:2024,sourceType:'module'}).globalScope.through.map(r=>r.identifier.name);
 for(const dep of new Set(refs))if(declarations.has(dep))collect(dep);else if(!allowed.has(dep))throw Error('Unexpected native dependency '+dep);
}
Object.values(exports).forEach(collect);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dvi-1203-audit-'));
try{
 const file=path.join(directory,'native.mjs');
 fs.writeFileSync(file,[...selected].sort((a,b)=>a.start-b.start).map(d=>d.text).join('\n')+'\nexport{'+Object.entries(exports).map(([alias,name])=>name+' as '+alias).join(',')+'};');
 const native=await import(pathToFileURL(file));
 // Manufacturing job lists changed; compare map geometry and combat routes.
 const siteGeometry=({jobIds,...site})=>site;
 const geometry=world=>({...world,sites:world.sites.map(siteGeometry),siteById:new Map([...world.siteById].map(([id,site])=>[id,siteGeometry(site)]))});
 assert.deepEqual(geometry(native.world),geometry(game.world));assert.deepEqual(native.monsters,game.monsters);
 let count=0;
 function compare(state,monster){
  const {player}=createScenario(state,monster);
  const localContext=game.createContext(game.world,314),nativeContext=native.createContext(native.world,314);
  const zone=game.world.zones.find(z=>z.monsterId===monster.id);
  const actual=game.predict(player,localContext,p=>game.startFight(p,localContext,zone.id));
  const expected=native.predict(player,nativeContext,p=>native.startFight(p,nativeContext,zone.id));
  assert.deepEqual(actual,expected,`${state.style}: ${state.gear.weapon.id}: ${monster.name}`);count++;
 }
 for(const style of ['melee','ranged','magic'])for(const monster of game.monsters)compare(preset(style),monster);
 for(const[id,style]of[[394,'melee'],[151,'ranged'],[629,'ranged'],[630,'ranged'],[631,'magic']])for(const tier of [0,4]){
  const state=preset(style);for(const k of Object.keys(state.levels))state.levels[k]=99;
  state.masteries.accuracy=13;state.gear.weapon={id,tier,plus:17};state.manual.foodPerTrip=5;
  if(style==='magic')for(const[slot,id]of[['helmet',632],['body',633],['legs',634],['shield',635]])state.gear[slot]={id,tier,plus:17};
  for(const monster of game.monsters)compare(state,monster);
 }
 for(const id of [629,630,631,632,633,634,635])for(let tier=0;tier<5;tier++)for(const plus of [0,17,100]){
  const encoded=game.encode(game.withRarity(id,tier),plus);assert.deepEqual(game.gear(encoded),native.gear(encoded));
 }
 let gatheringCount=0;
 for(const job of gatheringJobs){
  const state=gatheringDefaults();state.skill=job.skill;state.levels[job.skill]=99;state.simulationHours=1;state.hotSetting='off';
  for(const site of game.world.sites.filter(site=>site.jobIds.includes(job.id))){
   const scenario=createGatheringScenario(state,job,site,{seed:314}),actual=simulateGatheringSite(state,job,site,{seed:314});
   let player;native.predict(scenario.player,scenario.context,p=>{player=p;return false;});player.offlineCapTicks=12000;
   assert.ok(native.startWork(player,scenario.context,site.id,job.id,'bank',null));
   const report=questlessOffline(native,player,scenario.context,START_TICK+6000);
   // Compare the sampled inventory; displayed rewards now use opportunity expectations.
   const expectedItems={...actual.sampleItems};if(actual.coins)expectedItems[game.coinItemId]=actual.coins;
   assert.deepEqual(expectedItems,report.itemsGained);assert.equal(actual.xp,report.skills[job.skill]?.xp??0);gatheringCount++;
  }
 }
 let craftingCount=0,upgradeCount=0;
 const state=craftingDefaults();state.hotSetting='off';for(const skill of Object.keys(state.levels))state.levels[skill]=99;
 for(const job of craftingJobs)for(const tier of craftingTiers(job)){
  const actual=simulateCrafting(state,job,tier,3,{seed:314});
  if(job.upgrade){
   const {player}=craftingPlayer(state),before=player.skills[job.skill],from=game.withRarity(job.upgrade.from[0],tier);
   player.bank=craftingMaterials(job,tier,3);for(let i=0;i<3;i++)assert.equal(native.applyUpgrade(player,job.upgrade,from),'ok');
   assert.equal(actual.xp,player.skills[job.skill]-before);assert.equal(player.bank[game.withRarity(job.output.itemId,tier)],3);upgradeCount++;
  }else{
   const scenario=createCraftingScenario(state,job,tier,3,{seed:314}),before=scenario.player.skills[job.skill];
   const report=questlessOffline(native,scenario.player,scenario.context,START_TICK+6000);
   assert.equal(actual.xp,scenario.player.skills[job.skill]-before);assert.deepEqual(actual.sampleItems,report.itemsGained);craftingCount++;
  }
 }
 let costs=0;for(const id of [629,630,631,632,633,634,635])for(let tier=0;tier<5;tier++)for(const plus of [0,17,100]){
  const encoded=game.encode(game.withRarity(id,tier),plus);assert.deepEqual(game.enhanceCost(encoded),native.enhanceCost(encoded));costs++;
 }
 let enhancementCases=0;
 assert.equal(native.enhanceTicks,4);assert.equal(native.skillPetChance('enhancing'),1/3e6);
 for(const item of enhanceableItems)for(let tier=0;tier<5;tier++)for(const [level,mastery,lectern]of [[1,0,0],[99,201,7]]){
  const state={...enhancementDefaults(),itemId:item.id,tier,level,mastery,lectern,target:20};
  const player={skills:{enhancing:game.levelXp(level)},masteries:{enhance:mastery},house:{lectern},houseFurniture:lectern?{lectern:{cell:0,slot:0}}:{},brews:{},lastTick:0};
  for(const step of enhancementSteps(state)){
   const id=game.withRarity(item.id,tier),cost=native.enhanceCost(game.encode(id,step.from));
   assert.equal(step.chance,native.enhanceChance(player,step.from));
   assert.equal(step.gold,cost.gold);assert.equal(step.shards,cost.shards);
   assert.equal(step.xp,native.enhanceXp(player,{windows:[]},0,id,step.from));enhancementCases++;
  }
 }
 const schedule=forecast(Date.UTC(2026,9,13));for(const entry of [schedule.current,...schedule.entries])assert.deepEqual(entry,native.hotSkill(entry.from));
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({predictions:count,gearVariants:105,gatheringSites:gatheringCount,craftingCases:craftingCount,upgradeCases:upgradeCount,enhancementCosts:costs,enhancementCases,forecastSlots:49})+'\n');
 console.log(`Enhancing: ${enhancementCases} item/rarity/level/mastery/plus cases matched independent native chance, costs and XP; duration and pet chance matched.`);
 console.log(`Other pages: ${gatheringCount} gathering sites, ${craftingCount} ordinary recipe/quality cases, ${upgradeCount} upgrade/quality cases, ${costs} enhancement costs and 49 forecast slots matched independent native code.`);
 console.log(`Native 1.0.1203 comparison: ${count}/${count} complete 1-hour predictions matched; world geometry, monsters and 105 new-gear variants matched.`);
}finally{fs.rmSync(directory,{recursive:true});}
