import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {enhancementDefaults,enhanceableItems,validateEnhancement,enhancementSteps,calculateEnhancement,importEnhancement,decodeEnhancementItem} from '../src/enhancement.js';
const config=patch=>({...enhancementDefaults(),tier:0,target:5,protect:false,...patch});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-9*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
// Independent Gaussian elimination of the absorbing chain (small targets).
function linearExpected(steps,start,reward){
 const n=steps.length,a=steps.map((s,k)=>{const row=Array(n+1).fill(0);row[k]=1;if(k+1<n)row[k+1]-=s.chance;row[s.failTo]-=1-s.chance;row[n]=reward(s);return row;});
 for(let k=0;k<n;k++){
  let pivot=k;for(let j=k+1;j<n;j++)if(Math.abs(a[j][k])>Math.abs(a[pivot][k]))pivot=j;
  [a[k],a[pivot]]=[a[pivot],a[k]];const v=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=v;
  for(let i=0;i<n;i++)if(i!==k){const factor=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=factor*a[k][j];}
 }
 return a[start][n];
}
const snapshot=()=>({version:2,capturedAt:Date.now(),player:{skills:{enhancing:game.levelXp(32)+3},house:{lectern:12},houseFurniture:{lectern:{cell:1,slot:0}},masteries:{enhance:3},equipment:{mount:game.encode(game.withRarity(328,2),5)},bank:{[game.encode(game.withRarity(328,2),5)]:1,80:3,64:100},pack:[{itemId:110,qty:1}],overflow:{81:1}}});

