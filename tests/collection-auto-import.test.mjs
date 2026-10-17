import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollectionAutoImporter,validateCollectionAutoImport} from '../src/collection-auto-import.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(run){
 let time=0,next=0,focus;const timers=new Map(),errors=[];
 const importer=createCollectionAutoImporter({run,onError:error=>errors.push(error.message),now:()=>time,setInterval:(callback,ms)=>{assert.equal(ms,60000);timers.set(++next,callback);return next;},clearInterval:id=>timers.delete(id),listenFocus:callback=>{focus=callback;return ()=>focus=null;}});
 return {importer,timers,errors,advance:ms=>time+=ms,focus:()=>focus?.(),tick:()=>{time+=60000;for(const callback of timers.values())callback();}};
}
test('auto importer starts only when enabled and active, reads immediately, on focus and each 60 seconds',async()=>{
 let count=0;const t=setup(async()=>count++);t.importer.set({enabled:false,active:true});t.tick();t.focus();assert.equal(count,0);
 t.importer.set({enabled:true,active:true});await flush();assert.equal(count,1);assert.equal(t.timers.size,1);
 t.importer.set({enabled:true,active:true});await flush();assert.equal(count,1);assert.equal(t.timers.size,1);
 t.tick();await flush();assert.equal(count,2);t.focus();await flush();assert.equal(count,2);
 t.advance(1001);t.focus();await flush();assert.equal(count,3);
 t.importer.set({enabled:true,active:false});assert.equal(t.timers.size,0);t.tick();t.focus();assert.equal(count,3);
 t.importer.set({enabled:true,active:true});await flush();assert.equal(count,4);
 t.importer.set({enabled:false,active:true});t.tick();t.focus();assert.equal(count,4);t.importer.dispose();
});
test('overlapping triggers coalesce and disabling or invalidating prevents stale results from applying',async()=>{
 let finish,isCurrent,count=0;const t=setup(current=>{count++;isCurrent=current;return new Promise(resolve=>finish=resolve);});
 t.importer.set({enabled:true,active:true});t.tick();t.focus();assert.equal(count,1);assert.equal(isCurrent(),true);
 t.importer.invalidate();assert.equal(isCurrent(),false);finish();await flush();t.tick();assert.equal(count,2);
 t.importer.set({enabled:false,active:true});assert.equal(isCurrent(),false);finish();await flush();assert.equal(t.timers.size,0);
 t.importer.set({enabled:true,active:true});assert.equal(count,3);t.importer.set({enabled:true,active:false});assert.equal(isCurrent(),false);finish();await flush();t.importer.dispose();
});
test('unexpected failures are visible and future ticks retry; invalid saved options fail explicitly',async()=>{
 let count=0;const t=setup(async()=>{count++;throw Error('readFailed');});t.importer.set({enabled:true,active:true});await flush();assert.deepEqual(t.errors,['readFailed']);t.tick();await flush();assert.equal(count,2);t.importer.dispose();
 assert.deepEqual(validateCollectionAutoImport({version:1,enabled:true}),{version:1,enabled:true});
 for(const raw of [null,{version:2,enabled:true},{version:1,enabled:1}])assert.throws(()=>validateCollectionAutoImport(raw),/invalidAutoImport/);
});
