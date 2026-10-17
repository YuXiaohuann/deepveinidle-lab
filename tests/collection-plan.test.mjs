import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/upstream.js';
import {collectionDefaults,collectionRoutes,estimateCollection} from '../src/collection-model.js';
import {collectionPlanDefaults,validateCollectionPlan,addCollectionPlan,addCollectionPlans,removeCollectionPlan,setCollectionPlanTarget,calculateCollectionPlan} from '../src/collection-plan.js';
import {priceDefaults} from '../src/item-prices.js';
const state=()=>({...collectionDefaults(),initialized:true});
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
 const material=calculateCollectionPlan(s,joined,priced()).materials.find(m=>m.itemId===materialId);assert.equal(material.quantity,expected);assert.equal('contributors' in material,false);
});
test('burn expectations are kept fractional, progress changes recompute, completed goals remain with zero need',()=>{
 const s=state(),cooking=game.recipes.find(j=>j.skill==='cooking'&&j.burn&&!j.retired);s.config.levels.cooking=cooking.levelReq;
 const r=calculateCollectionPlan(s,addCollectionPlan(collectionPlanDefaults(),pick(cooking.output.itemId,1)),priced());assert.ok(Math.abs(r.materials[0].quantity-1/.7)<1e-12);
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
