import {createPriceSnapshot} from '../src/price-protocol.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {collectionDefaults,collectionRoutes,estimateCollection} from '../src/collection-model.js';
import {collectionPlanDefaults,validateCollectionPlan,addCollectionPlan,addCollectionPlans,removeCollectionPlan,setCollectionPlanTarget,calculateCollectionPlan as calculatePlanSnapshot} from '../src/collection-plan.js';
import {priceDefaults} from '../src/item-prices.js';
const calculateCollectionPlan=(state,plan,prices,options)=>calculatePlanSnapshot(state,plan,createPriceSnapshot(prices),options);
const state=()=>({...collectionDefaults(),buyMode:'ask',initialized:true,bank:{},pack:{}});
const pick=(itemId,target)=>({itemId,jobId:collectionRoutes(itemId)[0].id,target});
const priced=()=>{const prices=priceDefaults();for(const item of game.items)prices.quotes[item.id]={ask:{value:2,capturedAt:100},bid:{value:2,capturedAt:100}};return prices;};

test('milestones normalize to the highest per complete item and never double count rewards/materials',()=>{
 const s=state();s.counts[40]=9;
 const plan=validateCollectionPlan({version:1,selections:[pick(40,10),pick(40,100),pick(40,1000),pick(40,1000)]});
 assert.deepEqual(plan.selections,[pick(40,1000)]);
 const r=calculateCollectionPlan(s,plan,priced());assert.equal(r.points,14);assert.equal(r.cost,3964);assert.deepEqual(r.materials.map(m=>[m.itemId,m.quantity]),[[1,991],[2,991]]);
 s.buyMode='vendor';assert.equal(calculateCollectionPlan(s,plan,priced()).cost,991*(game.vendorPrice(1)+game.vendorPrice(2)));
 assert.deepEqual(addCollectionPlan(plan,pick(40,10)),plan);assert.deepEqual(addCollectionPlan(plan,pick(40,1000)),plan);
 const lower=addCollectionPlan(removeCollectionPlan(plan,40),pick(40,100));assert.equal(calculateCollectionPlan(s,lower,priced()).materials[0].quantity,91);
 assert.deepEqual(removeCollectionPlan(lower,40),collectionPlanDefaults());assert.equal(plan.selections[0].target,1000);
});
test('quality IDs remain independent and common materials sum across different recipes',()=>{
 const s=state();const plan=validateCollectionPlan({version:1,selections:[pick(40,10),pick(1040,100)]});
 const r=calculateCollectionPlan(s,plan,priced());assert.deepEqual(r.materials.map(m=>[m.itemId,m.quantity]),[[1,10],[2,10],[1001,100],[1002,100]]);
 for(const skill in s.config.levels)s.config.levels[skill]=game.maxLevel;
 const inputs=new Map();for(const job of game.recipes.filter(j=>!j.retired&&collectionRoutes(j.output.itemId).some(r=>r.id===j.id)))for(const input of game.recipeInputs(job,0)){const jobs=inputs.get(input.itemId)??[];jobs.push(job);inputs.set(input.itemId,jobs);}
 const [materialId,[first,second]]=[...inputs].find(([,jobs])=>jobs.length>1);assert.notEqual(first.output.itemId,second.output.itemId);
 const joined=addCollectionPlan(addCollectionPlan(collectionPlanDefaults(),pick(first.output.itemId,10)),pick(second.output.itemId,10));
 const expected=estimateCollection(s,first.output.itemId,first,undefined,10).materials[materialId]+estimateCollection(s,second.output.itemId,second,undefined,10).materials[materialId];
 const material=calculateCollectionPlan(s,joined,priced()).materials.find(m=>m.itemId===materialId);assert.equal(material.quantity,Math.ceil(expected));assert.equal('contributors' in material,false);
});
test('burn expectations round up after aggregation, progress changes recompute, completed goals remain with zero need',()=>{
 const s=state(),cooking=game.recipes.find(j=>j.skill==='cooking'&&j.burn&&!j.retired);s.config.levels.cooking=cooking.levelReq;
 const r=calculateCollectionPlan(s,addCollectionPlan(collectionPlanDefaults(),pick(cooking.output.itemId,1)),priced());assert.equal(r.materials[0].quantity,2);assert.equal(r.materials[0].purchase,2);assert.equal(r.materials[0].cost,4);assert.equal(r.cost,r.materials.reduce((sum,m)=>sum+m.cost,0));assert.ok(Math.abs(r.entries[0].materials[r.materials[0].itemId]-1/.7)<1e-12);
 const plan=addCollectionPlan(collectionPlanDefaults(),pick(40,1000));s.counts[40]=99;assert.equal(calculateCollectionPlan(s,plan,priced()).materials[0].quantity,901);
 s.counts[40]=1000;const done=calculateCollectionPlan(s,plan,priced());assert.equal(done.completedCount,1);assert.equal(done.cost,0);assert.equal(done.points,0);assert.deepEqual(done.materials,[]);assert.equal(plan.selections.length,1);
});
test('unavailable routes stay in the plan and cannot masquerade as a complete zero-cost plan',()=>{
 const s=state(),high=game.recipes.find(j=>j.skill==='smithing'&&j.levelReq>1&&!j.retired&&collectionRoutes(j.output.itemId).length);
 const plan=addCollectionPlan(addCollectionPlan(collectionPlanDefaults(),pick(high.output.itemId,1)),pick(40,10));
 const r=calculateCollectionPlan(s,plan,priced());assert.equal(r.blockedCount,1);assert.equal(r.cost,null);assert.equal(r.points,null);assert.ok(r.knownCost>0);assert.equal(r.entries.length,2);assert.equal(r.complete,false);
 s.initialized=false;assert.equal(calculateCollectionPlan(s,plan,priced()).blockedCount,2);
});
test('missing prices and amount overflow preserve quantities, and explicit zero stays valid',()=>{
 const s=state(),plan=addCollectionPlan(collectionPlanDefaults(),pick(40,100));
 const prices=priceDefaults(),missing=calculateCollectionPlan(s,plan,prices);assert.equal(missing.cost,null);assert.equal(missing.materials[0].quantity,100);assert.equal(missing.missingPrices,2);
 prices.quotes[1]={ask:{value:0,capturedAt:100}};prices.quotes[2]={ask:{value:0,capturedAt:100}};assert.equal(calculateCollectionPlan(s,plan,prices).cost,0);
 prices.quotes[1].ask.value=Number.MAX_SAFE_INTEGER;const overflow=calculateCollectionPlan(s,plan,prices);assert.equal(overflow.cost,null);assert.equal(overflow.amountOverflow,true);assert.equal(overflow.materials[0].quantity,100);
});
test('bad selections fail explicitly and never mutate the existing plan',()=>{
 const plan=addCollectionPlan(collectionPlanDefaults(),pick(40,10)),before=structuredClone(plan);
 for(const entry of [{...pick(40,10),target:11},{...pick(40,10),itemId:1040,jobId:-1},{...pick(40,10),itemId:'40'}])assert.throws(()=>addCollectionPlan(plan,entry),/invalidPlan/);
 assert.throws(()=>validateCollectionPlan({version:2,selections:[]}),/invalidPlan/);assert.deepEqual(plan,before);
 assert.deepEqual(validateCollectionPlan(JSON.parse(JSON.stringify(plan))),plan);
});

