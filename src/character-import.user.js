// ==UserScript==
// @name         Deep Vein Idle · 角色配置导入 / Character import
// @name:en      Deep Vein Idle · Character import
// @name:zh-cn   Deep Vein Idle · 角色配置导入
// @namespace    https://dvi-lab.pages.dev/
// @version      2.5.2
// @description  读取角色配置与市场报价供实验室导入；不发送游戏指令。
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
 const key='dvi-character-snapshot-v2',marketKey='dvi-market-quotes-v1';
 if(location.origin==='https://deepveinidle.com'){
  const page=unsafeWindow,NativeSocket=page.WebSocket;let latestSocket,latestPlayer,guild,worldBuffs,worldTick,serial=Promise.resolve(),visible=true,hideTimer=null,successShown=false,status='等待游戏数据 / Waiting for game data';
  let market={version:1,quotes:{},invalid:0},marketSerial=Promise.resolve(),marketSuccessShown=false;
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  function paint(){mount();const el=document.getElementById('dvi-character-capture');if(el&&el.textContent!==status)el.textContent=status;}
  function captured(kind){
   if(kind==='market'?marketSuccessShown:successShown)return;
   if(kind==='market')marketSuccessShown=true;else successShown=true;
   status=kind==='market'?'市场报价已读取 / Market prices captured':'角色配置已读取 / Character captured';
   clearTimeout(hideTimer);visible=true;hideTimer=setTimeout(()=>{visible=false;document.getElementById('dvi-character-capture')?.remove();},5000);paint();
  }
  function clonePlayer(player){
   // Capture the complete own-role object; transport and account credentials
   // are never included. Defensive filtering also covers unexpected auth keys.
   return JSON.parse(JSON.stringify(player,(key,value)=>/^(?:password|token|auth|authorization|cookie|email|chat)$/i.test(key)?undefined:value));
  }
  function failure(error,socket){if(socket!==latestSocket)return;clearTimeout(hideTimer);visible=true;successShown=false;status=`读取失败 / Capture failed: ${error.message}`;paint();console.error('[DVI character import]',error);}
  function capture(you,socket){
   if(!object(you)||!object(you.skills)||!object(you.equipment)||!Number.isSafeInteger(you.lastTick))throw new Error('角色数据结构不兼容 / Incompatible character data');
   const snapshot={version:2,capturedAt:Date.now(),player:clonePlayer(you),guild,worldBuffs,worldTick};
   const write=async()=>{
    if(socket!==latestSocket)return;
    await GM_setValue(key,snapshot);
    if(socket!==latestSocket)return;
    captured('character');
   };
   serial=serial.then(write).catch(error=>failure(error,socket));
   return serial;
  }
  function captureMarket(messages,socket){
   let changed=false,hasQuote=false;
   const at=Date.now();
   const sideValue=v=>v===null||typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
   const add=(top)=>{
    if(!object(top)||!Number.isSafeInteger(top.itemId)||top.itemId<=0){market.invalid++;changed=true;return;}
    const q=market.quotes[top.itemId]??={};
    for(const side of ['ask','bid'])if(Object.hasOwn(top,side)){
     const valid=sideValue(top[side]);q[side]=valid?{value:top[side],capturedAt:at}:{invalid:true,capturedAt:at};changed=true;if(valid)hasQuote=true;
    }
   };
   for(const m of messages){
    if(m?.t==='marketBook')add(m.top);
    if(m?.t==='marketBooks'){if(Array.isArray(m.tops))m.tops.forEach(add);else{market.invalid++;changed=true;}}
    if(m?.t==='marketDepth'){
     const top={itemId:m.itemId};
     for(const [side,field]of [['ask','asks'],['bid','bids']])if(Object.hasOwn(m,field)){
      const rows=m[field];
      top[side]=Array.isArray(rows)&&rows.every(r=>object(r)&&typeof r.price==='number'&&Number.isSafeInteger(r.price)&&r.price>0)?rows.length?(side==='ask'?Math.min(...rows.map(r=>r.price)):Math.max(...rows.map(r=>r.price))):null:undefined;
     }
     add(top);
    }
   }
   if(changed)writeMarket(socket,hasQuote);
  }
  function writeMarket(socket,notify=false){
   const snapshot=JSON.parse(JSON.stringify(market));
   marketSerial=marketSerial.then(async()=>{if(socket!==latestSocket)return;await GM_setValue(marketKey,snapshot);if(socket===latestSocket&&notify)captured('market');}).catch(error=>{
    if(socket!==latestSocket)return;clearTimeout(hideTimer);marketSuccessShown=false;status='市场报价保存失败 / Market prices could not be saved';visible=true;paint();console.error('[DVI market import]',error);
   });
  }
  function frameReceived(frame,socket){
   if(socket!==latestSocket||!Number.isInteger(frame?.tick)||!Array.isArray(frame.m))return;
   if(frame.m.some(m=>m?.t==='welcome')){market={version:1,quotes:{},invalid:0};writeMarket(socket);}
   captureMarket(frame.m,socket);
   for(const message of frame.m){
    if(message?.t==='welcome'){latestPlayer=undefined;guild=undefined;worldBuffs=undefined;}
    if(message?.t==='welcome'||message?.t==='guild'){
     const info=message.t==='welcome'?message.guild:message.info;
     guild=info==null?null:{name:info.name,tag:info.tag};
    }
    if(message?.t==='welcome'||message?.t==='snapshot'){
     latestPlayer=message.you;
    }else if(message?.t!=='windows'&&message?.t!=='guild')continue;
    worldTick=frame.tick;
    if(Object.hasOwn(message,'windows'))worldBuffs=Array.isArray(message.windows)?message.windows:undefined;
    if(latestPlayer)try{capture(latestPlayer,socket);}catch(error){failure(error,socket);}
   }
  }
  page.WebSocket=new Proxy(NativeSocket,{construct(target,args){
   const socket=Reflect.construct(target,args);
   const url=new URL(String(args[0]),location.href);
   if(url.host===location.host&&url.pathname==='/ws'){
    latestSocket=socket;marketSuccessShown=false;market={version:1,quotes:{},invalid:0};writeMarket(socket);latestPlayer=undefined;guild=undefined;worldBuffs=undefined;worldTick=undefined;clearTimeout(hideTimer);visible=true;successShown=false;
    status='等待游戏数据 / Waiting for game data';paint();
    socket.addEventListener('message',event=>{
     if(socket!==latestSocket||typeof event.data!=='string')return;
     let frame;try{frame=JSON.parse(event.data);}catch{return;}
     frameReceived(frame,socket);

    });
   }
   return socket;
  }});
  function mount(){if(!visible||!document.documentElement||document.getElementById('dvi-character-capture'))return;const el=document.createElement('div');el.id='dvi-character-capture';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99999;max-width:calc(100vw - 32px);padding:6px 10px;border:1px solid #756440;border-radius:6px;background:#171c24;color:#e6d6ae;font:12px sans-serif;white-space:pre-line;pointer-events:none';el.textContent=status;document.documentElement.append(el);}
  new MutationObserver(()=>{if(!document.getElementById('dvi-character-capture'))mount();}).observe(document,{childList:true,subtree:true});
  mount();
 }else{
  document.addEventListener('dvi-market-request',async event=>{
   if(typeof event.detail!=='string')return;let data;try{data=JSON.parse(event.detail);}catch{return;}
   if(data?.source!=='dvi-simulator'||!['probe','read'].includes(data.action)||typeof data.id!=='string'||data.id.length>100)return;
   const reply={source:'dvi-market-script',id:data.id,version:'1.0'};
   try{if(data.action==='probe')reply.ready=true;else reply.snapshot=await GM_getValue(marketKey,null);}catch{reply.error='marketCaptureFailed';}
   document.dispatchEvent(new CustomEvent('dvi-market-response',{detail:JSON.stringify(reply)}));
  });
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
