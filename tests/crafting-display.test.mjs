import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as game from '../src/upstream.js';
import * as model from '../src/crafting-model.js';
import {valuationPrice} from '../src/item-prices.js';
const source=fs.readFileSync(new URL('../src/crafting-controls.js',import.meta.url),'utf8');
function page(language='zh'){
 const context=vm.createContext({...model,game,valuationPrice,localStorage:{getItem(){return null;}},translatedName:n=>n,translatedItemName:id=>String(id),priceState:()=>({prices:{}}),subscribePrices(){}});
 vm.runInContext(source.replaceAll('import.meta.url',"'http://localhost/'").replace(/^import .*;\n/gm,'').replace('export function renderCrafting','function renderCrafting'),context);
 vm.runInContext(`language=${JSON.stringify(language)};state.levels.cooking=100;[1,2,3,4].forEach(t=>selectedTiers.add(t));`,context);return context;
}
test('all five rarities appear independently, with unit columns first and plan input last',()=>{
 for(const lang of ['zh','en']){
  const p=page(lang),rows=vm.runInContext('visibleJobs()',p);assert.equal(rows.length,40);
  assert.deepEqual(Array.from(rows.slice(0,5),r=>r.tier),[0,1,2,3,4]);
  const headers=vm.runInContext('headers()',p);assert.equal((headers.match(/<th /g)||[]).length,9);
  const row=vm.runInContext('recipeRow(visibleJobs()[0])',p);assert.equal((row.match(/<td[ >]/g)||[]).length,9);
  assert.doesNotMatch(row,/<select|data-craft-tier/);assert.match(row,/<td><input[^>]+data-craft-count="61:0"[^>]+value="0"[^>]*><\/td><\/tr>$/);
  assert.ok(headers.indexOf(lang==='zh'?'单次材料成本':'Material cost / craft')<headers.indexOf(lang==='zh'?'制造次数/小时':'Crafts/hour'));
  vm.runInContext("state.plans={'61:2':7};filledOnly=true",p);assert.equal(vm.runInContext('visibleJobs()[0].tier',p),2);assert.equal(vm.runInContext('visibleJobs().length',p),1);
 }
});
test('hour/day toggles scale only cached rate columns and retain per-craft values',()=>{
 const p=page();vm.runInContext(`const plan=visibleJobs()[0];rateCache.set(plan.key,{signature:signature({...plan,count:0}),result:{completed:240,xp:480,items:{40:240},consumed:{20:240}}});`,p);
 const hour=vm.runInContext('recipeRow(visibleJobs()[0])',p);
 vm.runInContext("state.period='day'",p);const day=vm.runInContext('recipeRow(visibleJobs()[0])',p);
 const cells=s=>s.match(/<td[^>]*>.*?<\/td>/g);
 assert.deepEqual(cells(hour).slice(0,5),cells(day).slice(0,5));
 assert.equal(cells(hour)[5],'<td>10</td>');assert.equal(cells(day)[5],'<td>240</td>');
 assert.match(cells(hour)[6],/>20</);assert.match(cells(day)[6],/>480</);
 vm.runInContext("state.plans={'61:0':90}",p);assert.equal(vm.runInContext('!!rateFor(visibleJobs()[0])',p),true);
 assert.match(vm.runInContext('headers()',p),/制造次数\/天/);
});


test('rarity filter defaults to normal, combines with search and retains plans and totals',()=>{
 const p=page();vm.runInContext("selectedTiers.clear();selectedTiers.add(0);state.plans={'61:0':2,'61:2':7};query='Cook Shrimp'",p);
 // Use the actual upstream recipe name to avoid translation assumptions.
 vm.runInContext("query=craftingJobs.find(j=>j.id===61).name",p);
 assert.equal(vm.runInContext('visibleJobs().length',p),1);
 assert.equal(vm.runInContext('visibleJobs()[0].tier',p),0);
 const before=vm.runInContext('JSON.stringify(materialRequirements(state))',p);
 vm.runInContext('selectedTiers.add(2)',p);
 assert.deepEqual(Array.from(vm.runInContext('visibleJobs().map(p=>p.tier)',p)),[0,2]);
 assert.equal(vm.runInContext('JSON.stringify(materialRequirements(state))',p),before);
 const html=vm.runInContext('rarityFilters()',p);assert.equal((html.match(/aria-pressed="true"/g)||[]).length,2);
 vm.runInContext('selectedTiers.clear()',p);
 assert.equal(vm.runInContext('visibleJobs().length',p),0);
 assert.equal(vm.runInContext("state.plans['61:2']",p),7);
 assert.match(source,/const selectedTiers=new Set\(\[0\]\)/);
});


test('calculation status keeps its layout slot when idle, running and failed',()=>{
 const p=page();assert.match(vm.runInContext('craftingProgress()',p),/craft-progress is-idle/);
 vm.runInContext('running=true;progress={completed:1,total:5}',p);
 const running=vm.runInContext('craftingProgress()',p);assert.match(running,/1\/5/);assert.doesNotMatch(running,/is-idle|hidden/);
 vm.runInContext("running=false;workerError='workerFailed'",p);
 assert.doesNotMatch(vm.runInContext('craftingProgress()',p),/is-idle/);
 assert.match(source,/craft-recipe-heading.*craftingProgress\(\)/);
 assert.doesNotMatch(source,/<p class="table-note gather-progress"/);
});


test('recipe cost and value details show prices without editable fields',()=>{
 const p=page(),row=vm.runInContext('recipeRow(visibleJobs()[0])',p);
 assert.doesNotMatch(row,/data-craft-price|craft-price-input/);
 assert.equal((row.match(/<input /g)||[]).length,1);
 assert.match(row,/-cost/);assert.match(row,/-value/);
});


test('toolbar orders group, search, rarity, filled button and period, with no batch UI',()=>{
 const toolbar=source.slice(source.indexOf('<div class="toolbar craft-toolbar">'),source.indexOf('<p id="craft-notice"'));
 const controls=['id="craft-group"','id="craft-search"','${rarityFilters()}','id="craft-filled"','id="craft-period"'];
 for(let i=1;i<controls.length;i++)assert.ok(toolbar.indexOf(controls[i-1])<toolbar.indexOf(controls[i]));
 assert.match(toolbar,/<button id="craft-filled"[^>]+aria-pressed/);
 assert.doesNotMatch(source,/craft-batch|applyCraftingBatch|data-craft-tier/);
});
