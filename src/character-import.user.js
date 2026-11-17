// ==UserScript==
// @name         Deep Vein Idle · 角色配置导入 / Character import
// @name:en      Deep Vein Idle · Character import
// @name:zh-cn   Deep Vein Idle · 角色配置导入
// @namespace    https://dvi-lab.pages.dev/
// @version      2.10.0
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
  const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window,socketPrototype=page.WebSocket.prototype,addListener=socketPrototype.addEventListener;
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const attached=new WeakSet();
  let current;
  let pending=null,saving=false,saveTimer=null,stopped=false;
  let visible=true,hideTimer=null,status='等待游戏数据 / Waiting for game data';
  let badge;
  function paint(){if(visible&&badge?.isConnected&&badge.textContent!==status)badge.textContent=status;}
  function showCaptured(){
   if(current.captured||stopped)return;current.captured=true;
   status='角色配置已读取 / Character captured';
   hideTimer=setTimeout(()=>{visible=false;badge?.remove();},5000);paint();
  }
  function failure(error){
   if(stopped)return;stopped=true;pending=null;clearTimeout(saveTimer);clearTimeout(hideTimer);visible=true;
   status=`读取失败 / Capture failed: ${error.message}。请刷新游戏 / Refresh the game`;mount();paint();console.error('[DVI character import]',error);
  }
  function scheduleSave(){
   if(stopped||saving||saveTimer!==null||!pending)return;
   saveTimer=setTimeout(save,100);
  }
  async function save(){
   saveTimer=null;
   if(stopped||!pending)return;
   const snapshot=pending,connection=current;pending=null;saving=true;
   try{
    await GM_setValue(key,snapshot);
    if(connection===current&&!stopped)showCaptured();
   }catch(error){
    if(connection===current)failure(Error(`角色配置保存失败 / Character could not be saved: ${error.message}`));
    else console.error('[DVI character import: previous connection save failed]',error);
   }finally{saving=false;scheduleSave();}
  }
  function frame(raw){
   let {player,guild,worldBuffs,worldTick}=current;
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
     if(!object(you))throw Error('角色数据结构不兼容 / Incompatible character data');
     own=you;
    }else if(m?.t!=='windows'&&m?.t!=='guild')continue;
    worldTick=f.tick;
    if(Object.hasOwn(m,'windows'))worldBuffs=Array.isArray(m.windows)?m.windows.map(w=>object(w)?Object.fromEntries(['label','fromTick','toTick','xpMult','rarityMult'].filter(k=>Object.hasOwn(w,k)).map(k=>[k,w[k]])):w):undefined;
    if(player||own)changed=true;
   }
   if(own)player=own;
   Object.assign(current,{player,guild,worldBuffs,worldTick});
   if(!changed)return;
   pending={version:2,capturedAt:Date.now(),player,guild,worldBuffs,worldTick,worldBuffsVersion:1};
   scheduleSave();
  }
  socketPrototype.addEventListener=function(type,...args){
   const result=Reflect.apply(addListener,this,[type,...args]);
   if(stopped||type!=='message'||attached.has(this))return result;
   const url=new URL(this.url);
   if(url.origin!==location.origin.replace(/^http/,'ws')||url.pathname!=='/ws')return result;
   const socket=this,connection={socket,captured:false};
   Reflect.apply(addListener,socket,['message',event=>{
    if(stopped||current!==connection||typeof event.data!=='string')return;
    try{frame(event.data);}catch(error){failure(error);}
   }]);
   attached.add(socket);current=connection;pending=null;
   clearTimeout(saveTimer);saveTimer=null;clearTimeout(hideTimer);
   visible=true;status='等待游戏数据 / Waiting for game data';
   // A new connection starts a new notice; removed notices are not otherwise rebuilt.
   mount();paint();
   return result;
  };
  function mount(){
   if(!visible||!document.documentElement)return;
   badge=document.getElementById('dvi-character-capture');
   if(badge){paint();return;}
   badge=document.createElement('div');badge.id='dvi-character-capture';badge.setAttribute('role','status');
   badge.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99999;max-width:calc(100vw - 32px);padding:6px 10px;border:1px solid #756440;border-radius:6px;background:#171c24;color:#e6d6ae;font:12px sans-serif;white-space:pre-line;pointer-events:none';
   badge.textContent=status;document.documentElement.append(badge);
  }
  if(document.documentElement)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
  page.addEventListener('pagehide',()=>{stopped=true;pending=null;clearTimeout(saveTimer);clearTimeout(hideTimer);document.removeEventListener('DOMContentLoaded',mount);},{once:true});
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
