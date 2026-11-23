import test from 'node:test';
import assert from 'node:assert/strict';
import {recordActivityTime,timingDetails} from '../src/activity-timing.js';
test('every tick belongs to exactly one category and pauses are not work',()=>{
 const r={elapsedTicks:7};
 for(const p of [{activity:'working'},{activity:'walking'},{activity:'banking'},{activity:'drinking'},{activity:'working',stunUntil:10},{activity:'idle',route:{}},{activity:'idle'}])recordActivityTime(r,p,1);
 assert.equal(r.activityTicks.stunned,1);assert.equal(r.activityTicks.transitions,1);
 assert.equal(r.extraTicks,6);assert.equal(r.activityTicks.working,1);
 assert.equal(Object.values(r.activityTicks).reduce((a,b)=>a+b),7);
 for(const lang of ['zh','en']){const html=timingDetails(r,lang,'Work');assert.doesNotMatch(html,/NaN|undefined|seed|坐标/);assert.match(html,/85\.7%/);assert.match(html,lang==='zh'?/被抓停顿/:/Caught pauses/);assert.match(html,lang==='zh'?/流程切换/:/Transitions/);assert.doesNotMatch(html,/停顿与切换|Pauses and transitions/);}
});

test('durations use only the largest unit with up to two decimal places',async()=>{
 const {tickMs}=await import('../src/upstream.js');
 const display=(seconds,language='zh')=>timingDetails({elapsedTicks:seconds*1000/tickMs,extraTicks:0},language,'Work').match(/<span>Simulated<\/span><span>(.*?)<\/span>|<span>实际模拟<\/span><span>(.*?)<\/span>/).slice(1).find(v=>v!==undefined);
 for(const [seconds,expected] of [[65323.8,'18.15小时'],[523.8,'8.73分钟'],[43.8,'43.8秒'],[0,'0秒'],[0.001,'&lt;0.01秒'],[60,'1分钟'],[3600,'1小时'],[59.999,'60秒']])assert.equal(display(seconds),expected);
 assert.equal(display(65323.8,'en'),'18.15h');assert.equal(display(523.8,'en'),'8.73min');assert.equal(display(43.8,'en'),'43.8s');
 for(const lang of ['zh','en']){
  assert.match(timingDetails({elapsedTicks:8,extraTicks:0,activityTicks:{working:8}},lang,'Work'),/100\.0%/);
  assert.match(timingDetails({elapsedTicks:8,extraTicks:0,activityTicks:{working:8}},lang,'Work'),/ · 0\.0%/);
  assert.doesNotMatch(timingDetails({elapsedTicks:0,extraTicks:0},lang,'Work'),/%/);
 }
});
