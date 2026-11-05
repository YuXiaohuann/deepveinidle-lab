// ==UserScript==
// @name         Deep Vein Idle · 角色配置导入 / Character import
// @name:en      Deep Vein Idle · Character import
// @name:zh-cn   Deep Vein Idle · 角色配置导入
// @namespace    https://dvi-lab.pages.dev/
// @version      2.9.0
// @description  读取角色配置供实验室导入；不发送游戏指令。
// @match        https://deepveinidle.com/*
// @match        https://cn.deepveinidle.com/*
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
 if(['https://deepveinidle.com','https://cn.deepveinidle.com'].includes(location.origin)){
  const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window,NativeSocket=page.WebSocket;
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const fields=['lastTick','skills','equipment','foodItemId','eatAt','foodMaxTier','foodPerTrip','brews','brewTier','brewBuckets','house','houseFurniture','masteries','perks','guildBonus','homeBank','ironman','bank','pack','overflow','collections','forgeLog'];
  const clean=v=>JSON.parse(JSON.stringify(v,(k,value)=>/^(?:password|token|auth|authorization|cookie|email|chat)$/i.test(k)?undefined:value));
  let latestSocket,epoch=0,player,guild,worldBuffs,worldTick;
  let pending=null,saving=false,saveTimer=null,stopped=false,captured=false;
  let visible=true,hideTimer=null,status='等待游戏数据 / Waiting for game data';
  const observer=new MutationObserver(()=>{if(visible&&!document.getElementById('dvi-character-capture'))mount();});
  function paint(){if(visible)observer.observe(document,{childList:true,subtree:true});mount();const el=document.getElementById('dvi-character-capture');if(el&&el.textContent!==status)el.textContent=status;}
  function showCaptured(){
   if(captured||stopped)return;captured=true;
   status='角色配置已读取 / Character captured';
   hideTimer=setTimeout(()=>{visible=false;observer.disconnect();document.getElementById('dvi-character-capture')?.remove();},5000);paint();
  }
  function failure(error){
   if(stopped)return;stopped=true;pending=null;clearTimeout(saveTimer);clearTimeout(hideTimer);visible=true;
   status=`读取失败 / Capture failed: ${error.message}。请刷新游戏 / Refresh the game`;paint();console.error('[DVI character import]',error);
  }
  function scheduleSave(){
   if(stopped||saving||saveTimer!==null||!pending)return;
   saveTimer=setTimeout(save,100);
  }
  async function save(){
   saveTimer=null;
   if(stopped||!pending)return;
   const snapshot=pending,connection=epoch;pending=null;saving=true;
   try{
    await GM_setValue(key,snapshot);
    if(connection===epoch&&!stopped)showCaptured();
   }catch(error){
    if(connection===epoch)failure(Error(`角色配置保存失败 / Character could not be saved: ${error.message}`));
    else console.error('[DVI character import: previous connection save failed]',error);
   }finally{saving=false;scheduleSave();}
  }
  function frame(raw){
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
    if(Object.hasOwn(m,'windows'))worldBuffs=Array.isArray(m.windows)?m.windows.map(w=>object(w)?Object.fromEntries(['label','fromTick','toTick','xpMult','rarityMult'].filter(k=>Object.hasOwn(w,k)).map(k=>[k,w[k]])):w):undefined;
    if(player||own)changed=true;
   }
   if(!changed)return;
   if(own)player=clean(Object.fromEntries(fields.filter(k=>Object.hasOwn(own,k)).map(k=>[k,own[k]])));
   pending={version:2,capturedAt:Date.now(),player,guild,worldBuffs,worldTick,worldBuffsVersion:1};
   scheduleSave();
  }
  page.WebSocket=new Proxy(NativeSocket,{construct(target,args){
   const socket=Reflect.construct(target,args),url=new URL(String(args[0]),location.href);
   if(url.host===location.host&&url.pathname==='/ws'){
    latestSocket=socket;epoch++;player=guild=worldBuffs=worldTick=undefined;pending=null;captured=false;
    clearTimeout(saveTimer);saveTimer=null;clearTimeout(hideTimer);
    if(!stopped){visible=true;status='等待游戏数据 / Waiting for game data';paint();}
    socket.addEventListener('message',event=>{
     if(stopped||socket!==latestSocket||typeof event.data!=='string')return;
     try{frame(event.data);}catch(error){failure(error);}
    });
   }
   return socket;
  }});
  function mount(){if(!visible||!document.documentElement||document.getElementById('dvi-character-capture'))return;const el=document.createElement('div');el.id='dvi-character-capture';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99999;max-width:calc(100vw - 32px);padding:6px 10px;border:1px solid #756440;border-radius:6px;background:#171c24;color:#e6d6ae;font:12px sans-serif;white-space:pre-line;pointer-events:none';el.textContent=status;document.documentElement.append(el);}
  paint();
  page.addEventListener('pagehide',()=>{stopped=true;pending=null;clearTimeout(saveTimer);clearTimeout(hideTimer);observer.disconnect();},{once:true});
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
