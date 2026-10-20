import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollectionAutoImporter,validateCollectionAutoImport} from '../src/collection-auto-import.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(run){
 let focus;const errors=[];
 const importer=createCollectionAutoImporter({run,onError:error=>errors.push(error.message),listenFocus:callback=>{focus=callback;return ()=>focus=null;}});
 return {importer,errors,focus:()=>focus?.()};
}
test('auto importer reads on enable, every completed focus and section return; disabled and inactive focus do nothing',async()=>{
 let count=0;const t=setup(async()=>count++);
 t.importer.set({enabled:false,active:true});t.focus();assert.equal(count,0);
 t.importer.set({enabled:true,active:true});await flush();assert.equal(count,1);
 t.importer.set({enabled:true,active:true});assert.equal(count,1);
 t.focus();await flush();t.focus();await flush();assert.equal(count,3);
 t.importer.set({enabled:true,active:false});t.focus();assert.equal(count,3);
 t.importer.set({enabled:true,active:true});await flush();assert.equal(count,4);
 t.importer.set({enabled:false,active:true});t.focus();assert.equal(count,4);
 t.importer.dispose();t.focus();assert.equal(count,4);
});
test('overlapping focus coalesces and disabling or invalidating prevents stale results from applying',async()=>{
 let finish,isCurrent,count=0;const t=setup(current=>{count++;isCurrent=current;return new Promise(resolve=>finish=resolve);});
 t.importer.set({enabled:true,active:true});t.focus();t.focus();assert.equal(count,1);assert.equal(isCurrent(),true);
 t.importer.invalidate();assert.equal(isCurrent(),false);finish();await flush();t.focus();assert.equal(count,2);
 t.importer.set({enabled:false,active:true});assert.equal(isCurrent(),false);finish();await flush();
 t.importer.set({enabled:true,active:true});assert.equal(count,3);t.importer.set({enabled:true,active:false});assert.equal(isCurrent(),false);finish();await flush();t.importer.dispose();
});
test('unexpected failures are visible and next focus retries; invalid saved options fail explicitly',async()=>{
 let count=0;const t=setup(async()=>{count++;throw Error('readFailed');});t.importer.set({enabled:true,active:true});await flush();assert.deepEqual(t.errors,['readFailed']);t.focus();await flush();assert.equal(count,2);t.importer.dispose();
 assert.deepEqual(validateCollectionAutoImport({version:1,enabled:true}),{version:1,enabled:true});
 for(const raw of [null,{version:2,enabled:true},{version:1,enabled:1}])assert.throws(()=>validateCollectionAutoImport(raw),/invalidAutoImport/);
});
