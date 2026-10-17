import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {game,preset} from '../src/model.js';
import {createScenario} from '../src/simulation.js';
import {craftingSkills,craftingSlots} from '../src/crafting-model.js';
import {gatheringSkills,gatheringSlots} from '../src/gathering-model.js';

const args={};
for(let i=2;i<process.argv.length;i+=2){
 const key=process.argv[i],value=process.argv[i+1];
 assert.ok(['--url','--out'].includes(key)&&value&&!Object.hasOwn(args,key),`Invalid argument: ${key}`);args[key]=value;
}
const directory=path.resolve(args['--out']??'.test-artifacts/collection-plan');await fs.mkdir(directory,{recursive:true});
let base=args['--url'],server,browser;
if(base){const url=new URL(base);assert.ok(['http:','https:'].includes(url.protocol),'Expected HTTP(S) URL');base=url.origin;}
const results={cases:[],errors:[]};
try{
 if(!base){
  const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited: ${code}`);})]);
  base=`http://127.0.0.1:${port}`;
 }
 results.base=base;
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});const context=await browser.newContext({viewport:{width:1440,height:960}});
 const build=preset('ranged');build.manual.enemySelection=`monster-${game.monsters[0].id}`;build.manual.simulationHours=1;
 await context.addInitScript(build=>{if(!localStorage.getItem('dvi-simulator-v1'))localStorage.setItem('dvi-simulator-v1',JSON.stringify({language:'zh',state:build}));window.collectionWorkers=0;const OriginalWorker=Worker;window.Worker=class extends OriginalWorker{constructor(url,options){super(url,options);if(String(url).includes('collection-worker.js'))window.collectionWorkers++;}};},build);
 const {player}=createScenario({});for(const skill of [...craftingSkills,...gatheringSkills])player.skills[skill]=game.levelXp(1);for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;
 Object.assign(player,{house:{},houseFurniture:{},masteries:{},perks:{},ironman:false,homeBank:null});
 const snapshot=JSON.parse(JSON.stringify({version:2,capturedAt:Date.now(),worldBuffsVersion:1,worldTick:player.lastTick,worldBuffs:[],player,guild:null}));
 await context.addInitScript(snapshot=>{
  window.planProgress=9;window.planReads=0;window.planHold=false;window.planFail=false;window.planResponses=[];const seen=new Set();
  document.addEventListener('dvi-character-request',event=>{
   const request=JSON.parse(event.detail);if(request.action!=='read'||seen.has(request.id))return;seen.add(request.id);window.planReads++;
   const response={source:'dvi-character-script',version:'2.4',id:request.id,...(window.planFail?{error:'failed'}:{snapshot:{...snapshot,capturedAt:Date.now(),player:{...snapshot.player,collections:{40:window.planProgress}}}})};
   const detail=JSON.stringify(response);if(window.planHold)window.planResponses.push(detail);else document.dispatchEvent(new CustomEvent('dvi-character-response',{detail}));
  });
 },snapshot);
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>results.errors.push(error.message));await page.clock.install();
 await page.goto(new URL('/collection',base).href);await page.locator('#collection-section').waitFor({state:'visible'});
 const until=async expression=>{for(let i=0;i<200;i++){if(await page.evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Condition did not become true: '+expression);};
 const readState=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')));
 const button=target=>page.locator(`[data-collection-plan="40:41:${target}"]`);
 const quantity=()=>page.locator('[data-plan-material="1"] [data-plan-quantity]').innerText();
 assert.equal(await page.locator('#collection-auto-import').isChecked(),false);assert.equal(await page.locator('#collection-auto-status').isVisible(),false);assert.equal(await page.evaluate(()=>window.planReads),0);
 await page.locator('#collection-import').click();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===9);
 await page.locator('#collection-search').fill('青铜锭');await page.locator('#collection-tier').selectOption('0');
 await button(10).click();assert.equal(await quantity(),'1');await button(100).click();assert.equal(await quantity(),'91');await button(1000).click();assert.equal(await quantity(),'991');
 assert.equal(await page.locator('[data-plan-item]').count(),1);assert.equal(await button(10).isDisabled(),true);assert.equal(await button(100).isDisabled(),true);assert.match(await page.locator('#collection-plan-summary').innerText(),/14/);assert.equal(await page.locator('[data-collection-key="40:41:1000"]').evaluate(e=>e.open),false);
 assert.equal(await page.locator('.collection-information').getByText('纯动作估算',{exact:true}).count(),0);
 assert.equal(await page.locator('#collection-plan').getByText('纯动作估算',{exact:true}).count(),0);
 assert.equal(await button(1000).evaluate(e=>{const cell=e.parentElement;return cell.classList.contains('collection-plan-action')&&cell===cell.parentElement.firstElementChild&&cell.nextElementSibling.classList.contains('collection-item');}),true);
 assert.equal(await page.locator('.collection-plan-selections input,.collection-plan-selections select,.collection-plan-selections button').count(),0);
 assert.deepEqual(await page.locator('.collection-plan-selections th').allTextContents(),['物品','数量','完成进度']);
 assert.deepEqual(await page.locator('[data-plan-item="40"] td').allTextContents(),['青铜锭 · 普通','1,000','9 / 1,000 · 0.9%']);
 assert.equal(await page.locator('[data-plan-material="1"]').getByText('缺报价',{exact:false}).count()>0,true);
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const id of [1,2,1001,1002])prices.prices[id]={source:'manual',price:2};updatePrices(prices);});assert.match(await page.locator('#collection-plan-summary').innerText(),/3,964/);
 await page.locator('#collection-search').fill('nothing matches');assert.equal(await page.locator('.collection-card').count(),0);assert.equal(await quantity(),'991');
 await page.locator('#collection-points-min').fill('-1');assert.equal(await quantity(),'991');await page.locator('#collection-points-min').fill('');await page.locator('#collection-search').fill('青铜锭');
 await button(1000).click();await button(100).click();assert.equal(await quantity(),'91');await button(100).click();await button(10).click();assert.equal(await quantity(),'1');await button(10).click();assert.equal(await page.locator('[data-plan-item]').count(),0);
 await button(1000).click();await page.locator('#collection-tier').selectOption('1');await page.locator('[data-collection-plan="1040:41:10"]').click();assert.equal(await page.locator('[data-plan-item]').count(),2);assert.equal(await page.locator('[data-plan-material="1001"] [data-plan-quantity]').innerText(),'10');assert.equal(await quantity(),'991');
 results.cases.push('highest-target deduplication, included lower milestones, read-only item/quantity/progress table and list reselection, quality separation, material prices and filter-independent selections');
 for(const [language,width]of [['zh',1440],['zh',390],['en',1440],['en',390]]){await page.setViewportSize({width,height:960});await page.selectOption('#language',language);assert.equal(await page.locator('[data-plan-item]').count(),2);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(directory,`plan-${language}-${width}.png`),fullPage:true});}
 await page.selectOption('#language','zh');await page.reload();await until(()=>document.querySelectorAll('[data-plan-item]').length===2);assert.equal(await quantity(),'991');assert.equal(await page.locator('#collection-auto-import').isChecked(),false);
 await page.locator('#collection-tier').selectOption('1');await page.locator('[data-collection-plan="1040:41:10"]').click();await page.locator('#collection-reset').click();assert.equal(await page.locator('[data-plan-item]').count(),1);assert.match(await page.locator('#collection-plan').innerText(),/未完整计算/);assert.equal(await page.locator('[data-plan-progress]').innerText(),'—');
 await page.locator('#collection-import').click();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===9);assert.equal(await quantity(),'991');
 await page.evaluate(()=>window.planProgress=1000);await page.locator('#collection-import').click();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===1000);assert.equal(await page.locator('[data-plan-item]').count(),1);assert.match(await page.locator('#collection-plan-summary').innerText(),/已完成 1/);assert.equal(await page.locator('[data-plan-progress]').innerText(),'1,000 / 1,000 · 100% · 已完成');assert.equal(await page.locator('[data-plan-material]').count(),0);
 await page.evaluate(()=>window.planProgress=9);await page.locator('#collection-import').click();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===9);
 results.cases.push('plan save/reload, config reset retention with unavailable state, imports recompute remaining needs and retain completed selections');
 await page.clock.pauseAt(new Date(Date.now()+1000));const initialReads=await page.evaluate(()=>window.planReads);
 await page.locator('#collection-auto-import').check();await until(()=>document.querySelector('#collection-import-status').textContent.includes('已导入'));assert.equal(await page.evaluate(()=>window.planReads),initialReads+1);
 const baseline=await page.evaluate(()=>window.planReads);await page.clock.runFor(59000);assert.equal(await page.evaluate(()=>window.planReads),baseline);await page.clock.runFor(1000);await until(()=>!document.querySelector('#collection-import').disabled);assert.equal(await page.evaluate(()=>window.planReads),baseline+1);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.evaluate(()=>window.planReads),baseline+1);await page.clock.runFor(1100);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await until(()=>!document.querySelector('#collection-import').disabled);assert.equal(await page.evaluate(()=>window.planReads),baseline+2);
 await page.selectOption('#language','en');await page.selectOption('#language','zh');assert.equal(await page.evaluate(()=>window.planReads),baseline+2);
 await page.locator('#mastery-nav').click();await page.clock.runFor(60000);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.evaluate(()=>window.planReads),baseline+2);await page.goBack();await until(()=>window.planReads>0&&!document.querySelector('#collection-import').disabled);assert.equal(await page.evaluate(()=>window.planReads),baseline+3);
 results.cases.push('auto import defaults off, immediate enable, exact 60-second schedule, focus/timer coalescing, redraw stability, section pause and return resume');
 await page.clock.runFor(1100);await page.evaluate(()=>{window.planHold=true;window.planProgress=99;window.dispatchEvent(new Event('focus'));});const heldCount=await page.evaluate(()=>window.planReads);assert.equal(await page.locator('#collection-import').isDisabled(),true);
 await page.clock.runFor(1100);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.evaluate(()=>window.planReads),heldCount);await page.locator('#collection-auto-import').uncheck();await page.evaluate(()=>{const detail=window.planResponses.shift();document.dispatchEvent(new CustomEvent('dvi-character-response',{detail}));window.planHold=false;});await until(()=>!document.querySelector('#collection-import').disabled);assert.equal((await readState()).counts[40],9);
 await page.clock.runFor(60000);assert.equal(await page.evaluate(()=>window.planReads),heldCount);
 await page.locator('#collection-auto-import').check();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]===99);assert.equal(await quantity(),'901');
 await page.clock.runFor(1100);await page.evaluate(()=>{window.planHold=true;window.planProgress=1000;window.dispatchEvent(new Event('focus'));});await page.locator('#collection-levels').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.levels.smithing"]').fill('5');await page.locator('[data-collection-path="config.levels.smithing"]').press('Tab');await page.evaluate(()=>{const detail=window.planResponses.shift();document.dispatchEvent(new CustomEvent('dvi-character-response',{detail}));window.planHold=false;});await until(()=>!document.querySelector('#collection-import').disabled);assert.equal((await readState()).counts[40],99);assert.equal((await readState()).config.levels.smithing,5);
 const beforeDraft=await page.evaluate(()=>window.planReads);await page.locator('[data-collection-path="config.levels.smithing"]').fill('7');await page.clock.runFor(1100);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.evaluate(()=>window.planReads),beforeDraft);await page.locator('[data-collection-path="config.levels.smithing"]').press('Tab');
 results.cases.push('automatic reads never overlap; disabling drops held responses, edits invalidate stale captures and uncommitted inputs defer auto-import');
 await page.clock.runFor(1100);await page.evaluate(()=>{window.planFail=true;window.dispatchEvent(new Event('focus'));});await until(()=>document.querySelector('#collection-import-status').textContent.includes('读取失败'));const failed=await page.evaluate(()=>window.planReads);assert.equal((await readState()).counts[40],99);assert.equal(await page.locator('#collection-auto-import').isChecked(),true);
 await page.clock.runFor(60000);await until(()=>!document.querySelector('#collection-import').disabled);assert.equal(await page.evaluate(()=>window.planReads),failed+1);await page.evaluate(()=>window.planFail=false);await page.clock.runFor(60000);await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]===1000);assert.match(await page.locator('#collection-plan-summary').innerText(),/已完成 1/);assert.equal(await page.locator('[data-plan-progress]').innerText(),'1,000 / 1,000 · 100% · 已完成');
 await page.reload();await until(()=>window.planReads===1&&!document.querySelector('#collection-import').disabled);assert.equal(await page.locator('#collection-auto-import').isChecked(),true);assert.equal((await readState()).counts[40],9);assert.equal(await quantity(),'991');await page.locator('#collection-auto-import').uncheck();
 results.cases.push('failed captures preserve role/plan, keep auto enabled and retry; persisted opt-in resumes one immediate import after refresh');
 await page.locator('[data-plan-clear]').click();assert.equal(await page.locator('[data-plan-item]').count(),0);assert.equal((await readState()).counts[40],9);
 await context.close();
 const broken=await browser.newContext();await broken.addInitScript(()=>{localStorage.setItem('dvi-collection-plan-v1','bad-json');localStorage.setItem('dvi-collection-auto-import-v1','bad-json');});const badPage=await broken.newPage();await badPage.goto(new URL('/collection',base).href);assert.match(await badPage.locator('#collection-plan').innerText(),/could not be read|无法读取/);assert.equal(await badPage.locator('#collection-auto-status').isVisible(),true);assert.match(await badPage.locator('#collection-auto-status').innerText(),/could not be read|无法读取/);assert.equal(await badPage.locator('#collection-auto-import').isChecked(),false);assert.equal(await badPage.evaluate(()=>localStorage.getItem('dvi-collection-plan-v1')),'bad-json');await badPage.locator('[data-plan-clear]').click();assert.equal(await badPage.locator('#collection-plan [role="alert"]').count(),0);await broken.close();
 results.cases.push('clear plan preserves character; invalid plan/auto settings are visible and kept until explicit repair');
 assert.deepEqual(results.errors,[]);
}catch(error){results.failure=String(error.stack??error);throw error;}
finally{await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(results,null,2)+'\n');await browser?.close();server?.kill();}
console.log(JSON.stringify(results));