test('all original enhanceable equipment and tools appear once',()=>{
 const expected=[...new Set([...game.equipment,...game.tools].map(x=>x.itemId))].filter(id=>game.canEnhance(id));
 assert.deepEqual(enhanceableItems.map(x=>x.id),expected);
 for(const x of enhanceableItems)for(let tier=0;tier<5;tier++)assert.doesNotThrow(()=>validateEnhancement(config({itemId:x.id,tier})));
});
test('original chances, costs, XP and multipliers match independent vectors',()=>{
 let step=enhancementSteps(config({itemId:328,tier:2,level:32,target:6}))[5];near(step.chance,.7434);assert.equal(step.gold,144000);assert.equal(step.shards,18);assert.equal(step.xp,360);
 step=enhancementSteps(config({itemId:328,tier:4,level:32,lectern:7,mastery:11,target:20}))[19];near(step.chance,.2*1.062*1.07*1.0275);assert.equal(step.gold,3000000);assert.equal(step.shards,60);assert.equal(step.xp,10000);
 for(const [tier,multiplier]of [1,3,8,20,50].entries())assert.equal(enhancementSteps(config({itemId:328,tier,target:1}))[0].gold,3000*multiplier);
 const levels=[15,30,50,75,90],bases=[100,300,1000,3000,8000,20000];
 for(const item of enhanceableItems){const recipe=game.recipes.find(x=>x.output.itemId===item.id),upgrade=game.upgradeRecipes.find(r=>r.to.includes(item.id)),level=recipe?.levelReq??upgrade?.levelReq,base=level===undefined?3000:bases[levels.filter(x=>level>=x).length];assert.equal(enhancementSteps(config({itemId:item.id,target:1}))[0].gold,base);}
});
test('protection uses current +2 and only charges a scroll on failure',()=>{
 const steps=enhancementSteps(config({protect:true,target:4}));assert.equal(steps[1].protected,false);assert.equal(steps[2].protected,true);assert.equal(steps[2].failTo,1);assert.equal(steps[3].failTo,2);
 const r=calculateEnhancement(config({protect:true,target:4,lectern:50}));assert.equal(r.totals.scrolls,0);
});
test('positive recurrence matches independent chain solution, including rebuilding below start',()=>{
 for(const protect of [false,true])for(const protectFrom of [2,4,8])for(const start of [0,3,7]){
  const s=config({itemId:328,tier:2,level:32,current:start,target:8,protect,protectFrom}),r=calculateEnhancement(s);
  for(const [key,reward]of Object.entries({gold:x=>x.gold,shards:x=>x.shards,attempts:()=>1,scrolls:x=>x.protected?1-x.chance:0}))near(r.totals[key],linearExpected(r.steps,start,reward));
  near(r.totals.seconds,r.totals.attempts*2.4);
 }
 const r=calculateEnhancement(config({itemId:328,tier:2,level:32,current:5,target:6}));near(r.totals.gold,367901.05340684234);assert.ok(r.totals.gold>144000/.7434);
});
test('100% steps equal deterministic sums and +20 remains finite and positive',()=>{
 const r=calculateEnhancement(config({itemId:328,tier:2,current:5,target:10,lectern:50,level:game.maxLevel,mastery:200}));assert.equal(r.totals.gold,24000*(6+7+8+9+10));assert.equal(r.totals.shards,3*(6+7+8+9+10));assert.equal(r.totals.attempts,5);
 for(const protect of [false,true]){const result=calculateEnhancement(config({target:20,protect}));for(const value of Object.values(result.totals))assert.ok(Number.isFinite(value)&&value>=0);assert.ok(result.totals.attempts>20);}
});
test('zero target cost, blank prices and explicit zero pricing stay distinct',()=>{
 const zero=calculateEnhancement(config({current:5,target:5}));assert.deepEqual(zero.totals,{gold:0,shards:0,scrolls:0,attempts:0,seconds:0});assert.equal(zero.pricedGold,0);
 const blank=calculateEnhancement(config());assert.equal(blank.pricedGold,null);assert.equal(blank.purchaseTotal,null);
 const priced=calculateEnhancement(config({shardPrice:0,basePrice:120}));assert.equal(priced.pricedGold,priced.totals.gold);assert.equal(priced.purchaseTotal,priced.totals.gold+120);
 const protectedResult=calculateEnhancement(config({protect:true,shardPrice:10,scrollPrice:20,basePrice:0}));near(protectedResult.pricedGold,protectedResult.totals.gold+10*protectedResult.totals.shards+20*protectedResult.totals.scrolls);
});
test('invalid configuration fails explicitly',()=>{
 for(const patch of [{current:7,target:6},{level:null},{current:1.5},{target:101},{lectern:-1},{mastery:.5},{protectFrom:1},{protect:'true'},{shardPrice:NaN},{scrollPrice:-1},{itemId:64}])assert.throws(()=>calculateEnhancement(config(patch)));
});
test('profit margin covers enhancement and base costs, with explicit pricing required',()=>{
 const r=calculateEnhancement(config({target:3,protect:true,shardPrice:10,scrollPrice:20,basePrice:120}));
 // For +0 to +3: costs at +2 are divided by .88; protected failure
 // repeats +1 (chance .94), whose failure also repeats +0;
 // each failed +2 attempt spends one scroll.
 const goldStep1=(200+.06*100)/.94,shardStep1=(6+.06*3)/.94;
 const gold=100+goldStep1+(300+.12*goldStep1)/.88;
 const shards=3+shardStep1+(9+.12*shardStep1)/.88;
 const scrolls=.12/.88;
 near(r.expectedFee,(gold+shards*10+scrolls*20+120)/.97);
 assert.equal(calculateEnhancement(config({shardPrice:10})).expectedFee,null);
 assert.equal(calculateEnhancement(config({basePrice:0})).expectedFee,null);
 assert.equal(calculateEnhancement(config({protect:true,shardPrice:10,basePrice:0})).expectedFee,null);
 const free=calculateEnhancement(config({shardPrice:0,basePrice:0}));near(free.expectedFee,free.totals.gold/.97);
 near(calculateEnhancement(config({current:5,target:5,basePrice:120})).expectedFee,120/.97);
 assert.equal(calculateEnhancement(config({current:5,target:5,basePrice:0})).expectedFee,0);
});
test('import captures enhancement-only fields and deduplicates worn and inventory candidates',()=>{
 const s=config({shardPrice:3}),r=importEnhancement(s,snapshot());assert.equal(r.state.level,32);assert.equal(r.state.lectern,12);assert.equal(r.state.mastery,3);assert.equal(r.state.shardPrice,3);assert.equal(r.candidates.length,4);assert.deepEqual(r.candidates[0],{itemId:328,tier:2,current:5,id:game.encode(game.withRarity(328,2),5)});assert.deepEqual(s,config({shardPrice:3}));
 const unplaced=snapshot();unplaced.player.houseFurniture={};assert.equal(importEnhancement(s,unplaced).state.lectern,0);
 const empty=snapshot();empty.player.masteries={};empty.player.house={};empty.player.houseFurniture={};assert.equal(importEnhancement(s,empty).state.mastery,0);
});
test('import rejects missing or illegal data atomically and ignores ordinary inventory items',()=>{
 const state=config();for(const field of ['skills','house','houseFurniture','masteries','equipment','pack','bank','overflow']){const s=snapshot();delete s.player[field];assert.throws(()=>importEnhancement(state,s));assert.deepEqual(state,config());}
 for(const mutate of [s=>s.version=1,s=>s.player.skills.enhancing=NaN,s=>s.player.masteries.enhance=-1,s=>s.player.houseFurniture.lectern=null,s=>s.player.bank[110]=-1,s=>s.player.equipment.weapon=game.encode(110,101)]){const s=snapshot();mutate(s);assert.throws(()=>importEnhancement(state,s));}
 assert.equal(decodeEnhancementItem(64),null);
});

