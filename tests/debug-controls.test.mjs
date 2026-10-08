import test from 'node:test';
import assert from 'node:assert/strict';
import {preset} from '../src/model.js';
import {createScenario} from '../src/simulation.js';
import {importCharacter} from '../src/character-import.js';
import {importSnapshot} from '../src/character-snapshot.js';
import {enhancementDefaults,importEnhancement} from '../src/enhancement.js';

test('debug download round-trips into all import modes; invalid files preserve state and selected file survives redraw',async()=>{
 const original={document:globalThis.document,CustomEvent:globalThis.CustomEvent};
 const originalURL={create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 const elements=new Map(),buttons=['config','snapshot','enhance'].map(mode=>({dataset:{debugImport:mode}}));
 const scriptButtons=['snapshot'].map(mode=>({dataset:{debugScriptImport:mode}}));
 const host={innerHTML:'',querySelector:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},querySelectorAll:selector=>selector==='[data-debug-script-import]'?scriptButtons:buttons};
 let blob,download,clicked=false;
 class Document extends EventTarget{getElementById(){return host;}body={append(){}};createElement(){return {click(){clicked=true;download=this.download;},remove(){}};}}
 globalThis.document=new Document();globalThis.CustomEvent=class extends Event{constructor(type,args){super(type);this.detail=args.detail;}};
 URL.createObjectURL=value=>{blob=value;return 'blob:test';};URL.revokeObjectURL=()=>{};
 const player=createScenario(preset('ranged')).player,capturedAt=Date.now();
 let source={version:2,capturedAt,player,prediction:{source:'predictor',clientBuild:'index-C3S-5Yeu.js',capturedAt,player,seed:123,windows:[]}};
 document.addEventListener('dvi-character-request',event=>{const request=JSON.parse(event.detail);document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',id:request.id,version:'2.4',snapshot:source})}));});
 document.addEventListener('dvi-debug-request',event=>{const request=JSON.parse(event.detail);document.dispatchEvent(new CustomEvent('dvi-debug-response',{detail:JSON.stringify({source:'dvi-debug-script',id:request.id,version:'1.0',snapshot:source})}));});
 try{
  const {renderDebug}=await import('../src/debug-controls.js');
  let combat=preset('magic'),snapshot=null,enhancement=enhancementDefaults(),language='zh';
  const callbacks={applyCombat:(mode,input)=>{if(mode==='snapshot'){const next=importSnapshot(input);snapshot=next;return {snapshot:true,capturedAt:next.capturedAt};}const result=importCharacter(combat,input);combat=result.state;snapshot=null;return {...result,capturedAt:input.capturedAt};},applyEnhancement:input=>{const result=importEnhancement(enhancement,input);enhancement=result.state;return {capturedAt:result.capturedAt};},refresh:()=>renderDebug(language,callbacks)};
  callbacks.refresh();assert.match(host.innerHTML,/debug-capture.user.js/);assert.ok(buttons.every(button=>button.disabled));
  assert.ok(scriptButtons.every(button=>!button.disabled));
  await scriptButtons[0].onclick();assert.deepEqual(snapshot,importSnapshot(source));
  assert.match(host.querySelector('#debug-script-status').textContent,/临时快照/);
  await host.querySelector('#debug-export').onclick();assert.ok(clicked);assert.equal(download,`dvi-character-${capturedAt}.json`);
  const json=await blob.text();assert.deepEqual(JSON.parse(json),source);
  host.querySelector('#debug-file').onchange({target:{files:[{name:'capture.json',text:async()=>json}]}});
  await buttons[0].onclick();assert.deepEqual(combat,importCharacter(preset('magic'),source).state);
  await buttons[1].onclick();assert.deepEqual(snapshot,importSnapshot(source));
  await buttons[2].onclick();assert.deepEqual(enhancement,importEnhancement(enhancementDefaults(),source).state);
  language='en';callbacks.refresh();assert.equal(host.querySelector('#debug-filename').textContent,'capture.json');assert.match(host.innerHTML,/Import combat snapshot/);
  const before=structuredClone({combat,snapshot,enhancement});
  host.querySelector('#debug-file').onchange({target:{files:[{name:'bad.json',text:async()=>'{'}]}});
  await buttons[0].onclick();assert.match(host.querySelector('#debug-status').textContent,/Incompatible/);
  assert.deepEqual({combat,snapshot,enhancement},before);
  const incompatible=structuredClone(source);incompatible.prediction.clientBuild='unknown';
  host.querySelector('#debug-file').onchange({target:{files:[{name:'old.json',text:async()=>JSON.stringify(incompatible)}]}});
  await buttons[1].onclick();assert.match(host.querySelector('#debug-status').textContent,/Unsupported game version/);assert.deepEqual({combat,snapshot,enhancement},before);
  source=incompatible;clicked=false;await host.querySelector('#debug-export').onclick();assert.equal(clicked,false);
  const unknown={...source,clientBuild:'index-unreviewed.js',captureError:'incompatibleClient',prediction:undefined};
  host.querySelector('#debug-file').onchange({target:{files:[{name:'unknown.json',text:async()=>JSON.stringify(unknown)}]}});
  for(const nextLanguage of ['zh','en']){
   language=nextLanguage;callbacks.refresh();await buttons[1].onclick();
   assert.match(host.querySelector('#debug-status').textContent,language==='zh'?/未适配游戏版本/:/Unsupported game version/);
   assert.deepEqual({combat,snapshot,enhancement},before);
  }
  const {prediction,...configuration}=source;source=configuration;clicked=false;
  const directBefore=structuredClone({combat,snapshot,enhancement});
  await scriptButtons[0].onclick();assert.match(host.querySelector('#debug-script-status').textContent,/No predictor input/);
  assert.deepEqual({combat,snapshot,enhancement},directBefore);
  await host.querySelector('#debug-export-config').onclick();assert.ok(clicked);assert.equal(download,`dvi-character-config-${capturedAt}.json`);
  const configJson=await blob.text();assert.deepEqual(JSON.parse(configJson),configuration);assert.equal(JSON.parse(configJson).prediction,undefined);
  host.querySelector('#debug-file').onchange({target:{files:[{name:'configuration.json',text:async()=>configJson}]}});
  await buttons[0].onclick();assert.deepEqual(combat,importCharacter(before.combat,configuration).state);assert.equal(snapshot,null);
  await buttons[2].onclick();assert.deepEqual(enhancement,importEnhancement(before.enhancement,configuration).state);
  await buttons[1].onclick();assert.match(host.querySelector('#debug-status').textContent,/No predictor input/);assert.equal(snapshot,null);
  assert.deepEqual(combat,importCharacter(before.combat,configuration).state);
  source={version:2,capturedAt,player:null};clicked=false;await host.querySelector('#debug-export-config').onclick();assert.equal(clicked,false);
  assert.match(host.querySelector('#debug-export-status').textContent,/Incompatible/);
 }finally{URL.createObjectURL=originalURL.create;URL.revokeObjectURL=originalURL.revoke;for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
