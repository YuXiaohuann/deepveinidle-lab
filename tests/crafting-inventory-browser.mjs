import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {craftingDefaults,craftingPlayer} from '../src/crafting-model.js';
import {priceDefaults,setItemPrice} from '../src/item-prices.js';
import {defaults} from '../src/model.js';
const out=path.resolve(process.argv[2]??'.test-artifacts/crafting-inventory/browser');await fs.mkdir(out,{recursive:true});
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const results={cases:[],errors:[]};let browser,page;
try{
 await once(server.stdout,'data');browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const build={...craftingDefaults(),skill:'smithing',hotSetting:'off',owned:{1:999},levels:{...craftingDefaults().levels,smithing:15}};
 const {player}=craftingPlayer({...build,levels:{...build.levels,smithing:55}});player.bank={1:2,2:1};player.pack=[{itemId:1,qty:3},{itemId:1,qty:1},{itemId:2,qty:1}];
 let prices=priceDefaults();prices.preferences.autoImport=false;prices=setItemPrice(prices,1,10);prices=setItemPrice(prices,2,20);
 const combat=defaults();combat.manual.simulationHours=1;combat.manual.enemySelection='monster-1';combat.manual.hotSetting='off';
 const workspace={version:1,build,orders:[{id:'a',name:'A',enabled:true,plans:{'41:0':3},fees:{fixed:5,percent:10,minute:null}},{id:'b',name:'B',enabled:true,plans:{'41:0':4},fees:{fixed:7,percent:0,minute:null}}],currentOrderId:'a'};
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(({workspace,player,prices,combat})=>{
  if(!localStorage.getItem('inventory-test-init')){localStorage.setItem('inventory-test-init','1');localStorage.setItem('dvi-crafting-orders-v1',JSON.stringify(workspace));localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));localStorage.setItem('dvi-simulator-v1',JSON.stringify({state:combat,language:'zh'}));}
  window.inventoryBridge={mode:'hold',reads:[],pending:[],snapshot:{version:2,worldBuffsVersion:1,capturedAt:Date.now(),worldTick:100,worldBuffs:[],player}};
  const send=(id,data)=>document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',version:'2.4',id,...data})}));
  window.replyInventory=()=>{for(const id of window.inventoryBridge.pending.splice(0))send(id,{snapshot:window.inventoryBridge.snapshot});};
  document.addEventListener('dvi-character-request',event=>{const request=JSON.parse(event.detail),bridge=window.inventoryBridge;if(request.action==='probe'){send(request.id,{ready:true});return;}if(bridge.reads.includes(request.id))return;bridge.reads.push(request.id);if(bridge.mode==='hold')bridge.pending.push(request.id);else if(bridge.mode==='error')send(request.id,{error:'read failed'});else send(request.id,{snapshot:bridge.snapshot});});
  window.inventoryWorkerRuns=0;const Original=Worker;window.Worker=class extends Original{postMessage(data,...rest){if(data.plans)window.inventoryWorkerRuns++;return super.postMessage(data,...rest);}};
 },{workspace,player,prices,combat});
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>results.errors.push(error.message));
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-crafting-orders-v1')));
 const stock=id=>page.locator(`[data-craft-inventory="${id}"]`);
 const settle=()=>page.waitForFunction(()=>!document.querySelector('#craft-refresh-inventory').disabled);
 const readCount=()=>page.evaluate(()=>window.inventoryBridge.reads.length);
 const setSnapshot=async(bank,pack=[])=>page.evaluate(({bank,pack})=>{const bridge=window.inventoryBridge;bridge.snapshot={...bridge.snapshot,capturedAt:Date.now(),player:{...bridge.snapshot.player,bank,pack}};},{bank,pack});
 await page.goto(`http://127.0.0.1:${port}/craft`);await page.waitForFunction(()=>window.inventoryBridge.reads.length===1);
 assert.equal(await stock(1).innerText(),'—');assert.equal(await page.locator('[data-craft-owned]').count(),0);assert.equal(await page.locator('.craft-material-table tbody tr').first().locator('td').nth(2).innerText(),'—');assert.equal(await page.locator('.craft-material-table tfoot td').last().innerText(),'—');assert.equal(await page.locator('#craft-import').isDisabled(),true);
 await page.evaluate(()=>window.replyInventory());await settle();assert.equal(await stock(1).innerText(),'6');assert.equal(await stock(2).innerText(),'2');assert.equal(await page.locator('.craft-material-table tfoot td').last().innerText(),'110');assert.equal(await page.locator('[data-craft-field="levels.smithing"]').inputValue(),'15');
 results.cases.push('entry auto-reads only inventory; unknown is not zero; legacy hand stock ignored; warehouse+duplicate backpack merge; purchase budget; read-only stock; shared busy state');
 await page.waitForFunction(()=>document.querySelector('.craft-progress').classList.contains('is-idle'));const workers=await page.evaluate(()=>window.inventoryWorkerRuns),fees=await page.locator('.craft-orders-table tbody td:nth-child(6)').allTextContents();
 await setSnapshot({1:20,2:30});const reads=await readCount();await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));});await page.waitForFunction(n=>window.inventoryBridge.reads.length===n+1,reads);await page.evaluate(()=>window.replyInventory());await settle();assert.equal(await stock(1).innerText(),'20');assert.equal(await page.locator('.craft-material-table tfoot td').last().innerText(),'0');assert.equal(await page.evaluate(()=>window.inventoryWorkerRuns),workers);assert.deepEqual(await page.locator('.craft-orders-table tbody td:nth-child(6)').allTextContents(),fees);
 results.cases.push('focus coalesces reads; refreshing stock does not change character/orders/fees or restart simulations');
 const before=await saved();await page.evaluate(()=>{window.inventoryBridge.mode='immediate';window.inventoryBridge.snapshot.player.pack=[{itemId:1,qty:-1}];window.inventoryBridge.snapshot.capturedAt=Date.now();});await page.locator('#craft-refresh-inventory').click();await settle();assert.equal(await page.locator('#craft-inventory-status').getAttribute('role'),'alert');assert.deepEqual((await saved()).inventory,before.inventory);assert.equal(await stock(1).innerText(),'20');
 await setSnapshot({1:1});await page.evaluate(time=>window.inventoryBridge.snapshot.capturedAt=time-1,before.inventory.capturedAt);await page.locator('#craft-refresh-inventory').click();await settle();assert.match(await page.locator('#craft-inventory-status').innerText(),/早于/);assert.deepEqual((await saved()).inventory,before.inventory);
 results.cases.push('malformed or older snapshots preserve previous inventory and capture time with visible errors');
 await setSnapshot({1:5},[{itemId:1,qty:2}]);await page.locator('#craft-import').click();await settle();await page.waitForFunction(()=>document.querySelector('[data-craft-field="levels.smithing"]')?.value==='55');assert.equal(await stock(1).innerText(),'7');const manual=await saved();assert.deepEqual(manual.orders,before.orders);
 await page.evaluate(()=>{window.inventoryBridge.snapshot.player.skills.smithing=0;window.inventoryBridge.snapshot.player.bank=null;window.inventoryBridge.snapshot.capturedAt=Date.now();});await page.locator('#craft-import').click();await settle();assert.equal(await page.locator('[data-craft-field="levels.smithing"]').inputValue(),'55');assert.deepEqual((await saved()).inventory,manual.inventory);
 results.cases.push('manual configuration import updates inventory from the same snapshot; invalid inventory atomically rejects role and inventory changes');
 await setSnapshot({1:999,2:999});await page.evaluate(()=>window.inventoryBridge.mode='hold');await page.locator('#craft-refresh-inventory').click();await page.locator('#combat-nav').click();await page.evaluate(()=>window.replyInventory());await page.waitForTimeout(50);assert.deepEqual((await saved()).inventory,manual.inventory);
 await page.locator('#craft-nav').click();await page.waitForFunction(()=>window.inventoryBridge.pending.length>0);await setSnapshot({1:8,2:9});await page.evaluate(()=>window.replyInventory());await settle();assert.equal(await stock(1).innerText(),'8');
 const restored=await saved();await page.reload();await page.waitForFunction(()=>window.inventoryBridge.pending.length>0);assert.equal(await stock(1).innerText(),'8');assert.deepEqual((await saved()).orders,restored.orders);await page.evaluate(()=>window.replyInventory());await settle();
 results.cases.push('late replies after leaving the page are discarded; return refreshes; cached inventory and orders survive reload');
 await page.waitForFunction(()=>document.querySelector('.craft-progress').classList.contains('is-idle'),{},{timeout:60000});
 for(const width of [1440,390])for(const language of ['zh','en']){await page.setViewportSize({width,height:1000});await page.selectOption('#language',language);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.craft-material-table').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`inventory-${language}-${width}.png`)});assert.equal(await page.locator('[data-craft-owned]').count(),0);}
 results.cases.push('read-only stock, status, purchase budget and refresh control in Chinese/English desktop and 390px');
 assert.deepEqual(results.errors,[]);results.status='passed';await context.close();
}catch(error){results.errors.push(error.stack??String(error));if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results,null,2));
