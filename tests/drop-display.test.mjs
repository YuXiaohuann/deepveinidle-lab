import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import {defaults,normalize} from '../src/model.js';
import {importCharacter} from '../src/character-import.js';
import {manualControls} from '../src/manual-controls.js';
import {rewardAmount} from '../src/combat-hot.js';
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const names=['enemyColumns','visibleEnemyColumns','depotCell','priceWarning','hourlyCells'];
const code=ast.body.filter(n=>names.includes(n.id?.name)||n.declarations?.some(d=>names.includes(d.id.name))).map(n=>source.slice(n.start,n.end)).join('\n');
const quantityNames=['formatAmount','formatRate','formatDropQuantity','lootDetails'];
const quantityCode=ast.body.filter(n=>quantityNames.includes(n.id?.name)||n.declarations?.some(d=>quantityNames.includes(d.id.name))).map(n=>source.slice(n.start,n.end)).join('\n');
test('drop quantities use adaptive precision after period conversion without changing consumables',()=>{
 for(const language of ['zh','en'])for(const period of ['hour','day','total']){
  const c=vm.createContext({language,period,state:{manual:{simulationHours:48}},rewardAmount,game:{itemTier:()=>0,baseItemId:id=>id,item:()=>({name:'Item'})},valuationPrice:()=>({price:1,fallback:false}),priceState:()=>({prices:{}}),esc:String,name:String});
  vm.runInContext(quantityCode,c);
  const factor=rewardAmount(1,period,48);
  for(const [value,expected] of [[0,'0'],[0.000001,'1/1,000,000'],[0.03,'1/33'],[0.026,'1/38'],[0.027,'1/37'],[0.099,'1/10'],[0.1,'0.10'],[0.1234,'0.12'],[1,'1.00'],[9.994,'9.99'],[10,'10'],[10.6,'11']]){
   const quantity=value/factor;
   assert.equal(vm.runInContext(`formatDropQuantity(${quantity})`,c),expected,`${language}/${period}/${value}`);
   assert.ok(c.lootDetails({1:quantity},true).includes(`<span>${expected}</span>`));
  }
  assert.ok(c.lootDetails({1:0.03/factor}).includes('<span>0.0</span>'));
  assert.equal(c.lootDetails({},true),'');
 }
 assert.ok(source.includes("lootDetails(r.normalItems,true)||'0'"));
 assert.ok(source.includes("lootDetails(r.rareItems,true)||'0'"));
 assert.ok(source.includes('lootDetails(r.foodItems??{})'));
 assert.ok(source.includes('lootDetails(r.potionItems??{})'));
});
function view(enabled,result,error=false){
 const c=vm.createContext({state:{manual:{vendorValues:enabled}},hourly:new Map(result?[['m',result]]:[]),simulationError:error,valuedResult:r=>r,language:'zh',game:{tickMs:600},t:k=>k,formatRate:(n,metric='count')=>metric==='coins'?String(Math.round(n)):n.toFixed(1),formatAmount:String,esc:String,lootDetails:()=>'<span>item quantity</span>'});
 vm.runInContext(code,c);return c;
}
test('valuation preference defaults off, persists and renders bilingual controls',()=>{
 assert.equal(defaults().manual.vendorValues,true);
 assert.equal(normalize({manual:{}}).manual.vendorValues,true);
 const state=defaults();state.manual.vendorValues=true;state.manual.valuationMode='vendor';state.guild={name:"SakuraSpring",tag:"SAKI"};
 assert.equal(normalize(JSON.parse(JSON.stringify(state))).manual.vendorValues,true);
 for(const language of ['zh','en']){
 const controls=manualControls(state,{language,number:()=>'',options:()=>'',esc:String,name:String});
 const html=controls.simulation;
 assert.match(html,/id="simulation-settings"/);
 assert.doesNotMatch(Object.values(controls).join(''),/sakura-settings|Play with Sakura|一起蛐蛐撒库拉/);
 assert.doesNotMatch(html,/<details[^>]* open/);
 assert.doesNotMatch(html,/data-path="manual.valuationMode"/);
 assert.ok(!html.includes(language==='zh'?'掉落估值':'Drop valuation'));
 }
});
test('headers and pending and failed rows follow the visible column count',()=>{
 for(const enabled of [false,true]){
 const c=view(enabled);const columns=c.visibleEnemyColumns();
 assert.equal(columns.length,11);assert.equal(columns.at(-1)[0],'profitHour');
 assert.equal(columns.find(x=>x[0]==='normalHour')[1],'normalValue');
 assert.equal(columns.some(x=>x[0]==='totalIncomeHour'),true);
 assert.equal((c.hourlyCells({key:'m'}).match(/<td/g)||[]).length,9);
 assert.match(c.hourlyCells({key:'m'}),/<summary>…<\/summary><div>depot: …<\/div>/);
 assert.match(view(enabled,null,true).hourlyCells({key:'m'}),/<summary>!<\/summary><div>depot: !<\/div>/);
 }
});
test('quantities and vendor values render separately with optional highlighted income',()=>{
 const result={homeBank:2,kills:1,attacks:7,xp:2,coins:3,normal:4,rare:5,normalValue:40,rareValue:50,totalIncome:93,profit:80,foodCost:10,potionCost:3,consumableCost:13,food:6,normalItems:{},rareItems:{},bySkill:{},elapsedTicks:1,movingTicks:0,restocks:0};
 for(const enabled of [false,true]){
 const html=view(enabled,result).hourlyCells({key:'m'});
 assert.match(html,new RegExp(`<summary>${'40'}</summary>`));
 assert.match(html,new RegExp(`<summary>${'50'}</summary>`));
 assert.equal(html.includes('<td class="column-highlight">93</td>'),true);
 assert.match(html,/item quantity/);assert.match(html,/^<td><details[^>]*><summary>1.0<\/summary><div>攻击次数：7.0/);assert.match(html,/<summary>0%<\/summary>/);assert.match(html,/depot: 仓库 2/);
 const seeded=view(enabled,{...result,seed:4294967295});assert.match(seeded.hourlyCells({key:'m'}),/随机种子：4294967295/);
 seeded.language='en';assert.match(seeded.hourlyCells({key:'m'}),/Random seed: 4294967295/);
 assert.match(seeded.hourlyCells({key:'m'}),/Attack attempts: 7.0/);
 }
});

