import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import {defaults,normalize} from '../src/model.js';
import {manualControls} from '../src/manual-controls.js';
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const names=['enemyColumns','visibleEnemyColumns','hourlyCells'];
const code=ast.body.filter(n=>names.includes(n.id?.name)||n.declarations?.some(d=>names.includes(d.id.name))).map(n=>source.slice(n.start,n.end)).join('\n');
function view(enabled,result,error=false){
 const c=vm.createContext({state:{manual:{vendorValues:enabled}},hourly:new Map(result?[['m',result]]:[]),simulationError:error,language:'zh',game:{tickMs:600},t:k=>k,formatRate:(n,metric='count')=>metric==='coins'?String(Math.round(n)):n.toFixed(1),formatAmount:String,esc:String,lootDetails:()=>'<span>item quantity</span>'});
 vm.runInContext(code,c);return c;
}
test('valuation preference defaults off, persists and renders bilingual controls',()=>{
 assert.equal(defaults().manual.vendorValues,false);
 assert.equal(normalize({manual:{}}).manual.vendorValues,false);
 const state=defaults();state.manual.vendorValues=true;
 assert.equal(normalize(JSON.parse(JSON.stringify(state))).manual.vendorValues,true);
 for(const language of ['zh','en']){
 const html=manualControls(state,{language,number:()=>'',options:()=>'',esc:String,name:String}).simulation;
 assert.match(html,/data-path="manual.vendorValues" checked/);
 assert.ok(html.includes(language==='zh'?'按商人价格计算掉落价值':'Value drops at vendor prices'));
 }
});
test('headers and pending and failed rows follow the visible column count',()=>{
 for(const enabled of [false,true]){
 const c=view(enabled);const columns=c.visibleEnemyColumns();
 assert.equal(columns.length,enabled?15:14);assert.equal(columns.at(-1)[0],'depot');
 assert.equal(columns.find(x=>x[0]==='normalHour')[1],enabled?'normalValue':'normal');
 assert.equal(columns.some(x=>x[0]==='totalIncomeHour'),enabled);
 assert.equal((c.hourlyCells({key:'m'}).match(/<td/g)||[]).length,enabled?7:6);
 assert.match(view(enabled,null,true).hourlyCells({key:'m'}),/!/);
 }
});
test('quantities and vendor values render separately with optional highlighted income',()=>{
 const result={kills:1,xp:2,coins:3,normal:4,rare:5,normalValue:40,rareValue:50,totalIncome:93,food:6,normalItems:{},rareItems:{},bySkill:{},elapsedTicks:1,movingTicks:0,restocks:0};
 for(const enabled of [false,true]){
 const html=view(enabled,result).hourlyCells({key:'m'});
 assert.match(html,new RegExp(`<summary>${enabled?'40':'4.0'}</summary>`));
 assert.match(html,new RegExp(`<summary>${enabled?'50':'5.0'}</summary>`));
 assert.equal(html.includes('<td class="column-highlight">93</td>'),enabled);
 assert.match(html,/item quantity/);assert.match(html,/^<td><details/);
 }
});
