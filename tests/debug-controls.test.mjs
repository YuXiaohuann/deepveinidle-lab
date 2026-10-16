import test from 'node:test';
import assert from 'node:assert/strict';
import {preset} from '../src/model.js';
import {createScenario} from '../src/simulation.js';
import {importCharacter} from '../src/character-import.js';
import {enhancementDefaults,importEnhancement} from '../src/enhancement.js';

test('debug configuration download round-trips both imports; failures preserve state and file survives redraw',async()=>{
 const original={document:globalThis.document,CustomEvent:globalThis.CustomEvent};
 const originalURL={create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 const elements=new Map(),buttons=['config','enhance'].map(mode=>({dataset:{debugImport:mode}}));
 const host={innerHTML:'',querySelector:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},querySelectorAll:()=>buttons};
 let blob,download,clicked=false;
 class Document extends EventTarget{getElementById(){return host;}body={append(){}};createElement(){return {click(){clicked=true;download=this.download;},remove(){}};}}
 globalThis.document=new Document();globalThis.CustomEvent=class extends Event{constructor(type,args){super(type);this.detail=args.detail;}};
 URL.createObjectURL=value=>{blob=value;return 'blob:test';};URL.revokeObjectURL=()=>{};
 const player=createScenario(preset('ranged')).player,capturedAt=Date.now();
 let source={version:2,capturedAt,player,worldBuffsVersion:1,worldTick:100,worldBuffs:[{fromTick:0,toTick:200,xpMult:1.3525,rarityMult:1.7075}]};
 document.addEventListener('dvi-character-request',event=>{const request=JSON.parse(event.detail);document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',id:request.id,version:'2.4',snapshot:source})}));});
 try{
  const {renderDebug}=await import('../src/debug-controls.js');
  let combat=preset('magic'),enhancement=enhancementDefaults(),language='zh';
  const callbacks={applyCombat:input=>{const result=importCharacter(combat,input);combat=result.state;return {...result,capturedAt:input.capturedAt,saveOK:true};},applyEnhancement:input=>{const result=importEnhancement(enhancement,input);enhancement=result.state;return {capturedAt:result.capturedAt};},refresh:()=>renderDebug(language,callbacks)};
  callbacks.refresh();assert.match(host.innerHTML,/character-import.user.js/);assert.ok(buttons.every(button=>button.disabled));
  assert.doesNotMatch(host.innerHTML,/debug-capture|data-debug-script-import|data-debug-import="snapshot"|角色快照|战斗快照/);
  const beforeExport=structuredClone({combat,enhancement});
  await host.querySelector('#debug-export-config').onclick();assert.ok(clicked);assert.equal(download,`dvi-character-config-${capturedAt}.json`);
  assert.deepEqual({combat,enhancement},beforeExport);
  const json=await blob.text();assert.deepEqual(JSON.parse(json),source);
  host.querySelector('#debug-file').onchange({target:{files:[{name:'configuration.json',text:async()=>json}]}});
  combat.manual.vendorValues=true;combat.manual.valuationMode='vendor';combat.manual.hotSetting='off';combat.manual.simulationHours=6.5;combat.manual.customSimulation=true;
  const beforeConfigImport=structuredClone(combat);
  await buttons[0].onclick();assert.deepEqual(combat,importCharacter(beforeConfigImport,source).state);
  assert.equal(combat.manual.weeklyXp,35.25);assert.equal(combat.manual.worldRarity,70.75);
  assert.equal(combat.manual.vendorValues,true);assert.equal(combat.manual.hotSetting,'off');assert.equal(combat.manual.simulationHours,7);assert.equal(combat.manual.customSimulation,true);
  await buttons[1].onclick();assert.deepEqual(enhancement,importEnhancement(enhancementDefaults(),source).state);
  language='en';callbacks.refresh();assert.equal(host.querySelector('#debug-filename').textContent,'configuration.json');
  assert.doesNotMatch(host.innerHTML,/debug-capture|data-debug-script-import|data-debug-import="snapshot"|character snapshot|combat snapshot/i);
  const before=structuredClone({combat,enhancement});
  for(const invalid of ['{',JSON.stringify({version:2,capturedAt,player:null})]){
   host.querySelector('#debug-file').onchange({target:{files:[{name:'bad.json',text:async()=>invalid}]}});
   for(const button of buttons){await button.onclick();assert.match(host.querySelector('#debug-status').textContent,/Incompatible/);assert.deepEqual({combat,enhancement},before);}
  }
  source={version:2,capturedAt,player:null};clicked=false;await host.querySelector('#debug-export-config').onclick();assert.equal(clicked,false);
  assert.match(host.querySelector('#debug-export-status').textContent,/Incompatible/);
 }finally{URL.createObjectURL=originalURL.create;URL.revokeObjectURL=originalURL.revoke;for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
