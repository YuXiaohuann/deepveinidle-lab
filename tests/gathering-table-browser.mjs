import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {gatheringDefaults} from '../src/gathering-model.js';
import {priceDefaults} from '../src/item-prices.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/gathering-table');await fs.mkdir(directory,{recursive:true});
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const results={cases:[],errors:[]};let browser;
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited: ${code}`);})]);
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const prices=priceDefaults();prices.preferences.autoImport=false;
 await context.addInitScript(prices=>localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices)),prices);
 await context.addInitScript(state=>{
  if(!localStorage.getItem('dvi-gathering-v1'))localStorage.setItem('dvi-gathering-v1',JSON.stringify(state));
  window.gatherRuns=[];const OriginalWorker=Worker;
  window.Worker=class extends OriginalWorker{
   constructor(url,options){super(url,options);if(String(url).includes('gathering-worker.js')){this.run={results:[],worker:this};window.gatherRuns.push(this.run);this.addEventListener('message',({data})=>{if(data.result)this.run.results.push(data.result);if(data.done)this.run.done=true;});}}
   postMessage(data,...rest){if(this.run){this.run.mode=window.tableMode;if(window.tableMode==='wait')return;if(window.tableMode==='error'){setTimeout(()=>this.onmessage({data:{error:'invalidRoute',done:true}}),0);return;}}return super.postMessage(data,...rest);}
  };
 },{...gatheringDefaults(),siteSelection:3,hotSetting:'off',brews:{...gatheringDefaults().brews,gatherer:2}});
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>results.errors.push(error.message));
 await page.goto(`http://127.0.0.1:${port}/gather`);
 assert.equal(await page.locator('[data-gather-field="siteSelection"]').count(),0);
 assert.doesNotMatch(await page.locator('#gather-content').innerText(),/所有采集点平均|实际随机选择|Average of all sites|selects sites randomly/);
 await page.waitForFunction(()=>window.gatherRuns.at(-1)?.done);
 const headers=()=>page.locator('#gather-results .gather-table th button').allTextContents().then(items=>items.map(item=>item.replace(/\s*[↑↓↕]/g,'').trim()));
 const checkRows=async(count=10)=>assert.ok(await page.locator('#gather-results .gather-table tbody tr').evaluateAll((rows,count)=>rows.every(row=>[...row.cells].reduce((sum,cell)=>sum+cell.colSpan,0)===count),count));
 const sample=await page.evaluate(()=>window.gatherRuns.at(-1).results[0]);
 assert.equal(sample.sites.length,1);assert.equal(sample.sites[0].siteId,1);assert.equal(sample.homeBank,1);
 const potions=page.locator(`#gather-${sample.jobId}-potions`);await potions.locator('summary').click();assert.match(await potions.innerText(),/药剂成本/);assert.equal(await potions.locator('.loot-line').last().locator('span').last().innerText(),'24.0');
 const xpDetail=page.locator(`#gather-${sample.jobId}-xp`);await xpDetail.locator('summary').click();
 const singleXp=(sample.xp/sample.completed).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
 assert.equal(await xpDetail.locator('.loot-line span').last().innerText(),singleXp);
 const daily=['任务','经验/天','收入/天','利润/天','移动占比','采集次数/天','金币/天','主要产物/天','额外掉落/天','消耗品/天'];
 assert.deepEqual(await headers(),daily);await checkRows();
 assert.equal(await page.locator('#gather-results .enemies-heading h2 span').count(),0);
 assert.ok(await page.locator('#gather-results .gather-table tbody tr').evaluateAll(rows=>rows.every(row=>[...row.cells].flatMap((cell,i)=>cell.classList.contains('column-highlight')?[i]:[]).join(',')==='0,1,2,3')));
 const levels=()=>page.locator('#gather-results .gather-table td:first-child small').allTextContents().then(values=>values.map(value=>Number(value.match(/\d+/)[0])));
 assert.ok((await page.locator('#gather-results .gather-table td:first-child small').allTextContents()).every(label=>label.startsWith('等级 ')&&!label.includes('所需')));
 let values=await levels();assert.deepEqual(values,[...values].sort((a,b)=>b-a));
 const job=page.locator('#gather-results .gather-table td:first-child details').last();const id=await job.getAttribute('id');await job.locator('summary').click();
 assert.equal(await job.locator('.loot-line').count(),2);
 await page.locator('[data-gather-sort="levelReq"]').click();values=await levels();assert.deepEqual(values,[...values].sort((a,b)=>a-b));assert.equal(await page.locator(`#${id}`).getAttribute('open'),'');
 results.cases.push('10-column order, name/level merge, default and ascending level sorting, highlighted data and locked rows');
 await page.locator('#gather-simulation').evaluate(el=>el.open=true);
 const runs=await page.evaluate(()=>window.gatherRuns.length);
 assert.equal(await page.locator('#gather-period').count(),0);assert.deepEqual(await headers(),daily);
 assert.equal(await potions.locator('.loot-line').last().locator('span').last().innerText(),'24.0');assert.equal(await xpDetail.getAttribute('open'),'');assert.equal(await xpDetail.locator('.loot-line span').last().innerText(),singleXp);
 await page.locator('#gather-search').fill('no-such-task');await checkRows();assert.equal(await page.locator('#gather-results .empty-results').getAttribute('colspan'),'10');await page.locator('#gather-search').fill('');
 await page.selectOption('#language','en');assert.deepEqual(await headers(),['Task','XP/day','Income/day','Profit/day','Moving share','Gathering/day','Coins/day','Main items/day','Extra drops/day','Consumables/day']);assert.equal(await page.locator(`#${id}`).getAttribute('open'),'');

 assert.equal(await page.evaluate(()=>window.gatherRuns.length),runs);
 results.cases.push('fixed daily bilingual headers, gather counts, empty results and expanded state survive redraw without new Workers');
 const potionId=Number(Object.keys(sample.potionItems)[0]);
 await page.evaluate(async id=>{const service=await import('/src/price-service.js');service.setPrice(id,100000);},potionId);
 const sampleRow=page.locator(`#gather-${sample.jobId}-level`).locator('xpath=ancestor::tr');
 assert.match(await sampleRow.locator('td').nth(3).innerText(),/-/);
 assert.equal(await potions.locator('summary [aria-label="Unset price"]').count(),0);
 for(const key of ['profit','potionCost']){await page.locator(`[data-gather-sort="${key}"]`).click();assert.equal(await page.locator(`[data-gather-sort="${key}"]`).locator('xpath=..').getAttribute('aria-sort'),'ascending');}
 await page.locator('[data-gather-sort="levelReq"]').click();
 await page.evaluate(async id=>{const service=await import('/src/price-service.js');service.setPrice(id,0);},potionId);
 assert.equal(await potions.locator('summary').innerText(),'0');
 await page.evaluate(async id=>{const service=await import('/src/price-service.js');service.setPrice(id,null);},potionId);
 assert.equal(await potions.locator('summary [aria-label="Unset price"]').count(),1);
 assert.equal(await page.evaluate(()=>window.gatherRuns.length),runs);
 results.cases.push('potion pricing updates costs and negative profit, zero and missing prices, both new sort keys, and no new Workers');

 for(const width of [1440,390])for(const language of ['zh','en']){
  await page.setViewportSize({width,height:1000});await page.selectOption('#language',language);await checkRows();
  assert.equal(await xpDetail.locator('.loot-line span').first().innerText(),language==='zh'?'平均单次经验':'Average XP per action');assert.equal(await xpDetail.locator('p').count(),0);
  await page.locator(`#${id}`).evaluate(el=>el.open=false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#gather-results .gather-table').evaluate(el=>el.parentElement.scrollLeft=0);await page.locator('#gather-results .gather-table thead').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`${language}-${width}.png`)});
  await page.locator(`#${id}`).evaluate(el=>el.open=true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(directory,`${language}-${width}-expanded.png`)});
  if(width===390)assert.ok(await page.locator('#gather-results .gather-table').evaluate(el=>el.parentElement.scrollWidth>el.parentElement.clientWidth));
 }
 results.cases.push('Chinese/English desktop and 390px layouts, including expanded name and contained horizontal scrolling');
 await page.setViewportSize({width:1440,height:1000});await page.selectOption('#language','zh');
 await page.evaluate(()=>window.tableMode='wait');await page.locator('#gather-rerun').click();await page.waitForFunction(()=>window.gatherRuns.at(-1)?.mode==='wait');await checkRows();assert.equal(await page.locator('#gather-results .gather-table tbody tr').first().locator('td').nth(1).innerText(),'…');
 await page.locator('#gather-results .gather-table tbody tr').first().locator('td').nth(4).locator('summary').click();assert.match(await page.locator('#gather-results .gather-table tbody tr').first().locator('td').nth(4).innerText(),/采集点/);
 await page.locator('#gather-search').fill('no-such-task');
 assert.ok(await page.evaluate(()=>{
  const input=document.querySelector('#gather-search');
  input.setSelectionRange(2,5);
  window.gatherRuns.at(-1).worker.onmessage({data:{progress:{completed:1,total:2}}});
  return document.querySelector('#gather-search')===input&&document.activeElement===input&&input.selectionStart===2&&input.selectionEnd===5&&
   document.querySelector('.gather-progress').textContent.includes('1/2')&&Boolean(document.querySelector('#gather-results .empty-results'));
 }));
 await page.locator('#gather-search').fill('');
 const ime=await context.newCDPSession(page);
 await page.locator('#gather-search').evaluate(input=>{
  window.compositionInput=input;
  window.compositionEvents=[];
  for(const type of ['compositionstart','compositionend'])input.addEventListener(type,event=>window.compositionEvents.push(event.type));
 });
 await ime.send('Input.imeSetComposition',{text:'kuang',selectionStart:5,selectionEnd:5});
 await page.evaluate(()=>window.gatherRuns.at(-1).worker.onmessage({data:{progress:{completed:2,total:2}}}));
 await page.waitForFunction(()=>document.querySelector('.gather-progress').textContent.includes('2/2'));
 assert.deepEqual(await page.evaluate(()=>window.compositionEvents),['compositionstart']);
 assert.ok(await page.evaluate(()=>document.activeElement===window.compositionInput));
 await ime.send('Input.insertText',{text:'矿'});
 assert.equal(await page.locator('#gather-search').inputValue(),'矿');
 assert.deepEqual(await page.evaluate(()=>window.compositionEvents),['compositionstart','compositionend']);
 await ime.detach();
 await page.locator('#gather-search').fill('');
 results.cases.push('Worker progress preserves the focused task filter and text selection');
 await page.evaluate(()=>window.tableMode='error');await page.locator('#gather-rerun').click();await page.waitForFunction(()=>document.querySelector('.gather-progress').textContent.includes('无法建立采集路线'));await checkRows();assert.match(await page.locator('#gather-results .gather-table tbody tr').first().locator('td').nth(1).innerText(),/无法建立采集路线/);
 results.cases.push('controlled waiting and failed Worker rows retain column alignment and site details');
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('dvi-gathering-v1'));state.simulationHours=1;localStorage.setItem('dvi-gathering-v1',JSON.stringify(state));});await page.reload();await page.waitForFunction(()=>window.gatherRuns.at(-1)?.done);await checkRows();assert.equal((await headers()).length,10);assert.equal((await headers())[1],'经验/天');
 await page.locator('#gather-search').fill('no-such-task');assert.equal(await page.locator('#gather-results .empty-results').getAttribute('colspan'),'10');await page.locator('#gather-search').fill('');
 await page.locator('[data-gather-skill="thieving"]').click();await page.waitForFunction(()=>window.gatherRuns.at(-1)?.done);assert.equal(await page.locator('#gather-results .gather-table td:first-child details').last().locator('.loot-line').count(),3);
 results.cases.push('short-duration daily scaling, empty rows and thieving catch detail');
 assert.deepEqual(results.errors,[]);await context.close();
}catch(error){results.errors.push(error.stack??String(error));process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results,null,2));
