// ==UserScript==
// @name         Deep Vein Idle · 角色配置导入 / Character import
// @name:en      Deep Vein Idle · Character import
// @name:zh-cn   Deep Vein Idle · 角色配置导入
// @namespace    https://dvi-lab.pages.dev/
// @version      2.2
// @description  捕获内置预测的完整角色输入，导入配置或临时快照；不发送游戏指令。
// @match        https://deepveinidle.com/*
// @match        https://dvi-lab.pages.dev/*
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
 if(location.origin==='https://deepveinidle.com'){
  // One-based line/column ranges, end exclusive. Reviewed against vendor/manifest.json.
  // Update this table only after reviewing the source and simulation compatibility.
  const auditedBuilds={
   'index-C3S-5Yeu.js':{clone:[2,274152,275754],predict:[2,287754,288722]}
  };
  const entryResources=new Set();let clientBuild=null;
  const page=unsafeWindow,NativeSocket=page.WebSocket;let latestSocket,latestPlayer,worldBuffs,worldTick,seed,prediction,serial=Promise.resolve(),parsingSocket,capturing=false,lastPrediction,visible=true,hideTimer=null,successShown=false,status='等待游戏数据 / Waiting for game data';
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  function noteScript(node){
   if(node?.tagName!=='SCRIPT'||!node.src)return;
   const url=new URL(node.src,location.href);
   if(url.origin===location.origin&&/^\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(url.pathname))entryResources.add(url.pathname.split('/').pop());
  }
  function scanScripts(root){
   noteScript(root);
   for(const node of root?.querySelectorAll?.('script[src]')??[])noteScript(node);
  }
  function updateBuild(){
   const next=entryResources.size===1?[...entryResources][0]:null;
   if(next===clientBuild)return;
   clientBuild=next;prediction=undefined;lastPrediction=undefined;
   if(latestPlayer)try{capture(latestPlayer,latestSocket);}catch(error){failure(error,latestSocket);}
  }
  scanScripts(document);updateBuild();
  function predictorRead(stack){
   const ranges=auditedBuilds[clientBuild];if(!ranges)return false;
   // Parse V8's "at ... (URL:line:column)" and Firefox/Safari's "name@URL:line:column".
   const frames=[];
   for(const line of stack.split('\n')){
    const match=line.match(/(https:\/\/[^\s()]+):(\d+):(\d+)\)?\s*$/);if(!match)continue;
    const url=new URL(match[1]);
    frames.push({game:url.origin===location.origin&&url.pathname===`/assets/${clientBuild}`,line:Number(match[2]),column:Number(match[3])});
   }
   const inside=(frame,range)=>frame?.game&&frame.line===range[0]&&frame.column>=range[1]&&frame.column<range[2];
   const first=frames.findIndex(frame=>frame.game);
   return first>=0&&inside(frames[first],ranges.clone)&&inside(frames[first+1],ranges.predict);
  }
  function paint(){mount();const el=document.getElementById('dvi-character-capture');if(el&&el.textContent!==status)el.textContent=status;}
  // The game reads bankOrder while cloning the actual predictor input. Observe
  // that read without changing the value or running another prediction.
  function observePlayer(player,socket){
   if(!object(player)||!Array.isArray(player.bankOrder))return;
   let order=player.bankOrder;
   Object.defineProperty(player,'bankOrder',{enumerable:true,configurable:true,get(){
    const stack=new Error().stack||'';
    if(!capturing&&socket===latestSocket&&predictorRead(stack)){
     try{capturing=true;const copy=clonePlayer(player),signature=JSON.stringify({player:copy,seed,windows:worldBuffs??[]});
      if(signature!==lastPrediction){lastPrediction=signature;prediction={player:copy,seed,windows:JSON.parse(JSON.stringify(worldBuffs??[])),capturedAt:Date.now(),source:'predictor',clientBuild};capture(player,socket);}
     }catch(error){failure(error,socket);}finally{capturing=false;}
    }
    return order;
   },set(value){order=value;}});
  }
  function clonePlayer(player){
   // Capture the complete own-role object; transport and account credentials
   // are never included. Defensive filtering also covers unexpected auth keys.
   return JSON.parse(JSON.stringify(player,(key,value)=>/^(?:password|token|auth|authorization|cookie|email|chat)$/i.test(key)?undefined:value));
  }
  function failure(error,socket){if(socket!==latestSocket)return;clearTimeout(hideTimer);visible=true;successShown=false;status=`读取失败 / Capture failed: ${error.message}`;paint();console.error('[DVI character import]',error);}
  function capture(you,socket){
   if(!object(you)||!object(you.skills)||!object(you.equipment)||!Number.isSafeInteger(you.lastTick))throw new Error('角色数据结构不兼容 / Incompatible character data');
   const snapshot={version:2,capturedAt:Date.now(),player:clonePlayer(you),worldBuffs,worldTick,prediction,clientBuild,captureError:auditedBuilds[clientBuild]?undefined:'incompatibleClient'};
   const write=async()=>{
    if(socket!==latestSocket)return;
    await GM_setValue(key,snapshot);
    if(socket!==latestSocket)return;
    status=prediction?'预测快照已读取 / Predictor snapshot captured':'角色配置已读取 / Character captured';
    if(!successShown){visible=true;successShown=true;hideTimer=setTimeout(()=>{visible=false;document.getElementById('dvi-character-capture')?.remove();},15000);}
    paint();
   };
   serial=serial.then(write).catch(error=>failure(error,socket));
   return serial;
  }
  function frameReceived(frame,socket,observe=false){
   if(socket!==latestSocket||!Number.isInteger(frame?.tick)||!Array.isArray(frame.m))return;
   for(const message of frame.m){
    if(message?.t==='welcome'){latestPlayer=undefined;worldBuffs=undefined;prediction=undefined;lastPrediction=undefined;seed=message.seed;}
    if(message?.t==='welcome'||message?.t==='snapshot'){
     latestPlayer=message.you;
     if(observe)observePlayer(latestPlayer,socket);
    }else if(message?.t!=='windows')continue;
    worldTick=frame.tick;
    if(Object.hasOwn(message,'windows'))worldBuffs=Array.isArray(message.windows)?message.windows:undefined;
    if(latestPlayer)try{capture(latestPlayer,socket);}catch(error){failure(error,socket);}
   }
  }
  // Observe the object parsed by the client itself, including subsequent local
  // mutations. A separately parsed socket copy would miss that predictor state.
  const nativeParse=page.JSON?.parse;
  if(nativeParse)page.JSON.parse=function(...args){
   const value=Reflect.apply(nativeParse,this,args);
   if(latestSocket&&typeof args[0]==='string'&&object(value)&&Array.isArray(value.m)&&Number.isInteger(value.tick))frameReceived(value,parsingSocket??latestSocket,true);
   return value;
  };
  page.WebSocket=new Proxy(NativeSocket,{construct(target,args){
   const socket=Reflect.construct(target,args);
   const url=new URL(String(args[0]),location.href);
   if(url.host===location.host&&url.pathname==='/ws'){
    latestSocket=socket;latestPlayer=undefined;worldBuffs=undefined;worldTick=undefined;seed=undefined;prediction=undefined;lastPrediction=undefined;clearTimeout(hideTimer);visible=true;successShown=false;
    status='等待游戏数据 / Waiting for game data';paint();
    const listen=socket.addEventListener,remove=socket.removeEventListener,listeners=new WeakMap();
    socket.addEventListener=function(type,listener,...options){
     if(type!=='message'||typeof listener!=='function')return Reflect.apply(listen,this,[type,listener,...options]);
     let wrapped=listeners.get(listener);if(!wrapped){wrapped=function(event){const previous=parsingSocket;parsingSocket=socket;try{return Reflect.apply(listener,this,[event]);}finally{parsingSocket=previous;}};listeners.set(listener,wrapped);}
     return Reflect.apply(listen,this,[type,wrapped,...options]);
    };
    if(remove)socket.removeEventListener=function(type,listener,...options){return Reflect.apply(remove,this,[type,type==='message'?listeners.get(listener)??listener:listener,...options]);};
    socket.addEventListener('message',event=>{
     if(socket!==latestSocket||typeof event.data!=='string')return;
     // In a page realm the JSON hook captures the shared object. This fallback
     // only supplies configuration when that hook is unavailable.
     if(nativeParse)return;
     let frame;try{frame=JSON.parse(event.data);}catch{return;}
     frameReceived(frame,socket);

    });
   }
   return socket;
  }});
  function mount(){if(!visible||!document.documentElement||document.getElementById('dvi-character-capture'))return;const el=document.createElement('div');el.id='dvi-character-capture';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99999;max-width:calc(100vw - 32px);padding:6px 10px;border:1px solid #756440;border-radius:6px;background:#171c24;color:#e6d6ae;font:12px sans-serif;pointer-events:none';el.textContent=status;document.documentElement.append(el);}
  new MutationObserver((records=[])=>{
   for(const record of records)for(const node of record.addedNodes)scanScripts(node);
   updateBuild();
   if(!document.getElementById('dvi-character-capture'))mount();
  }).observe(document,{childList:true,subtree:true});
  mount();
 }else{
  // The document is shared across userscript/page worlds; window identities are not.
  document.addEventListener('dvi-character-request',async event=>{
   if(typeof event.detail!=='string')return;
   let data;try{data=JSON.parse(event.detail);}catch{return;}
   if(data?.source!=='dvi-simulator'||!['probe','read'].includes(data.action)||typeof data.id!=='string'||data.id.length>100)return;
   const reply={source:'dvi-character-script',id:data.id,version:'2.2'};
   try{if(data.action==='probe')reply.ready=true;else reply.snapshot=await GM_getValue(key,null);}catch(error){reply.error=String(error.message||error);}
   document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify(reply)}));
  });
 }
})();
