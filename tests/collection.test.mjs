import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {collectionWorkConfig,collectionDefaults,validateCollection,collectionTarget,pointsForProduction,collectionRoutes,estimateCollection,collectionRows,priceCollection,collectionPrice,importCollection,collectionInteger,collectionNumber,collectionPlayers,collectionWindows,collectionPotionItems} from '../src/collection-model.js';
import {priceDefaults} from '../src/item-prices.js';
import {createScenario,simulationTick,START_TICK} from '../src/simulation.js';
import {createCraftingScenario} from '../src/crafting-simulation.js';
import {simulateCollection} from '../src/collection-simulation.js';
import {craftingSlots,craftingSkills} from '../src/crafting-model.js';
import {gatheringSlots,gatheringSkills,gatheringPlayer} from '../src/gathering-model.js';
const setup=()=>({...collectionDefaults(),initialized:true});
const job=id=>collectionRoutes(id)[0];
function snapshot(){
 const {player}=createScenario({});for(const skill of [...craftingSkills,...gatheringSkills])player.skills[skill]=game.levelXp(1);
 for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;
 player.house={};player.houseFurniture={};player.collections={40:9};player.masteries={};player.perks={};player.ironman=false;player.homeBank=null;
 return {version:2,capturedAt:Date.now(),player,worldTick:0,worldBuffs:[],guild:null};
}
test('original collection rewards and five rarities agree with total earned points at every boundary',()=>{
 const thresholds=game.collectionThresholds(40),rewards=[1,1,3,10,35,120,420,1500];
 assert.deepEqual(thresholds,[1,10,100,1000,10000,100000,1000000,10000000]);
 for(let tier=0;tier<5;tier++)for(let i=0;i<thresholds.length;i++){
  const id=game.withRarity(40,tier),q=thresholds[i],mult=[1,3,10,30,100][tier];
  assert.equal(game.collectionPoints(q,tier,40)-game.collectionPoints(q-1,tier,40),rewards[i]*mult);
  assert.equal(game.collectionPoints(q,tier,40),game.masteryEarnedPoints({collections:{[id]:q},forgeLog:{}}));
 }
 const pet=game.items.find(i=>game.isPet(i.id));assert.deepEqual(game.collectionThresholds(pet.id),[1]);assert.equal(pointsForProduction(pet.id,0,1),1000);assert.equal(pointsForProduction(pet.id,1,10),0);
});
test('next and later targets use only unearned rewards; completed progress has no target',()=>{
 const s=setup();s.counts[40]=9;assert.deepEqual(collectionTarget(s,40),{current:9,target:10,missing:1,points:1,complete:false});
 assert.equal(collectionTarget(s,40,100).points,4);s.counts[40]=10000000;assert.equal(collectionTarget(s,40).complete,true);
 assert.throws(()=>collectionTarget(s,40,11),/invalidTarget/);
});
test('fixed action time uses original chance; batch rounding credits all crossed milestones',()=>{
 const s=setup(),j=job(40),r=estimateCollection(s,40,j);assert.equal(r.seconds,2.4);assert.deepEqual(r.materials,{1:1,2:1});
 s.counts[40]=9;assert.equal(estimateCollection(s,40,j).quantity,1);
 const batch={...j,output:{itemId:40,qty:100}};s.counts[40]=0;const b=estimateCollection(s,40,batch);assert.equal(b.quantity,100);assert.equal(b.points,5);assert.equal(b.secondsPerPoint,2.4/5);
});
test('burns use successful target actions and expected consumed materials',()=>{
 const s=setup(),j=game.recipes.find(j=>j.skill==='cooking'&&j.burn&&!j.retired);s.config.levels.cooking=j.levelReq;
 const id=j.output.itemId,r=estimateCollection(s,id,j);assert.equal(r.status,'ok');assert.ok(r.burn>0);assert.equal(r.attempts,Math.ceil(r.missing/j.output.qty)/(1-r.burn));assert.ok(r.outputs[j.burn.itemId]>0);
});
test('gathering qualities, batches and catches use target-quality stopping probabilities',()=>{
 const s=setup(),j=job(1),normal=estimateCollection(s,1,j),rare=estimateCollection(s,game.withRarity(1,4),j);
 assert.equal(normal.status,'ok');assert.ok(rare.seconds>normal.seconds);assert.equal(normal.attempts,1/normal.quality);
 const caught=game.recipes.find(j=>j.skill==='thieving'&&j.caught&&game.collectionItems.has(j.output.itemId)&&j.output.itemId!==game.coinItemId);
 s.config.levels.thieving=caught.levelReq;const r=estimateCollection(s,caught.output.itemId,caught);
 assert.ok(r.caught>0);const p=game.workChance(caught,gatheringPlayer(s.config).player);
 assert.equal(r.seconds,r.attempts*(game.tickMs/1000/p+r.caught*Math.max(0,caught.caught.stunTicks-1)*game.tickMs/1000));
});
test('unsupported upgrades, locked levels and pre-import states remain explicit',()=>{
 const s=setup(),upgrade=game.upgradeRecipes[0];assert.equal(collectionRoutes(upgrade.to[0]).some(r=>r.retired),false);
 const high=game.recipes.find(j=>j.skill==='smithing'&&j.levelReq>1&&!j.retired);assert.equal(estimateCollection(s,high.output.itemId,high).status,'levelTooLow');
 s.initialized=false;assert.equal(estimateCollection(s,40,job(40)).status,'uninitialized');
 assert.ok(collectionRows(setup()).every(r=>r.jobId!==null&&collectionRoutes(r.id).some(j=>j.id===r.jobId)));
 assert.throws(()=>estimateCollection(setup(),40,null),/invalidRoute/);
});
test('buy/sell quotes stay distinct; only explicit manual prices override procurement',()=>{
 const p=priceDefaults();p.quotes[1]={ask:{value:9,capturedAt:100},bid:{value:4,capturedAt:100}};
 p.prices[1]={price:1,source:'vendor'};assert.equal(collectionPrice(1,p,'buy').price,9);assert.equal(collectionPrice(1,p,'sell').price,4);
 p.prices[1]={price:0,source:'manual',updatedAt:200};assert.equal(collectionPrice(1,p,'buy').price,0);
 p.prices[1]={price:null,source:'manual'};p.quotes[1].ask.value=null;assert.equal(collectionPrice(1,p,'buy').price,null);
 p.quotes[1].ask={invalid:true,capturedAt:100};assert.equal(collectionPrice(1,p,'buy').price,null);
});
test('material and net investment separate missing inputs, missing sales, zero and negative totals',()=>{
 const p=priceDefaults(),r=estimateCollection(setup(),40,job(40));assert.equal(priceCollection(r,p).cost,null);assert.equal(priceCollection(r,p).profitPerPoint,null);
 p.prices[1]={source:'manual',price:0};p.prices[2]={source:'manual',price:2};let v=priceCollection(r,p);assert.equal(v.cost,2);assert.equal(v.net,null);
 p.quotes[40]={bid:{value:10,capturedAt:100}};v=priceCollection(r,p);assert.equal(v.net,-8);assert.equal(v.profitPerPoint,8);p.quotes[40].bid.value=1;assert.equal(priceCollection(r,p).profitPerPoint,-1);p.quotes[40].bid.value=2;assert.equal(Object.is(priceCollection(r,p).profitPerPoint,0),true);
 const gathering=estimateCollection(setup(),1,job(1));assert.equal(priceCollection(gathering,p).cost,0);
});
test('minimal import accepts sparse collection and no forgeLog; failed import is atomic',()=>{
 const s=setup(),snap=snapshot();delete snap.player.forgeLog;const imported=importCollection(s,snap);assert.equal(imported.counts[40],9);assert.equal(imported.initialized,true);assert.equal(imported.config.blessing,false);assert.ok(Object.values(imported.config.brews).every(v=>v===-1));
 const before=structuredClone(s);delete snap.player.collections;assert.throws(()=>importCollection(s,snap),/incompleteSnapshot/);assert.deepEqual(s,before);
 for(const invalid of [-1,.5,'4',null]){snap.player.collections={40:invalid};assert.throws(()=>importCollection(s,snap),/invalidSnapshot/);}
 snap.player.collections={40:0};delete snap.player.skills.smithing;assert.throws(()=>importCollection(s,snap),/incompleteSnapshot/);
});
test('storage and user quantities reject invalid values instead of clipping',()=>{
 const s=setup();assert.deepEqual(validateCollection(s),s);
 for(const n of ['',null,-1,.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>collectionInteger(n),/invalidInteger/);
 s.config.levels.smithing=0;assert.throws(()=>validateCollection(s),/invalidConfiguration/);
});
test('target simulation matches independent original tick events, stops at actual product and reproduces seed',()=>{
 const s=setup();s.counts[40]=9;const j=job(40),r=simulateCollection(s,40,j.id,{target:100,seed:87,maxTicks:6000});
 const {player,context}=createCraftingScenario(s.config,j,0,6000,{target:100,seed:87,maxTicks:6000});let elapsed=0,qty=0;
 for(let t=1;t<=6000;t++){const events=[];simulationTick(player,context,START_TICK+t,events);for(const e of events)if(e.kind==='produced'&&e.itemId===40)qty+=e.qty??1;if(qty>=91){elapsed=t;break;}}
 assert.equal(r.elapsedTicks,elapsed);assert.equal(r.quantity,qty);assert.equal(r.points,4);assert.equal(r.complete,true);assert.deepEqual(r.materials,{1:91,2:91});assert.deepEqual(simulateCollection(s,40,j.id,{target:100,seed:87,maxTicks:6000}),r);
});
test('simulation limit preserves partial progress without complete per-point results',()=>{
 const s=setup();const r=simulateCollection(s,40,job(40).id,{target:10000000,seed:0,maxTicks:100});assert.equal(r.complete,false);assert.equal(r.error,'timeLimit');assert.equal(r.secondsPerPoint,null);assert.ok(r.quantity<10000000);
 assert.throws(()=>simulateCollection(s,40,job(40).id,{maxTicks:0}),/invalidDuration/);
});

test('every supported route includes all future targets from current progress',()=>{
 const s=setup();s.counts[40]=9;
 const before=structuredClone(s),rows=collectionRows(s).filter(r=>r.id===40);
 assert.deepEqual(rows.map(r=>r.target),[10,100,1000,10000,100000,1000000,10000000]);
 assert.deepEqual(rows.slice(0,3).map(r=>r.points),[1,4,14]);
 assert.equal(rows[1].quantity,91);assert.equal(rows[1].materials[1],91);
 for(const r of rows)assert.equal(r.points,game.collectionPoints(r.target,0,40)-game.collectionPoints(9,0,40));
 assert.deepEqual(s,before);
 s.counts[40]=10000000;const completed=collectionRows(s).filter(r=>r.id===40);
 assert.equal(completed.length,1);assert.equal(completed[0].status,'complete');assert.equal(completed[0].target,null);
});

test('overflow is isolated to each amount, preserving valid costs and time across unlimited targets',()=>{
 const state=setup(),prices=priceDefaults();
 for(const item of game.items)prices.prices[item.id]={price:1e6,source:'manual'};
 const rows=collectionRows(state),valued=rows.map(r=>priceCollection(r,prices));
 const large=valued.find(r=>r.id===3001&&r.target===10000000);
 assert.deepEqual(large.overflowFields,['value']);assert.equal(large.cost,0);assert.equal(large.costPerPoint,0);assert.equal(large.value,null);assert.equal(large.profitPerPoint,null);assert.ok(large.secondsPerPoint>0);
 const small=valued.find(r=>r.id===3001&&r.target===1);assert.deepEqual(small.overflowFields,[]);assert.ok(small.value>0);
 const materialOverflow=priceCollection({...large,materials:{1:1e10},outputs:{40:1}},prices);
 assert.deepEqual(materialOverflow.overflowFields,['cost']);assert.equal(materialOverflow.cost,null);assert.equal(materialOverflow.value,1e6);assert.equal(materialOverflow.net,null);
 prices.prices[1]={price:0,source:'manual'};assert.equal(priceCollection({...large,materials:{1:1e10},outputs:{}},prices).cost,0);
 for(const item of game.items)prices.prices[item.id]={price:1,source:'manual'};
 const recovered=priceCollection(large,prices);assert.deepEqual(recovered.overflowFields,[]);assert.ok(recovered.value>0);assert.ok(Number.isFinite(recovered.profitPerPoint));
 assert.throws(()=>priceCollection({...large,materials:{1:Infinity}},prices),/quantityOverflow/);
});

test('material cost sources stay independent of recovery and retain explicit manual overrides',()=>{
 const prices=priceDefaults(),r=estimateCollection(setup(),40,job(40));
 for(const [id,ask,bid]of [[1,9,4],[2,7,2],[40,30,20]])prices.quotes[id]={ask:{value:ask,capturedAt:100},bid:{value:bid,capturedAt:101}};
 assert.equal(priceCollection(r,prices,'bid','ask').cost,16);assert.equal(priceCollection(r,prices,'bid','bid').cost,6);
 const vendor=priceCollection(r,prices,'bid','vendor');assert.equal(vendor.cost,game.vendorPrice(1)+game.vendorPrice(2));assert.equal(vendor.value,20);assert.equal(vendor.materialsPriced[0].source,'vendor');
 assert.equal(priceCollection(r,prices,'vendor','ask').cost,16);
 for(const mode of ['ask','bid','vendor']){prices.prices[1]={price:0,source:'manual'};assert.equal(priceCollection(r,prices,'bid',mode).materialsPriced[0].price,0);delete prices.prices[1];}
 prices.quotes[1].bid.value=null;assert.equal(priceCollection(r,prices,'bid','bid').cost,null);assert.equal(priceCollection(r,prices,'bid','ask').cost,16);
 const untradeable=game.items.find(i=>!game.canSell(i.id));assert.equal(collectionPrice(untradeable.id,prices,'buy','bid','vendor').price,null);
});
test('material source options round-trip with collection and recovery settings',()=>{
 const state=setup();state.counts[40]=99;state.sellMode='vendor';
 const saved=validateCollection(state);assert.equal(saved.buyMode,'ask');assert.deepEqual(saved.counts,{40:99});assert.equal(saved.sellMode,'vendor');
 for(const mode of ['ask','bid','vendor']){saved.buyMode=mode;assert.equal(validateCollection(JSON.parse(JSON.stringify(saved))).buyMode,mode);}
 for(const invalid of [null,'other',0]){saved.buyMode=invalid;assert.throws(()=>validateCollection(saved),/invalidConfiguration/);}
});

test('bonus settings retain potions, blessing, hot strategy and fractional world/guild inputs',()=>{
 const s=setup();s.config.brews.hunter=3;s.config.blessing=true;s.config.hotSetting='off';s.config.guildXp=1.25;s.config.weeklyXp=2.75;s.config.worldRarity=7.125;s.config.brews.elixir=4;
 const saved=validateCollection(JSON.parse(JSON.stringify(s)));assert.equal(saved.config.brews.hunter,3);assert.equal(saved.config.blessing,true);assert.equal(saved.config.hotSetting,'off');assert.equal(saved.config.worldRarity,7.125);assert.equal(saved.config.weeklyXp,2.75);
 assert.equal(collectionNumber('1.25'),1.25);for(const n of ['',true,NaN,Infinity,-1,1e7+1])assert.throws(()=>collectionNumber(n),/invalidNumber/);
 s.config.brews.hunter=5;assert.throws(()=>validateCollection(s),/invalidConfiguration/);
});
test('full bonus import preserves active brew tiers, blessing, fractional guild XP and all world windows',()=>{
 const snap=snapshot(),p=snap.player;snap.worldBuffsVersion=1;snap.worldTick=p.lastTick;
 p.brews.hunter=p.lastTick+6000;p.brewTier.hunter=3;p.brews.elixir=p.lastTick+6000;p.brewTier.elixir=4;p.brews.blessing=p.lastTick+6000;p.guildBonus=.0125;
 snap.worldBuffs=[{fromTick:p.lastTick,toTick:p.lastTick+1,xpMult:1.0125,rarityMult:1.075},{fromTick:p.lastTick-1,toTick:p.lastTick,xpMult:1.025,rarityMult:1.0125}];
 const s=importCollection(setup(),snap);assert.equal(s.config.brews.hunter,3);assert.equal(s.config.brews.elixir,4);assert.equal(s.config.blessing,true);assert.equal(s.config.guildXp,1.25);assert.equal(s.config.weeklyXp,3.75);assert.equal(s.config.worldRarity,8.75);assert.deepEqual(s.importWarnings,[]);
 delete snap.worldBuffsVersion;const legacy=importCollection(s,snap);assert.equal(legacy.config.worldRarity,0);assert.equal(legacy.config.weeklyXp,0);assert.deepEqual(legacy.importWarnings,['worldBuffs.upgrade']);
 p.brewTier.hunter='invalid';assert.throws(()=>importCollection(s,snap),/incompleteSnapshot/);
});
test('static gathering combines world rarity, hunter and blessing with original tool/home/mastery modifiers',()=>{
 const s=setup();s.config.hotSetting='off';const id=4001,base=estimateCollection(s,id,job(id));
 s.config.gear.pickaxe={id:84,tier:4,plus:5};s.config.gear.amulet={id:186,tier:3,plus:2};s.config.house.shrine=10;s.config.masteries.rare=7;s.config.masteries.gather=10;s.config.perks.quick=5;s.config.brews.hunter=4;s.config.blessing=true;s.config.worldRarity=8.75;
 const p=collectionPlayers(s).gather,r=estimateCollection(s,id,job(id));
 const multiplier=(1+game.toolLuck(p.equipment.pickaxe)+game.equipmentLuck(p.equipment))*game.combine(game.brewRarityMultiplier(p),game.houseRarityMultiplier(p),game.masteryMultiplier(p.masteries,'rare'),1+s.config.worldRarity/100);
 assert.ok(Math.abs(r.quality-Math.min(1,game.rarityThresholds.legendary*multiplier))<1e-12);assert.ok(r.seconds<base.seconds);assert.equal(r.actionSeconds,game.tickMs/1000/game.workChance(job(id),p));
 s.config.blessing=false;const craft=estimateCollection(s,40,job(40));s.config.blessing=true;assert.equal(estimateCollection(s,40,job(40)).seconds,craft.seconds);
});
test('hot modes and complete world modifiers use matching clocks for estimates and simulation windows',()=>{
 const s=setup();s.config.weeklyXp=2.75;s.config.worldRarity=8.125;const now=Date.UTC(2026,9,17,1);
 for(const mode of ['game','current','off']){
  s.config.hotSetting=mode;const r=estimateCollection(s,4001,job(4001),collectionPlayers(s,now));assert.ok(r.quality>0);
  const windows=collectionWindows(s.config,'mining',6000,now),mods=game.windowModifiers(windows,game.predictionStartTick);
  const hot=game.hotSkill(game.predictionStartTick),nativeRare=mode==='game'&&hot.skill==='mining'&&hot.kind==='rarity'?hot.mult-1:0;
  assert.ok(Number.isFinite(mods.rarityMult));if(mode==='off')assert.ok(Math.abs(mods.rarityMult+(hot.skill==='mining'&&hot.kind==='rarity'?hot.mult-1:0)-1.08125)<1e-12);
  if(mode==='game')assert.ok(Math.abs(mods.rarityMult-1.08125)<1e-12);assert.ok(nativeRare>=0);
 }
 const craft={...s.config,weeklyXp:2.75,hotSetting:'off'};const mods=game.windowModifiers(collectionWindows(craft,'smithing',6000,now),game.predictionStartTick);assert.equal(mods.xpMult,1.0275);
});
test('potion upkeep uses original one-hour duration and affects net investment independently of materials',()=>{
 const s=setup();s.config.brews.hunter=3;s.config.brews.elixir=1;const items=collectionPotionItems(s.config,1800);assert.deepEqual(items,{[game.withRarity(221,3)]:.5,[game.withRarity(223,1)]:.5});assert.equal(game.potionDurationTicks*game.tickMs/1000,3600);
 const r=estimateCollection(s,4001,job(4001)),prices=priceDefaults();const missing=priceCollection(r,prices);assert.equal(missing.cost,0);assert.equal(missing.potionCost,null);assert.equal(missing.net,null);
 for(const id in r.outputs)prices.prices[id]={price:0,source:'manual'};for(const id in r.potionItems)prices.prices[id]={price:2,source:'manual'};
 const priced=priceCollection(r,prices);assert.ok(priced.potionCost>0);assert.equal(priced.costPerPoint,0);assert.equal(priced.net,priced.potionCost);
 const overflow=priceCollection({...r,potionItems:{[3221]:1e20}},prices);assert.equal(overflow.cost,0);assert.equal(overflow.potionCost,null);assert.ok(overflow.overflowFields.includes('potions'));
});
test('travel simulation applies XP and movement boosts and charges actual elapsed potion usage',()=>{
 const s=setup();s.config.hotSetting='off';const baseline=simulateCollection(s,40,job(40).id,{maxTicks:6000});
 s.config.brews.elixir=4;s.config.brews.swift=4;s.config.blessing=true;s.config.guildXp=12.5;s.config.weeklyXp=2.75;
 const r=simulateCollection(s,40,job(40).id,{maxTicks:6000});assert.equal(r.complete,true);assert.ok(r.xp>baseline.xp);assert.ok(r.seconds<=baseline.seconds);assert.deepEqual(r.potionItems,collectionPotionItems(s.config,r.seconds));assert.equal(r.blessing,true);
 const {player,context}=createCraftingScenario(s.config,job(40),0,6000,{maxTicks:6000});context.windows=collectionWindows(s.config,'smithing',6000,Date.now());let xp=0,qty=0;
 for(let tick=1;tick<=r.elapsedTicks;tick++){const events=[];simulationTick(player,context,START_TICK+tick,events);for(const event of events)if(event.kind==='produced'){xp+=event.xp;qty+=event.qty??1;}}
 assert.equal(r.quantity,qty);assert.equal(r.xp,xp);
});

test('one configuration feeds both engines and excludes gathering-only upkeep from crafting',()=>{
 const s=setup();s.config.masteries.xp=7;s.config.masteries.move=9;s.config.brews.hunter=4;s.config.brews.gatherer=3;s.config.brews.elixir=2;s.config.brews.swift=1;s.config.weeklyXp=2.75;
 assert.equal(Object.hasOwn(s,'gather'),false);assert.equal(Object.hasOwn(s,'craft'),false);
 const players=collectionPlayers(s);
 for(const p of [players.gather,players.craft]){assert.equal(p.masteries.xp,7);assert.equal(p.masteries.move,9);}
 const craft=collectionWorkConfig(s,'craft');assert.equal(craft.weeklyXp,2.75);assert.deepEqual(craft.brews,{elixir:2,swift:1});
 const estimate=estimateCollection(s,40,job(40));assert.deepEqual(estimate.potionItems,collectionPotionItems(craft,estimate.seconds));
 const sample=simulateCollection(s,40,job(40).id,{maxTicks:6000});assert.deepEqual(sample.potionItems,collectionPotionItems(craft,sample.seconds));
 assert.deepEqual(validateCollection(JSON.parse(JSON.stringify(s))),s);
 assert.throws(()=>validateCollection({...s,version:0}),/invalidConfiguration/);
});
