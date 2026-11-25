import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath,json} from '../scripts/release-common.mjs';
import {legacyPriceState} from './fixtures/legacy-price-state.mjs';
import {setItemPrice} from '../src/item-prices.js';
import * as game from '../src/upstream.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/price-preferences');
await fs.mkdir(directory,{recursive:true});const result={cases:[],errors:[]};let server,browser;
try{
 let base=process.argv[3];
 if(!base){
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});await once(server.stdout,'data');
 base=`http://127.0.0.1:${port}`; }
 result.target=base;
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 for(const language of ['zh','en'])for(const width of [1280,700,390]){
  const context=await browser.newContext({viewport:{width,height:960}}),page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>result.errors.push(error.message));let requests=0,release;
  const at=Date.now()-1000,quote=(ask,bid)=>({avg7d:{value:ask+5,capturedAt:at},avg30d:{value:bid+5,capturedAt:at},ask:{value:ask,capturedAt:at},bid:{value:bid,capturedAt:at}});
  let saved=setItemPrice(setItemPrice(setItemPrice(legacyPriceState(),1,77),2,0),3,33);
  saved.prices[2].locked=true;saved.preferences.autoImport=false;saved.preferences.categories.bars='bid';
  saved.quotes={1:quote(90,40),2:quote(80,null),3:{ask:{value:22,capturedAt:at},bid:{invalid:true,capturedAt:at}},293:quote(200,120)};
  await context.addInitScript(({saved,language})=>{if(!localStorage.getItem('dvi-item-prices-v1'))localStorage.setItem('dvi-item-prices-v1',JSON.stringify(saved));localStorage.setItem('dvi-simulator-v1',JSON.stringify({language}));},{saved,language});
  await context.route('https://deepveinidle.com/api/market/prices.json',async route=>{
   requests++;await new Promise(resolve=>release=resolve);
   await route.fulfill({contentType:'application/json',body:JSON.stringify({game:'Deep Vein Idle',generatedAt:new Date(at+500).toISOString(),refreshSeconds:300,items:{1:{avg7d:115,avg30d:105,lowestSell:150,highestBuy:55,sellQty:20,buyQty:10,vol7d:1234,vol30d:5678},293:{avg7d:215,avg30d:205,lowestSell:250,highestBuy:140,sellQty:30,buyQty:15,vol7d:0,vol30d:0}}})});
  });
  await page.goto(base+'/forecast');await page.locator('#item-prices-open').click();
  const panel=page.locator('#price-import-settings');
  const assertOpen=async expected=>assert.equal(await panel.evaluate(el=>el.open),expected);
  const expand=async()=>{await assertOpen(false);await panel.locator('summary').click();await assertOpen(true);};
  await assertOpen(false);assert.equal(requests,0);
  await page.screenshot({path:path.join(directory,`default-collapsed-${language}-${width}.png`)});
  await expand();
  await page.locator('#price-close').click();await page.locator('#item-prices-open').click();await assertOpen(true);
  await panel.locator('summary').click();await assertOpen(false);
  await page.locator('#price-family').selectOption('resources');await assertOpen(false);
  await page.locator('#price-close').click();
  await page.locator('#language').selectOption(language==='zh'?'en':'zh');
  await page.locator('#item-prices-open').click();await assertOpen(false);
  await page.locator('#price-close').click();await page.locator('#language').selectOption(language);
  await page.locator('#item-prices-open').click();await expand();assert.equal(requests,0);

  assert.equal(await page.locator('.price-categories tbody tr').count(),7);
  assert.deepEqual(await page.locator('.price-categories thead th').allTextContents(),language==='zh'?['分类','价格选项']:['Category','Price source']);
  assert.equal(await page.locator('.price-categories tbody tr').evaluateAll(rows=>rows.every(row=>row.cells.length===2)),true);
  assert.deepEqual(await page.locator('.price-categories tbody tr').evaluateAll(rows=>rows.map(row=>row.cells[0].childNodes[0].textContent)),language==='zh'?['全部','资源','消耗品','装备','工具','贵重品','贵重品（怪物的稀有掉落）']:['All','Resources','Consumables','Equipment','Tools','Valuables','Valuables (monster rare drops)']);
  assert.equal(await page.locator('[data-price-category="all"][value="avg7d"]').isChecked(),true);
  assert.equal(await page.locator('[data-price-category="all"][value=""]').count(),0);
  assert.equal(await page.locator('[data-price-category="resources"][value=""]').isChecked(),true);
  assert.equal(await page.locator('#price-import-settings .issue-box').count(),0);
  const apiPrice=id=>page.evaluate(async id=>(await import('/src/price-service.js')).getItem(id).price,id);
  assert.equal(await apiPrice(1),77);assert.equal(requests,0);
  assert.equal(await page.locator('[data-price-category="monsterValuables"][value="vendor"]').isChecked(),true);
  assert.equal(await page.locator('#price-family option[value="monsterValuables"]').count(),0);
  const special=mode=>page.locator(`[data-price-category="monsterValuables"][value="${mode}"]`).check();
  await special('ask');assert.equal(await apiPrice(207),null);
  await special('vendor');assert.equal(await apiPrice(207),288000);assert.equal(requests,0);
  await page.locator('[data-price-category="valuables"][value="off"]').check();assert.equal(await apiPrice(207),288000);
  await special('');assert.equal(await apiPrice(207),null);
  await special('vendor');assert.equal(await apiPrice(207),288000);
  await page.reload();await page.locator('#item-prices-open').click();await expand();
  assert.equal(await page.locator('[data-price-category="monsterValuables"][value="vendor"]').isChecked(),true);assert.equal(await apiPrice(207),288000);

  await page.locator('#price-family').selectOption('resources');
  await page.evaluate(async()=>{const service=await import('/src/price-service.js');window.priceBefore=service.getSnapshot();window.priceEvents=[];service.subscribe(event=>window.priceEvents.push(event));});
  const choose=(category,mode)=>page.locator(`[data-price-category="${category}"][value="${mode}"]`).check();
  await choose('resources','ask');assert.equal(await page.locator('#price-import-settings .issue-box').count(),0);
  assert.equal(await page.locator('[data-price-value="1"]').inputValue(),'90');assert.equal(await apiPrice(293),200);
  assert.equal(await page.evaluate(()=>window.priceBefore.getItem(1).price),77);
  assert.equal(await page.evaluate(()=>window.priceEvents.length),1);
  assert.deepEqual(await page.evaluate(()=>[window.priceEvents[0].prices,window.priceEvents[0].preferences,window.priceEvents[0].market]),[true,true,false]);
  await choose('resources','');await choose('all','bid');assert.equal(await page.locator('[data-price-value="1"]').inputValue(),'40');assert.equal(await apiPrice(293),120);
  assert.equal(await page.locator('[data-price-value="3"]').inputValue(),'');assert.equal(await page.locator('[data-price-value="2"]').inputValue(),'0');
  await page.locator('[data-price-fallback="all"]').check();assert.equal(await page.locator('[data-price-fallback="resources"]').isDisabled(),true);assert.equal(await page.locator('[data-price-fallback="resources"]').isChecked(),true);
  await choose('resources','ask');assert.equal(await page.locator('[data-price-fallback="resources"]').isDisabled(),false);assert.equal(await apiPrice(1),90);
  await choose('all','vendor');assert.equal(await apiPrice(1),90);await choose('resources','');assert.equal(await apiPrice(1),game.vendorPrice(1));
  await choose('all','ask');await page.locator('[data-price-fallback="all"]').uncheck();assert.equal(await apiPrice(1),90);assert.equal(requests,0);
  await page.reload();await page.locator('#item-prices-open').click();await expand();await page.locator('#price-family').selectOption('resources');assert.equal(await page.locator('[data-price-category="resources"][value=""]').isChecked(),true);assert.equal(await apiPrice(1),90);
  assert.equal(await page.locator('[data-price-value="2"]').inputValue(),'0');
  await page.locator('#price-import').click();await page.waitForFunction(()=>document.querySelector('#price-import')?.disabled);
  assert.equal(requests,1);await choose('all','bid');assert.equal(await apiPrice(1),40);release();
  await page.waitForFunction(()=>document.querySelector('#price-status')?.textContent.startsWith('已更新 ')||document.querySelector('#price-status')?.textContent.startsWith('Updated '));
  assert.equal(await apiPrice(1),55);assert.equal(await page.locator('[data-price-value="1"]').inputValue(),'55');assert.equal(await apiPrice(2),0);assert.equal(requests,1);
  await page.screenshot({path:path.join(directory,`inherited-${language}-${width}.png`)});
  await choose('all','off');assert.equal(await page.locator('#price-import').isDisabled(),false);await choose('monsterValuables','off');assert.equal(await page.locator('#price-import').isDisabled(),true);assert.equal(await apiPrice(1),55);
  await choose('resources','ask');assert.equal(await apiPrice(1),150);assert.equal(await page.locator('#price-import').isDisabled(),false);assert.equal(requests,1);
  await page.locator('#price-import-reset').click();assert.equal(await page.locator('[data-price-category="resources"][value=""]').isChecked(),true);assert.equal(await apiPrice(1),115);assert.equal(await apiPrice(2),0);
  assert.equal(await page.locator('[data-price-category="all"][value="avg7d"]').isChecked(),true);
  await choose('all','avg30d');assert.equal(await apiPrice(1),105);
  const fields=await page.evaluate(async()=>(await import('/src/price-service.js')).getItem(1));assert.equal(fields.avg7d,115);assert.equal(fields.avg30d,105);assert.equal(fields.volume7d,1234);assert.equal(fields.volume30d,5678);
  await page.reload();await page.locator('#item-prices-open').click();await expand();assert.equal(await apiPrice(1),105);assert.equal(await page.locator('[data-price-category="all"][value="avg30d"]').isChecked(),true);
  await page.screenshot({path:path.join(directory,`restored-average-${language}-${width}.png`)});
  const layout=await page.locator('#item-prices-dialog').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
  if(width===390){
   const firstOption=await page.locator('[data-price-category="all"][value="avg7d"]').evaluate(el=>el.parentElement.getBoundingClientRect().height);
   assert.ok(firstOption<70,`Price labels must remain readable: ${firstOption}`);
  }
  const alignment=await page.locator('.price-categories tbody tr').evaluateAll(rows=>rows.map(row=>{
   const top=row.querySelector('.price-category-settings').getBoundingClientRect().top;
   return [...row.querySelectorAll('[data-price-category]:not([value=""]),[data-price-fallback]')].map(input=>{const rect=input.getBoundingClientRect();return {left:rect.left,top:rect.top-top};});
  }));
  for(const row of alignment.slice(1))for(let index=0;index<alignment[0].length;index++){
   assert.ok(Math.abs(row[index].left-alignment[0][index].left)<=1,JSON.stringify(alignment));
   assert.ok(Math.abs(row[index].top-alignment[0][index].top)<=1,JSON.stringify(alignment));
  }
  assert.equal(await page.locator('.price-import-options #price-import-reset').count(),1);
  assert.equal(await page.locator('#price-import-reset').textContent(),language==='zh'?'重置价格选项':'Reset price options');
  const resetLayout=await page.locator('#price-import-reset').evaluate(button=>{
   const rect=button.getBoundingClientRect(),label=button.previousElementSibling;
   const auto=label.getBoundingClientRect();return {previous:label.querySelector('input').id,left:rect.left,top:rect.top,bottom:rect.bottom,autoRight:auto.right,autoTop:auto.top,autoBottom:auto.bottom};
  });
  assert.equal(resetLayout.previous,'price-auto-import');
  if(width>=700)assert.ok(resetLayout.left>=resetLayout.autoRight&&resetLayout.top<resetLayout.autoBottom,JSON.stringify(resetLayout));
  else if(resetLayout.top<resetLayout.autoBottom&&resetLayout.bottom>resetLayout.autoTop)assert.ok(resetLayout.left>=resetLayout.autoRight,JSON.stringify(resetLayout));
  else assert.ok(resetLayout.top>=resetLayout.autoBottom,JSON.stringify(resetLayout));
  const placeholder=page.locator('.price-option-placeholder');
  assert.equal(await placeholder.count(),1);assert.equal(await placeholder.getAttribute('aria-hidden'),'true');
  assert.equal(await placeholder.locator('input,button,[tabindex]').count(),0);
  await page.locator('[data-price-category="monsterValuables"][value="vendor"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(directory,`monster-valuables-${language}-${width}.png`)});
  result.cases.push(`${language}/${width}: default collapsed, session state on reopen/filter/language and refresh reset, two columns, aligned option columns and wrapped rows, inaccessible noninteractive All placeholder, primary game categories, v4 reset and v7 restoration and independent monster valuables vendor defaults/inheritance/reload, both averages, required All, inherited/override/floor/Skip/reset, immediate table/API and atomic events, old snapshot isolation, missing/invalid clears and locked zero, reload and latest policy during request`);
  await context.close();
 }
 assert.deepEqual(result.errors,[]);result.status='passed';console.log(JSON.stringify({status:result.status,cases:result.cases.length,directory}));
}catch(error){result.status='failed';result.failure=error.stack;throw error;}
finally{await json(path.join(directory,'browser.json'),result);await browser?.close();server?.kill();}
