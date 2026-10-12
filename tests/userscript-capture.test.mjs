import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {preset} from '../src/model.js';
import {createScenario} from '../src/simulation.js';
import {importCharacter} from '../src/character-import.js';
import {importSnapshot} from '../src/character-snapshot.js';

const script=fs.readFileSync(new URL('../src/debug-capture.user.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../vendor/game-original.js',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../vendor/manifest.json',import.meta.url),'utf8'));
const build='index-C3S-5Yeu.js',url=`https://deepveinidle.com/assets/${build}`;
const table=vm.runInNewContext('('+script.match(/const auditedBuilds=(\{[\s\S]*?\n  \});/)[1]+')');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(builds=[build],order=[]){
 const stored=[],configStored=[],scripts=builds.map(scriptNode);let observer;
 const page={JSON:{parse:JSON.parse},WebSocket:class{listeners=[];addEventListener(type,fn){if(type==='message')this.listeners.push(fn);}receive(text){for(const fn of this.listeners)fn({data:text});}}};
 const document={documentElement:{append(){}},querySelectorAll:()=>scripts,createElement:()=>({style:{},setAttribute(){}}),getElementById:()=>({textContent:''})};
 const context=vm.createContext({unsafeWindow:page,document,location:{origin:'https://deepveinidle.com',host:'deepveinidle.com',href:'https://deepveinidle.com/'},URL,Date,console,setTimeout:()=>0,clearTimeout(){},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},GM_setValue:async(k,v)=>{if(k==='dvi-debug-snapshot-v2')stored.push(structuredClone(v));else if(k==='dvi-character-snapshot-v2')configStored.push(structuredClone(v));}});
 const roleScript=fs.readFileSync(new URL('../src/character-import.user.js',import.meta.url),'utf8');
 for(const kind of order.length?order:['debug'])vm.runInContext(kind==='debug'?script:roleScript,context);
 const socket=new page.WebSocket('wss://deepveinidle.com/ws');
 const player=createScenario(preset('ranged')).player;player.id=7;player.lastTick=100;player.bankLocked=[64];player.bank={64:12};player.forgeLog={3:7};
 context.frameText=JSON.stringify({tick:100,m:[{t:'welcome',seed:123,windows:[{fromTick:0,toTick:200,xpMult:1.5,label:'Event'}],you:player}]});
 socket.receive(context.frameText);
 vm.runInContext('var actual=unsafeWindow.JSON.parse(frameText).m[0].you; actual.skills.ranged+=555;',context);
 return {context,stored,configStored,player,addScript(name){const node=scriptNode(name);scripts.push(node);observer([{addedNodes:[node]}]);}};
}
function scriptNode(name){return {tagName:'SCRIPT',src:`https://deepveinidle.com/assets/${name}`};}
function injectDeclaration(context,name,rename=name){
 const declaration=manifest.declarations.find(d=>d.name===name);
 const text=source.slice(declaration.start,declaration.end).replace(`function ${name}(`,`function ${rename}(`);
 assert.equal(name.length,rename.length,'Keep the audited positions while renaming');
 const prefix=source.slice(0,declaration.start).replace(/[^\r\n]/g,' ');
 vm.runInContext(prefix+text,context,{filename:url});
}
function fakeRead(context,stack){
 context.stackText=stack;
 vm.runInContext('Error=class{constructor(){this.stack=stackText;}}; actual.bankOrder;',context);
}

test('published positions match the reviewed source hash and declaration ranges',()=>{
 assert.equal(createHash('sha256').update(source).digest('hex'),manifest.sha256);
 assert.equal(manifest.sourceUrl,url);
 for(const [kind,name]of [['clone','P$'],['predict','Ei']]){
  const d=manifest.declarations.find(x=>x.name===name),lines=source.slice(0,d.start).split('\n');
  assert.deepEqual(Array.from(table[build][kind]),[lines.length,lines.at(-1).length+1,lines.at(-1).length+1+d.end-d.start]);
 }
});

test('actual reviewed clone and predictor capture advanced input even with renamed functions',async()=>{
 const h=harness();
 // Only initialize the native predictor; no additional prediction or world simulation.
 Object.assign(h.context,{Lr:6000,ft(){},x$(){},cc:()=>100,LH:1000000,F1:()=>null});
 injectDeclaration(h.context,'P$','Q4');injectDeclaration(h.context,'Ei','Z7');
 vm.runInContext('P$=Q4; Z7(actual,{},()=>false);',h.context);
 await settle();
 const snapshot=h.stored.at(-1),captured=snapshot.prediction;
 assert.equal(snapshot.clientBuild,build);assert.equal(snapshot.captureError,undefined);
 assert.deepEqual(captured.player.forgeLog,{3:7});assert.equal(captured.source,'predictor');assert.equal(captured.clientBuild,build);assert.equal(captured.seed,123);
 assert.equal(captured.player.skills.ranged,h.player.skills.ranged+555);assert.deepEqual(captured.player.bankLocked,[64]);assert.equal(captured.windows[0].label,'Event');
 assert.equal(importSnapshot(snapshot).player.skills.ranged,captured.player.skills.ranged);
 assert.deepEqual(vm.runInContext('actual.bankOrder',h.context),[]);
});

test('ordinary clones, serialization and name matches outside the audited ranges never capture',async()=>{
 const h=harness();injectDeclaration(h.context,'P$');
 vm.runInContext('P$(actual); JSON.stringify(actual); function Hi(p){return {...p,bankOrder:[...p.bankOrder]};} Hi(actual);',h.context,{filename:url});
 await settle();assert.equal(h.stored.at(-1).prediction,undefined);
 assert.throws(()=>importSnapshot(h.stored.at(-1)),/predictionMissing/);
});

test('V8 and Firefox/Safari stack formats use URL and positions without function names',async()=>{
 for(const format of ['v8','at-sign']){
  const h=harness(),position=[`${url}:2:274300`,`${url}:2:287860`];
  const stack=format==='v8'?`Error\n at arbitrary (${position[0]})\n at other (${position[1]})`:`arbitrary@${position[0]}\nother@${position[1]}`;
  fakeRead(h.context,stack);await settle();assert.equal(h.stored.at(-1).prediction.source,'predictor');
 }
});

test('wrong source, reversed frames and out-of-range positions do not capture',async()=>{
 for(const stack of [
  `at clone (${url}:2:274151)\nat predict (${url}:2:287860)`,
  `at clone (${url}:2:275754)\nat predict (${url}:2:287860)`,
  `at clone (${url}:1:274300)\nat predict (${url}:2:287860)`,
  `at predict (${url}:2:287860)\nat clone (${url}:2:274300)`,
  `at clone (https://other.example/assets/${build}:2:274300)\nat predict (${url}:2:287860)`,
  `at clone (${url}:2:274300)\nat other (${url}:2:286000)\nat predict (${url}:2:287860)`,
  `at clone (${url}:2:274300)\nat other (https://other.example/helper.js:1:1)\nat predict (${url}:2:287860)`,
  'unsupported stack'
 ]){
  const h=harness();fakeRead(h.context,stack);await settle();assert.equal(h.stored.at(-1).prediction,undefined);
 }
});

test('unknown, absent and ambiguous resources report compatibility before missing prediction and allow configuration import',async()=>{
 for(const builds of [['index-unreviewed.js'],[],[build,'index-unreviewed.js']]){
  const h=harness(builds);await settle();const snapshot=h.stored.at(-1);
  assert.equal(snapshot.captureError,'incompatibleClient');assert.equal(snapshot.prediction,undefined);
  assert.throws(()=>importSnapshot(snapshot),/incompatibleClient/);
  assert.equal(importCharacter(preset('magic'),snapshot).applied.length,9);
 }
});

test('late script discovery enables capture; additional entry resources discard a prior prediction',async()=>{
 const h=harness([]);await settle();assert.equal(h.stored.at(-1).captureError,'incompatibleClient');
 h.addScript(build);await settle();assert.equal(h.stored.at(-1).captureError,undefined);
 fakeRead(h.context,`at clone (${url}:2:274300)\nat predict (${url}:2:287860)`);await settle();assert.ok(h.stored.at(-1).prediction);
 h.addScript('index-unreviewed.js');await settle();const snapshot=h.stored.at(-1);
 assert.equal(snapshot.prediction,undefined);assert.equal(snapshot.captureError,'incompatibleClient');
 assert.throws(()=>importSnapshot(snapshot),/incompatibleClient/);
});

test('compatibility failure also rejects stale predictor data saved under a new resource',()=>{
 assert.throws(()=>importSnapshot({version:2,clientBuild:'index-unreviewed.js',prediction:{source:'predictor',clientBuild:build}}),/incompatibleClient/);
});


test('both script installation orders preserve configuration capture and native prediction observation',async()=>{
 for(const order of [['config','debug'],['debug','config']]){
  const h=harness([build],order);
  fakeRead(h.context,`at clone (${url}:2:274300)\nat predict (${url}:2:287860)`);
  await settle();
  assert.equal(h.stored.at(-1).prediction.source,'predictor');
  assert.equal(h.configStored.length,1);
  assert.equal(h.configStored[0].prediction,undefined);
  assert.equal(h.stored.at(-1).prediction.player.skills.ranged,h.configStored[0].player.skills.ranged+555);
 }
});

test('debug and role scripts both retain only own guild identity and clear it on leaving',async()=>{
 for(const order of [['debug','role'],['role','debug']]){
  const h=harness([build],order);
  // Both passive socket listeners must receive the same update.
  const socket=h.context.unsafeWindow.WebSocket;
  const connected=new socket('wss://deepveinidle.com/ws');
  connected.addEventListener('message',event=>h.context.unsafeWindow.JSON.parse(event.data));
  connected.receive(h.context.frameText);await settle();
  connected.receive(JSON.stringify({tick:101,m:[{t:'guild',info:{name:'Miners',tag:'MINE',members:['private'],chat:['private']}}]}));await settle();
  for(const captures of [h.stored,h.configStored])assert.deepEqual(captures.at(-1).guild,{name:'Miners',tag:'MINE'});
  connected.receive(JSON.stringify({tick:102,m:[{t:'guild',info:null}]}));await settle();
  for(const captures of [h.stored,h.configStored])assert.equal(captures.at(-1).guild,null);
 }
});
