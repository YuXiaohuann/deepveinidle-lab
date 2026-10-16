// ==UserScript==
// @name         Deep Vein Idle · 角色配置导入 / Character import
// @name:en      Deep Vein Idle · Character import
// @name:zh-cn   Deep Vein Idle · 角色配置导入
// @namespace    https://dvi-lab.pages.dev/
// @version      2.7.0
// @description  读取角色配置供实验室导入；不发送游戏指令。
// @match        https://deepveinidle.com/*
// @match        https://dvi-lab.pages.dev/*
// @match        https://*.dvi-lab.pages.dev/*
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==
(function(){
 'use strict';
 const key='dvi-character-snapshot-v2';
 // Kept inside the installable script: no runtime fetch or page-global parser hook.
 function captureWorker(){
  'use strict';
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const fields=['lastTick','skills','equipment','foodItemId','eatAt','foodMaxTier','foodPerTrip','brews','brewTier','brewBuckets','house','houseFurniture','masteries','perks','guildBonus','homeBank','ironman','bank','pack','overflow','collections','forgeLog'];
  let epoch=0,player,guild,worldBuffs,worldTick,capturedAt;
  let revisions={character:0};
  const clean=v=>JSON.parse(JSON.stringify(v,(k,value)=>/^(?:password|token|auth|authorization|cookie|email|chat)$/i.test(k)?undefined:value));
  function reset(next){epoch=next;player=guild=worldBuffs=worldTick=capturedAt=undefined;revisions={character:0};}
  function frame(raw,at){
   let f;try{f=JSON.parse(raw);}catch{return;}
   if(!Number.isInteger(f?.tick)||!Array.isArray(f.m))return;
   let changed=false,own;
   for(const m of f.m){
    if(m?.t==='welcome'){own=player=guild=worldBuffs=undefined;}
    if(m?.t==='welcome'||m?.t==='guild'){
     const info=m.t==='welcome'?m.guild:m.info;guild=info==null?null:{name:info.name,tag:info.tag};
    }
    if(m?.t==='welcome'||m?.t==='snapshot'){
     const you=m.you;
     if(!object(you)||!object(you.skills)||!object(you.equipment)||!Number.isSafeInteger(you.lastTick))throw Error('角色数据结构不兼容 / Incompatible character data');
     own=you;
    }else if(m?.t!=='windows'&&m?.t!=='guild')continue;
    worldTick=f.tick;
    if(Object.hasOwn(m,'windows'))worldBuffs=Array.isArray(m.windows)?m.windows.map(w=>object(w)?Object.fromEntries(['label','fromTick','toTick','xpMult'].filter(k=>Object.hasOwn(w,k)).map(k=>[k,w[k]])):w):undefined;
    if(player||own)changed=true;
   }
   if(changed){if(own)player=clean(Object.fromEntries(fields.filter(k=>Object.hasOwn(own,k)).map(k=>[k,own[k]])));capturedAt=at;revisions.character++;}
  }
  self.onmessage=({data:d})=>{
   try{
    if(d.type==='reset'){reset(d.epoch);self.postMessage({type:'changed',epoch,revisions});return;}
    if(d.epoch!==epoch)return;
    if(d.type==='frame'){
     frame(d.raw,d.at);
     self.postMessage({type:'ack',epoch,sequence:d.sequence,chars:d.raw.length,revisions});
    }else if(d.type==='pull'){
     const snapshot={version:2,capturedAt,player,guild,worldBuffs,worldTick};
     self.postMessage({type:'snapshot',epoch,kind:d.kind,revision:revisions[d.kind],notify:true,snapshot});
    }
   }catch(error){
    self.postMessage({type:'failed',epoch,error:error.message});
    if(d.type==='frame')self.postMessage({type:'ack',epoch,sequence:d.sequence,chars:d.raw.length,revisions});
   }
  };
  self.postMessage({type:'ready'});
 }
 if(location.origin==='https://deepveinidle.com'){
  const page=unsafeWindow,NativeSocket=page.WebSocket;
  const slots={character:{key}};
  let latestSocket,epoch=0,sequence=0,worker,workerURL,ready=false,stopped=false,readyTimer,ackTimer;
  let pending=0,pendingChars=0,visible=true,hideTimer=null,status='等待游戏数据 / Waiting for game data';
  const shown=new Set();
  const observer=new MutationObserver(()=>{if(visible&&!document.getElementById('dvi-character-capture'))mount();});
  function paint(){if(visible)observer.observe(document,{childList:true,subtree:true});mount();const el=document.getElementById('dvi-character-capture');if(el&&el.textContent!==status)el.textContent=status;}
  function captured(kind){
   if(shown.has(kind)||stopped)return;shown.add(kind);
   status='角色配置已读取 / Character captured';
   clearTimeout(hideTimer);visible=true;hideTimer=setTimeout(()=>{visible=false;observer.disconnect();document.getElementById('dvi-character-capture')?.remove();},5000);paint();
  }
  function dispose(){
   clearTimeout(readyTimer);clearTimeout(ackTimer);
   for(const slot of Object.values(slots))clearTimeout(slot.timer);
   worker?.terminate();if(workerURL){URL.revokeObjectURL(workerURL);workerURL=null;}
  }
  function failure(error){
   if(stopped)return;stopped=true;dispose();clearTimeout(hideTimer);visible=true;
   status=`读取失败 / Capture failed: ${error.message}。请刷新游戏 / Refresh the game`;paint();console.error('[DVI character import]',error);
  }
  function send(data){if(stopped)return;try{worker.postMessage(data);}catch(error){failure(error);}}
  function watchAck(){clearTimeout(ackTimer);if(pending)ackTimer=setTimeout(()=>failure(Error('Worker 无响应 / Worker unresponsive')),10000);}
  function schedule(kind){
   const slot=slots[kind];
   if(stopped||!ready||slot.busy||slot.timer||!(slot.desired>slot.saved))return;
   slot.timer=setTimeout(()=>{
    slot.timer=null;if(stopped)return;slot.busy={epoch,writing:false};send({type:'pull',epoch,kind});
   },100);
  }
  function changed(revisions){for(const kind of ['character']){slots[kind].desired=revisions[kind];schedule(kind);}}
  function finish(kind,token){const slot=slots[kind];if(slot.busy===token){slot.busy=null;schedule(kind);}}
  async function save(d){
   const slot=slots[d.kind],token=slot?.busy;
   if(!token||token.epoch!==d.epoch)return;
   if(d.epoch!==epoch||stopped){finish(d.kind,token);return;}
   token.writing=true;
   try{
    await GM_setValue(slot.key,d.snapshot);
    if(d.epoch===epoch&&!stopped){slot.saved=d.revision;if(d.notify)captured(d.kind);}
   }catch(error){
    if(d.epoch===epoch)failure(Error(`角色配置保存失败 / Character could not be saved: ${error.message}`));
    else console.error('[DVI character import: previous connection save failed]',error);
   }finally{finish(d.kind,token);}
  }
  page.WebSocket=new Proxy(NativeSocket,{construct(target,args){
   const socket=Reflect.construct(target,args),url=new URL(String(args[0]),location.href);
   if(url.host===location.host&&url.pathname==='/ws'){
    latestSocket=socket;epoch++;shown.clear();clearTimeout(hideTimer);
    for(const slot of Object.values(slots)){
     clearTimeout(slot.timer);slot.timer=null;slot.desired=slot.saved=0;
     // A pull from the previous connection has not entered GM storage yet.
     if(slot.busy&&!slot.busy.writing)slot.busy=null;
    }
    if(!stopped){visible=true;status='等待游戏数据 / Waiting for game data';paint();send({type:'reset',epoch});}
    socket.addEventListener('message',event=>{
     if(stopped||socket!==latestSocket||typeof event.data!=='string')return;
     if(pending>=128||pendingChars+event.data.length>16*1024*1024){failure(Error('捕获积压超限 / Capture backlog exceeded'));return;}
     pending++;pendingChars+=event.data.length;if(pending===1)watchAck();
     send({type:'frame',epoch,sequence:++sequence,at:Date.now(),raw:event.data});
    });
   }
   return socket;
  }});
  function mount(){if(!visible||!document.documentElement||document.getElementById('dvi-character-capture'))return;const el=document.createElement('div');el.id='dvi-character-capture';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99999;max-width:calc(100vw - 32px);padding:6px 10px;border:1px solid #756440;border-radius:6px;background:#171c24;color:#e6d6ae;font:12px sans-serif;white-space:pre-line;pointer-events:none';el.textContent=status;document.documentElement.append(el);}
  paint();
  try{
   workerURL=URL.createObjectURL(new Blob([`(${captureWorker.toString()})()`],{type:'text/javascript'}));
   worker=new Worker(workerURL);
   worker.onmessage=({data:d})=>{
    if(stopped)return;
    if(d.type==='ready'){ready=true;clearTimeout(readyTimer);URL.revokeObjectURL(workerURL);workerURL=null;for(const kind of ['character'])schedule(kind);return;}
    if(d.type==='ack'){pending--;pendingChars-=d.chars;watchAck();}
    if(d.epoch!==epoch)return;
    if(d.type==='failed'){failure(Error(d.error));return;}
    if(d.type==='ack')changed(d.revisions);
    if(d.type==='changed')changed(d.revisions);
    if(d.type==='snapshot')save(d);
   };
   worker.onerror=()=>failure(Error('Worker 执行失败 / Worker failed'));
   worker.onmessageerror=()=>failure(Error('Worker 消息传递失败 / Worker message failed'));
   readyTimer=setTimeout(()=>failure(Error('Worker 启动超时 / Worker startup timed out')),5000);
  }catch(error){failure(error);}
  page.addEventListener('pagehide',()=>{stopped=true;dispose();clearTimeout(hideTimer);observer.disconnect();},{once:true});
 }else{
  // The document is shared across userscript/page worlds; window identities are not.
  document.addEventListener('dvi-character-request',async event=>{
   if(typeof event.detail!=='string')return;
   let data;try{data=JSON.parse(event.detail);}catch{return;}
   if(data?.source!=='dvi-simulator'||!['probe','read'].includes(data.action)||typeof data.id!=='string'||data.id.length>100)return;
   const reply={source:'dvi-character-script',id:data.id,version:'2.4'};
   try{if(data.action==='probe')reply.ready=true;else reply.snapshot=await GM_getValue(key,null);}catch(error){reply.error=String(error.message||error);}
   document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify(reply)}));
  });
 }
})();