test('high target without protection matches an independent renewal calculation',()=>{
 for(const current of [0,5,18,19]){
  const r=calculateEnhancement(config({current,target:20}));
  const segment=start=>{let survival=1,attempts=0,gold=0;for(let k=start;k<20;k++){attempts+=survival;gold+=survival*r.steps[k].gold;survival*=r.steps[k].chance;}return {survival,attempts,gold};};
  const initial=segment(0),remaining=segment(current);
  for(const key of ['attempts','gold'])near(r.totals[key],remaining[key]+(1-remaining.survival)*initial[key]/initial.survival);
 }
});

test('enhancement imports and persists hidden guild identity without changing calculations',()=>{
 const old=config(),snap={...snapshot(),guild:{name:'Deep miners',tag:'DM',members:['private']}};
 const imported=importEnhancement(old,snap).state;
 assert.deepEqual(imported.guild,{name:'Deep miners',tag:'DM'});
 assert.deepEqual(validateEnhancement(JSON.parse(JSON.stringify(imported))).guild,imported.guild);
 assert.deepEqual(calculateEnhancement(imported),calculateEnhancement({...imported,guild:null}));
 assert.equal(importEnhancement(imported,snapshot()).state.guild,null);
 assert.equal(importEnhancement(imported,{...snapshot(),guild:null}).state.guild,null);
 assert.throws(()=>importEnhancement(imported,{...snapshot(),guild:{name:'Guild'}}),/invalidSnapshot/);
 assert.deepEqual(imported.guild,{name:'Deep miners',tag:'DM'});
});

test('all seven upgrade-only items use their native 95/99 crafting tier for costs and import',()=>{
 for(const id of [629,630,631,632,633,634,635]){
  for(const[tier,mult]of[1,3,8,20,50].entries()){
   const step=enhancementSteps(config({itemId:id,tier,target:4}))[3];
   assert.equal(step.gold,20000*mult*4);assert.equal(step.shards,12);
   assert.deepEqual(decodeEnhancementItem(game.encode(game.withRarity(id,tier),17)),{itemId:id,tier,current:17,id:game.encode(game.withRarity(id,tier),17)});
  }
 }
});

test('profit margin defaults for old saves, validates explicit inputs, and preserves raw costs',()=>{
 const old=config({shardPrice:10,scrollPrice:20,basePrice:120});delete old.profitRate;
 assert.equal(validateEnhancement(old).profitRate,3);
 const baseline=calculateEnhancement({...old,profitRate:0});
 assert.equal(baseline.expectedFee,baseline.purchaseTotal);
 for(const profitRate of [3,12.5,99.9]){
  const result=calculateEnhancement({...old,profitRate});
  near((result.expectedFee-result.purchaseTotal)/result.expectedFee,profitRate/100);
  assert.deepEqual(result.totals,baseline.totals);
 }
 for(const profitRate of [null,undefined,-1,100,101,Infinity,NaN,'3'])assert.throws(()=>validateEnhancement({...old,profitRate}),/invalidProfitRate/);
 assert.equal(validateEnhancement(JSON.parse(JSON.stringify({...old,profitRate:12.5}))).profitRate,12.5);
 assert.equal(importEnhancement({...old,profitRate:12.5},snapshot()).state.profitRate,12.5);
});

test('base price earns profit; missing base leaves enhancement cost intact',()=>{
 const s=config({shardPrice:10,scrollPrice:20,basePrice:100,profitRate:20});
 const result=calculateEnhancement(s),withoutBase=calculateEnhancement({...s,basePrice:0});
 near(result.expectedFee-withoutBase.expectedFee,125);
 near(result.expectedFee,(result.pricedGold+100)/.8);
 const missingBase=calculateEnhancement({...s,basePrice:null});
 assert.equal(missingBase.pricedGold,result.pricedGold);assert.equal(missingBase.expectedFee,null);
 assert.equal(calculateEnhancement({...s,current:5,target:5}).expectedFee,125);
});