test('explicit target adjustments raise or lower one route atomically and reject invalid choices',()=>{
 const s=state();s.counts[40]=9;const initial=addCollectionPlan(collectionPlanDefaults(),pick(40,1000));
 const lower=setCollectionPlanTarget(initial,40,100);assert.equal(calculateCollectionPlan(s,lower,priced()).materials[0].quantity,91);assert.equal(initial.selections[0].target,1000);
 const higher=setCollectionPlanTarget(lower,40,1000);assert.deepEqual(higher,initial);
 assert.equal(calculateCollectionPlan(s,setCollectionPlanTarget(lower,40,1),priced()).completedCount,1);
 for(const [itemId,target]of [[40,11],[1040,100],[40,'100']])assert.throws(()=>setCollectionPlanTarget(initial,itemId,target),/invalidPlan/);
 assert.equal(initial.selections[0].target,1000);
});

test('bulk add preserves existing selections, merges highest milestones and rejects invalid input atomically',()=>{
 const plan=addCollectionPlan(collectionPlanDefaults(),pick(40,1000)),before=structuredClone(plan);
 const values=[pick(40,10),pick(1040,10),pick(1040,100),pick(1040,10)];
 const added=addCollectionPlans(plan,values);
 assert.deepEqual(added.selections,[pick(40,1000),pick(1040,100)]);
 assert.deepEqual(addCollectionPlans(added,values),added);
 assert.throws(()=>addCollectionPlans(plan,[pick(1040,100),pick(40,11)]),/invalidPlan/);
 assert.deepEqual(plan,before);
});

