import fs from 'node:fs';
import vm from 'node:vm';

export const captureScript=fs.readFileSync(new URL('../../src/character-import.user.js',import.meta.url),'utf8');
export function captureHarness(write,{autoSave=true,workerFailure=false,origin='https://deepveinidle.com'}={}){
 const storage=new Map(),writes=[],timers=new Map(),workers=[],urls=new Map();
 let badge=null,timerId=0,observing=false,observer,hidden;
 const page={addEventListener(type,fn){if(type==='pagehide')hidden=fn;},WebSocket:class{
  listeners={};addEventListener(type,fn){this.listeners[type]=fn;}
  receive(messages,tick=1){this.raw(JSON.stringify({tick,m:messages}));}
  raw(data){this.listeners.message?.({data});}
  send(){throw Error('No game commands permitted');}
 }};
 const document={documentElement:{append(el){badge=el;}},createElement:()=>({style:{},setAttribute(){},remove(){badge=null;if(observing)observer();}}),getElementById:()=>badge};
 class Blob{constructor(parts){this.source=parts.join('');}}
 class WorkerURL extends URL{
  static createObjectURL(blob){const url=`blob:test-${urls.size}`;urls.set(url,blob.source);return url;}
  static revokeObjectURL(url){urls.delete(url);}
 }
 class Worker{
  constructor(url){
   if(workerFailure)throw Error('Worker blocked');
   this.inbox=[];this.sent=[];workers.push(this);
   const self={postMessage:data=>{const copy=structuredClone(data);queueMicrotask(()=>{if(!this.terminated)this.onmessage?.({data:copy});});}};
   this.scope=self;
   vm.runInNewContext(urls.get(url),{self,console});
  }
  postMessage(data){
   const copy=structuredClone(data);this.sent.push(copy);
   const run=()=>{if(!this.terminated)this.scope.onmessage({data:copy});};
   if(this.paused)this.inbox.push(run);else queueMicrotask(run);
  }
  resume(){this.paused=false;for(const run of this.inbox.splice(0))queueMicrotask(run);}
  terminate(){this.terminated=true;this.inbox=[];}
 }
 const context={unsafeWindow:page,document,location:{origin,host:new URL(origin).host,href:origin+'/'},URL:WorkerURL,Blob,Worker,Date,console:{error(){}},
  setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});if(ms===100&&autoSave)queueMicrotask(()=>{if(timers.delete(id))fn();});return id;},
  clearTimeout:id=>timers.delete(id),MutationObserver:class{constructor(fn){observer=fn;}observe(){observing=true;}disconnect(){observing=false;}},
  GM_setValue:async(key,value)=>{const copy=structuredClone(value);writes.push({key,value:copy});await write?.(key,copy);storage.set(key,copy);}
 };
 vm.runInNewContext(captureScript,context);
 return {page,storage,writes,timers,workers,urls,context,badge:()=>badge,observing:()=>observing,
  removeBadge(){badge=null;if(observing)observer();},
  fire(ms){const entries=[...timers].filter(([,t])=>t.ms===ms);for(const [id,t]of entries){timers.delete(id);t.fn();}},
  hideBadge(){const entry=[...timers].find(([,t])=>t.ms===5000);if(!entry)throw Error('No badge timer');timers.delete(entry[0]);entry[1].fn();},
  pagehide(){hidden();}
 };
}
export const flushCapture=()=>new Promise(resolve=>setImmediate(resolve));
