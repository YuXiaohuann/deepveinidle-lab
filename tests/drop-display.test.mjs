import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import {defaults,normalize} from '../src/model.js';
import {importCharacter} from '../src/character-import.js';
import {manualControls} from '../src/manual-controls.js';
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const names=['enemyColumns','visibleEnemyColumns','depotCell','hourlyCells'];
const code=ast.body.filter(n=>names.includes(n.id?.name)||n.declarations?.some(d=>names.includes(d.id.name))).map(n=>source.slice(n.start,n.end)).join('\n');
function view(enabled,result,error=false){
 const c=vm.createContext({state:{manual:{vendorValues:enabled}},hourly:new Map(result?[['m',result]]:[]),simulationError:error,valuedResult:r=>r,language:'zh',game:{tickMs:600},t:k=>k,formatRate:(n,metric='count')=>metric==='coins'?String(Math.round(n)):n.toFixed(1),formatAmount:String,esc:String,lootDetails:()=>'<span>item quantity</span>'});
 vm.runInContext(code,c);return c;
}
test('valuation preference defaults off, persists and renders bilingual controls',()=>{
 assert.equal(defaults().manual.vendorValues,false);
 assert.equal(normalize({manual:{}}).manual.vendorValues,false);
 const state=defaults();state.manual.vendorValues=true;state.manual.valuationMode='vendor';state.guild={name:"SakuraSpring",tag:"SAKI"};
 assert.equal(normalize(JSON.parse(JSON.stringify(state))).manual.vendorValues,true);
 for(const language of ['zh','en']){
 const controls=manualControls(state,{language,number:()=>'',options:()=>'',esc:String,name:String});
 const html=controls.simulation;
 assert.match(html,/id="simulation-settings"/);
 assert.doesNotMatch(Object.values(controls).join(''),/sakura-settings|Play with Sakura|一起蛐蛐撒库拉/);
 assert.doesNotMatch(html,/<details[^>]* open/);
 assert.match(html,/data-path="manual.valuationMode"/);
 assert.ok(html.includes(language==='zh'?'掉落估值':'Drop valuation'));
 }
});
test('headers and pending and failed rows follow the visible column count',()=>{
 for(const enabled of [false,true]){
 const c=view(enabled);const columns=c.visibleEnemyColumns();
 assert.equal(columns.length,enabled?10:9);assert.equal(columns.at(-1)[0],'foodHour');
 assert.equal(columns.find(x=>x[0]==='normalHour')[1],enabled?'normalValue':'normal');
 assert.equal(columns.some(x=>x[0]==='totalIncomeHour'),enabled);
 assert.equal((c.hourlyCells({key:'m'}).match(/<td/g)||[]).length,enabled?8:7);
 assert.match(c.hourlyCells({key:'m'}),/<summary>…<\/summary><div>depot: …<\/div>/);
 assert.match(view(enabled,null,true).hourlyCells({key:'m'}),/<summary>!<\/summary><div>depot: !<\/div>/);
 }
});
test('quantities and vendor values render separately with optional highlighted income',()=>{
 const result={homeBank:2,kills:1,xp:2,coins:3,normal:4,rare:5,normalValue:40,rareValue:50,totalIncome:93,food:6,normalItems:{},rareItems:{},bySkill:{},elapsedTicks:1,movingTicks:0,restocks:0};
 for(const enabled of [false,true]){
 const html=view(enabled,result).hourlyCells({key:'m'});
 assert.match(html,new RegExp(`<summary>${enabled?'40':'4.0'}</summary>`));
 assert.match(html,new RegExp(`<summary>${enabled?'50':'5.0'}</summary>`));
 assert.equal(html.includes('<td class="column-highlight">93</td>'),enabled);
 assert.match(html,/item quantity/);assert.match(html,/^<td>1.0<\/td><td><details/);assert.match(html,/<summary>0%<\/summary>/);assert.match(html,/depot: 仓库 2/);
 }
});

test('valuation control is public regardless of guild and is preserved on configuration import',()=>{
 const state=defaults();state.manual.vendorValues=true;state.manual.valuationMode='vendor';
 const render=state=>manualControls(state,{language:'zh',number:()=>'',options:()=>'',esc:String,name:String});
 for(const guild of [null,undefined,{name:'Other',tag:'SAKI'},{name:'SakuraSpring',tag:'OTHER'},{name:'sakuraspring',tag:'SAKI'},{name:'SakuraSpring',tag:'SAKI'}]){
  state.guild=guild;assert.match(render(state).simulation,/data-path="manual.valuationMode"/);assert.doesNotMatch(Object.values(render(state)).join(''),/sakura-settings/);
 }
 const snapshot={version:2,capturedAt:Date.now(),player:{lastTick:100},guild:{name:'SakuraSpring',tag:'SAKI'}};
 const imported=importCharacter(state,snapshot).state;
 assert.match(render(imported).simulation,/manual.valuationMode/);assert.equal(imported.manual.vendorValues,true);
 const left=importCharacter(imported,{...snapshot,guild:null}).state;
 assert.match(render(left).simulation,/manual.valuationMode/);assert.equal(left.manual.vendorValues,true);
 assert.equal(normalize(JSON.parse(JSON.stringify(left))).manual.vendorValues,true);
});
