import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacterUpdater,loadCharacterUpdates,validateCharacterUpdates,characterUpdateStorageKey} from '../src/character-auto-import.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),data};};
function setup(extra={}){
 const applied=[],errors=[],reads=[];let finish,revision=0,draft=false;
 const updater=createCharacterUpdater({storage:memory(),page:'craft',read:()=>{reads.push(1);return new Promise(resolve=>finish=resolve);},apply:snapshot=>applied.push(snapshot),onError:e=>errors.push(e.message),revision:()=>revision,hasDraft:()=>draft,...extra});
 if(!updater.settingsError)updater.configure({config:true});return {updater,applied,errors,reads,reply:snapshot=>finish({snapshot}),edit:()=>revision++,draft:value=>draft=value};
}
test('defaults, strict validation, per-page isolation and corrupt storage protection',()=>{
 for(const raw of [null,{version:2,config:false},{version:1,config:1}])assert.throws(()=>validateCharacterUpdates(raw),/invalidAutoImport/);
 const storage=memory();assert.deepEqual(loadCharacterUpdates(storage,'combat'),{version:1,config:false});assert.deepEqual(loadCharacterUpdates(storage,'craft'),{version:1,config:false});
 storage.setItem(characterUpdateStorageKey('combat'),'broken');assert.throws(()=>loadCharacterUpdates(storage,'combat'));assert.equal(loadCharacterUpdates(storage,'craft').config,false);
 const t=setup({storage,page:'combat'});assert.equal(t.updater.settingsError,'load');t.updater.setActive(true);assert.equal(t.reads.length,0);assert.equal(storage.getItem(characterUpdateStorageKey('combat')),'broken');t.updater.setActive(false);t.updater.configure({config:true});assert.equal(t.updater.settingsError,null);assert.equal(JSON.parse(storage.getItem(characterUpdateStorageKey('combat'))).config,true);
});
test('entry, completed focus and return read once; redraw, inactive and disabled skip reads',async()=>{
 const t=setup();t.updater.setActive(true);assert.equal(t.reads.length,1);t.updater.setActive(true);t.updater.trigger();assert.equal(t.reads.length,1);t.reply({capturedAt:1});await flush();assert.equal(t.applied[0].capturedAt,1);
 t.updater.trigger();t.reply({capturedAt:2});await flush();assert.equal(t.reads.length,2);t.updater.setActive(false);t.updater.trigger();assert.equal(t.reads.length,2);t.updater.setActive(true);t.reply({capturedAt:3});await flush();assert.equal(t.reads.length,3);t.updater.configure({config:false});t.updater.trigger();assert.equal(t.reads.length,3);
});
test('legacy stock preference is ignored and removed on settings save',()=>{
 const storage=memory();storage.setItem(characterUpdateStorageKey('craft'),JSON.stringify({version:1,config:true,inventory:'ignored legacy data'}));
 const t=setup({storage});assert.deepEqual(t.updater.options,{version:1,config:true});
 assert.deepEqual(JSON.parse(storage.getItem(characterUpdateStorageKey('craft'))),{version:1,config:true});
});
test('leaving and returning during a pending read discards the old reply and refreshes the active page',async()=>{
 const t=setup();t.updater.setActive(true);t.updater.setActive(false);t.updater.setActive(true);t.reply({capturedAt:1});await flush();assert.equal(t.applied.length,0);assert.equal(t.reads.length,2);t.reply({capturedAt:2});await flush();assert.equal(t.applied[0].capturedAt,2);
});
test('edits and drafts protect state; manual reads share concurrency but work while automatic updates are disabled',async()=>{
 const t=setup();t.updater.setActive(true);t.edit();t.reply({});await flush();assert.equal(t.applied.length,0);t.draft(true);await t.updater.trigger();assert.equal(t.reads.length,1);t.draft(false);t.updater.configure({config:false});t.updater.read();t.updater.trigger();assert.equal(t.reads.length,2);t.reply({});await flush();assert.equal(t.applied.length,1);
});
test('read/apply failures are visible, data remains unchanged and next trigger retries; busy manual page skips automatic requests',async()=>{
 let busy=true,count=0;const t=setup({busy:()=>busy,apply:()=>{count++;throw Error('invalidSnapshot');}});t.updater.setActive(true);assert.equal(t.reads.length,0);busy=false;t.updater.trigger();t.reply(null);await flush();assert.deepEqual(t.errors,['noSnapshot']);t.updater.trigger();t.reply({});await flush();assert.deepEqual(t.errors,['noSnapshot','invalidSnapshot']);assert.equal(count,1);
});
test('settings save failures remain explicit while the in-memory choice is available',()=>{
 const t=setup({storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}}});t.updater.configure({config:true});assert.equal(t.updater.settingsError,'save');assert.equal(t.updater.options.config,true);
});
