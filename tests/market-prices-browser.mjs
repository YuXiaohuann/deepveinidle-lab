import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath,json} from '../scripts/release-common.mjs';
import {priceDefaults,setItemPrice} from '../src/item-prices.js';

const toolbarOnly=process.argv.includes('--toolbar-only');
const directory=path.resolve(toolbarOnly?'.test-artifacts/price-toolbar':'.test-artifacts/market-prices');
await fs.mkdir(directory,{recursive:true});
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const result={cases:[],errors:[]};let browser;
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited: ${code}`);})]);
 const base=`http://127.0.0.1:${port}`;
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 if(!toolbarOnly){
 const live=await browser.newContext(),livePage=await live.newPage();
 await livePage.goto(base+'/forecast');
 result.live=await livePage.evaluate(async()=>{
  const {requestMarket}=await import('/src/market-import.js');const {snapshot}=await requestMarket();
  return {items:Object.keys(snapshot.quotes).length,invalid:snapshot.invalid,generatedAt:new Date(Object.values(snapshot.quotes)[0].ask.capturedAt).toISOString()};
 });
 assert.ok(result.live.items>0);result.cases.push('real browser cross-origin official API request without userscript');await live.close();
 }
 for(const language of ['zh','en'])for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>result.errors.push(e.message));
  let requests=0,fail=false;
  const at=Date.now()-1000;
  const payload={game:'Deep Vein Idle',generatedAt:new Date(at).toISOString(),refreshSeconds:300,items:{1:{lowestSell:84,highestBuy:50},2:{lowestSell:90,highestBuy:80},1110:{lowestSell:900,highestBuy:700}}};
  await context.route('https://deepveinidle.com/api/market/prices.json',route=>{
   requests++;return route.fulfill({status:fail?503:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:fail?'Unavailable':JSON.stringify(payload)});
  });
  let saved=setItemPrice(setItemPrice(priceDefaults(),1,123),2,99);saved.version=2;saved.prices[1].locked=true;saved.quotes={3:{bid:{value:999,capturedAt:Date.now()}}};
  await context.addInitScript(({saved,language})=>{
   localStorage.setItem('dvi-item-prices-v1',JSON.stringify(saved));localStorage.setItem('dvi-simulator-v1',JSON.stringify({language}));
  },{saved,language});
  await page.goto(base+'/forecast');await page.selectOption('#language',language);
  await page.locator('#item-prices-open').click();
  await page.locator('#item-prices-dialog').waitFor();
  await page.waitForTimeout(100);assert.equal(requests,0);assert.equal(await page.locator('#price-status').textContent(),'');
  await page.locator('#price-close').click();await page.locator('#item-prices-open').click();
  await page.waitForTimeout(100);assert.equal(requests,0);
  await page.selectOption('#language',language==='zh'?'en':'zh');await page.selectOption('#language',language);assert.equal(requests,0);
  assert.equal(requests,0);assert.equal(await page.locator('[data-price-value]').count(),0);
  const emptyPrompt=language==='zh'?'物品数量较多，请先设置筛选条件':'Many items to display; set a filter first';
  assert.ok((await page.locator('.price-list').innerText()).includes(emptyPrompt));assert.equal(await page.locator('#price-select-all').isDisabled(),true);
  assert.deepEqual(await page.locator('#price-filter option').evaluateAll(els=>els.map(el=>el.value)),['all','priced','locked']);
  assert.equal(await page.locator('#price-import-settings a').count(),0);
  assert.equal(await page.locator('#price-import-settings #price-import').count(),0);
  assert.equal(await page.locator('#price-status').count(),1);
  assert.equal(await page.locator('#price-market-status').count(),0);
  assert.equal(await page.locator('#price-import').evaluate(el=>el.previousElementSibling.id),'price-clear');
  assert.equal(await page.locator('#price-status').evaluate(el=>el.previousElementSibling.id),'price-import');
  assert.doesNotMatch(await page.locator('#price-import-settings').innerText(),/userscript|捕获|Captured/);
  assert.deepEqual(await page.locator('[data-price-category="ore"]').evaluateAll(els=>els.map(el=>el.value)),['ask','bid','bidVendor','vendor','off']);
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-item-prices-v1')));
  const changeFilter=async(key,value)=>{const el=page.locator('#price-'+key);if(key==='search'||key==='plus'){await el.fill(value);await el.blur();}else await el.selectOption(value);};
  const expectEmpty=async()=>{assert.equal(await page.locator('[data-price-value]').count(),0);assert.ok((await page.locator('.price-list').innerText()).includes(emptyPrompt));assert.equal(await page.locator('#price-select-all').isDisabled(),true);assert.equal(await page.locator('#price-bulk-lock').isDisabled(),true);assert.equal(await page.locator('#price-bulk-unlock').isDisabled(),true);};
  assert.deepEqual(await stored(),saved);
  const memory=await page.evaluate(async()=>{const {priceState}=await import('/src/item-price-store.js');return priceState();});assert.equal(memory.version,3);assert.deepEqual(memory.quotes,{});
  await page.locator('#price-import').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(directory,`prices-${language}-${width}.png`)});
  const layout=await page.locator('#item-prices-dialog').evaluate(el=>({width:el.getBoundingClientRect().width,scroll:el.scrollWidth,client:el.clientWidth}));
  assert.ok(layout.width<=width,JSON.stringify(layout));assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
  await page.locator('#price-import-settings summary').click();assert.equal(await page.locator('#price-import-settings').evaluate(el=>el.open),false);
  assert.equal(requests,0);await page.locator('#price-import').click();await page.waitForFunction(()=>document.querySelector('#price-status')?.textContent.startsWith('已更新 ')||document.querySelector('#price-status')?.textContent.startsWith('Updated '));
  assert.equal(requests,1);assert.equal((await stored()).version,3);assert.equal((await stored()).quotes[3],undefined);assert.equal((await stored()).prices[1].price,123);assert.equal((await stored()).prices[2].price,80);
  assert.equal((await stored()).prices[2].quoteCapturedAt,at);
  await expectEmpty();
  for(const [key,value,reset]of [['family','ore','all'],['search','Tin',''],['tier','0','all'],['plus','1','0'],['filter','priced','all'],['filter','locked','all']]){
   await changeFilter(key,value);assert.ok(await page.locator('[data-price-value]').count()>0,key);
   await page.locator('#price-select-all').check();assert.equal(await page.locator('#price-bulk-lock').isDisabled(),false);
   await changeFilter(key,reset);await expectEmpty();assert.equal(requests,1);
  }
  await changeFilter('search','no-such-dvi-item-xyz');assert.equal(await page.locator('[data-price-value]').count(),0);assert.ok((await page.locator('.price-list').innerText()).includes(language==='zh'?'没有匹配物品':'No matching items'));
  await changeFilter('search','   ');await expectEmpty();await changeFilter('search','');
  await changeFilter('family','ore');assert.equal(await page.locator('[data-price-value="1"]').inputValue(),'123');assert.equal(await page.locator('[data-price-value="2"]').inputValue(),'80');
  await page.locator('#price-import').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`prices-filtered-${language}-${width}.png`)});
  await page.locator('[data-price-value="2"]').fill('0');assert.equal((await stored()).prices[2].price,0);assert.equal((await stored()).prices[2].locked,true);
  await page.locator('[data-price-value="2"]').fill('');assert.equal((await stored()).prices[2].price,null);assert.equal((await stored()).prices[2].locked,true);
  await page.locator('[data-price-value="2"]').fill('42');await page.locator('[data-price-value="2"]').blur();
  const before=await stored();fail=true;await page.locator('#price-import').click();await page.locator('#price-status[role="alert"]').waitFor();assert.equal(requests,2);assert.deepEqual(await stored(),before);
  const failureText=await page.locator('#price-status').textContent();await page.locator('#price-close').click();await page.locator('#item-prices-open').click();await page.waitForTimeout(100);assert.equal(requests,2);assert.equal(await page.locator('#price-status').textContent(),failureText);
  await page.locator('[data-price-lock="2"]').uncheck();assert.equal(await page.locator('#price-status').getAttribute('role'),'alert');
  fail=false;await page.locator('#price-import').click();await page.waitForFunction(()=>document.querySelector('#price-status')?.textContent.startsWith('已更新 ')||document.querySelector('#price-status')?.textContent.startsWith('Updated '));assert.equal((await stored()).prices[2].price,80);assert.equal(requests,3);
  await changeFilter('family','all');await expectEmpty();
  page.once('dialog',dialog=>dialog.accept());await page.locator('#price-clear').click();assert.equal((await stored()).prices[2],undefined);assert.equal((await stored()).prices[1].price,123);assert.equal((await stored()).quotes[2].bid.value,80);await expectEmpty();assert.equal(requests,3);
  await page.locator('#price-close').click();assert.equal(await page.locator('#item-prices-open').evaluate(el=>el===document.activeElement),true);
  await page.locator('#item-prices-open').click();await page.waitForTimeout(100);assert.equal(requests,3);await page.keyboard.press('Escape');assert.equal(await page.locator('#item-prices-dialog').evaluate(el=>el.open),false);
  result.cases.push(`${language} ${width}px: empty unfiltered list, retained status options, each independent filter and whitespace/no-match states, clearing deselects, global import and clear while empty, zero automatic requests, manual prices/locks, persistent filter/error and explicit retry, close and focus`);
  await context.close();
 }
 if(!toolbarOnly){
 const workerContext=await browser.newContext(),workerPage=await workerContext.newPage();
 workerPage.on('pageerror',e=>result.errors.push(e.message));
 await workerContext.route('**/capture-worker-check',route=>route.fulfill({contentType:'text/html',path:'tests/fixtures/capture-worker.html'}));
 await workerContext.route('**/candidate.js',route=>route.fulfill({contentType:'text/javascript',path:'src/character-import.user.js'}));
 await workerPage.goto(base+'/capture-worker-check');
 await workerPage.waitForFunction(()=>{const text=document.querySelector('#results').textContent;if(!text.startsWith('{'))return false;const r=JSON.parse(text);return r.error||r.passed?.includes('PASS');},{},{timeout:20000});
 result.worker=JSON.parse(await workerPage.locator('#results').innerText());assert.equal(result.worker.error,undefined,JSON.stringify(result.worker));assert.ok(result.worker.passed.includes('PASS'));
 result.cases.push('real Blob Worker: role trimming, ignored market frames, coalesced slow role saves, connection isolation and visible Worker failure');
 await workerContext.close();
 }
assert.deepEqual(result.errors,[]);result.status='passed';console.log(JSON.stringify({status:result.status,cases:result.cases.length,live:result.live,directory}));
}catch(error){result.status='failed';result.failure=error.stack;throw error;}
finally{if(browser)await browser.close();server.kill();await json(path.join(directory,'browser.json'),result);}
