import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath,json} from '../scripts/release-common.mjs';
import {game,preset} from '../src/model.js';

const directory=path.resolve('.test-artifacts/formulas');
await fs.mkdir(directory,{recursive:true});
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const result={cases:[],errors:[]};
let browser;
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw new Error(`Server exited: ${code}`);})]);
 const base=`http://127.0.0.1:${port}`;
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const state=preset('ranged');state.manual.enemySelection=`monster-${game.monsters[0].id}`;state.manual.simulationHours=1;
 await context.addInitScript(state=>{
  localStorage.setItem('dvi-simulator-v1',JSON.stringify({language:'zh',state}));
  window.combatWorkerCount=0;
  const OriginalWorker=Worker;
  window.Worker=class extends OriginalWorker{
   constructor(url,options){super(url,options);if(String(url).includes('/simulation-worker.js'))window.combatWorkerCount++;}
  };
 },state);
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>result.errors.push(error.message));
 let requests=0,fail=true;
 await context.route('**/src/content/formulas/combat.zh.md',route=>{
  requests++;
  return fail?route.fulfill({status:503,body:'Unavailable'}):route.continue();
 });
 await page.goto(base+'/combat');
 await page.waitForFunction(()=>document.querySelector('#simulation-status').hidden);
 assert.equal(requests,0);
 assert.equal(await page.locator('#formulas-nav').count(),0);
 await page.goto(base+'/formulas');
 await page.waitForFunction(()=>document.querySelector('#simulation-status').hidden);
 const workerCount=await page.evaluate(()=>window.combatWorkerCount);
 await page.locator('.formula-status[role="alert"]').waitFor();
 assert.match(await page.locator('.formula-error').innerText(),/HTTP 503/);
 fail=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();
 await page.locator('.formula-article h1').waitFor();
 assert.equal(requests,2);result.cases.push('lazy loading, HTTP failure and retry');
 assert.equal(await page.locator('.formula-toc a').count(),await page.locator('.formula-article h2,.formula-article h3').count());
 const anchors=page.locator('.formula-toc a');
 await anchors.nth(1).click();const firstHash=new URL(page.url()).hash;
 await anchors.nth(4).click();const secondHash=new URL(page.url()).hash;
 assert.notEqual(firstHash,secondHash);
 await page.goBack();assert.equal(new URL(page.url()).hash,firstHash);
 await page.goForward();assert.equal(new URL(page.url()).hash,secondHash);
 assert.equal(await page.evaluate(()=>document.activeElement.id),secondHash.slice(1));
 result.cases.push('generated directory, chapter focus and history');
 await page.selectOption('#language','en');await page.locator('.formula-article h1').waitFor();
 assert.equal(await page.locator('#formulas-nav').count(),0);
 assert.equal(await page.getByRole('region',{name:'公式',exact:true}).count(),1);
 result.cases.push('formula menu hidden in Chinese and English, accessible page name retained');
 assert.equal(await page.locator('.formula-article h1').innerText(),'战斗公式');
 assert.equal(await page.locator('#formulas-section').getAttribute('lang'),'zh-CN');
 assert.equal(new URL(page.url()).hash,secondHash);assert.equal(requests,2);
 await page.locator('#combat-nav').click();await page.goBack();await page.locator('.formula-article h1').waitFor();
 assert.equal(requests,2);assert.equal(await page.evaluate(()=>window.combatWorkerCount),workerCount);
 result.cases.push('Chinese content under English UI, cache and simulation preservation');
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  if(width===390){await page.reload();await page.locator('.formula-article h1').waitFor();assert.equal(await page.locator('#formula-directory').evaluate(element=>element.open),false);}
  for(const language of ['zh','en']){
   await page.selectOption('#language',language);await page.locator('.formula-article h1').waitFor();
   assert.equal(await page.locator('#formulas-nav').count(),0);
  }
  await page.evaluate(()=>scrollTo(0,0));
  const layout=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,split:document.getElementById('app').classList.contains('split-scroll'),tables:[...document.querySelectorAll('.formula-table')].every(element=>getComputedStyle(element).overflowX==='auto'),formulas:[...document.querySelectorAll('.formula-article pre')].every(element=>element.tabIndex===0&&getComputedStyle(element).overflowX==='auto')}));
  assert.ok(layout.width<=width,JSON.stringify(layout));assert.equal(layout.split,false);assert.equal(layout.tables,true);assert.equal(layout.formulas,true);
  await page.screenshot({path:path.join(directory,`formulas-${width}.png`),fullPage:false});
  await page.locator('.formula-article h3').first().evaluate(element=>element.scrollIntoView({block:'start'}));
  await page.screenshot({path:path.join(directory,`formulas-content-${width}.png`),fullPage:false});
  result.cases.push(`reading layout ${width}px`);
 }
 await page.goto(base+'/formulas/#formula-2');await page.locator('.formula-article h1').waitFor();
 await page.waitForFunction(()=>document.activeElement.id==='formula-2');
 await page.reload();await page.waitForFunction(()=>document.activeElement.id==='formula-2');
 result.cases.push('direct trailing-slash route, initial anchor and refresh');
 for(const resource of ['/docs/status.md','/reports/combat-formulas-draft-2026-10-15.md','/src/notes.md'])assert.equal((await context.request.get(base+resource)).status(),403);
 for(const resource of ['/src/content/formulas/combat.zh.md','/vendor/markdown-it/markdown-it.esm.min.mjs','/vendor/markdown-it/LICENSE.txt'])assert.equal((await context.request.get(base+resource)).status(),200);
 result.cases.push('public content and renderer, internal documents blocked');
 await context.close();
 const delayed=await browser.newContext();
 await delayed.addInitScript(state=>localStorage.setItem('dvi-simulator-v1',JSON.stringify({language:'zh',state})),state);
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 await delayed.route('**/src/content/formulas/combat.zh.md',async route=>{await gate;await route.continue();});
 const other=await delayed.newPage();other.on('pageerror',error=>result.errors.push(error.message));
 await other.goto(base+'/formulas');await other.locator('.formula-status').waitFor();
 await other.locator('#combat-nav').click();release();
 await other.waitForResponse(response=>response.url().endsWith('/combat.zh.md'));
 assert.equal(await other.locator('#formulas-section').isVisible(),false);
 await other.goBack();await other.locator('.formula-article h1').waitFor();
 result.cases.push('late content response cannot replace the active page');
 assert.deepEqual(result.errors,[]);result.status='passed';
 console.log(JSON.stringify({status:result.status,cases:result.cases.length,directory}));
}catch(error){result.status='failed';result.failure=error.stack;throw error;}
finally{if(browser)await browser.close();server.kill();await json(path.join(directory,'browser.json'),result);}
