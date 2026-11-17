import fs from 'node:fs';
import vm from 'node:vm';

export const captureScript=fs.readFileSync(new URL('../../src/character-import.user.js',import.meta.url),'utf8');
export function captureHarness(write,{autoSave=true,origin='https://deepveinidle.com',hasUnsafeWindow=true,ready=true}={}){
 const storage=new Map(),writes=[],timers=new Map();
 let badge=null,timerId=0,observing=false,observer,hidden;
 const socketClass=()=>class extends EventTarget{
  constructor(url,{listen=true}={}){super();this.url=new URL(url,origin).href;if(listen)this.addEventListener('message',()=>{});}
  receive(messages,tick=1){this.raw(JSON.stringify({tick,m:messages}));}
  raw(data){this.dispatchEvent(Object.assign(new Event('message'),{data}));}
  send(){throw Error('No game commands permitted');}
 };
 const page={addEventListener(type,fn){if(type==='pagehide')hidden=fn;},WebSocket:socketClass()};
 const NativeSocket=page.WebSocket,documentEvents=new EventTarget();
 const document={documentElement:{append(el){badge=el;el.isConnected=true;}},createElement:()=>({isConnected:false,style:{},setAttribute(){},remove(){this.isConnected=false;badge=null;}}),getElementById:()=>badge,
  addEventListener:documentEvents.addEventListener.bind(documentEvents),removeEventListener:documentEvents.removeEventListener.bind(documentEvents),dispatchEvent:documentEvents.dispatchEvent.bind(documentEvents)};
 const root=document.documentElement;if(!ready)document.documentElement=null;
 const context={window:hasUnsafeWindow?{...page,WebSocket:socketClass()}:page,document,location:{origin,host:new URL(origin).host,href:origin+'/'},URL,Date,console:{error(){}},
  setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});if(ms===100&&autoSave)queueMicrotask(()=>{if(timers.delete(id))fn();});return id;},
  clearTimeout:id=>timers.delete(id),MutationObserver:class{constructor(fn){observer=fn;}observe(){observing=true;}disconnect(){observing=false;}},
  GM_setValue:async(key,value)=>{const copy=structuredClone(value);writes.push({key,value:copy});await write?.(key,copy);storage.set(key,copy);}
 };
 if(hasUnsafeWindow)context.unsafeWindow=page;
 vm.runInNewContext(captureScript,context);
 return {ready(){document.documentElement=root;document.dispatchEvent(new Event('DOMContentLoaded'));},NativeSocket,page,storage,writes,timers,context,badge:()=>badge,observing:()=>observing,
  removeBadge(){badge?.remove();},
  fire(ms){const entries=[...timers].filter(([,t])=>t.ms===ms);for(const [id,t]of entries){timers.delete(id);t.fn();}},
  hideBadge(){const entry=[...timers].find(([,t])=>t.ms===5000);if(!entry)throw Error('No badge timer');timers.delete(entry[0]);entry[1].fn();},
  pagehide(){hidden();}
 };
}
export const flushCapture=()=>new Promise(resolve=>setImmediate(resolve));
