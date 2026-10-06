import test from 'node:test';
import assert from 'node:assert/strict';
import {game,preset,normalize,defaults} from '../src/model.js';
import {DAY_TICKS,combatHot,combatHotWindows,rewardAmount} from '../src/combat-hot.js';
import {epoch,tickTime} from '../src/hot-forecast.js';
import {manualWindows} from '../src/manual-settings.js';
import {START_TICK,simulateMonster,createScenario} from '../src/simulation.js';
import {nativeDay} from './native-day.mjs';
const now=Date.UTC(2026,9,6,3,17);
test('hot choice defaults on, missing legacy fields enable it, and explicit choices survive saving',()=>{
 assert.equal(defaults().manual.hotForecast,true);
 assert.equal(normalize({}).manual.hotForecast,true);
 const s=preset('ranged');
 for(const value of [true,false]){s.manual.hotForecast=value;assert.equal(normalize(JSON.parse(JSON.stringify(s))).manual.hotForecast,value);}
 delete s.manual.hotForecast;s.manual.hotMode=1;
 assert.equal(normalize(s).manual.hotForecast,true);
 for(const value of [false,1,'true',null]){s.manual.hotForecast=value;assert.equal(normalize(s).manual.hotForecast,false);}
});
test('forecast includes active combat periods, clips boundaries and fails on invalid time',()=>{
 const result=combatHot(now);assert.equal(result.end-result.start,144000);
 assert.equal(tickTime(result.start),now);
 let hot=game.hotSkill(result.start);while(hot.skill!=='combat')hot=game.hotSkill(hot.until);
 const active=combatHot(tickTime(hot.from+17));assert.equal(active.entries[0].from,hot.from+17);assert.equal(active.entries[0].until,hot.until);
 for(const entry of result.entries){assert.equal(entry.skill,'combat');assert.ok(entry.from>=result.start&&entry.until<=result.end);assert.ok(entry.until>entry.from);}
 for(const value of [NaN,Infinity,epoch-1])assert.throws(()=>combatHot(value),/invalidTime/);
});
test('mapped windows match forecast for every tick including initialization and half-hour boundaries',()=>{
 const schedule=combatHot(Date.UTC(2026,9,2)),windows=[...manualWindows(START_TICK,START_TICK+DAY_TICKS,30),...combatHotWindows(schedule)],seen=new Set();
 const expectedHot=Array.from({length:DAY_TICKS+1},(_,offset)=>game.hotSkill(schedule.start+Math.max(0,offset-1)));
 for(let offset=0;offset<=DAY_TICKS;offset++){
  const tick=START_TICK+offset,native=game.hotSkill(tick),forecast=expectedHot[offset];
  let xp=native.skill==='combat'&&native.kind==='xp'?native.mult-1:0,rare=native.skill==='combat'&&native.kind==='rarity'?native.mult-1:0;
  for(const w of windows)if(tick>=w.fromTick&&tick<=w.toTick){xp+=w.xpMult-1;rare+=w.rarityMult-1;}
  assert.ok(Math.abs(xp-(.3+(forecast.skill==='combat'&&forecast.kind==='xp'?forecast.mult-1:0)))<1e-10);
  assert.ok(Math.abs(rare-(forecast.skill==='combat'&&forecast.kind==='rarity'?forecast.mult-1:0))<1e-10);
  if(forecast.skill==='combat')seen.add(forecast.kind);
 }
 assert.deepEqual([...seen].sort(),['rarity','xp']);
});
test('day totals divide uniformly without hourly rounding, including early deaths',()=>{
 for(const value of [0,1,25,1234.5]){assert.equal(rewardAmount(value,'hour'),value/24);assert.equal(rewardAmount(value,'day'),value);}
 const s=preset('ranged'),m=game.monsters[0],result=simulateMonster(s,m);
 assert.equal(result.elapsedTicks,DAY_TICKS);assert.equal(result.xp,Object.values(result.bySkill).reduce((sum,n)=>sum+n,0));
 const dead=simulateMonster(defaults(),game.monsters.at(-1));assert.equal(dead.deaths,1);assert.ok(dead.elapsedTicks<DAY_TICKS);assert.equal(rewardAmount(dead.xp,'hour'),dead.xp/24);
});
test('forecast changes XP and aligns with original offline chunks over 24 hours',()=>{
 const s=preset('ranged'),m=game.monsters[0];s.manual.hotForecast=false;
 const baseline=simulateMonster(s,m,{now});s.manual.hotForecast=true;
 const result=simulateMonster(s,m,{now}),{player,context}=createScenario(s,m,{now}),zone=game.world.zones.find(z=>z.monsterId===m.id);
 const expected=nativeDay(player,context,p=>game.startFight(p,context,zone.id));
 assert.ok(result.xp>baseline.xp);assert.equal(result.xp,expected.xpPerHour);assert.deepEqual(result.bySkill,expected.bySkill);assert.equal(result.elapsedTicks,expected.ticks);
 assert.throws(()=>simulateMonster(s,m,{now:epoch-1}),/invalidTime/);
 assert.deepEqual(simulateMonster({...s,manual:{...s.manual,hotForecast:false}},m,{now:epoch-1}),baseline);
});
