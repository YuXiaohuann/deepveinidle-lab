import test from 'node:test';
import assert from 'node:assert/strict';
import {game,defaults,preset,calculate,normalize,gearForStyle,masteryValue,masteryRank} from '../src/model.js';
import {createScenario,simulateMonster} from '../src/simulation.js';
import {importCharacter} from '../src/character-import.js';
import {validItemId,itemFamily,valueCombatRewards} from '../src/item-prices.js';
import {translatedItemName} from '../src/i18n.js';
import {enhanceableItems} from '../src/enhancement.js';

const newGear=[
 [629,'ranged','weapon',95,59,53,0], [630,'ranged','weapon',95,69,65,0],
 [631,'magic','weapon',95,81,73,0], [632,'magic','helmet',99,25,0,10],
 [633,'magic','body',99,42,0,19], [634,'magic','legs',99,32,0,15],
 [635,'magic','shield',99,28,23,0],
];

test('new combat gear supports all qualities, enhancement, prices, translation and storage',()=>{
 for(const[id,style,slot,level,accuracy,strength,defence]of newGear){
  assert.deepEqual([game.gear(id).levelReq,game.gear(id).accuracy,game.gear(id).strength,game.gear(id).defence],[level,accuracy,strength,defence]);
  assert.ok(gearForStyle(slot,style).some(g=>g.itemId===id));
  assert.notEqual(translatedItemName(id,'zh'),translatedItemName(id,'en'));
  assert.equal(itemFamily(id),slot==='weapon'?'weapons':'armour');
  for(let tier=0;tier<5;tier++){
   const encoded=game.encode(game.withRarity(id,tier),17);
   assert.ok(validItemId(encoded));assert.equal(game.gear(encoded).slot,slot);
   const s=defaults();s.gear[slot]={id,tier,plus:17};
   assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))).gear[slot],s.gear[slot]);
  }
 }
 // The reviewed upgrade recipe level now determines enhancement costs.
 assert.equal(enhanceableItems.length,168);
 assert.ok(newGear.every(([id])=>enhanceableItems.some(i=>i.id===id)));
});

test('new equipment imports quality and enhancement without warnings, preserving mastery ranks',()=>{
 for(const[id,style,slot]of newGear){
  const s=preset(style);for(const k of Object.keys(s.levels))s.levels[k]=99;
  const p=createScenario(s).player;p.equipment[slot]=game.encode(game.withRarity(id,4),23);p.masteries.accuracy=13;
  const imported=importCharacter(s,{version:2,capturedAt:Date.now(),player:p});
  assert.deepEqual(imported.state.gear[slot],{id,tier:4,plus:23});
  assert.ok(!imported.warnings.some(w=>w.includes('equipment.')));
  assert.equal(imported.state.masteries.accuracy,13);
  assert.equal(masteryValue('accuracy',13),13);assert.equal(masteryRank('accuracy',13),13);
 }
});

test('weapon piercing affects enemy defence before the fixed 10, including enhanced new longbow',()=>{
 for(const[id,style,scale]of[[114,'melee',1],[394,'melee',.75],[145,'ranged',1],[151,'ranged',.9],[157,'magic',.5],[630,'ranged',.9]]){
  const s=defaults();s.style=style;s.levels[style]=99;s.gear.weapon={id,tier:4,plus:17};
  const r=calculate(s),enemy=r.rows.find(m=>m.name==='Ice wight');
  assert.equal(game.armourMultiplier(r.player),scale);
  assert.equal(enemy.chance,r.stats.accuracy/(r.stats.accuracy+10+106*scale));
 }
});

test('updated attributes use native integers and preserve rarity then enhancement rounding',()=>{
 assert.deepEqual([game.gear(157).accuracy,game.gear(157).strength],[70,63]);
 assert.deepEqual([game.gear(349).accuracy,game.gear(349).strength],[23,18]);
 assert.deepEqual([115,116,117,118,119,351].map(id=>game.gear(id).defence),[6,13,22,35,52,64]);
 // Rare accuracy round(70*1.6)=112, then +5 gives round(112*1.30)=146.
 assert.equal(game.gear(game.encode(game.withRarity(157,2),5)).accuracy,146);
 for(const id of [114,394]){
  const s=defaults();s.gear.weapon.id=id;s.levels.melee=74;assert.ok(calculate(s).issues.some(i=>i.kind==='level'));
  s.levels.melee=75;assert.ok(!calculate(s).issues.some(i=>i.kind==='level'));
 }
 const s=defaults();s.masteries.accuracy=10;
 assert.equal(calculate(s).stats.accuracy,12); // round(11*1.10)
});

test('warehouse meals leave the full selected trip load and all consumed food is charged',()=>{
 const s=preset('ranged'),{player:p}=createScenario(s);Object.assign(p,{hp:12,brews:{},bank:{64:100},pack:[],foodItemId:64,foodPerTrip:5,eatAt:.5,route:{zoneId:1}});p.perks.meals=0;
 const events=[];game.restock(p,events);
 assert.equal(p.hp,84);assert.equal(p.bank[64],89);assert.equal(p.pack.reduce((n,i)=>n+i.qty,0),5);
 assert.equal(events.filter(e=>e.kind==='ate').length,6);
 s.manual.simulationHours=1;s.manual.hotSetting='off';s.manual.foodPerTrip=5;
 const monster=game.monsters.find(m=>m.name==='Ice wight'),result=simulateMonster(s,monster,{seed:314});
 const valued=valueCombatRewards(result,{64:{price:7}});
 assert.ok(result.food>0);assert.equal(valued.foodCost,result.food*7);
});
