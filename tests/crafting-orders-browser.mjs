import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {craftingDefaults} from '../src/crafting-model.js';
import {priceDefaults,setItemPrice} from '../src/item-prices.js';
import {craftingOrdersStorageKey as key,emptyWorkspace} from '../src/crafting-orders.js';
const directory=path.resolve(process.argv[2]??'.test-artifacts/crafting-orders/orders');await fs.mkdir(directory,{recursive:true});
const target=process.argv[3]??null;let server,port;
if(!target){
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
}
const results={target:target??'local',cases:[],errors:[]};let browser,page;
const check=label=>results.cases.push(label);
try{
 if(server)await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited: ${code}`);})]);
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 let prices=priceDefaults();prices.preferences.autoImport=false;for(const id of [1,2,1001,1002])prices=setItemPrice(prices,id,10);
 const workspace=emptyWorkspace();workspace.build={...craftingDefaults(),skill:'smithing',hotSetting:'off',levels:{cooking:1,smithing:15,fletching:1,herblore:1,crafting:1}};
 await context.addInitScript(({key,workspace,prices})=>{
  if(!localStorage.getItem('orders-test-init')){localStorage.setItem('orders-test-init','1');localStorage.setItem(key,JSON.stringify(workspace));localStorage.setItem('dvi-crafting-v1','{"old":true}');localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));localStorage.setItem('orders-test-unrelated','keep');}
  window.stockSnapshot={version:2,capturedAt:Date.now(),player:{bank:{},pack:[]}};
  document.addEventListener('dvi-character-request',event=>{const request=JSON.parse(event.detail);document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',version:'2.4',id:request.id,...(request.action==='probe'?{ready:true}:{snapshot:window.stockSnapshot})})}));});
  const Original=Worker;window.craftRuns=[];window.Worker=class extends Original{constructor(url,options){super(url,options);if(String(url).includes('crafting-worker.js')){this.run={input:null,results:[]};window.craftRuns.push(this.run);this.addEventListener('message',({data})=>{if(data.result)this.run.results.push(data);if(data.done)this.run.done=true;});}}postMessage(data,...rest){if(this.run)this.run.input=data;return super.postMessage(data,...rest);}terminate(){if(this.run)this.run.terminated=true;return super.terminate();}};
 },{key,workspace,prices});
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>results.errors.push(error.message));
 const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const change=async(selector,value)=>{await page.locator(selector).fill(String(value));await page.locator(selector).blur();};
 const setStock=async(id,qty)=>{await page.evaluate(({id,qty})=>{window.stockSnapshot.player.bank[id]=qty;window.stockSnapshot.capturedAt=Date.now();},{id,qty});await page.locator('#craft-refresh-inventory').click();await page.waitForFunction(({id,qty})=>JSON.parse(localStorage.getItem('dvi-crafting-orders-v1')).inventory?.items[id]===qty,{id,qty});};
 const recipe=key=>`.craft-table [data-craft-count="${key}"]`;
 const rowFor=id=>page.locator(`[data-craft-order-enabled="${id}"]`).locator('xpath=ancestor::tr');
 const ready=()=>page.waitForFunction(()=>window.craftRuns.length&&window.craftRuns.every(r=>r.done||r.terminated));
 await page.goto((target??`http://127.0.0.1:${port}`)+'/craft');await ready();
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-crafting-v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('orders-test-unrelated')),'keep');assert.equal(await page.locator(recipe('41:0')).isDisabled(),false);
 const initial=await read();assert.equal(initial.orders.length,1);assert.equal(initial.orders[0].enabled,true);assert.equal(initial.currentOrderId,initial.orders[0].id);
 assert.equal(await page.locator('#craft-orders-panel #craft-order-name').count(),1);assert.equal(await page.locator('#craft-orders-panel .craft-orders-table').count(),1);assert.equal(await page.locator('#craft-recipes-panel #craft-order-name').count(),0);
 assert.equal(await page.locator('#craft-recipes-panel').evaluate(el=>el.nextElementSibling.id),'craft-orders-panel');
 assert.equal(await page.locator('#craft-order-select,#craft-select-all,#craft-select-none,#craft-delete-selected,[data-craft-order-action="edit"]').count(),0);assert.equal(await page.getByRole('heading',{name:'订单明细',exact:true}).count(),1);assert.equal(await page.getByRole('heading',{name:'当前订单设置',exact:true}).count(),0);assert.equal(await page.locator('.craft-order-editor .micro').count(),0);
 await change('#craft-order-name','订单 A');assert.equal(await page.locator('.craft-recipe-heading .craft-editing-order').innerText(),'订单 A');
 assert.ok(await page.locator('.craft-orders-table').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('.craft-order-editor'))&Node.DOCUMENT_POSITION_FOLLOWING)));
 assert.equal(await page.getByRole('heading',{name:'加工费汇总',exact:true}).count(),0);assert.equal(await page.locator('#craft-plan-summary,.craft-summary').count(),0);
 for(const fee of ['fixed','percent','minute'])assert.equal(await page.locator('#craft-fee-'+fee).getAttribute('placeholder'),'0');
 await change(recipe('41:0'),3);await change(recipe('42:0'),2);
 let saved=await read();const a=saved.currentOrderId;assert.deepEqual(saved.orders[0].plans,{'41:0':3,'42:0':2});assert.equal(saved.orders[0].enabled,true);
 await page.locator('#craft-search').fill('Bronze bar');await change('#craft-batch-'+a,5);await page.locator('#craft-batch').click();saved=await read();assert.deepEqual(saved.orders[0].plans,{'41:0':5,'42:0':5});
 await page.locator('#craft-search').fill('');await change(recipe('42:0'),0);await change(recipe('41:0'),3);
 await change('#craft-fee-fixed',100);await change('#craft-fee-percent',10);await change('#craft-fee-minute',7);await ready();
 check('old crafting data removed without unrelated data loss; automatic enabled multi-recipe order; automatic entry and hidden-recipe batch editing; all three zero placeholders');
 await page.locator('[data-craft-order-action="copy"][data-order-id="'+a+'"]').click();saved=await read();const b=saved.currentOrderId;assert.equal(saved.orders[1].enabled,true);assert.equal(saved.orders[1].fees.minute,7);
 await page.locator('#craft-order-name').fill('订单 B 待提交');await rowFor(a).locator('td').nth(1).click();assert.equal((await read()).currentOrderId,a);assert.equal((await read()).orders[1].name,'订单 B 待提交');await rowFor(b).locator('td').nth(1).click();await change('#craft-order-name','订单 B');assert.equal(await page.locator('.craft-recipe-heading .craft-editing-order').innerText(),'订单 B');await change(recipe('41:0'),4);await ready();
 await page.locator(`[data-craft-order-enabled="${a}"]`).check();await page.locator(`[data-craft-order-enabled="${b}"]`).check();assert.equal(await page.locator('.craft-execution-table tbody tr').count(),1);assert.match(await page.locator('.craft-execution-table tbody tr').innerText(),/7/);
 await page.locator('.craft-execution-table summary').click();assert.match(await page.locator('.craft-execution-table .reward-detail>div').innerText(),/订单 A.*3/s);assert.match(await page.locator('.craft-execution-table .reward-detail>div').innerText(),/订单 B.*4/s);
 await setStock(1,5);await setStock(2,100);
 assert.equal(await page.locator('.craft-material-table th').count(),6);assert.match(await page.locator('.craft-material-table thead').innerText(),/库存 \/ 总需求/);
 const purchases=await page.locator('.craft-material-table tbody tr').evaluateAll(rows=>rows.map(row=>row.cells[2].textContent));assert.deepEqual(purchases,['2','0']);
 assert.equal(await page.locator('.craft-material-table tfoot td').last().innerText(),'20');
 const beforeFee=await rowFor(a).locator('td').nth(5).innerText();await setStock(1,100);assert.equal(await rowFor(a).locator('td').nth(5).innerText(),beforeFee);
 check('copy defaults enabled; whole-order selection; merged recipe totals and source detail; material inventory deducted once; stock does not alter percentage fee');
 const runs=await page.evaluate(()=>window.craftRuns.length);await change('[data-craft-price="1"]',20);assert.equal(await page.evaluate(()=>window.craftRuns.length),runs);assert.notEqual(await rowFor(a).locator('td').nth(5).innerText(),beforeFee);
 const variants=await page.evaluate(()=>window.craftRuns.flatMap(r=>r.input?.plans??[]).filter(p=>p.mode!=='rate').map(p=>p.key));assert.ok(variants.includes('41:0/3'));assert.ok(variants.includes('41:0/4'));
 // Independently compute each fee using the actual per-order Worker duration.
 const calculations=await page.evaluate(async key=>{const {orderEstimate}=await import('/src/crafting-orders.js'),{getSnapshot}=await import('/src/price-service.js'),game=await import('/src/upstream.js');const saved=JSON.parse(localStorage.getItem(key)),entries=window.craftRuns.flatMap(r=>r.results).filter(e=>e.mode!=='rate');return saved.orders.map(o=>{const e=orderEstimate(o,getSnapshot(),p=>({result:entries.findLast(e=>e.result.key===`${p.key}/${p.count}`).result}),game.tickMs);return {id:o.id,expected:100+e.material.value*.1+e.minutes*7,actual:e.fees.total};});},key);
 for(const c of calculations){assert.equal(c.actual,c.expected);assert.equal(await rowFor(c.id).locator('td').nth(5).innerText(),c.expected.toLocaleString('zh-CN',{maximumFractionDigits:2}));}
 check('separate count variants use real Worker results; fixed, percentage and exact-minute fees sum per order; price changes revalue without resimulation');
 await page.locator(`[data-craft-order-enabled="${a}"]`).uncheck();await page.locator(`[data-craft-order-enabled="${b}"]`).uncheck();assert.equal((await read()).currentOrderId,b);assert.equal(await page.locator('.craft-execution-table tbody tr').innerText(),'尚未选择执行订单。');assert.equal((await read()).orders.length,2);
 await page.locator(`[data-craft-order-enabled="${a}"]`).check();await rowFor(a).locator('td').nth(1).click();assert.equal((await read()).currentOrderId,a);await rowFor(b).focus();await rowFor(b).press('Enter');assert.equal((await read()).currentOrderId,b);await rowFor(a).focus();await rowFor(a).press(' ');assert.equal((await read()).currentOrderId,a);assert.equal(await rowFor(a).getAttribute('aria-current'),'true');
 await page.locator('#craft-filled').click();
 await change('.craft-order-recipes [data-craft-count="41:0"]',8);await ready();assert.equal((await read()).orders[0].plans['41:0'],8);assert.equal(await page.locator(recipe('41:0')).inputValue(),'8');assert.equal(await page.locator('.craft-execution-table tbody tr').locator('td').last().innerText(),'8');
 const invalid=page.locator('.craft-order-recipes [data-craft-count="41:0"]');await invalid.fill('-1');await invalid.blur();assert.equal((await read()).orders[0].plans['41:0'],8);assert.equal(await invalid.getAttribute('aria-invalid'),'true');await change('.craft-order-recipes [data-craft-count="41:0"]',8);
 await page.locator('#craft-settings').evaluate(el=>el.open=true);assert.equal(await page.locator('#craft-period').count(),0);
 await page.locator('#craft-filled').click();await change(recipe('42:0'),1);await ready();const before=await read();await page.reload();await ready();saved=await read();assert.deepEqual(saved.orders,before.orders);assert.deepEqual(saved.build.owned,before.build.owned);assert.equal(saved.currentOrderId,a);
 await page.locator('#craft-reset').click();saved=await read();assert.deepEqual(saved.orders,before.orders);assert.deepEqual(saved.build.owned,before.build.owned);assert.equal(saved.build.levels.smithing,1);
 assert.match(await rowFor(a).locator('td').nth(4).innerText(),/未完整计算/);assert.match(await rowFor(a).locator('td').nth(5).innerText(),/未完整计算/);
 check('execution deselection preserves orders; edits update plan; invalid counts rejected; refresh preserves current order/fees/selection/stock; build reset preserves orders and blocked time fee stays unknown');
 // Restore unlocked configuration for bilingual layout review.
 await page.locator('#craft-skills').evaluate(el=>el.open=true);await change('[data-craft-field="levels.smithing"]',15);await page.waitForFunction(()=>window.craftRuns.at(-1)?.input?.state.levels.smithing===15&&window.craftRuns.at(-1)?.done);
 for(const width of [1440,390])for(const lang of ['zh','en']){
  await page.setViewportSize({width,height:1000});await page.selectOption('#language',lang);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const alignments=await page.locator('.craft-table th:first-child,.craft-table td:first-child,.craft-order-recipes th:nth-child(2),.craft-order-recipes td:nth-child(2),.craft-execution-table th:nth-child(2),.craft-execution-table td:nth-child(2)').evaluateAll(cells=>cells.map(cell=>getComputedStyle(cell).textAlign));assert.ok(alignments.length>6);assert.ok(alignments.every(value=>value==='right'));
  if(width===1440){const ys=await page.locator('.craft-order-fields input').evaluateAll(inputs=>inputs.map(input=>input.getBoundingClientRect().y));assert.equal(ys.length,4);assert.ok(ys.every(y=>Math.abs(y-ys[0])<1));}
  await page.locator('.craft-order-heading').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`editor-${lang}-${width}.png`)});
  await page.locator('.craft-orders-table').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`orders-${lang}-${width}.png`)});
  await page.locator('.craft-material-table').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`plan-${lang}-${width}.png`)});
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});const longName='测试订单与长名称 '.repeat(10);await change('#craft-order-name',longName);assert.equal(await page.locator('.craft-editing-order').innerText(),longName.trim());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.craft-recipe-heading').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`title-long-${width}.png`)});
 }
 await change('#craft-order-name','订单 A');
 check('recipe heading includes live order name; row click and keyboard selection; four fields on one row; recipe columns right aligned; no bulk controls or selector; no plan-summary panel; bilingual desktop/390px and long-name screenshots recorded');
 await page.selectOption('#language','zh');await rowFor(a).locator('td').nth(1).click();await change('#craft-batch-'+a,0);
 page.once('dialog',d=>d.dismiss());await page.locator('#craft-batch').click();assert.equal(Object.keys((await read()).orders[0].plans).length,2);
 page.once('dialog',d=>d.accept());await page.locator('#craft-batch').click();saved=await read();assert.deepEqual(saved.orders[0].plans,{});assert.equal(saved.orders[0].enabled,true);
 await page.locator(`[data-craft-order-enabled="${a}"]`).check();assert.equal((await read()).orders[0].enabled,true);
 page.once('dialog',d=>d.dismiss());await page.locator(`[data-craft-order-action="delete"][data-order-id="${b}"]`).click();assert.equal((await read()).orders.length,2);assert.equal((await read()).currentOrderId,a);
 page.once('dialog',d=>d.accept());await page.locator(`[data-craft-order-action="delete"][data-order-id="${b}"]`).click();assert.equal((await read()).orders.length,1);
 page.once('dialog',d=>d.accept());await page.locator(`[data-craft-order-action="delete"][data-order-id="${a}"]`).click();assert.equal((await read()).orders.length,1);
 const replacement=(await read()).orders[0];assert.equal(replacement.enabled,true);assert.deepEqual(replacement.plans,{});assert.notEqual(replacement.id,a);assert.notEqual(replacement.id,b);await page.reload();assert.equal((await read()).orders[0].enabled,true);
 check('batch-zero preserves selection, empty orders remain enabled, and deleting the last order recreates one enabled order');
 await page.evaluate(key=>localStorage.setItem(key,'{broken'),key);await page.reload();await page.locator('#craft-reset-storage').waitFor();await page.locator('#craft-new-order').click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'{broken');
 page.once('dialog',d=>d.accept());await page.locator('#craft-reset-storage').click();assert.equal((await read()).orders.length,1);assert.equal((await read()).orders[0].enabled,true);
 check('corrupt storage remains untouched until explicit reset, which creates one enabled order');
 await page.evaluate(key=>localStorage.removeItem(key),key);await page.reload();const fresh=await read();assert.equal(fresh.orders.length,1);assert.equal(fresh.orders[0].enabled,true);
 check('missing storage and valid empty storage both automatically create an editable enabled order; management and list share a panel after recipes');
 await page.evaluate(key=>{const original=Storage.prototype.setItem;window.restoreCraftStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('storage denied');return original.call(this,k,v);};},key);
 await page.locator('#craft-new-order').click();assert.equal((await read()).orders.length,1);assert.match(await page.locator('#craft-save').innerText(),/无法保存/);assert.equal(await page.locator('#craft-order-name').count(),1);
 await page.evaluate(()=>window.restoreCraftStorage());await page.locator('#craft-order-name').fill('恢复保存');await page.locator('#craft-order-name').press('Tab');assert.equal((await read()).orders[1].name,'恢复保存');assert.doesNotMatch(await page.locator('#craft-save').innerText(),/无法保存/);
 check('storage write failure preserves in-memory editing, displays failure and recovers on a subsequent valid save; keyboard Tab commits input');
 assert.deepEqual(results.errors,[]);results.status='passed';await context.close();
}catch(error){results.errors.push(error.stack??String(error));if(page)await page.screenshot({path:path.join(directory,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();server?.kill();await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results,null,2));
