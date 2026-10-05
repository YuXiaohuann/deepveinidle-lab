// ==UserScript==
// @name         Deep Vein Idle · 角色配置导入 / Character import
// @name:en      Deep Vein Idle · Character import
// @name:zh-cn   Deep Vein Idle · 角色配置导入
// @namespace    https://dvi-lab.pages.dev/
// @version      1.0
// @description  只读角色配置，在战斗模拟器按菜单一键导入；不发送游戏指令。
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
 const key='dvi-character-config-v1';
 if(location.origin==='https://deepveinidle.com'){
  const page=unsafeWindow,NativeSocket=page.WebSocket;let latestSocket,latestPlayer,worldBuffs,worldTick,visible=true,hideTimer=null,successShown=false,status='等待游戏数据 / Waiting for game data';
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const keys={skills:['melee','ranged','magic','defence','hitpoints'],equipment:['weapon','shield','helmet','body','legs','ring','amulet','mount'],brews:['swift','hunter','nourish','warrior','haste','elixir','abyssal','fed','rooted','blessing'],brewTier:['swift','hunter','nourish','warrior','haste','elixir','abyssal'],brewBuckets:['swift','hunter','nourish','warrior','haste','elixir','abyssal'],house:['yard','post','armour','target','altar','shrine','storeroom'],houseFurniture:['yard','post','armour','target','altar','shrine','storeroom'],masteries:['xp','move','hp','maxhit','accuracy','rare'],perks:['pockets','meals','rest']};
  function paint(){mount();const el=document.getElementById('dvi-character-capture');if(el&&el.textContent!==status)el.textContent=status;}
  const weeklyLabels=new Set(['Weekly goal: gathered','Weekly goal: felled']);
  function readWorldBuffs(windows){
   if(!Array.isArray(windows)||!windows.every(object))return undefined;
   const weekly=windows.filter(w=>weeklyLabels.has(w.label));
   if(!weekly.every(w=>Number.isSafeInteger(w.fromTick)&&w.fromTick>=0&&Number.isSafeInteger(w.toTick)&&w.toTick>=w.fromTick&&typeof w.xpMult==='number'&&Number.isFinite(w.xpMult)&&w.xpMult>=1))return undefined;
   return weekly.map(({label,fromTick,toTick,xpMult})=>({label,fromTick,toTick,xpMult}));
  }
  async function capture(you,socket){
   if(!object(you)||!object(you.skills)||!object(you.equipment)||!Number.isSafeInteger(you.lastTick))throw new Error('角色数据结构不兼容 / Incompatible character data');
   const player={};
   for(const field of ['lastTick','foodItemId','eatAt','foodMaxTier','foodPerTrip','guildBonus','homeBank','ironman'])if(Object.hasOwn(you,field)&&(you[field]===null||['number','boolean'].includes(typeof you[field])))player[field]=you[field];
   for(const [field,list]of Object.entries(keys))if(object(you[field])){
    player[field]={};
    for(const k of list)if(Object.hasOwn(you[field],k)){
     const v=you[field][k];
     if(field==='houseFurniture'&&object(v))player[field][k]={placed:true};
     else if(field==='brewBuckets'&&Array.isArray(v)&&v.length===5&&v.every(n=>typeof n==='number'))player[field][k]=Array.from(v);
     else if(v===null||typeof v==='number')player[field][k]=v;
    }
   }
   const capturedAt=Date.now(),snapshot={version:1,capturedAt,player};
   if(worldBuffs!==undefined){snapshot.worldBuffs=worldBuffs;snapshot.worldTick=worldTick;}
   await GM_setValue(key,snapshot);
   if(socket!==latestSocket)return;
   status='角色配置已读取 / Character configuration captured';
   if(!successShown){
    visible=true;successShown=true;
    hideTimer=setTimeout(()=>{visible=false;document.getElementById('dvi-character-capture')?.remove();},15000);
   }
   paint();
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
     if(!Number.isInteger(frame?.tick)||!Array.isArray(frame.m))return;
     for(const message of frame.m){
      if(message?.t==='welcome'){latestPlayer=undefined;worldBuffs=undefined;}
      if(message?.t==='welcome'||message?.t==='snapshot')latestPlayer=message.you;
      else if(message?.t!=='windows')continue;
      worldTick=frame.tick;
      if(message.t==='windows'||Object.hasOwn(message,'windows'))worldBuffs=readWorldBuffs(message.windows);
      if(!latestPlayer)continue;
      capture(latestPlayer,socket).catch(error=>{if(socket!==latestSocket)return;clearTimeout(hideTimer);visible=true;successShown=false;status=`读取失败 / Capture failed: ${error.message}`;paint();console.error('[DVI character import]',error);});
     }
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
   const reply={source:'dvi-character-script',id:data.id,version:'1.0'};
   try{if(data.action==='probe')reply.ready=true;else reply.snapshot=await GM_getValue(key,null);}catch(error){reply.error=String(error.message||error);}
   document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify(reply)}));
  });
 }
})();
