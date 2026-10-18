import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {preset} from '../src/model.js';
import {enhancementDefaults,enhancementStorageKey} from '../src/enhancement.js';
import {masteryDefaults,masteryStorageKey} from '../src/mastery.js';
import {craftingDefaults,craftingStorageKey} from '../src/crafting-model.js';

const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
const output=path.resolve(option('--out')??'.test-artifacts/upstream-1194');
await fs.mkdir(output,{recursive:true});
const servers=[],result={cases:[],errors:[]};let browser;
async function serve(script){
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
 const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const child=spawn(process.execPath,[script],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});servers.push(child);
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(([code])=>{throw Error(`Server exited ${code}`);})]);
 return `http://127.0.0.1:${port}`;
}
try{
 const base=option('--url')??await serve('scripts/serve.mjs');result.target=base;
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 for(const language of ['zh','en'])for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>result.errors.push(error.message));
  const state=preset('ranged');state.manual.simulationHours=1;state.manual.enemySelection='monster-11';state.manual.hotSetting='off';
  const craft=craftingDefaults();craft.skill='smithing';craft.levels.smithing=99;craft.plans={'upgrade-271:4':2};craft.owned={4044:6,4114:1,4252:1};
  await context.addInitScript(({state,craft,key,language})=>{
   localStorage.setItem('dvi-simulator-v1',JSON.stringify({language,state}));localStorage.setItem(key,JSON.stringify(craft));
  },{state,craft,key:craftingStorageKey,language});
  await page.goto(base+'/combat');await page.selectOption('#language',language);
  await page.waitForFunction(()=>document.querySelector('#simulation-status').hidden&&!document.querySelector('#rows .pending'));
  assert.equal(await page.locator('#rows tr[data-enemy]').count(),1);
  assert.ok(!/Simulation failed|模拟失败/.test(await page.locator('#rows').innerText()));
  assert.match(await page.locator('.footer-source').innerText(),/2026-10-18.*1\.0\.1194/);
  const combatScreenshot=`combat-${language}-${width}.png`;await page.screenshot({path:path.join(output,combatScreenshot),fullPage:true});
  await page.locator('#craft-nav').click();await page.locator('[data-craft-rarity="4"]').click();await page.locator('#craft-filled').click();
  await page.waitForFunction(()=>document.querySelector('#craft-results').textContent.includes('3,800 XP'));
  assert.equal(await page.locator('[data-craft-count="upgrade-271:4"]').inputValue(),'2');
  assert.equal(await page.locator('[data-craft-owned="4114"]').inputValue(),'1');
  assert.equal(await page.locator('[data-craft-owned="4252"]').inputValue(),'1');
  assert.equal(await page.locator('[data-craft-owned="4044"]').count(),0);
  const requirements=await page.locator('.craft-material-table tbody tr').allTextContents();
  assert.equal(requirements.length,2);assert.match(requirements[0]+requirements[1],language==='zh'?/陨铁剑/:/Meteoric blade/);
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).owned,craftingStorageKey),craft.owned);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const craftScreenshot=`craft-${language}-${width}.png`;await page.screenshot({path:path.join(output,craftScreenshot),fullPage:true});
  await page.reload();await page.locator('#craft-section').waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).plans,craftingStorageKey),craft.plans);
  const enhance={...enhancementDefaults(),mastery:201,target:100};
  await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:enhancementStorageKey,state:enhance});
  await page.goto(base+'/enhance');
  const target=page.locator('[data-enhance-field="target"]'),mastery=page.locator('[data-enhance-field="mastery"]');
  assert.equal(await target.inputValue(),'100');assert.equal(await target.getAttribute('max'),'20');
  await page.locator('#enhance-results [role="alert"]').waitFor();
  assert.match(await page.locator('#enhance-results').innerText(),/\+20/);
  await page.reload();assert.equal(await target.inputValue(),'100');
  await page.locator('#enhance-mastery-settings').evaluate(el=>el.open=true);
  assert.equal(await mastery.inputValue(),'50');assert.equal(await mastery.getAttribute('max'),'50');
  await target.fill('20');await page.locator('.enhance-table tbody tr').first().waitFor();
  assert.equal(await page.locator('.enhance-table tbody tr').count(),20);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).mastery,enhancementStorageKey),201);
  const enhanceScreenshot=`enhance-${language}-${width}.png`;await page.screenshot({path:path.join(output,enhanceScreenshot),fullPage:true});
  await mastery.fill('51');await page.locator('#enhance-results [role="alert"]').waitFor();
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).mastery,enhancementStorageKey),201);
  await mastery.fill('50');
  await page.locator('[data-enhance-field="current"]').fill('100');await page.locator('[data-enhance-field="current"]').dispatchEvent('change');
  await target.fill('100');await page.locator('.enhance-table tbody').waitFor();
  assert.match(await page.locator('.enhance-table tbody').innerText(),language==='zh'?/无需强化/:/no enhancement needed/);
  await page.reload();assert.equal(await page.locator('[data-enhance-field="current"]').inputValue(),'100');assert.equal(await target.inputValue(),'100');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const highScreenshot=`enhance-existing-${language}-${width}.png`;await page.screenshot({path:path.join(output,highScreenshot),fullPage:true});
  const masteryState=masteryDefaults();masteryState.totalPoints=100000;masteryState.current.enhance=201;masteryState.target.enhance=201;
  await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:masteryStorageKey,state:masteryState});
  await page.goto(base+'/mastery');
  const card=page.locator('[data-mastery-row="enhance"]');
  assert.equal(await card.locator('[data-mastery-field="current"]').inputValue(),'201');
  assert.equal(await card.locator('[data-mastery-value="current"]').innerText(),'+50%');
  assert.equal(await card.locator('[data-mastery-value="target"]').innerText(),'+50%');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const masteryScreenshot=`mastery-${language}-${width}.png`;await page.screenshot({path:path.join(output,masteryScreenshot),fullPage:true});
  result.cases.push({language,width,status:'passed',screenshots:[combatScreenshot,craftScreenshot,enhanceScreenshot,highScreenshot,masteryScreenshot],requirements});await context.close();
 }
 if(!option('--url')){
  const workerBase=await serve('scripts/check-capture-browser.mjs'),page=await browser.newPage();await page.goto(workerBase);
  await page.waitForFunction(()=>{const text=document.querySelector('#results').textContent;return text.includes('"PASS"')||text.includes('"error"');},{},{timeout:20000});
  result.worker=JSON.parse(await page.locator('#results').textContent());assert.ok(result.worker.passed.includes('PASS'),JSON.stringify(result.worker));
 }
 assert.deepEqual(result.errors,[]);result.status='passed';console.log(`PASS upstream browser: ${result.cases.length} bilingual/viewport cases${result.worker?', native Blob Worker passed':''}`);
}catch(error){result.status='failed';result.error=error.stack;throw error;}
finally{
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
 if(browser)await browser.close();for(const server of servers)server.kill();
}
