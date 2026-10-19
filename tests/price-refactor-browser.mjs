import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {priceDefaults} from '../src/item-prices.js';
const directory=path.resolve('.test-artifacts/price-refactor/protocol');await fs.mkdir(directory,{recursive:true});
const results={cases:[],errors:[]};let server,browser;
try{
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});await once(server.stdout,'data');
 const base=`http://127.0.0.1:${port}`;browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 for(const language of ['zh','en'])for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:960}}),page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
  const prices=priceDefaults();prices.preferences.autoImport=false;
  await context.addInitScript(({language,prices})=>{if(!localStorage.getItem('dvi-simulator-v1'))localStorage.setItem('dvi-simulator-v1',JSON.stringify({language}));if(!localStorage.getItem('dvi-item-prices-v1'))localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));},{language,prices});
  let requests=0;
  await context.route('https://deepveinidle.com/api/market/prices.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify({game:'Deep Vein Idle',generatedAt:new Date().toISOString(),refreshSeconds:300,items:{1:{lowestSell:9,sellQty:12000,highestBuy:4,buyQty:25000},2:{lowestSell:7,sellQty:0,highestBuy:2,buyQty:0}}})});});
  await page.goto(base+'/collection');assert.equal(await page.locator('#collection-buy').inputValue(),'global');
  await page.locator('#collection-manual').click();await page.locator('#collection-search').fill('Bronze bar');await page.locator('#collection-tier').selectOption('0');await page.locator('#collection-filter-minutes').fill('0.04');
  const metric=()=>page.locator('[data-collection-key="40:41:1"] [data-collection-metric="costPerPoint"]').innerText();
  assert.match(await metric(),/—/);
  await page.evaluate(async()=>{const p=await import('/src/price-service.js');p.setPrice(1,0);p.setPrice(2,3);await p.refreshMarket();});assert.match(await metric(),/3/);
  await page.locator('#collection-buy').selectOption('ask');assert.match(await metric(),/16/);
  await page.locator('#collection-buy').selectOption('bid');assert.match(await metric(),/6/);
  await page.locator('#collection-buy').selectOption('vendor');assert.doesNotMatch(await metric(),/—/);
  await page.locator('#collection-buy').selectOption('global');await page.reload();assert.equal(await page.locator('#collection-buy').inputValue(),'global');assert.match(await metric(),/3/);
  await page.locator('#item-prices-open').click();assert.equal(requests,1);await page.locator('#price-search').fill('Copper');await page.locator('#price-search').blur();
  const row=page.locator('[data-price-value="1"]').locator('..').locator('..');assert.equal(await row.locator('td').count(),9);
  assert.match(await row.innerText(),/12,000/);assert.match(await row.innerText(),/25,000/);assert.equal(await page.locator('[data-price-value="1"]').inputValue(),'0');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const layout=await page.locator('#item-prices-dialog').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(layout.scroll<=layout.client+1);
  await page.locator('#price-import-settings').evaluate(el=>el.open=false);await row.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`six-fields-${language}-${width}.png`)});
  if(width===390){await page.locator('.price-list').evaluate(el=>el.scrollLeft=el.scrollWidth);await page.screenshot({path:path.join(directory,`market-totals-${language}-${width}.png`)});}await page.locator('#price-close').click();
  await page.locator('a[href="/enhance"]').click();await page.evaluate(async()=>{const p=await import('/src/price-service.js');p.setPrice(208,8);p.setPrice(359,9);});
  const shard=page.locator('[data-enhance-field="shardPrice"]');assert.equal(await shard.inputValue(),'8');await shard.fill('0');await shard.blur();
  await page.evaluate(async()=>{const p=await import('/src/price-service.js');p.setPrice(208,12);});assert.equal(await shard.inputValue(),'0');
  await shard.fill('');await shard.blur();assert.equal(await shard.inputValue(),'');await page.reload();assert.equal(await shard.inputValue(),'');
  await page.screenshot({path:path.join(directory,`enhancement-${language}-${width}.png`)});
  for(const route of ['combat','gather','craft']){await page.locator(`a[href="/${route}"]`).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  results.cases.push(`${language}/${width}: six fields, totals, four collection modes and persistence, enhancement override/blank, consumer navigation without script errors`);await context.close();
 }
 assert.deepEqual(results.errors,[]);
}catch(error){results.failure=String(error.stack??error);throw error;}
finally{await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(results,null,2)+'\n');await browser?.close();server?.kill();}
console.log(JSON.stringify({status:'passed',cases:results.cases.length,directory}));
