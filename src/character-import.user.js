// ==UserScript==
// @name         Deep Vein Idle · 角色配置导入 / Character import
// @name:en      Deep Vein Idle · Character import
// @name:zh-cn   Deep Vein Idle · 角色配置导入
// @namespace    https://dvi-lab.pages.dev/
// @version      2.3
// @description  读取角色配置用于战斗与强化配置导入；不发送游戏指令。
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
  const page=unsafeWindow,NativeSocket=page.WebSocket;let latestSocket,latestPlayer,worldBuffs,worldTick,serial=Promise.resolve(),visible=true,hideTimer=null,successShown=false,status='等待游戏数据 / Waiting for game data';
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  function paint(){mount();const el=document.getElementById('dvi-character-capture');if(el&&el.textContent!==status)el.textContent=status;}
  function clonePlayer(player){
   // Capture the complete own-role object; transport and account credentials
   // are never included. Defensive filtering also covers unexpected auth keys.
   return JSON.parse(JSON.stringify(player,(key,value)=>/^(?:password|token|auth|authorization|cookie|email|chat)$/i.test(key)?undefined:value));
  }
  function failure(error,socket){if(socket!==latestSocket)return;clearTimeout(hideTimer);visible=true;successShown=false;status=`读取失败 / Capture failed: ${error.message}`;paint();console.error('[DVI character import]',error);}
  function capture(you,socket){
   if(!object(you)||!object(you.skills)||!object(you.equipment)||!Number.isSafeInteger(you.lastTick))throw new Error('角色数据结构不兼容 / Incompatible character data');
   const snapshot={version:2,capturedAt:Date.now(),player:clonePlayer(you),worldBuffs,worldTick};
   const write=async()=>{
    if(socket!==latestSocket)return;
    await GM_setValue(key,snapshot);
    if(socket!==latestSocket)return;
    status='角色配置已读取 / Character captured';
    if(!successShown){visible=true;successShown=true;hideTimer=setTimeout(()=>{visible=false;document.getElementById('dvi-character-capture')?.remove();},15000);}
    paint();
   };
   serial=serial.then(write).catch(error=>failure(error,socket));
   return serial;
  }
  function frameReceived(frame,socket){
   if(socket!==latestSocket||!Number.isInteger(frame?.tick)||!Array.isArray(frame.m))return;
   for(const message of frame.m){
    if(message?.t==='welcome'){latestPlayer=undefined;worldBuffs=undefined;}
    if(message?.t==='welcome'||message?.t==='snapshot'){
     latestPlayer=message.you;
    }else if(message?.t!=='windows')continue;
    worldTick=frame.tick;
    if(Object.hasOwn(message,'windows'))worldBuffs=Array.isArray(message.windows)?message.windows:undefined;
    if(latestPlayer)try{capture(latestPlayer,socket);}catch(error){failure(error,socket);}
   }
  }
  page.WebSocket=new Proxy(NativeSocket,{construct(target,args){
   const socket=Reflect.construct(target,args);
   const url=new URL(String(args[0]),location.href);
   if(url.host===location.host&&url.pathname==='/ws'){
    latestSocket=socket;latestPlayer=undefined;worldBuffs=undefined;worldTick=undefined;clearTimeout(hideTimer);visible=true;successShown=false;
    status='等待游戏数据 / Waiting for game data';paint();
    socket.addEventListener('message',event=>{
     if(socket!==latestSocket||typeof event.data!=='string')return;
     let frame;try{frame=JSON.parse(event.data);}catch{return;}
     frameReceived(frame,socket);

    });
   }
   return socket;
  }});
  function mount(){if(!visible||!document.documentElement||document.getElementById('dvi-character-capture'))return;const el=document.createElement('div');el.id='dvi-character-capture';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99999;max-width:calc(100vw - 32px);padding:6px 10px;border:1px solid #756440;border-radius:6px;background:#171c24;color:#e6d6ae;font:12px sans-serif;pointer-events:none';el.textContent=status;document.documentElement.append(el);}
  new MutationObserver(()=>{if(!document.getElementById('dvi-character-capture'))mount();}).observe(document,{childList:true,subtree:true});
  mount();
 }else{
  // The document is shared across userscript/page worlds; window identities are not.
  document.addEventListener('dvi-character-request',async event=>{
   if(typeof event.detail!=='string')return;
   let data;try{data=JSON.parse(event.detail);}catch{return;}
   if(data?.source!=='dvi-simulator'||!['probe','read'].includes(data.action)||typeof data.id!=='string'||data.id.length>100)return;
   const reply={source:'dvi-character-script',id:data.id,version:'2.3'};
   try{if(data.action==='probe')reply.ready=true;else reply.snapshot=await GM_getValue(key,null);}catch(error){reply.error=String(error.message||error);}
   document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify(reply)}));
  });
 }
})();
