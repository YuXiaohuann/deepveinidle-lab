import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {craftingDefaults} from '../src/crafting-model.js';
import {priceDefaults} from '../src/item-prices.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/crafting-table');await fs.mkdir(directory,{recursive:true});
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
  if(!localStorage.getItem('dvi-crafting-orders-v1'))localStorage.setItem('dvi-crafting-orders-v1',JSON.stringify({version:1,build:{...state,plans:{}},orders:[{id:'table',name:'Table order',enabled:true,plans:state.plans,fees:{fixed:null,percent:null,minute:null}}],currentOrderId:'table',inventory:{capturedAt:Date.now(),items:state.owned}}));
  document.addEventListener('dvi-character-request',event=>{const r=JSON.parse(event.detail);document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',version:'2.4',id:r.id,...(r.action==='probe'?{ready:true}:{snapshot:{version:2,capturedAt:Date.now(),player:{bank:state.owned,pack:[]}}})})}));});
  window.craftRuns=[];const OriginalWorker=Worker;
  window.Worker=class extends OriginalWorker{
   constructor(url,options){super(url,options);if(String(url).includes('crafting-worker.js')){this.run={results:[]};window.craftRuns.push(this.run);window.tableWorker=this;this.addEventListener('message',({data})=>{if(data.result)this.run.results.push({mode:data.mode,result:data.result});if(data.done)this.run.done=true;});}}
   postMessage(data,...rest){if(this.run){this.run.mode=window.tableMode;this.run.input=data;if(window.tableMode==='wait')return;}return super.postMessage(data,...rest);}
  };
 },{...craftingDefaults(),hotSetting:'off',plans:{'61:0':3},owned:{20:2}});
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>results.errors.push(error.message));
 await page.goto(`http://127.0.0.1:${port}/craft`);await page.waitForFunction(()=>window.craftRuns.at(-1)?.done);
 const table=()=>page.locator('#craft-results .craft-table');
 const headers=()=>table().locator('th').allTextContents().then(items=>items.map(item=>item.replace(/\s*[↑↓↕]/g,'').trim()));
 const checkRows=async()=>assert.ok(await table().locator('tbody tr').evaluateAll(rows=>rows.every(row=>[...row.cells].reduce((sum,cell)=>sum+cell.colSpan,0)===7)));
 const checkLayout=async()=>assert.ok(await table().evaluate(el=>{
  const style=cell=>getComputedStyle(cell);
  const heading=el.tHead.rows[0].cells[0];
  return style(heading).textAlign==='left'&&style(heading).position==='sticky'&&
   [...el.tBodies[0].rows].every(({cells})=>style(cells[0]).textAlign==='left'&&
    [...cells].slice(1).every(cell=>style(cell).textAlign==='right'&&style(cell).verticalAlign==='middle')&&
    cells[6].querySelector('input').getBoundingClientRect().height===36);
 }));
 const daily=['配方','经验/天','利润/天','制造次数/天','单次材料成本','单次产物价值','订单制造次数'];
 assert.deepEqual(await headers(),daily);await checkRows();assert.equal(await page.locator('.craft-recipe-heading h2 span').count(),0);
 assert.ok(await table().locator('tbody tr').evaluateAll(rows=>rows.every(row=>[...row.cells].flatMap((cell,i)=>cell.classList.contains('column-highlight')?[i]:[]).join(',')==='0,1,2')));
 const levels=()=>table().locator('td:first-child .enemy-name small').allTextContents().then(values=>values.map(value=>Number(value.match(/\d+/)[0])));
 let values=await levels();assert.deepEqual(values,[...values].sort((a,b)=>b-a));
 const recipe=page.locator('#craft-61\\:0-recipe');assert.match(await recipe.locator('summary').innerText(),/ · 普通\n所需等级 1/);await recipe.locator('summary').click();assert.equal(await recipe.locator('.loot-line').count(),4);
 await page.locator('[data-craft-sort="levelReq"]').click();values=await levels();assert.deepEqual(values,[...values].sort((a,b)=>a-b));assert.equal(await recipe.getAttribute('open'),'');
 await page.locator('[data-craft-rarity="2"]').click();assert.match(await page.locator('#craft-61\\:2-recipe summary').innerText(),/ · 稀有/);
 results.cases.push('seven columns, name/rarity and level, default/ascending sorting, highlighted values and locked rows, independent quality rows');
 await page.locator('#craft-settings').evaluate(el=>el.open=true);const runs=await page.evaluate(()=>window.craftRuns.length);
 const data=await page.evaluate(()=>window.craftRuns[0].results.find(r=>r.mode==='rate'&&r.result.key==='61:0').result);
 const xpDetail=page.locator('#craft-61\\:0-xp');await xpDetail.locator('summary').click();
 assert.equal(await xpDetail.locator('.loot-line span').last().innerText(),(data.xp/data.completed).toLocaleString('zh-CN',{maximumFractionDigits:2}));
 const countCell=()=>page.locator('.craft-table [data-craft-count="61:0"]').locator('xpath=ancestor::tr').locator('td').nth(3);
 assert.equal(await countCell().innerText(),data.completed.toLocaleString('zh-CN',{maximumFractionDigits:0}));
 assert.equal(await page.locator('#craft-period').count(),0);assert.deepEqual(await headers(),daily);assert.equal(await page.evaluate(()=>window.craftRuns.length),runs);
 assert.equal(await xpDetail.getAttribute('open'),'');
 await page.locator('#craft-search').fill('no-such-recipe');await checkRows();assert.equal(await table().locator('.empty-results').getAttribute('colspan'),'7');await page.locator('#craft-search').fill('');
 results.cases.push('daily headers and rounded counts match real Worker result; language, filters and empty results preserve cache');
 for(const width of [1440,390])for(const language of ['zh','en']){
  await page.setViewportSize({width,height:1000});await page.selectOption('#language',language);await checkRows();await checkLayout();
  assert.equal(await xpDetail.locator('.loot-line span').first().innerText(),language==='zh'?'平均单次经验':'Average XP per action');assert.equal(await xpDetail.locator('p').count(),0);assert.equal(await recipe.getAttribute('open'),'');
  if(language==='en')assert.deepEqual(await headers(),['Recipe','XP/day','Profit/day','Crafts/day','Material cost / craft','Product value / craft','Order crafts']);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await table().evaluate(el=>el.parentElement.scrollLeft=0);await table().locator('thead').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`${language}-${width}.png`)});
  if(width===390){assert.ok(await table().evaluate(el=>el.parentElement.scrollWidth>el.parentElement.clientWidth));await table().evaluate(el=>el.parentElement.scrollLeft=el.parentElement.scrollWidth);}
  const input=page.locator('.craft-table [data-craft-count="61:0"]');await input.fill('4');await input.blur();await page.waitForFunction(()=>window.craftRuns.at(-1)?.done&&JSON.parse(localStorage.getItem('dvi-crafting-orders-v1')).orders[0].plans['61:0']===4);
  await input.fill('3');await input.blur();await page.waitForFunction(()=>window.craftRuns.at(-1)?.done&&JSON.parse(localStorage.getItem('dvi-crafting-orders-v1')).orders[0].plans['61:0']===3);
 }
 results.cases.push('Chinese/English desktop and 390px, readable name details, contained horizontal scrolling and editable last-column plans');
 await page.setViewportSize({width:1440,height:1000});await page.selectOption('#language','zh');
 await page.evaluate(()=>window.tableMode='wait');await page.locator('#craft-rerun').click();await page.waitForFunction(()=>window.craftRuns.at(-1)?.mode==='wait');await checkRows();assert.equal(await countCell().innerText(),'计算中…');await checkLayout();
 await page.setViewportSize({width:390,height:1000});const input=page.locator('.craft-table [data-craft-count="61:0"]');await input.focus();
 await page.evaluate(()=>{window.focusedCraftInput=document.activeElement;const scroll=document.querySelector('#craft-results .craft-table').parentElement;scroll.scrollLeft=50;window.savedCraftScroll=scroll.scrollLeft;window.tableWorker.onmessage({data:{progress:{completed:1,total:10}}});});
 await page.waitForFunction(()=>document.querySelector('.craft-progress').textContent.includes('1/10'));
 assert.ok(await page.evaluate(()=>document.activeElement===window.focusedCraftInput&&document.querySelector('#craft-results .craft-table').parentElement.scrollLeft===window.savedCraftScroll));
 await page.evaluate(()=>{const worker=window.tableWorker;for(const plan of worker.run.input.plans)worker.onmessage({data:{jobError:{key:plan.key,mode:plan.mode,message:'invalidRoute'}}});worker.onmessage({data:{done:true}});});
 await page.waitForFunction(()=>document.querySelector('[data-craft-count="61:0"]').closest('tr').cells[3].textContent.includes('无法建立制造路线'));await checkRows();await checkLayout();
 results.cases.push('controlled pending/failure rows align; progress redraw preserves exact focused input node and horizontal scroll');
 await page.evaluate(()=>window.tableMode=undefined);await page.locator('[data-craft-skill="smithing"]').click();await page.locator('#craft-search').fill('Colossus blade');
 const upgrade=page.locator('.craft-table [data-craft-count="upgrade-271:0"]').locator('xpath=ancestor::tr');await checkRows();assert.match(await upgrade.locator('td').nth(1).innerText(),/1,900 \/次/);assert.equal(await upgrade.locator('td').nth(3).innerText(),'即时升级');
 const before=await upgrade.innerText();await page.selectOption('#language','en');await page.selectOption('#language','zh');assert.equal(await upgrade.innerText(),before);
 await page.locator('[data-craft-sort="xp"]').click();await checkRows();await page.selectOption('#language','en');assert.match(await upgrade.locator('td').nth(1).innerText(),/\/ upgrade/);
 await page.setViewportSize({width:390,height:1000});await upgrade.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(directory,'upgrade-en-390.png')});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-crafting-orders-v1')));assert.deepEqual(saved.orders[0].plans,{'61:0':3});assert.deepEqual(saved.inventory.items,{20:2});assert.equal(await page.locator('.craft-material-table th').count(),6);
 results.cases.push('instant upgrade per-action units, language invariance, sortable table, narrow layout and new order and stock persistence');
 assert.deepEqual(results.errors,[]);await context.close();
}catch(error){results.errors.push(error.stack??String(error));process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results,null,2));
