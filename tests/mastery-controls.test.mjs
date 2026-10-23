import test from 'node:test';
import assert from 'node:assert/strict';
import {masteryStorageKey,masteryDefaults} from '../src/mastery.js';

test('mastery controls import and apply plans atomically, preserving valid settings on failure',async()=>{
 const original={document:globalThis.document,localStorage:Object.getOwnPropertyDescriptor(globalThis,'localStorage'),CustomEvent:globalThis.CustomEvent};
 const elements=new Map(),storage=new Map([['dvi-simulator-v1','combat sentinel']]);let failStorage=false;
 const initial=masteryDefaults();initial.mode='unlimited';initial.budget=500;initial.target.xp=8;storage.set(masteryStorageKey,JSON.stringify(initial));
 class Element{innerHTML='';textContent='';open=false;disabled=false;value='';hidden=false;dataset={};children=new Map();querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Element());return this.children.get(selector);}querySelectorAll(selector){return selector==='details[id]'?[this.querySelector('#mastery-import-settings')]:[];}}
 class Document extends EventTarget{getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);}}
 const document=new Document();globalThis.document=document;globalThis.CustomEvent=class extends Event{constructor(type,args){super(type);this.detail=args.detail;}};
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(failStorage)throw Error('quota');storage.set(key,value);}};
 let snapshot={version:2,capturedAt:Date.now(),player:{masteries:{xp:7,enhance:3,offline:2},collections:{64:1},forgeLog:{29:1073741823},bank:{64:99}}};let reads=0;
 document.addEventListener('dvi-character-request',event=>{const request=JSON.parse(event.detail);if(request.action==='read')reads++;document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',id:request.id,version:'2.4',snapshot})}));});
 try{
  const {renderMastery,applyMasteryRecommendation}=await import('../src/mastery-controls.js');renderMastery('zh');const {setCharacterImportPage}=await import('../src/import-controls.js');setCharacterImportPage('mastery');const host=document.getElementById('mastery-content'),get=selector=>host.querySelector(selector);
  get('#mastery-import-settings').id='mastery-import-settings';get('#mastery-import-settings').open=true;
  assert.match(host.innerHTML,/<aside class="panel config mastery-settings">/);assert.match(host.innerHTML,/class="config-detail character-import"/);assert.match(host.innerHTML,/导入配置/);
  assert.match(host.innerHTML,/class="mastery-rank-controls"><input[^>]+data-mastery-field="target"[^>]*><button data-mastery-action="plus"[^>]*>\+1<\/button><button data-mastery-action="minus"[^>]*>−1<\/button><button data-mastery-action="max"[^>]*>MAX<\/button>/);
  await get('#mastery-import').onclick();assert.equal(reads,1);const saved=JSON.parse(storage.get(masteryStorageKey));assert.equal(saved.current.xp,7);assert.equal(saved.current.enhance,3);assert.equal(saved.current.offline,2);assert.equal(saved.current.rare,0);assert.deepEqual(saved.current,saved.target);assert.equal(saved.mode,'limited');assert.match(host.innerHTML,/id="mastery-total" type="number"[^>]+value="5337"/);assert.match(host.innerHTML,/<option value="limited" selected>/);assert.equal(saved.totalPoints,5337);assert.equal(saved.budget,undefined);assert.match(get('#mastery-summary').innerHTML,/>4,807<\/strong>/);assert.equal(saved.bank,undefined);assert.equal(saved.capturedAt,undefined);assert.equal(storage.get('dvi-simulator-v1'),'combat sentinel');assert.match(get('#mastery-import-status').textContent,/已导入/);assert.equal(get('#mastery-import-settings').open,true);
  const previous=storage.get(masteryStorageKey);snapshot.player.masteries.xp=-1;await get('#mastery-import').onclick();assert.equal(storage.get(masteryStorageKey),previous);assert.match(get('#mastery-import-status').textContent,/已有配置保留/);
  snapshot=null;await get('#mastery-import').onclick();assert.match(get('#mastery-import-status').textContent,/没有角色数据/);renderMastery('en');assert.match(get('#mastery-import-status').textContent,/No character data/);assert.equal(get('#mastery-import-settings').open,true);
  snapshot={version:2,capturedAt:Date.now(),player:{masteries:{xp:9},collections:{},forgeLog:{29:1073741823}}};failStorage=true;await get('#mastery-import').onclick();assert.equal(storage.get(masteryStorageKey),previous);assert.match(get('#mastery-save-note').textContent,/cannot be saved/);assert.match(get('#mastery-import-status').textContent,/Imported/);assert.match(host.innerHTML,/value="9"/);assert.match(get('#mastery-summary').innerHTML,/>0<\/strong>/);

  failStorage=false;host.onclick({target:{closest:selector=>selector==='#mastery-reset'?{}:null}});
  assert.ok(host.innerHTML.indexOf('id="mastery-mode"')<host.innerHTML.indexOf('id="mastery-total"'));
  assert.doesNotMatch(host.innerHTML,/id="mastery-budget"|mastery-table|可用点数自动按|当前等级为已有精通/);
  assert.match(host.innerHTML,/<label class="number-field" id="mastery-total-field">/);assert.doesNotMatch(host.innerHTML,/readonly/);
  assert.equal((host.innerHTML.match(/class="panel mastery-card"/g)||[]).length,10);
  const input=(id,value)=>host.oninput({target:{id,value,dataset:{}}});
  input('mastery-total','120');let updated=JSON.parse(storage.get(masteryStorageKey));assert.equal(updated.totalPoints,120);assert.equal(updated.budget,undefined);assert.match(get('#mastery-summary').innerHTML,/>120<\/strong>/);
  input('mastery-total','');assert.match(get('#mastery-issue').textContent,/cannot be blank/);assert.equal(JSON.parse(storage.get(masteryStorageKey)).totalPoints,120);
  input('mastery-total','240');assert.match(get('#mastery-summary').innerHTML,/>240<\/strong>/);
  host.oninput({target:{value:'2',dataset:{masteryField:'current',masteryId:'xp'}}});assert.match(get('#mastery-summary').innerHTML,/>158<\/strong>/);
  get('#mastery-mode').onchange({target:{value:'unlimited'}});
  host.onclick({target:{closest:selector=>selector==='#mastery-zero-ranks'?{}:null}});updated=JSON.parse(storage.get(masteryStorageKey));assert.equal(updated.mode,'unlimited');assert.equal(updated.totalPoints,240);assert.ok(Object.values(updated.current).every(n=>n===0));assert.ok(Object.values(updated.target).every(n=>n===0));
  input('mastery-total','20');host.oninput({target:{value:'1',dataset:{masteryField:'current',masteryId:'xp'}}});assert.match(get('#mastery-issue').textContent,/exceed total points by 20/);
  await get('#mastery-import').onclick();updated=JSON.parse(storage.get(masteryStorageKey));assert.equal(updated.mode,'limited');assert.equal(updated.totalPoints,5336);assert.equal(updated.budget,undefined);

  const beforeApply=storage.get(masteryStorageKey),ranks=masteryDefaults().current;
  assert.throws(()=>applyMasteryRecommendation({allocationMode:'remaining',ranks:{...ranks,xp:8}}),/targetBelowCurrent/);assert.equal(storage.get(masteryStorageKey),beforeApply);
  assert.throws(()=>applyMasteryRecommendation({allocationMode:'reset',ranks:{...ranks,xp:200}}),/optimizerPlanOverBudget/);assert.equal(storage.get(masteryStorageKey),beforeApply);
  assert.throws(()=>applyMasteryRecommendation({allocationMode:'unknown',ranks}),/invalidOptimizerMode/);assert.equal(storage.get(masteryStorageKey),beforeApply);
  assert.equal(applyMasteryRecommendation({allocationMode:'remaining',ranks:{...ranks,xp:10}}).saveOK,true);
  updated=JSON.parse(storage.get(masteryStorageKey));assert.equal(updated.current.xp,9);assert.equal(updated.target.xp,10);assert.equal(updated.totalPoints,5336);assert.equal(updated.mode,'limited');
  applyMasteryRecommendation({allocationMode:'reset',ranks:{...ranks,xp:1}});updated=JSON.parse(storage.get(masteryStorageKey));assert.deepEqual(updated.current,ranks);assert.equal(updated.target.xp,1);assert.equal(updated.totalPoints,5336);assert.equal(updated.mode,'limited');
  const savedBeforeFailure=storage.get(masteryStorageKey);failStorage=true;
  assert.equal(applyMasteryRecommendation({allocationMode:'remaining',ranks:{...ranks,xp:2}}).saveOK,false);assert.equal(storage.get(masteryStorageKey),savedBeforeFailure);assert.match(get('#mastery-save-note').textContent,/cannot be saved/);assert.match(host.innerHTML,/data-mastery-id="xp" value="2"/);

 }finally{for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else if(key==='localStorage')Object.defineProperty(globalThis,key,value);else globalThis[key]=value;}}
});
