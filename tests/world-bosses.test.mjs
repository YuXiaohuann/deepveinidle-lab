import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateWorldBosses,renderWorldBosses} from '../src/world-bosses.js';
import {game,defaults,preset,makePlayer,sortEnemies} from '../src/model.js';
const rows=state=>calculateWorldBosses(makePlayer(state).player);

test('three distinct bosses use recommended levels and hand-calculated baseline DPS',()=>{
 const result=rows(defaults());
 assert.equal(new Set(result.map(x=>x.key)).size,3);
 assert.deepEqual(result.map(x=>x.fears),['melee','ranged','magic']);
 for(const row of result){
  assert.equal(row.level,110);assert.equal(row.max,1);assert.equal(row.chance,11/441);
  assert.equal(row.seconds,3);assert.equal(row.dps,11/1323);
  assert.equal(row.enemyMax,110);assert.equal(row.enemyChance,460/471);assert.equal(row.enemySeconds,3.6);
 }
});

test('weakness multipliers round before averaging damage across all three styles',()=>{
 for(const [style,max,chance,seconds]of [['melee',49,340/770,2.4],['ranged',39,378/808,1.8],['magic',77,453/673,3.6]]){
  const result=rows(preset(style)),weak=result.find(x=>x.fears===style);
  assert.equal(weak.max,max);assert.equal(weak.chance,chance);assert.equal(weak.seconds,seconds);
  assert.equal(weak.dps,(max+1)/2*chance/seconds);
  assert.ok(result.filter(x=>x.fears!==style).every(x=>x.max<weak.max));
 }
});

test('magic, greatsword, longbow and shortbow preserve original defence corrections',()=>{
 for(const [predicate,multiplier]of [[g=>g.magic,.5],[g=>g.twoHanded,.75],[g=>g.ranged&&g.speed===5,.9],[g=>g.ranged&&g.speed===3,1]]){
  const weapon=game.equipment.find(g=>g.slot==='weapon'&&predicate(g));
  const state=defaults();state.gear.weapon.id=weapon.itemId;
  const {player}=makePlayer(state);
  assert.equal(rows(state)[0].chance,game.accuracy(player)/(game.accuracy(player)+10+420*multiplier));
 }
});

test('food, haste and crop reduction affect current static output',()=>{
 const state=preset('melee'),base=rows(state);
 state.fed=true;state.brews.haste=4;state.rooted=true;
 const buffed=rows(state);
 assert.ok(buffed[0].max>base[0].max);assert.ok(buffed[0].seconds<base[0].seconds);
 assert.ok(buffed[0].dps>base[0].dps);assert.ok(buffed[0].enemyMax<base[0].enemyMax);
});

test('underlevel gear counts and two-handed off-hand exclusion stays effective',()=>{
 const state=defaults();state.gear.weapon.id=394;state.gear.shield.id=115;
 const {player,issues}=makePlayer(state);
 assert.ok(issues.some(x=>x.kind==='level'));assert.equal(player.equipment.shield,null);
 const result=rows(state);state.gear.shield.id=0;assert.deepEqual(rows(state),result);
 assert.ok(result[0].max>rows(defaults())[0].max);
});

test('ordinary enemy selection and simulation hours do not affect boss rows',()=>{
 const state=preset('magic'),base=rows(state);
 state.manual.enemySelection='monster-1';state.manual.simulationHours=1;
 assert.deepEqual(rows(state),base);
});

test('bilingual nine-column markup, details and independent sort without a table note',()=>{
 const result=rows(preset('melee'));
 for(const language of ['zh','en']){
  const sorted=sortEnemies(result,'dps','asc');
  const html=renderWorldBosses(sorted,{language,sort:'dps',direction:'asc',open:new Set([result[0].key])});
  assert.equal((html.match(/<th[ >]/g)||[]).length,9);
  assert.equal((html.match(/<tr data-boss=/g)||[]).length,3);
  assert.ok(html.includes(`<details id="${result[0].key}-details" class="reward-detail" open>`));
  assert.match(html,/aria-sort="ascending"><button class="sort-header" data-boss-sort="dps"/);
  assert.doesNotMatch(html,/data-sort=|data-enemy=|5000/);
  assert.ok(html.includes(language==='zh'?'推荐等级':'Recommended level'));
  assert.ok(html.includes(language==='zh'?'理论 DPS':'Theoretical DPS'));
  assert.doesNotMatch(html,/table-note|服务端实际团战规则尚未完整核验|actual server raid rules have not been fully verified/);
 }
});
