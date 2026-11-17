import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {craftingDefaults,craftingJobs} from '../src/crafting-model.js';
import {priceDefaults} from '../src/item-prices.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/crafting-filters/demand');await fs.mkdir(directory,{recursive:true});
const target=process.argv[3]?.replace(/\/$/,'')??null;let server,port;
if(!target){
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
}
const base=target??`http://127.0.0.1:${port}`;
const results={target:target??'local',cases:[],errors:[]};let browser;
try{
 if(server)await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Server stopped');})]);
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>results.errors.push(e.message));
 const state=craftingDefaults();state.skill='smithing';state.simulationHours=1;for(const k in state.levels)state.levels[k]=110;
 const prices=priceDefaults();prices.preferences.autoImport=false;
 await context.addInitScript(({state,prices})=>{
  localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));
  localStorage.setItem('dvi-crafting-config-v1',JSON.stringify({version:1,build:state}));
  window.filterRuns=[];const OriginalWorker=Worker;
  window.Worker=class extends OriginalWorker{
   constructor(url,options){super(url,options);if(String(url).includes('crafting-worker')){this.run={results:[],worker:this};window.filterRuns.push(this.run);this.addEventListener('message',({data})=>{if(data.result)this.run.results.push(data);if(data.done)this.run.done=true;});}}
   postMessage(data,...rest){if(this.run){this.run.input=structuredClone(data);if(window.holdFilters)return;}return super.postMessage(data,...rest);}
   terminate(){if(this.run)this.run.terminated=true;return super.terminate();}
  };
 },{state,prices});
 await page.goto(`${base}/craft`);
 const settle=async()=>{await page.waitForTimeout(250);await page.waitForFunction(()=>document.querySelector('.craft-progress')?.classList.contains('is-idle'));};
 const runCount=()=>page.evaluate(()=>window.filterRuns.length);
 const last=()=>page.evaluate(()=>window.filterRuns.at(-1).input);
 const rateKeys=input=>input.plans.filter(p=>p.mode==='rate').map(p=>p.key);
 const query=page.locator('#craft-search'),group=page.locator('#craft-group');
 await settle();const initial=await last();
 assert.deepEqual(rateKeys(initial).sort(),craftingJobs.filter(j=>j.skill==='smithing'&&j.levelReq<=110).map(j=>`${j.id}:0`).sort());
 assert.ok(initial.plans.every(p=>p.mode==='rate'));results.cases.push('initial rates only normal quality; no order tasks');
 let count=await runCount();await query.fill('Bronze bar');await settle();assert.equal(await runCount(),count);
 await query.fill('no-such-item');await settle();assert.equal(await runCount(),count);await query.fill('Bronze bar');
 await group.selectOption('Bars');await settle();assert.equal(await runCount(),count);
 await page.locator('[data-craft-rarity="2"]').click();await settle();const rare=await last();
 assert.deepEqual(rateKeys(rare).sort(),craftingJobs.filter(j=>j.skill==='smithing'&&j.group==='Bars').map(j=>`${j.id}:2`).sort());assert.equal(rare.seed,initial.seed);assert.equal(rare.now,initial.now);
 const comparison=await page.evaluate(async()=>{const input=window.filterRuns.at(-1).input,actual=window.filterRuns.at(-1).results.find(r=>r.mode==='rate'&&r.result.key==='41:2').result;const {simulateCraftingWindow}=await import('/src/crafting-simulation.js'),{craftingJobs}=await import('/src/crafting-model.js');return {actual,expected:simulateCraftingWindow(input.state,craftingJobs.find(j=>j.id===41),2,{seed:input.seed,now:input.now})};});assert.deepEqual(comparison.actual,comparison.expected);
 count=await runCount();await page.locator('[data-craft-rarity="2"]').click();await settle();await page.locator('[data-craft-rarity="2"]').click();await settle();assert.equal(await runCount(),count);
 results.cases.push('category and rarity intersect; search never change tasks; exact engine result and fixed seed/time; cache survives toggles');
 await group.selectOption('Upgrades');await settle();assert.deepEqual(rateKeys(await last()).sort(),craftingJobs.filter(j=>j.skill==='smithing'&&j.group==='Upgrades').map(j=>`${j.id}:2`).sort());
 count=await runCount();await query.fill('Colossus blade');await settle();await query.fill('巨像之剑');await settle();assert.equal(await runCount(),count);assert.equal(await page.locator('.craft-table tbody tr').count(),2);
 await page.locator('[data-craft-rarity="0"]').click();await page.locator('[data-craft-rarity="2"]').click();await settle();assert.equal(await runCount(),count);
 results.cases.push('new category only fills missing rarity; English/Chinese aliases only filter rows; zero selected tiers send no rate work');
 await page.evaluate(()=>window.holdFilters=true);await page.locator('[data-craft-rarity="4"]').click();await page.waitForFunction(()=>window.filterRuns.at(-1).input.plans.some(p=>p.key==='upgrade-271:4'));
 const held=await runCount();await query.fill('no-such-item');await page.waitForTimeout(250);assert.equal(await runCount(),held);assert.equal(await page.locator('.craft-table .empty-results').count(),1);
 await group.selectOption('Bars');await page.waitForFunction(()=>window.filterRuns.at(-1).input.plans.some(p=>p.key==='41:4'));
 await page.evaluate(()=>{const old=window.filterRuns.at(-2);old.worker.onmessage({data:{error:'stale-filter-error',done:true}});});assert.doesNotMatch(await page.locator('.craft-progress').textContent(),/stale-filter-error/);
 await page.evaluate(()=>{window.holdFilters=false;const run=window.filterRuns.at(-1);run.worker.postMessage(run.input);});await settle();
 count=await runCount();await query.evaluate(el=>{window.filterSearchNode=el;el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value='Bronze bar';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));});await page.waitForTimeout(250);assert.equal(await runCount(),count);
 await query.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await settle();assert.equal(await runCount(),count);assert.ok(await page.evaluate(()=>window.filterSearchNode===document.getElementById('craft-search')));
 results.cases.push('search does not cancel in-flight simulation; category cancellation rejects stale Worker; IME never starts work and input node survives');
 await query.fill('no-such-item');await page.locator('[data-craft-rarity="4"]').click();const beforeEmpty=await runCount();await page.locator('#craft-rerun').click();await settle();assert.equal(await runCount(),beforeEmpty);
 results.cases.push('rerun with no selected quality sends no work');
 await query.fill('');await group.selectOption('');await page.locator('[data-craft-rarity="0"]').click();await settle();
 for(const width of [1440,390])for(const language of ['zh','en']){
  await page.setViewportSize({width,height:1000});await page.selectOption('#language',language);await settle();
  assert.ok(await group.evaluate(el=>{const search=el.previousElementSibling,a=search.getBoundingClientRect(),b=el.getBoundingClientRect();return search.classList.contains('search-wrap')&&b.left>=a.right&&Math.abs(a.top-b.top)<1;}));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.craft-recipe-heading').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`${language}-${width}.png`)});
 }
 results.cases.push('Chinese/English desktop and 390px toolbar order, containment and layout');
 assert.deepEqual(results.errors,[]);await context.close();
}catch(error){results.errors.push(error.stack??String(error));process.exitCode=1;}
finally{if(browser)await browser.close();server?.kill();await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results,null,2));
