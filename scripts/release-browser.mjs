import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {pages,json,browserPath} from './release-common.mjs';
import {game,preset} from '../src/model.js';
import {priceDefaults} from '../src/item-prices.js';
import {analyticsMode,configureAnalytics} from './release-analytics.mjs';

export async function verifyBrowser(base,version,directory,{analytics='live'}={}){
 analyticsMode(analytics);
 const executablePath=await browserPath(),browser=await chromium.launch({headless:true,executablePath});
 const results={base,version,browser:browser.version(),executablePath,cases:[],errors:[],combat:[]};
 const context=await browser.newContext();results.analytics=await configureAnalytics(context,analytics);
 await context.route(new URL('/api/usage',base).href,route=>route.fulfill({status:204}));
 const page=await context.newPage();
 page.setDefaultTimeout(20000);
 page.on('pageerror',e=>results.errors.push({type:'pageerror',message:e.message}));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))results.errors.push({type:m.type(),message:m.text()});});
 const state=preset('ranged');state.manual.simulationHours=1;
 const prices=priceDefaults();prices.preferences.autoImport=false;
 await context.addInitScript(({state,prices})=>{localStorage.setItem('dvi-simulator-v1',JSON.stringify({language:'zh',state}));localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));},{state,prices});
 const screenshots=path.join(directory,'screenshots');await fs.mkdir(screenshots,{recursive:true});
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 try{
  await page.goto(new URL('/combat',base).href,{waitUntil:'networkidle'});
  for(const route of ['/release-unknown-page','/release-unknown-page/nested/?unused=1']){
   await page.goto(new URL(route,base).href,{waitUntil:'networkidle'});
   assert.equal(page.url(),new URL('/combat'+new URL(route,base).search,base).href);
   await page.locator('#combat-section').waitFor({state:'visible'});
  }
  await page.evaluate(()=>{history.pushState(null,'','/release-unknown-history?unused=1');window.dispatchEvent(new PopStateEvent('popstate'));});
  assert.equal(page.url(),new URL('/combat?unused=1',base).href);
  await page.locator('#combat-section').waitFor({state:'visible'});
  results.redirects=3;
  for(const width of [1280,390])for(const language of ['zh','en']){
   await page.setViewportSize({width,height:900});await page.selectOption('#language',language);
   for(const id of pages){
    if(['formulas','debug'].includes(id)){await page.goto(new URL('/'+id,base).href,{waitUntil:'networkidle'});await page.selectOption('#language',language);}
    else await page.locator(`#${id}-nav`).click();
    await page.locator(`#${id}-section`).waitFor({state:'visible'});
    if(id==='formulas')await page.locator('.formula-article h1').waitFor();
    await settle();
    assert.equal(new URL(page.url()).pathname,'/'+id,'Navigation did not preserve path');
    assert.equal(await page.locator('.beta').textContent(),version,'UI version mismatch');
    assert.equal(await page.locator('html').getAttribute('lang'),language==='zh'?'zh-CN':'en','Language mismatch');
    const layout=await page.evaluate(id=>{
     const root=document.documentElement,section=document.getElementById(id+'-section');
     const left=section.querySelector('[data-scroll-column$="-config"]'),right=section.querySelector('[data-scroll-column$="-information"]');
     return {width:root.scrollWidth,viewport:innerWidth,split:document.getElementById('app').classList.contains('split-scroll'),bodyHeight:root.scrollHeight,height:innerHeight,leftOverflow:left?getComputedStyle(left).overflowY:null,rightOverflow:right?getComputedStyle(right).overflowY:null,rightBelow:left&&right?right.getBoundingClientRect().top>=left.getBoundingClientRect().bottom-1:null,footerInRight:right?right.contains(document.querySelector('.project-footer')):false};
    },id);
    assert.ok(layout.width<=width,`${id} ${language} ${width}: horizontal overflow`);
    const configured=['combat','gather','craft','enhance','mastery'].includes(id);
    if(configured&&width>740){assert.equal(layout.split,true);assert.equal(layout.leftOverflow,'auto');assert.equal(layout.rightOverflow,'auto');assert.equal(layout.footerInRight,true);assert.ok(layout.bodyHeight<=layout.height+1,'Desktop body should not scroll');}
    else if(configured){assert.notEqual(layout.leftOverflow,'auto');assert.notEqual(layout.rightOverflow,'auto');assert.equal(layout.rightBelow,true,'Mobile columns overlap');}
    else assert.equal(layout.split,false,'Forecast/debug should use normal scrolling');
    if(configured&&width>740){
     const left=page.locator(`[data-scroll-column="${id}-config"]`),right=page.locator(`[data-scroll-column="${id}-information"]`);
     await left.locator('details').evaluateAll(es=>es.forEach(e=>e.open=true));await settle();
     await left.evaluate(e=>e.scrollTop=0);await right.evaluate(e=>e.scrollTop=0);
     const scrollable=await left.evaluate(e=>e.scrollHeight>e.clientHeight);
     await left.focus();
     if(scrollable)await left.evaluate(e=>{e.dataset.releaseKeyEnded='false';e.addEventListener('scrollend',()=>{e.dataset.releaseKeyEnded='true';},{once:true});});
     await page.keyboard.press('PageDown');
     if(scrollable){await page.waitForFunction(id=>document.querySelector(`[data-scroll-column="${id}-config"]`).dataset.releaseKeyEnded==='true',id);await left.evaluate(e=>{delete e.dataset.releaseKeyEnded;});}
     if(scrollable)await page.waitForFunction(id=>document.querySelector(`[data-scroll-column="${id}-config"]`).scrollTop>0,id);
     assert.equal(await right.evaluate(e=>e.scrollTop),0,'Left keyboard scroll affected right column');
     await left.evaluate(e=>e.scrollTop=e.scrollHeight);await left.hover();await page.mouse.wheel(0,1000);await settle();
     assert.equal(await right.evaluate(e=>e.scrollTop),0,'Wheel boundary affected right column');assert.equal(await page.evaluate(()=>scrollY),0,'Wheel boundary moved desktop body');
     await right.hover();await right.focus();
     // Import status can add a line after End. Retry only for changed geometry.
     let atBottom=false;
     for(let attempt=0;attempt<3&&!atBottom;attempt++){
      const size=await right.evaluate(e=>({height:e.scrollHeight,client:e.clientHeight}));
      const needsScroll=await right.evaluate(e=>Math.abs(e.scrollTop-Math.max(0,e.scrollHeight-e.clientHeight))>1);
      if(needsScroll)await right.evaluate(e=>{e.dataset.releaseKeyEnded='false';e.addEventListener('scrollend',()=>{e.dataset.releaseKeyEnded='true';},{once:true});});
      await page.keyboard.press('End');
      if(needsScroll){await page.waitForFunction(id=>document.querySelector(`[data-scroll-column="${id}-information"]`).dataset.releaseKeyEnded==='true',id);await right.evaluate(e=>{delete e.dataset.releaseKeyEnded;});}
      await page.waitForFunction(({id,size})=>{const e=document.querySelector(`[data-scroll-column="${id}-information"]`);return Math.abs(e.scrollTop-Math.max(0,e.scrollHeight-e.clientHeight))<=1||e.scrollHeight!==size.height||e.clientHeight!==size.client;},{id,size});
      atBottom=await right.evaluate(e=>Math.abs(e.scrollTop-Math.max(0,e.scrollHeight-e.clientHeight))<=1);
     }
     assert.ok(atBottom,`${id}: keyboard End did not reach the column bottom`);
     assert.ok(await page.locator('.project-footer').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight+1),'Footer is not reachable');
     // Switching away/back and redrawing language must retain column positions.
     const requestedTop=await right.evaluate(e=>{
      const target=Math.min(120,(e.scrollHeight-e.clientHeight)/2);
      e.dataset.releaseScrollEnded=String(Math.abs(e.scrollTop-target)<=1);
      e.addEventListener('scrollend',()=>{e.dataset.releaseScrollEnded='true';},{once:true});
      e.scrollTop=target;return target;
     });
     // Wait for the native input animation to end, not a transient target crossing.
     await page.waitForFunction(({id,target})=>{const e=document.querySelector(`[data-scroll-column="${id}-information"]`);return e.dataset.releaseScrollEnded==='true'&&Math.abs(e.scrollTop-target)<=1;},{id,target:requestedTop});
     await right.evaluate(e=>{delete e.dataset.releaseScrollEnded;});await settle();
     const before=await right.evaluate(e=>e.scrollTop);const other=id==='combat'?'enhance':'combat';
     await page.locator(`#${other}-nav`).click();await page.locator(`#${id}-nav`).click();await settle();
     assert.ok(Math.abs(await right.evaluate(e=>e.scrollTop)-before)<=1,`Page switch lost scroll position: ${id}, before ${before}, after ${await right.evaluate(e=>e.scrollTop)}`);
     await page.selectOption('#language',language==='zh'?'en':'zh');await page.selectOption('#language',language);await settle();
     assert.ok(Math.abs(await right.evaluate(e=>e.scrollTop)-before)<=1,'Language redraw lost scroll position');
    }
    const screenshot=`${id}-${language}-${width}.png`;await page.screenshot({path:path.join(screenshots,screenshot),fullPage:true});
    results.cases.push({page:id,language,width,status:'passed',layout,screenshot:'screenshots/'+screenshot});
   }
   await page.locator('#combat-nav').click();
   await page.waitForFunction(count=>document.querySelectorAll('#rows tr[data-enemy]').length===count&&document.querySelector('#simulation-status').hidden&&!document.querySelector('#rows .pending'),game.monsters.length,{timeout:180000});
   const failed=await page.locator('#rows').innerText();assert.ok(!/Simulation failed|模拟失败/.test(failed),'Combat row failed');
   assert.equal(await page.locator('#rows tr[data-enemy]').count(),game.monsters.length);
   results.combat.push({language,width,targets:game.monsters.length,status:'passed'});
  }
  assert.equal(results.cases.length,pages.length*4);assert.deepEqual(results.errors,[],'Browser warnings/errors');
  return {cases:results.cases.length,combatTargets:game.monsters.length,browser:results.browser,executablePath,analytics:results.analytics};
 }catch(error){results.failure=error.message;results.failureLayout=await page.evaluate(()=>({active:document.activeElement?.outerHTML.slice(0,300),columns:[...document.querySelectorAll('[data-scroll-column]')].filter(e=>!e.closest('[hidden]')).map(e=>({column:e.dataset.scrollColumn,top:e.scrollTop,height:e.scrollHeight,client:e.clientHeight}))})).catch(()=>null);await page.screenshot({path:path.join(directory,'browser-failure.png'),fullPage:true}).catch(e=>results.errors.push({type:'screenshot',message:e.message}));throw error;}
 finally{await json(path.join(directory,'browser.json'),results);await browser.close();}
}