test('warehouse stock is deducted once after aggregation; qualities stay independent and full stock needs no quote',()=>{
 const s=state();s.bank={1:6,2:15,1001:2};
 const plan=addCollectionPlans(collectionPlanDefaults(),[pick(40,10),pick(1040,10)]);
 const result=calculateCollectionPlan(s,plan,priced());
 assert.deepEqual(result.materials.map(m=>[m.itemId,m.quantity,m.inventory,m.purchase,m.cost]),[[1,10,6,4,8],[2,10,15,0,0],[1001,10,2,8,16],[1002,10,0,10,20]]);
 assert.equal(result.cost,44);assert.equal(result.knownCost,44);
 const noPrices=priceDefaults();s.bank={1:10,2:100};
 const covered=calculateCollectionPlan(s,addCollectionPlan(collectionPlanDefaults(),pick(40,10)),noPrices);
 assert.equal(covered.cost,0);assert.equal(covered.missingPrices,0);assert.equal(covered.complete,true);
 s.bank[1]=9;const short=calculateCollectionPlan(s,addCollectionPlan(collectionPlanDefaults(),pick(40,10)),noPrices);
 assert.equal(short.materials[0].purchase,1);assert.equal(short.cost,null);assert.equal(short.missingPrices,1);
});
test('shared recipe inputs consume the warehouse only once and rounded burn needs determine cost',()=>{
 const s=state();for(const skill in s.config.levels)s.config.levels[skill]=game.maxLevel;
 const inputs=new Map();for(const job of game.recipes.filter(j=>!j.retired&&collectionRoutes(j.output.itemId).some(r=>r.id===j.id)))for(const input of game.recipeInputs(job,0)){const jobs=inputs.get(input.itemId)??[];jobs.push(job);inputs.set(input.itemId,jobs);}
 const [id,[first,second]]=[...inputs].find(([,jobs])=>new Set(jobs.map(j=>j.output.itemId)).size>1);
 const plan=addCollectionPlans(collectionPlanDefaults(),[pick(first.output.itemId,10),pick(second.output.itemId,10)]);
 const expected=estimateCollection(s,first.output.itemId,first,undefined,10).materials[id]+estimateCollection(s,second.output.itemId,second,undefined,10).materials[id];
 s.bank[id]=1;const m=calculateCollectionPlan(s,plan,priced()).materials.find(m=>m.itemId===id);
 assert.equal(m.purchase,Math.ceil(expected)-1);assert.equal(m.cost,(Math.ceil(expected)-1)*2);
 const cooking=game.recipes.find(j=>j.skill==='cooking'&&j.burn&&!j.retired);s.config.levels.cooking=cooking.levelReq;
 const burnPlan=addCollectionPlan(collectionPlanDefaults(),pick(cooking.output.itemId,1));s.bank={};
 const before=calculateCollectionPlan(s,burnPlan,priced()).materials[0];s.bank[before.itemId]=1;
 const after=calculateCollectionPlan(s,burnPlan,priced()).materials[0];assert.equal(after.purchase,before.quantity-1);assert.equal(after.cost,(before.quantity-1)*2);assert.equal(after.purchase,1);assert.equal(after.cost,2);
 s.bank[before.itemId]=2;const covered=calculateCollectionPlan(s,burnPlan,priceDefaults());assert.equal(covered.materials[0].purchase,0);assert.equal(covered.materials[0].cost,0);
});
test('unknown warehouse preserves gross needs and target rewards but never assumes zero inventory',()=>{
 const s=state();s.bank=null;const plan=addCollectionPlan(collectionPlanDefaults(),pick(40,10));
 const r=calculateCollectionPlan(s,plan,priced());assert.equal(r.missingInventory,true);assert.equal(r.complete,false);assert.equal(r.cost,null);assert.equal(r.points,2);
 assert.equal(r.materials[0].quantity,10);assert.equal(r.materials[0].inventory,null);assert.equal(r.materials[0].purchase,null);assert.equal(r.materials[0].cost,null);
 s.counts[40]=10;assert.equal(calculateCollectionPlan(s,plan,priced()).cost,0);
});

test('plan uses progress difference and combines bank with backpack once per material',()=>{
 const s=state();s.counts={40:9};s.bank={1:3};s.pack={1:4,2:10};
 const plan=addCollectionPlan(collectionPlanDefaults(),pick(40,100));
 const r=calculateCollectionPlan(s,plan,priced());assert.equal(r.entries[0].remaining,91);
 assert.deepEqual(r.materials.map(m=>[m.itemId,m.inventory,m.purchase]),[[1,7,84],[2,10,81]]);
 s.counts[40]=101;assert.equal(calculateCollectionPlan(s,plan,priced()).entries[0].remaining,0);
 s.initialized=false;assert.equal(calculateCollectionPlan(s,plan,priced()).entries[0].remaining,null);
 s.initialized=true;s.counts={};s.pack=null;assert.equal(calculateCollectionPlan(s,plan,priced()).missingInventory,true);
});