test('valuation control is public regardless of guild and is preserved on configuration import',()=>{
 const state=defaults();state.manual.vendorValues=true;state.manual.valuationMode='vendor';
 const render=state=>manualControls(state,{language:'zh',number:()=>'',options:()=>'',esc:String,name:String});
 for(const guild of [null,undefined,{name:'Other',tag:'SAKI'},{name:'SakuraSpring',tag:'OTHER'},{name:'sakuraspring',tag:'SAKI'},{name:'SakuraSpring',tag:'SAKI'}]){
  state.guild=guild;assert.doesNotMatch(render(state).simulation,/data-path="manual.valuationMode"/);assert.doesNotMatch(Object.values(render(state)).join(''),/sakura-settings/);
 }
 const snapshot={version:2,capturedAt:Date.now(),player:{lastTick:100},guild:{name:'SakuraSpring',tag:'SAKI'}};
 const imported=importCharacter(state,snapshot).state;
 assert.doesNotMatch(render(imported).simulation,/manual.valuationMode/);assert.equal(imported.manual.vendorValues,true);
 const left=importCharacter(imported,{...snapshot,guild:null}).state;
 assert.doesNotMatch(render(left).simulation,/manual.valuationMode/);assert.equal(left.manual.vendorValues,true);
 assert.equal(normalize(JSON.parse(JSON.stringify(left))).manual.vendorValues,true);
});

test('table amounts show fallback warnings before expanding and food displays its cost',()=>{
 const result={homeBank:2,kills:1,attacks:7,xp:2,coins:3,normalValue:40,rareValue:50,totalIncome:93,profit:20,food:6,foodCost:70,potionCost:3,consumableCost:73,consumableMissingPrices:[64],normalItems:{},rareItems:{},bySkill:{},elapsedTicks:1,movingTicks:0,restocks:0,normalMissingPrices:[1],rareMissingPrices:[],missingPrices:[1],foodMissingPrices:[64],profitMissingPrices:[1,64]};
 const html=view(true,result).hourlyCells({key:'m'});
 assert.match(html,/<summary><span[^>]*>⚠<\/span> 40<\/summary>/);
 assert.match(html,/<summary><span[^>]*>⚠<\/span> 73<\/summary>/);
 assert.match(html,/<td class="column-highlight"><span[^>]*>⚠<\/span> 93<\/td>/);
 assert.match(html,/<td class="column-highlight"><span[^>]*>⚠<\/span> 20<\/td>/);
 assert.match(html,/食物成本：/);assert.match(html,/药剂成本：/);
 assert.doesNotMatch(html,/<summary><span[^>]*>⚠<\/span> 50<\/summary>/);
});

test('attack details scale with kills in both languages and all reward periods',()=>{
 const result={homeBank:2,kills:48,attacks:240,xp:0,coins:0,normalValue:0,rareValue:0,totalIncome:0,profit:0,foodCost:0,potionCost:0,consumableCost:0,normalItems:{},rareItems:{},bySkill:{},elapsedTicks:1,movingTicks:0,restocks:0};
 const formatter=ast.body.find(n=>n.declarations?.some(d=>d.id.name==='formatRate'));
 for(const language of ['zh','en'])for(const period of ['hour','day','total']){
  const c=view(true,result);c.language=language;c.period=period;c.state.manual.simulationHours=48;c.rewardAmount=rewardAmount;
  vm.runInContext(source.slice(formatter.start,formatter.end),c);
  const attacks=rewardAmount(240,period,48).toFixed(1),kills=rewardAmount(48,period,48).toFixed(1);
  const html=c.hourlyCells({key:'m'});
  assert.ok(html.includes(`<summary>${kills}</summary><div>${language==='zh'?'攻击次数：':'Attack attempts: '}${attacks}</div>`));
 }
});
