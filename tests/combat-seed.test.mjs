import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import {game,preset} from '../src/model.js';
import {createScenario,simulateMonster} from '../src/simulation.js';
import {randomSimulationSeed} from '../src/simulation-seed.js';
import {nativeDay} from './native-day.mjs';

test('runtime seeds reach the original context without changing hot defaults or saved configuration',()=>{
 const state=preset('ranged'),before=JSON.stringify(state);
 for(const seed of [0,1,0x80000000,0xffffffff]){
  const scenario=createScenario(state,game.monsters[0],{seed});
  assert.equal(scenario.context.seed,seed);
  assert.equal(scenario.player.id,1);
  assert.equal(scenario.context.secretAt(1000000),0);
  assert.deepEqual(scenario.context.windows,[]);
 }
 assert.equal(state.manual.hotSetting,'game');
 assert.equal(createScenario(state).context.seed,0);
 assert.equal(JSON.stringify(state),before);
 for(const seed of [-1,0x100000000,.5,NaN,'1',null])assert.throws(()=>createScenario(state,null,{seed}),/Invalid simulation seed/);
 assert.ok(Number.isInteger(randomSimulationSeed()));
});

test('specified seeds reproduce full combat results, agree with upstream, and vary the sampled outcome',()=>{
 const state=preset('ranged');state.manual.simulationHours=1;
 const monster=game.monsters[0],zone=game.world.zones.find(z=>z.monsterId===monster.id);
 const outcomes=[];
 for(const seed of [0,123456789,0xffffffff]){
  const actual=simulateMonster(state,monster,{seed});
  assert.equal(actual.seed,seed);
  assert.deepEqual(actual,simulateMonster(state,monster,{seed,now:Date.UTC(2026,9,19)}));
  const {player,context,durationTicks}=createScenario(state,monster,{seed});
  const expected=nativeDay(player,context,p=>game.startFight(p,context,zone.id),durationTicks);
  assert.deepEqual(actual.bySkill,expected.bySkill);
  assert.equal(actual.elapsedTicks,expected.ticks);
  assert.equal(actual.deaths,expected.deaths);
  for(const [id,qty]of Object.entries(actual.normalItems))assert.equal(qty,expected.itemsGained[id]);
  const {seed:ignored,...outcome}=actual;outcomes.push(outcome);
 }
 assert.notDeepEqual(outcomes[0],outcomes[1]);
});

const appSource=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const appAst=parse(appSource,{ecmaVersion:'latest',sourceType:'module'});
const schedulingCode=appAst.body.filter(n=>n.id?.name==='scheduleSimulation'||n.declarations?.some(d=>d.id.name==='simulationSignature')).map(n=>appSource.slice(n.start,n.end)).join('\n').replace('import.meta.url',JSON.stringify('http://localhost/src/app.js'));
function scheduler(){
 const workers=[],timers=new Map();let timerId=0,seed=100;
 const context=vm.createContext({state:preset('ranged'),language:'zh',selectedEnemies:()=>({monsters:game.monsters}),randomSimulationSeed:()=>++seed,Date,JSON,Map,URL,$:()=>null,renderResults:()=>{},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),Worker:class{
  constructor(){workers.push(this);}
  postMessage(data){this.data=data;}
  terminate(){this.terminated=true;}
 }});
 vm.runInContext(schedulingCode,context);
 return {context,workers,flush:()=>{for(const [id,fn]of timers){timers.delete(id);fn();}},read:expr=>vm.runInContext(expr,context)};
}

test('one seed per round, redraws reuse results, forced and configuration reruns ignore stale messages',()=>{
 const s=scheduler();s.context.scheduleSimulation();s.flush();
 const first=s.workers[0];assert.equal(first.data.seed,101);
 s.context.language='en';s.context.state.manual.vendorValues=false;
 s.context.scheduleSimulation();s.flush();assert.equal(s.workers.length,1);
 s.context.scheduleSimulation(true);s.flush();const second=s.workers[1];assert.equal(second.data.seed,102);assert.equal(first.terminated,true);
 first.onmessage({data:{result:{key:'stale',seed:101},done:true}});
 first.onerror();assert.equal(s.read('hourly.size'),0);assert.equal(s.read('simulationError'),false);assert.notEqual(second.terminated,true);
 second.onmessage({data:{result:{key:'fresh',seed:102}}});assert.equal(s.read('hourly.get("fresh").seed'),102);
 s.context.state.levels.ranged++;s.context.scheduleSimulation();s.flush();assert.equal(s.workers[2].data.seed,103);
});

test('seed generation failure is shown without starting a fallback worker',()=>{
 const s=scheduler();s.context.randomSimulationSeed=()=>{throw Error('Random source unavailable');};
 s.context.scheduleSimulation();s.flush();assert.equal(s.workers.length,0);
 assert.equal(s.read('simulationError'),'Random source unavailable');
 s.context.scheduleSimulation();s.flush();assert.equal(s.workers.length,0);
});

test('worker forwards the same round seed to every monster',()=>{
 const source=fs.readFileSync(new URL('../src/simulation-worker.js',import.meta.url),'utf8');
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
 const code=ast.body.filter(n=>n.type!=='ImportDeclaration').map(n=>source.slice(n.start,n.end)).join('\n');
 const seen=[],messages=[],context=vm.createContext({self:{postMessage:message=>messages.push(message)},selectedEnemies:()=>({monsters:game.monsters}),simulateMonster:(state,monster,options)=>{seen.push(options);return {seed:options.seed,key:monster.id};}});
 vm.runInContext(code,context);context.self.onmessage({data:{state:{},seed:0xffffffff,now:123}});
 assert.equal(seen.length,20);assert.ok(seen.every(o=>o.seed===0xffffffff&&o.now===123));assert.equal(messages.at(-1).done,true);
});
