import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {game,preset} from '../src/model.js';
import {priceDefaults} from '../src/item-prices.js';
import {createScenario} from '../src/simulation.js';
import {craftingSkills,craftingSlots} from '../src/crafting-model.js';
import {gatheringSkills,gatheringSlots} from '../src/gathering-model.js';

const args={};
for(let i=2;i<process.argv.length;i+=2){
 const key=process.argv[i],value=process.argv[i+1];
 assert.ok(['--url','--out'].includes(key)&&value&&!Object.hasOwn(args,key),`Invalid argument: ${key}`);args[key]=value;
}
const directory=path.resolve(args['--out']??'.test-artifacts/collection-plan');await fs.mkdir(directory,{recursive:true});
let base=args['--url'],server,browser;
if(base){const url=new URL(base);assert.ok(['http:','https:'].includes(url.protocol),'Expected HTTP(S) URL');base=url.origin;}
const results={cases:[],errors:[]};
function trackPage(page){page.setDefaultTimeout(15000);page.on('pageerror',error=>results.errors.push(error.message));return page;}
try{
 if(!base){
  const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited: ${code}`);})]);
  base=`http://127.0.0.1:${port}`;
 }
 results.base=base;
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});const context=await browser.newContext({viewport:{width:1440,height:960}});
 const build=preset('ranged');build.manual.enemySelection=`monster-${game.monsters[0].id}`;build.manual.simulationHours=1;
 await context.addInitScript(({build,prices})=>{const savedPrices=JSON.parse(localStorage.getItem('dvi-item-prices-v1')??'null')??prices;savedPrices.preferences.autoImport=false;localStorage.setItem('dvi-item-prices-v1',JSON.stringify(savedPrices));if(!localStorage.getItem('dvi-simulator-v1'))localStorage.setItem('dvi-simulator-v1',JSON.stringify({language:'zh',state:build}));window.collectionWorkers=0;const OriginalWorker=Worker;window.Worker=class extends OriginalWorker{constructor(url,options){super(url,options);if(String(url).includes('collection-worker.js'))window.collectionWorkers++;}};},{build,prices:priceDefaults()});
 const {player}=createScenario({});for(const skill of [...craftingSkills,...gatheringSkills])player.skills[skill]=game.levelXp(1);for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;
 Object.assign(player,{house:{},houseFurniture:{},masteries:{},perks:{},ironman:false,homeBank:null});
 const snapshot=JSON.parse(JSON.stringify({version:2,capturedAt:Date.now(),worldBuffsVersion:1,worldTick:player.lastTick,worldBuffs:[],player,guild:null}));
 await context.addInitScript(snapshot=>{
  window.planProgress=9;window.planReads=0;window.planHold=false;window.planFail=false;window.planResponses=[];const seen=new Set();
  document.addEventListener('dvi-character-request',event=>{
   const request=JSON.parse(event.detail);if(request.action!=='read'||seen.has(request.id))return;seen.add(request.id);window.planReads++;
   const response={source:'dvi-character-script',version:'2.4',id:request.id,...(window.planFail?{error:'failed'}:{snapshot:{...snapshot,capturedAt:Date.now(),player:{...snapshot.player,bank:window.planBank??snapshot.player.bank,pack:window.planPack??snapshot.player.pack,collections:{40:window.planProgress}}}})};
   const detail=JSON.stringify(response);if(window.planHold)window.planResponses.push(detail);else document.dispatchEvent(new CustomEvent('dvi-character-response',{detail}));
  });
 },snapshot);
 let marketReads=0,marketFail=false,marketMaterials=false;
 await context.route('https://deepveinidle.com/api/market/prices.json',async route=>{
  marketReads++;
  await route.fulfill({status:marketFail?503:200,contentType:'application/json',body:JSON.stringify({game:'Deep Vein Idle',generatedAt:new Date(await page.evaluate(()=>Date.now())).toISOString(),refreshSeconds:60,items:{40:{lowestSell:20,highestBuy:15},...(marketMaterials?Object.fromEntries([1,2,1001,1002].map(id=>[id,{lowestSell:2,highestBuy:2}])):{})}})});
 });
 const page=trackPage(await context.newPage());let dismissNext=false;const confirmations=[];page.on('dialog',async dialog=>{confirmations.push(dialog.message());assert.equal(dialog.type(),'confirm');if(dismissNext){dismissNext=false;await dialog.dismiss();}else await dialog.accept();});await page.clock.install();
 await page.goto(new URL('/collection',base).href);await page.locator('#collection-section').waitFor({state:'visible'});assert.equal(await page.locator('#collection-buy').inputValue(),'global');await page.locator('#collection-buy').selectOption('ask');
 const until=async expression=>{for(let i=0;i<200;i++){if(await page.evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Condition did not become true: '+expression);};
 const readState=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')));
 const autoRemove=page.locator('[data-plan-auto-remove-completed]');
 assert.equal(await autoRemove.isChecked(),true);await autoRemove.uncheck();
 const button=target=>page.locator(`[data-collection-plan="40:41:${target}"]`);
 const quantity=()=>page.locator('[data-plan-material="1"] [data-plan-quantity]').innerText();
 assert.equal(await page.locator('#collection-auto-import').isChecked(),false);assert.equal(await page.locator('#collection-auto-status').isVisible(),false);assert.equal(await page.evaluate(()=>window.planReads),0);
 await page.locator('#collection-import').click();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===9);
 await until(()=>!document.querySelector('#collection-import').disabled);assert.equal(marketReads,1);assert.match(await page.locator('#collection-import-status').innerText(),/市场数据已更新/);
 await page.locator('#collection-search').fill('青铜锭');await page.locator('#collection-tier').selectOption('0');
 await button(10).click();assert.equal(await quantity(),'1');assert.equal(await page.locator('[data-plan-material="1"] [data-plan-coverage]').innerText(),'0%');await button(100).click();assert.equal(await quantity(),'91');await button(1000).click();assert.equal(await quantity(),'991');assert.notEqual(await page.locator('[data-plan-time]').innerText(),'—');
 assert.equal(await page.locator('[data-plan-item]').count(),1);assert.equal(await button(10).isDisabled(),true);assert.equal(await button(100).isDisabled(),true);assert.match(await page.locator('#collection-plan-summary').innerText(),/14/);assert.equal(await page.locator('[data-collection-key="40:41:1000"]').evaluate(e=>e.open),false);
 assert.equal(await page.locator('.collection-information').getByText('纯动作估算',{exact:true}).count(),0);
 assert.equal(await page.locator('#collection-plan').getByText('纯动作估算',{exact:true}).count(),0);
 assert.equal(await button(1000).evaluate(e=>{const cell=e.parentElement;return cell.classList.contains('collection-plan-action')&&cell===cell.parentElement.lastElementChild&&cell.parentElement.firstElementChild.classList.contains('collection-item');}),true);
 assert.equal(await page.locator('.collection-plan-selections tbody button').count(),0);
 assert.deepEqual(await page.locator('.collection-plan-selections th').evaluateAll(es=>es.map(e=>e.childNodes[0].textContent.trim())),['物品 ↕','稀有度 ↕','执行次数 ↕','完成进度','操作']);
 assert.deepEqual(await page.locator('[data-plan-item="40"] td:nth-child(-n+4)').allTextContents(),['青铜锭','普通','991','9 / 1,000 · 0%']);
 assert.equal(await page.locator('[data-plan-table="materials"][data-plan-sort="coverage"]').count(),0);assert.equal(await page.locator('.collection-plan-materials th:nth-child(4) button').count(),0);assert.equal(await page.locator('.collection-plan-materials th:nth-child(4)').getAttribute('aria-sort'),null);
 assert.deepEqual(await page.locator('.collection-plan-materials th').evaluateAll(es=>es.map(e=>e.childNodes[0].textContent.trim())),['物品 ↕','稀有度 ↕','需要采购 ↕','库存 / 需求','单价 ↕','总价 ↕']);assert.equal(await page.locator('.collection-plan-materials details,.collection-plan-materials article').count(),0);assert.doesNotMatch(await page.locator('#collection-plan').innerText(),/贡献方案|Contributing routes/);
 assert.equal(await page.locator('[data-plan-material="1"]').getByText('缺报价',{exact:false}).count()>0,true);
 assert.equal(await page.locator('[data-plan-total-cost]').innerText(),'0');assert.equal(await page.locator('[data-plan-missing-prices]').innerText(),'（缺价 2 项，仅计已知价格）');assert.equal(await page.locator('#collection-plan > p[role="status"]').count(),0);
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());prices.quotes[1]={ask:{value:2,capturedAt:Date.now()},bid:{value:2,capturedAt:Date.now()}};updatePrices(prices);});
 for(const language of ['zh','en']){
  await page.selectOption('#language',language);await page.setViewportSize({width:390,height:960});
  assert.equal(await page.locator('[data-plan-total-cost]').innerText(),'1,982');assert.equal(await page.locator('#collection-plan > p[role="status"]').count(),0);
  assert.equal(await page.locator('[data-plan-missing-prices]').innerText(),language==='zh'?'（缺价 1 项，仅计已知价格）':'(Missing prices: 1; known subtotal only)');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#collection-plan').screenshot({path:path.join(directory,`partial-cost-${language}-390.png`)});
 }
 await page.selectOption('#language','zh');await page.setViewportSize({width:1440,height:960});
 results.cases.push('summary displays known priced purchase subtotal for partial/all missing prices with explicit bilingual notice and no mobile overflow');

 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const id of [1,2,1001,1002])prices.quotes[id]={ask:{value:2,capturedAt:Date.now()},bid:{value:2,capturedAt:Date.now()}};updatePrices(prices);});assert.match(await page.locator('#collection-plan-summary').innerText(),/3,964/);assert.equal(await page.locator('[data-plan-missing-prices]').count(),0);
 await page.locator('#collection-buy').selectOption('vendor');assert.match(await page.locator('#collection-plan-summary').innerText(),new RegExp((991*(game.vendorPrice(1)+game.vendorPrice(2))).toLocaleString('zh-CN')));await page.locator('#collection-buy').selectOption('ask');
 await page.locator('#collection-search').fill('nothing matches');assert.equal(await page.locator('.collection-card').count(),0);assert.equal(await quantity(),'991');
 await page.locator('[data-plan-decrease="40"]').focus();await page.locator('[data-plan-decrease="40"]').press('Enter');assert.equal(await quantity(),'91');assert.equal(await page.locator('[data-plan-item="40"] [data-plan-progress]').innerText(),'9 / 100 · 9%');assert.equal(await page.locator('.collection-card').count(),0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1')).selections[0].target),100);await page.locator('[data-plan-increase="40"]').focus();await page.locator('[data-plan-increase="40"]').press('Space');assert.equal(await quantity(),'991');

 for(let i=0;i<3;i++)await page.locator('[data-plan-decrease="40"]').click();assert.equal(await page.locator('[data-plan-decrease="40"]').isDisabled(),true);assert.equal(await page.locator('[data-plan-decrease="40"]').getAttribute('tabindex'),'-1');await page.locator('[data-plan-decrease="40"]').dispatchEvent('click');assert.equal(await page.locator('[data-plan-item="40"] td:nth-child(3)').innerText(),'0');assert.equal(await page.locator('[data-plan-progress]').innerText(),'9 / 1 · 已完成');
 for(let i=0;i<7;i++)await page.locator('[data-plan-increase="40"]').click();assert.equal(await page.locator('[data-plan-increase="40"]').isDisabled(),true);for(let i=0;i<4;i++)await page.locator('[data-plan-decrease="40"]').click();assert.equal(await quantity(),'991');
 await page.locator('#collection-filter-points').fill('-1');assert.equal(await quantity(),'991');await page.locator('#collection-filter-points').fill('');await page.locator('#collection-search').fill('青铜锭');
 await button(1000).click();await button(100).click();assert.equal(await quantity(),'91');await button(100).click();await button(10).click();assert.equal(await quantity(),'1');await button(10).click();assert.equal(await page.locator('[data-plan-item]').count(),0);
 await button(1000).click();await page.locator('#collection-tier').selectOption('1');await page.locator('[data-collection-plan="1040:41:10"]').click();assert.equal(await page.locator('[data-plan-item]').count(),2);assert.equal(await page.locator('[data-plan-material="1001"] [data-plan-quantity]').innerText(),'10');assert.equal(await quantity(),'991');
 for(let i=0;i<3;i++)await page.locator('[data-plan-decrease="40"]').click();
 assert.deepEqual(await page.locator('[data-plan-item]').evaluateAll(es=>es.map(e=>e.dataset.planItem)),['40','1040']);
 assert.match(await page.locator('#collection-plan-summary').innerText(),/已选方案 2 · 已完成 1/);
 assert.equal(await page.locator('[data-plan-item]').count(),2);
 for(let i=0;i<3;i++)await page.locator('[data-plan-increase="40"]').click();
 assert.equal(await page.locator('[data-plan-item]').count(),2);
 for(let i=0;i<3;i++)await page.locator('[data-plan-decrease="40"]').click();
 assert.equal(confirmations.length,0);
 const mixedState=await page.evaluate(()=>localStorage.getItem('dvi-collection-v1'));
 await autoRemove.check();assert.deepEqual(await page.locator('[data-plan-item]').evaluateAll(es=>es.map(e=>e.dataset.planItem)),['1040']);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1')).selections.map(e=>e.itemId)),[1040]);assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-collection-v1')),mixedState);
 await page.locator('#collection-tier').selectOption('0');await button(1000).click();await page.locator('#collection-tier').selectOption('1');assert.equal(await autoRemove.count(),1);
 assert.equal(confirmations.length,0);
 for(let i=0;i<3;i++)await page.locator('[data-plan-decrease="40"]').click();assert.equal(await page.locator('[data-plan-item="40"]').count(),0);await page.locator('#collection-tier').selectOption('0');await button(1000).click();await page.locator('#collection-tier').selectOption('1');await autoRemove.uncheck();
 results.cases.push('auto-remove immediately prunes mixed completed targets and target decreases without confirmation; it preserves character data and remaining routes');
 await until(()=>!document.querySelector('#collection-import').disabled);
 marketMaterials=true;await page.evaluate(()=>window.planBank={1:10,2:2000,1001:3,1002:10});
 await page.locator('#collection-import').click();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).bank?.[1]===10&&!document.querySelector('#collection-import').disabled);
 assert.deepEqual(await page.locator('[data-plan-material="1"] td').allTextContents(),['铜矿','普通','981','10 / 991 · 1%','2','1,962']);
 assert.deepEqual(await page.locator('[data-plan-material="2"] td').allTextContents(),['锡矿','普通','0','2,000 / 991 · 100%','2','0']);
 assert.equal(await page.locator('[data-plan-material="1001"] [data-plan-purchase]').innerText(),'7');assert.match(await page.locator('#collection-plan-summary').innerText(),/1,976/);assert.equal(await page.locator('[data-collection-key="1040:41:1000"] .collection-total-cost').innerText(),'总材料成本\n4,000');
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());delete prices.quotes[2];updatePrices(prices);});
 assert.equal(await page.locator('[data-plan-material="2"] [data-plan-cost]').innerText(),'0');assert.doesNotMatch(await page.locator('#collection-plan').innerText(),/缺报价|未完整计算/);
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());prices.quotes[2]={ask:{value:2,capturedAt:Date.now()},bid:{value:2,capturedAt:Date.now()}};updatePrices(prices);});
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());prices.quotes[1].ask.value=2.49;updatePrices(prices);});
 assert.equal(await page.locator('[data-plan-material="1"] td:nth-child(5)').innerText(),'2');assert.equal(await page.locator('[data-plan-material="1"] [data-plan-cost]').innerText(),'2,443');assert.match(await page.locator('#collection-plan-summary').innerText(),/2,456.69/);
 const stockState=await readState();await page.evaluate(()=>window.planBank={1:-1});await page.locator('#collection-import').click();await until(()=>document.querySelector('#collection-import-status').textContent.includes('格式不兼容'));
 assert.deepEqual(await readState(),stockState);assert.equal(await page.locator('[data-plan-material="1"] [data-plan-inventory]').innerText(),'10');
 await page.evaluate(()=>window.planBank={1:10,2:2000,1001:3,1002:10});await page.locator('#collection-import').click();await until(()=>!document.querySelector('#collection-import').disabled);
 const checkSorting=async()=>{
  const stored=await page.evaluate(()=>localStorage.getItem('dvi-collection-plan-v1'));
  for(const [table,keys,rowAttribute]of [['selections',['item','tier','remaining'],'data-plan-item'],['materials',['item','tier','purchase','price','cost'],'data-plan-material']]){
   const other=table==='selections'?'materials':'selections',otherRows=await page.locator(`.collection-plan-${other} tbody tr`).allTextContents();
   for(const key of keys)for(const direction of ['asc','desc']){
    await page.locator(`[data-plan-table="${table}"][data-plan-sort="${key}"]`).click();
    assert.equal(await page.locator(`[data-plan-table="${table}"][data-plan-sort="${key}"]`).locator('..').getAttribute('aria-sort'),direction==='asc'?'ascending':'descending');
    const expected=await page.evaluate(async({table,key,direction})=>{
     const {calculateCollectionPlan}=await import('/src/collection-plan.js'),game=await import('/src/upstream.js'),{translatedItemName}=await import('/src/i18n.js'),{getSnapshot}=await import('/src/price-service.js');
     const result=calculateCollectionPlan(JSON.parse(localStorage.getItem('dvi-collection-v1')),JSON.parse(localStorage.getItem('dvi-collection-plan-v1')),getSnapshot());
     const value=row=>key==='item'?translatedItemName(row.itemId,'zh'):key==='tier'?game.itemTier(row.itemId):row[key];
     return (table==='selections'?result.entries:result.materials).sort((a,b)=>{
      const av=value(a),bv=value(b);if(av==null||bv==null)return av==null?(bv==null?a.itemId-b.itemId:1):-1;
      return (direction==='asc'?1:-1)*(key==='item'?av.localeCompare(bv,'zh-CN'):av-bv)||a.itemId-b.itemId;
     }).map(row=>String(row.itemId));
    },{table,key,direction});
    assert.deepEqual(await page.locator(`.collection-plan-${table} tbody tr`).evaluateAll((rows,attr)=>rows.map(row=>row.getAttribute(attr)),rowAttribute),expected);
    assert.deepEqual(await page.locator(`.collection-plan-${other} tbody tr`).allTextContents(),otherRows);
   }
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-collection-plan-v1')),stored);
 };
 await checkSorting();
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());window.sortQuote=prices.quotes[1];delete prices.quotes[1];updatePrices(prices);});
 await checkSorting();
 for(const key of ['price','cost']){
  const button=page.locator(`[data-plan-table="materials"][data-plan-sort="${key}"]`);
  await button.focus();await button.press('Enter');
  assert.equal(await button.locator('..').getAttribute('aria-sort'),'ascending');
  assert.equal(await page.locator('.collection-plan-materials tbody tr').last().getAttribute('data-plan-material'),'1');
  await button.press('Space');assert.equal(await button.locator('..').getAttribute('aria-sort'),'descending');
  assert.equal(await page.locator('.collection-plan-materials tbody tr').last().getAttribute('data-plan-material'),'1');
 }
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());prices.quotes[1]=window.sortQuote;updatePrices(prices);});
 results.cases.push('unknown prices and totals remain last in both directions; sort headers support Enter and Space');
 results.cases.push('each sortable column toggles ascending/descending using raw values and rarity order, with independent tables and unchanged plan storage');
 results.cases.push('warehouse import updates six ordered material columns with stock coverage and net cost; sufficient stock without quotes costs zero, invalid warehouse preserves the entire state');
 results.cases.push('highest-target deduplication, included lower milestones, editable target/actions table, material table without contributors and list reselection, quality separation, material prices and filter-independent selections');
 for(const [language,width]of [['zh',1440],['zh',390],['en',1440],['en',390]]){await page.setViewportSize({width,height:960});await page.selectOption('#language',language);assert.equal(await page.locator('[data-plan-item]').count(),2);assert.ok(await page.locator('.collection-plan-actions').evaluateAll(es=>es.every(e=>{const rects=[...e.querySelectorAll('.collection-plan-control')].map(b=>b.getBoundingClientRect());return e.scrollWidth<=e.clientWidth+1&&Math.abs(rects[0].top-(e.closest('tr').querySelector('td').getBoundingClientRect().top+8))<2&&(getComputedStyle(e).flexDirection==='row'&&rects.every(r=>Math.abs((r.top+r.bottom)-(rects[0].top+rects[0].bottom))<2));})));assert.equal(await page.locator('.collection-plan-actions select,.collection-plan-actions label').count(),0);assert.deepEqual(await page.locator('[data-plan-item="40"] .collection-plan-actions .collection-plan-control').allTextContents(),language==='zh'?['增加','减少','移除']:['Increase','Decrease','Remove']);assert.ok(await page.locator('.collection-plan-command-group').evaluate(e=>getComputedStyle(e).borderLeftWidth==='1px'));assert.equal(await page.locator('.collection-plan-toolbar>label:first-child [data-plan-auto-remove-completed]').count(),1);assert.equal(await page.locator('[data-plan-import] + [data-plan-clear]').count(),1);assert.equal(await page.locator('#collection-title').innerText(),language==='zh'?'角色配置':'Character build');assert.equal(await page.locator('[data-plan-table="materials"][data-plan-sort="cost"]').locator('..').getAttribute('aria-sort'),'descending');assert.equal(await page.locator('#collection-plan h2').innerText(),language==='zh'?'执行计划':'Execution plan');assert.equal(await page.locator('#collection-plan').getAttribute('aria-label'),language==='zh'?'执行计划':'Execution plan');assert.equal(await page.locator('#collection-filters-help,[aria-describedby="collection-filters-help"]').count(),0);assert.doesNotMatch(await page.locator('.collection-information').innerText(),/新增精通点按大于等于筛选|市场模式仅使用游戏API报价|Points gained use ≥|Market modes use game API quotes/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(directory,`plan-${language}-${width}.png`),fullPage:true});if(width===390){await page.locator('.collection-plan-table-wrap').evaluateAll(es=>es.forEach(e=>e.scrollLeft=e.scrollWidth));assert.ok(await page.locator('.collection-plan-table-wrap').evaluateAll(es=>es.length===2&&es.every(e=>[...e.querySelectorAll('tr>:first-child')].every(cell=>{const style=getComputedStyle(cell);return style.position==='sticky'&&Math.abs(cell.getBoundingClientRect().left-e.getBoundingClientRect().left)<2&&style.backgroundColor!=='rgba(0, 0, 0, 0)';}))));assert.ok(await page.locator('[data-plan-remove="40"]').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('.collection-plan-table-wrap').getBoundingClientRect();const frozen=e.closest('tr').querySelector('td').getBoundingClientRect();return r.left>=Math.max(p.left,frozen.right)&&r.right<=p.right+1;}));await page.screenshot({path:path.join(directory,`plan-${language}-${width}-actions.png`),fullPage:true});await page.locator('.collection-plan-table-wrap').evaluateAll(es=>es.forEach(e=>e.scrollLeft=0));}}
 await page.selectOption('#language','zh');await page.reload();await until(()=>document.querySelectorAll('[data-plan-item]').length===2);assert.equal(await quantity(),'991');assert.equal(await page.locator('#collection-auto-import').isChecked(),false);
 assert.equal(await page.locator('[data-plan-material="1"] [data-plan-inventory]').innerText(),'10');
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('dvi-collection-v1'));delete state.pack;localStorage.setItem('dvi-collection-v1',JSON.stringify(state));});await page.reload();
 assert.equal(await page.locator('[data-plan-material="1"] [data-plan-inventory]').innerText(),'—');assert.equal(await page.locator('[data-plan-material="1"] [data-plan-purchase]').innerText(),'—');assert.match(await page.locator('#collection-plan').innerText(),/仓库或背包数据未知/);assert.equal(await page.locator('[data-plan-total-cost]').innerText(),'—');assert.equal(await page.locator('[data-plan-missing-prices]').count(),0);assert.equal(await page.locator('#collection-plan > p[role="status"]').count(),1);assert.equal(await page.locator('[data-plan-material="1"] [data-plan-stock]').innerText(),'— / 991 · —');await checkSorting();
 await page.locator('[data-plan-remove="1040"]').click();await page.locator('#collection-reset').click();assert.equal(await page.locator('[data-plan-item]').count(),1);assert.match(await page.locator('#collection-plan').innerText(),/未完整计算/);assert.equal(await page.locator('[data-plan-progress]').innerText(),'—');assert.equal(await autoRemove.count(),1);
 await page.locator('#collection-import').click();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===9);assert.equal(await quantity(),'991');
 await autoRemove.uncheck();
 await page.evaluate(()=>window.planProgress=1000);await page.locator('#collection-import').click();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===1000);assert.equal(await page.locator('[data-plan-item]').count(),1);assert.match(await page.locator('#collection-plan-summary').innerText(),/已完成 1/);assert.equal(await page.locator('[data-plan-material]').count(),0);
 const completedPlan=await page.evaluate(()=>localStorage.getItem('dvi-collection-plan-v1'));
 assert.equal(await page.locator('[data-plan-progress]').innerText(),'1,000 / 1,000 · 已完成');
 await page.locator('[data-plan-table="selections"][data-plan-sort="remaining"]').click();
 await page.selectOption('#language','en');assert.equal(await page.locator('[data-plan-item]').count(),1);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-collection-plan-v1')),completedPlan);
 assert.equal(await autoRemove.isChecked(),false);
 const completedState=await page.evaluate(()=>localStorage.getItem('dvi-collection-v1'));
 await page.selectOption('#language','zh');await page.reload();assert.equal(await autoRemove.isChecked(),true);assert.equal(await page.locator('[data-plan-item]').count(),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-collection-v1')),completedState);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1')).selections),[]);
 await page.evaluate(()=>window.planProgress=9);await page.locator('#collection-import').click();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===9);
 await page.locator('#collection-search').fill('青铜锭');await page.locator('#collection-tier').selectOption('0');await button(1000).click();
 results.cases.push('opt-out retains completed routes across sorting and language; reload restores default-on, prunes saved completed targets and preserves character state');
 results.cases.push('both compact plan tables keep first-column headers and cells visible when scrolling is needed in Chinese and English at 390px');
 results.cases.push('plan save/reload, config reset retention with unavailable state, imports recompute remaining needs with automatic removal of completed selections');
 await until(()=>!document.querySelector('#collection-import').disabled);
 const quotesBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-item-prices-v1')).quotes);
 marketFail=true;await page.locator('#collection-import').click();await until(()=>!document.querySelector('#collection-import').disabled);
 assert.match(await page.locator('#collection-import-status').innerText(),/已导入[\s\S]*市场更新失败/);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-item-prices-v1')).quotes),quotesBefore);assert.equal(await quantity(),'991');marketFail=false;
 results.cases.push('successful manual imports refresh official quotes; market failure retains imported character, plan and prior quotes');
 await page.clock.pauseAt(new Date(Date.now()+1000));const initialReads=await page.evaluate(()=>window.planReads);
 await page.locator('#collection-auto-import').check();await until(()=>document.querySelector('#collection-import-status').textContent.includes('已导入'));assert.equal(await page.evaluate(()=>window.planReads),initialReads+1);
 await until(()=>!document.querySelector('#collection-import').disabled);const marketBaseline=marketReads;const baseline=await page.evaluate(()=>window.planReads);await page.evaluate(()=>window.planBank={1:100});await page.clock.runFor(59000);assert.equal(await page.evaluate(()=>window.planReads),baseline);await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>window.planReads),baseline);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await until(()=>!document.querySelector('#collection-import').disabled);assert.equal(await page.evaluate(()=>window.planReads),baseline+1);assert.equal(marketReads,marketBaseline+1);assert.equal((await readState()).bank[1],100);assert.equal(await page.locator('[data-plan-material="1"] [data-plan-purchase]').innerText(),'891');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await until(()=>!document.querySelector('#collection-import').disabled);assert.equal(await page.evaluate(()=>window.planReads),baseline+2);
 await page.selectOption('#language','en');await page.selectOption('#language','zh');assert.equal(await page.evaluate(()=>window.planReads),baseline+2);
 await page.locator('#mastery-nav').click();await page.clock.runFor(60000);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.evaluate(()=>window.planReads),baseline+2);await page.goBack();await until(()=>window.planReads>0&&!document.querySelector('#collection-import').disabled);assert.equal(await page.evaluate(()=>window.planReads),baseline+3);
 results.cases.push('auto import defaults off, immediate enable, no timer polling, every completed focus, redraw stability, section pause and return resume');
 await page.clock.runFor(1100);await page.evaluate(()=>{window.planHold=true;window.planProgress=99;window.dispatchEvent(new Event('focus'));});const heldCount=await page.evaluate(()=>window.planReads);assert.equal(await page.locator('#collection-import').isDisabled(),true);
 await page.clock.runFor(1100);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.evaluate(()=>window.planReads),heldCount);await page.locator('#collection-auto-import').uncheck();await page.evaluate(()=>{const detail=window.planResponses.shift();document.dispatchEvent(new CustomEvent('dvi-character-response',{detail}));window.planHold=false;});await until(()=>!document.querySelector('#collection-import').disabled);assert.equal((await readState()).counts[40],9);assert.equal((await readState()).bank[1],100);
 await page.clock.runFor(60000);assert.equal(await page.evaluate(()=>window.planReads),heldCount);
 await page.locator('#collection-auto-import').check();await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]===99);assert.equal(await quantity(),'901');
 await page.clock.runFor(1100);await page.evaluate(()=>{window.planHold=true;window.planProgress=1000;window.dispatchEvent(new Event('focus'));});await page.locator('#collection-levels').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.levels.smithing"]').fill('5');await page.locator('[data-collection-path="config.levels.smithing"]').press('Tab');await page.evaluate(()=>{const detail=window.planResponses.shift();document.dispatchEvent(new CustomEvent('dvi-character-response',{detail}));window.planHold=false;});await until(()=>!document.querySelector('#collection-import').disabled);assert.equal((await readState()).counts[40],99);assert.equal((await readState()).config.levels.smithing,5);
 const beforeDraft=await page.evaluate(()=>window.planReads);await page.locator('[data-collection-path="config.levels.smithing"]').fill('7');await page.clock.runFor(1100);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.evaluate(()=>window.planReads),beforeDraft);await page.locator('[data-collection-path="config.levels.smithing"]').press('Tab');
 results.cases.push('automatic reads never overlap; disabling drops held responses, edits invalidate stale captures and uncommitted inputs defer auto-import');
 await page.clock.runFor(1100);await page.evaluate(()=>{window.planFail=true;window.dispatchEvent(new Event('focus'));});await until(()=>document.querySelector('#collection-import-status').textContent.includes('读取失败'));const failed=await page.evaluate(()=>window.planReads);assert.equal((await readState()).counts[40],99);assert.equal(await page.locator('#collection-auto-import').isChecked(),true);
 await page.clock.runFor(60000);assert.equal(await page.evaluate(()=>window.planReads),failed);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await until(()=>!document.querySelector('#collection-import').disabled);assert.equal(await page.evaluate(()=>window.planReads),failed+1);await page.evaluate(()=>window.planFail=false);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await until(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]===1000);assert.match(await page.locator('#collection-plan-summary').innerText(),/已完成 0/);assert.equal(await page.locator('[data-plan-item]').count(),0);
 await page.reload();await until(()=>window.planReads===1&&!document.querySelector('#collection-import').disabled);assert.equal(await page.locator('#collection-auto-import').isChecked(),true);assert.equal((await readState()).counts[40],9);assert.equal(await page.locator('[data-plan-item]').count(),0);await page.locator('#collection-auto-import').uncheck();await button(1000).click();assert.equal(await quantity(),'991');
 results.cases.push('failed captures preserve role/plan, keep auto enabled and retry; persisted opt-in resumes one immediate import after refresh');
 await page.locator('[data-plan-clear]').click();assert.equal(await page.locator('[data-plan-item]').count(),0);assert.equal((await readState()).counts[40],9);
 const roundedMaterial=await page.evaluate(async()=>{
  const game=await import('/src/upstream.js'),{collectionDefaults,collectionRoutes}=await import('/src/collection-model.js'),{priceDefaults}=await import('/src/item-prices.js');
  const job=game.recipes.find(j=>j.skill==='cooking'&&j.burn&&!j.retired&&collectionRoutes(j.output.itemId).some(r=>r.id===j.id));
  const state={...collectionDefaults(),buyMode:'ask',initialized:true,bank:{},pack:{},counts:{}};state.config.levels.cooking=job.levelReq;
  const prices=priceDefaults(),inputs=game.recipeInputs(job,0);
  for(const input of inputs){state.bank[input.itemId]=1;prices.quotes[input.itemId]={ask:{value:2.5,capturedAt:Date.now()}};}
  localStorage.setItem('dvi-collection-v1',JSON.stringify(state));localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));localStorage.setItem('dvi-collection-plan-v1',JSON.stringify({version:1,selections:[{itemId:job.output.itemId,jobId:job.id,target:1}]}));
  return inputs[0].itemId;
 });
 await page.reload();
 const roundedRow=page.locator(`[data-plan-material="${roundedMaterial}"]`);
 assert.equal(await roundedRow.locator('[data-plan-quantity]').innerText(),'2');assert.equal(await roundedRow.locator('[data-plan-inventory]').innerText(),'1');assert.equal(await roundedRow.locator('[data-plan-purchase]').innerText(),'1');assert.equal(await roundedRow.locator('[data-plan-cost]').innerText(),'3');assert.equal(await roundedRow.locator('[data-plan-stock]').innerText(),'1 / 2 · 50%');
 await page.screenshot({path:path.join(directory,'plan-rounded-quantities.png'),fullPage:true});
 results.cases.push('fractional burn demand rounds up to whole units, deducts integer stock and prices rounded purchase using the original quote');
 await page.evaluate(async()=>{
  const {collectionDefaults}=await import('/src/collection-model.js');const state=collectionDefaults();state.initialized=true;state.pack={};state.bank={1:1234567,2:1234567};state.config.levels.smithing=100;state.buyMode='vendor';
  localStorage.setItem('dvi-collection-v1',JSON.stringify(state));localStorage.setItem('dvi-collection-plan-v1',JSON.stringify({version:1,selections:[{itemId:40,jobId:41,target:10000000},{itemId:1040,jobId:41,target:10000000}]}));
 });await page.reload();
 for(const language of ['zh','en'])for(const width of [320,390,768]){
  await page.setViewportSize({width,height:960});await page.selectOption('#language',language);
  assert.ok(await page.locator('.collection-plan-table th').evaluateAll(es=>es.every(e=>{
   const rect=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const content=range.getBoundingClientRect();
   return getComputedStyle(e).verticalAlign==='middle'&&Math.abs((content.top+content.bottom)-(rect.top+rect.bottom))<5;
  })));
  assert.ok(await page.locator('.collection-plan-table .sort-header').evaluateAll(es=>es.every(e=>getComputedStyle(e).minHeight==='0px')));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.locator('.collection-plan-table-wrap').evaluateAll(es=>es.every(e=>e.scrollWidth<500)));
  assert.equal(await page.locator('[data-plan-item="40"] td:nth-child(3)').innerText(),'10,000,000');assert.equal(await page.locator('[data-plan-material="1"] [data-plan-coverage]').innerText(),'12%');
  assert.ok(await page.locator('.collection-plan-materials tbody td:not(:first-child):not([data-plan-stock]),.collection-plan-selections tbody td:nth-child(3)').evaluateAll(es=>es.every(e=>getComputedStyle(e).whiteSpace==='nowrap'&&e.scrollWidth<=e.clientWidth+1)));
  assert.ok(await page.locator('.collection-plan-actions').evaluateAll(es=>es.every(e=>getComputedStyle(e).flexDirection==='row')));
  await page.locator('#collection-plan').screenshot({path:path.join(directory,`compact-large-${language}-${width}.png`)});
 }
 results.cases.push('compact tables preserve full large numbers and sorting headers at 320/390/768px in both languages, keep actions horizontal and contain overflow');
 await page.evaluate(()=>{
  const state=JSON.parse(localStorage.getItem('dvi-collection-v1'));state.counts={40:29};state.bank={1001:29};localStorage.setItem('dvi-collection-v1',JSON.stringify(state));
  const plan=JSON.parse(localStorage.getItem('dvi-collection-plan-v1'));plan.selections.forEach(entry=>entry.target=100);localStorage.setItem('dvi-collection-plan-v1',JSON.stringify(plan));
 });await page.reload();
 assert.match(await page.locator('[data-plan-item="40"] [data-plan-progress]').innerText(),/29%$/);
 assert.equal(await page.locator('[data-plan-material="1001"] [data-plan-coverage]').innerText(),'29%');
 results.cases.push('both percentages floor to whole numbers, including sub-one progress and fractional coverage, and exact 29 percent stays 29');
 await page.evaluate(()=>{window.planProgress=9;window.planBank={1:3,2:1};window.planPack=[{itemId:1,qty:4},{itemId:1,qty:2},{itemId:1001,qty:8}];});
 await page.locator('#collection-import').click();await until(()=>!document.querySelector('#collection-import').disabled);
 assert.equal(await page.locator('[data-plan-material="1"] [data-plan-inventory]').innerText(),'9');
 assert.equal(await page.locator('[data-plan-material="1"] [data-plan-purchase]').innerText(),'82');
 assert.equal(await page.locator('[data-plan-material="1001"] [data-plan-inventory]').innerText(),'8');
 await page.evaluate(()=>{window.planBank={};window.planPack=[];});
 results.cases.push('warehouse and duplicate backpack stacks combine by exact item quality and reduce purchases');
 await page.evaluate(()=>{
  window.clipboardValue='';window.clipboardFail=false;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
   writeText:async value=>{if(window.clipboardFail)throw Error('denied');window.clipboardValue=value;},
   readText:async()=>{if(window.clipboardFail)throw Error('denied');if(window.clipboardHold)return new Promise(resolve=>window.clipboardRelease=resolve);return window.clipboardValue;},
  }});
 });
 await autoRemove.uncheck();
 for(const lang of ['zh','en']){
  await page.selectOption('#language',lang);
  assert.deepEqual(await page.locator('.collection-plan-toolbar button').allTextContents(),lang==='zh'?['导出','导入','清空']:['Export','Import','Clear']);
  assert.equal(await page.locator('.collection-plan-auto-remove').innerText(),lang==='zh'?'自动移除已完成':'Auto-remove completed');
 }
 await page.evaluate(async()=>{
  const {collectionIds,collectionRoutes}=await import('/src/collection-model.js'),{encodeCollectionPlan}=await import('/src/collection-plan-transfer.js'),game=await import('/src/upstream.js');
  const plan={version:1,selections:collectionIds.filter(id=>collectionRoutes(id).length).slice(0,20).map(itemId=>({itemId,jobId:collectionRoutes(itemId)[0].id,target:game.collectionThresholds(game.baseItemId(itemId))[0]}))};
  window.clipboardValue=await encodeCollectionPlan(plan);window.compressedClipboard=window.clipboardValue;
 });
 assert.match(await page.evaluate(()=>window.clipboardValue),/^DVILAB-PLAN:/);
 for(const language of ['zh','en']){
  await page.selectOption('#language',language);
  const beforeCancel=await page.evaluate(()=>({plan:localStorage.getItem('dvi-collection-plan-v1'),summary:document.querySelector('#collection-plan-summary').textContent}));
  for(const action of ['import','clear']){
   dismissNext=true;const count=confirmations.length;await page.locator(`[data-plan-${action}]`).click();assert.equal(confirmations.length,count+1);assert.match(confirmations.at(-1),language==='zh'?/确定/:/Continue|Clear/);
   assert.deepEqual(await page.evaluate(()=>({plan:localStorage.getItem('dvi-collection-plan-v1'),summary:document.querySelector('#collection-plan-summary').textContent})),beforeCancel);
  }
 }
 results.cases.push('import and clear require bilingual confirmation; cancellation preserves plan and summary');

 await page.locator('[data-plan-import]').click();
 const beforeExport=confirmations.length;await page.locator('[data-plan-export]').click();await until(()=>!document.querySelector('[data-plan-export]').disabled);assert.equal(confirmations.length,beforeExport);assert.equal(await page.evaluate(()=>window.clipboardValue),await page.evaluate(()=>window.compressedClipboard));
 assert.equal(await page.locator('#collection-plan-summary [data-plan-clipboard-status]').innerText(),'Plan copied to clipboard');
 const exported=await page.evaluate(()=>window.clipboardValue),saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1')));
 assert.deepEqual(await page.evaluate(async value=>(await import('/src/collection-plan-transfer.js')).decodeCollectionPlan(value),exported),saved);
 await page.locator('[data-plan-clear]').click();await page.locator('[data-plan-import]').click();await until(()=>!document.querySelector('[data-plan-import]').disabled);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1'))),saved);
 assert.equal(await page.locator('#collection-plan-summary [data-plan-clipboard-status]').innerText(),'Plan imported from clipboard.');
 for(const language of ['zh','en'])for(const width of [320,390,1440]){
  await page.selectOption('#language',language);await page.setViewportSize({width,height:960});
  const summary=await page.locator('#collection-plan-summary').innerText();
  const labels=language==='zh'?['已选方案','已完成','所选目标奖励','期望材料成本','期望时间成本','计划已从剪贴板导入。']:['Selected routes','Completed','Selected target rewards','Expected material cost','Expected time cost','Plan imported from clipboard.'];
  let previous=-1;for(const label of labels){const index=summary.indexOf(label);assert.ok(index>previous);previous=index;}
  assert.equal(await page.locator('#collection-plan-summary [data-plan-clipboard-status]').evaluate(e=>getComputedStyle(e).color),'rgb(239, 154, 148)');
  assert.equal(await page.locator('#collection-plan > [data-plan-clipboard-status]').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#collection-plan').screenshot({path:path.join(directory,`summary-${language}-${width}.png`)});
 }
 results.cases.push('summary follows requested label order, shows expected time and inline red import status in both languages at 320/390/1440px');
 for(const value of ['bad-json','DVILAB-PLAN:bad!',JSON.stringify({version:1,selections:[{itemId:40,jobId:41,target:99}]})]){
  await page.evaluate(value=>window.clipboardValue=value,value);await page.locator('[data-plan-import]').click();
  assert.match(await page.locator('[data-plan-clipboard-status]').innerText(),/Invalid plan/);assert.equal(await page.locator('#collection-plan-summary [data-plan-clipboard-status]').count(),0);assert.equal(await page.locator('[data-plan-clipboard-status]').getAttribute('role'),'alert');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1'))),saved);
 }
 await page.evaluate(()=>window.clipboardFail=true);
 for(const action of ['import','export']){await page.locator(`[data-plan-${action}]`).click();assert.match(await page.locator('[data-plan-clipboard-status]').innerText(),/Clipboard operation failed/);}
 await page.evaluate(()=>{window.clipboardFail=false;window.clipboardHold=true;});await page.locator('[data-plan-import]').click();
 assert.equal(await page.locator('[data-plan-export]').isDisabled(),true);await page.locator('[data-plan-clear]').click();
 await page.evaluate(exported=>window.clipboardRelease(exported),exported);
 await until(()=>!document.querySelector('[data-plan-import]').disabled);
 assert.match(await page.locator('[data-plan-clipboard-status]').innerText(),/plan changed/);
 assert.equal(await page.locator('[data-plan-item]').count(),0);
 await page.locator('[data-plan-export]').click();await until(()=>!document.querySelector('[data-plan-export]').disabled);assert.deepEqual(await page.evaluate(()=>JSON.parse(window.clipboardValue)),{version:1,selections:[]});assert.equal(await page.locator('[data-plan-time]').innerText(),'0.0 s');assert.equal(await page.locator('#collection-plan-summary [data-plan-clipboard-status]').innerText(),'Plan copied to clipboard');
 results.cases.push('clipboard bilingual button order, roundtrip replacement, invalid JSON/target, permission failure, stale response rejection and empty export');
 await page.evaluate(()=>{
  window.clipboardHold=false;window.planProgress=9;window.planBank={1:90,2:91};window.planPack=[{itemId:1,qty:1}];
  window.clipboardValue=JSON.stringify({version:1,selections:[{itemId:40,jobId:41,target:100},{itemId:1040,jobId:41,target:10}]});
 });
 await page.locator('[data-plan-import]').click();await until(()=>!document.querySelector('[data-plan-import]').disabled);
 await page.locator('#collection-import').click();await until(()=>!document.querySelector('#collection-import').disabled);
 const readyRow=page.locator('[data-plan-item="40"]'),rareRow=page.locator('[data-plan-item="1040"]');
 assert.equal(await readyRow.evaluate(e=>e.classList.contains('collection-plan-ready')),true);
 assert.equal(await rareRow.evaluate(e=>e.classList.contains('collection-plan-ready')),false);
 assert.equal(await readyRow.locator('td:first-child[aria-describedby]').getAttribute('title'),'Expected materials ready');
 const planBeforeReady=await page.evaluate(()=>localStorage.getItem('dvi-collection-plan-v1'));
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');updatePrices({...priceState(),quotes:{}});});
 assert.equal(await readyRow.locator('td:first-child[aria-describedby]').count(),1);
 await page.locator('[data-plan-table="selections"][data-plan-sort="item"]').click();
 for(const language of ['zh','en'])for(const width of [320,390,1440]){
  await page.selectOption('#language',language);await page.setViewportSize({width,height:960});
  assert.equal(await readyRow.locator('td:first-child[aria-describedby]').getAttribute('title'),language==='zh'?'期望材料已备齐':'Expected materials ready');
  assert.equal(await rareRow.locator('td:first-child[aria-describedby]').count(),0);
  assert.ok(await readyRow.locator('td:first-child').evaluate(cell=>{
   const description=document.getElementById(cell.getAttribute('aria-describedby'));
   return description?.hidden&&description.textContent===cell.title&&!cell.innerText.includes(cell.title);
  }));
  assert.ok(await readyRow.evaluate(row=>{
   const measure=()=>({height:row.getBoundingClientRect().height,widths:[...row.cells].map(cell=>cell.getBoundingClientRect().width)});
   const before=measure();row.classList.remove('collection-plan-ready');const after=measure();row.classList.add('collection-plan-ready');
   return Math.abs(before.height-after.height)<.1&&before.widths.every((width,i)=>Math.abs(width-after.widths[i])<.1);
  }));
  assert.ok(await readyRow.locator('td:first-child').evaluate(cell=>{
   const marker=getComputedStyle(cell,'::before');return marker.position==='absolute'&&marker.width==='2px'&&marker.backgroundColor==='rgb(125, 201, 179)';
  }));
  assert.ok(await readyRow.evaluate(e=>[...e.cells].every(cell=>getComputedStyle(cell).backgroundColor==='rgb(27, 51, 50)')));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const wrap=page.locator('.collection-plan-selections').locator('..');await wrap.evaluate(e=>e.scrollLeft=e.scrollWidth);
  assert.equal(await readyRow.locator('td:first-child').evaluate(e=>getComputedStyle(e).position),'sticky');
  await wrap.evaluate(e=>e.scrollLeft=0);
  await page.locator('#collection-plan').screenshot({path:path.join(directory,`materials-ready-${language}-${width}.png`)});
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-collection-plan-v1')),planBeforeReady);
 await page.locator('[data-plan-increase="40"]').click();assert.equal(await readyRow.locator('td:first-child[aria-describedby]').count(),0);
 await page.locator('[data-plan-decrease="40"]').click();assert.equal(await readyRow.locator('td:first-child[aria-describedby]').count(),1);
 await page.evaluate(()=>{window.planBank={1:89,2:91};});await page.locator('#collection-import').click();await until(()=>!document.querySelector('#collection-import').disabled);
 assert.equal(await readyRow.locator('td:first-child[aria-describedby]').count(),0);
 await autoRemove.uncheck();
 await page.evaluate(()=>{window.planProgress=100;});await page.locator('#collection-import').click();await until(()=>!document.querySelector('#collection-import').disabled);
 assert.match(await readyRow.locator('[data-plan-progress]').innerText(),/Completed/);assert.equal(await readyRow.locator('td:first-child[aria-describedby]').count(),0);
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('dvi-collection-v1'));state.counts={40:9};state.pack=null;localStorage.setItem('dvi-collection-v1',JSON.stringify(state));});await page.reload();
 assert.equal(await page.locator('td:first-child[aria-describedby]').count(),0);
 results.cases.push('all dependency stocks must cover global demand; pack stock, quality separation, quote/sort/language redraw, target changes, role imports, completed/unknown stock, unchanged storage, compact marker without layout changes, tooltip/accessible description and sticky ready background at 320/390/1440px');

 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>window.clipboardValue,writeText:async value=>{window.clipboardValue=value;}}});window.clipboardValue=JSON.stringify({version:1,selections:[{itemId:40,jobId:41,target:1},{itemId:1040,jobId:41,target:10}]});});
 await autoRemove.check();await page.locator('[data-plan-import]').click();await until(()=>!document.querySelector('[data-plan-import]').disabled);assert.deepEqual(await page.locator('[data-plan-item]').evaluateAll(es=>es.map(e=>e.dataset.planItem)),['1040']);
 await autoRemove.uncheck();await page.locator('[data-plan-import]').click();await until(()=>!document.querySelector('[data-plan-import]').disabled);assert.equal(await page.locator('[data-plan-item]').count(),2);
 await autoRemove.check();assert.equal(await page.locator('[data-plan-item]').count(),1);
 // The main page uses a simulated clock; this separate context uses real time.
 const savedRole={...await readState(),capturedAt:null};
 const quota=await browser.newContext();
 await quota.addInitScript(state=>{
  localStorage.setItem('dvi-collection-v1',JSON.stringify(state));
  localStorage.setItem('dvi-collection-plan-v1',JSON.stringify({version:1,selections:[{itemId:40,jobId:41,target:1},{itemId:1040,jobId:41,target:10}]}));
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
   if(key==='dvi-collection-plan-v1')throw Error('quota');
   return original.call(this,key,value);
  };
 },savedRole);
 const quotaPage=trackPage(await quota.newPage());
 await quotaPage.goto(new URL('/collection',base).href);
 assert.equal(await quotaPage.locator('[data-plan-item]').count(),1);
 assert.match(await quotaPage.locator('#collection-plan [role="alert"]').innerText(),/保存失败|could not be saved/);
 assert.equal(await quotaPage.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1')).selections.length),2);
 await quota.close();
 results.cases.push('clipboard imports prune only completed selections when enabled, opt-out retains them, and save failures expose alerts while retaining valid memory and original stored data');
 await context.close();
 const broken=await browser.newContext();await broken.addInitScript(()=>{localStorage.setItem('dvi-collection-plan-v1','bad-json');localStorage.setItem('dvi-collection-auto-import-v1','bad-json');});const badPage=trackPage(await broken.newPage());badPage.on('dialog',dialog=>dialog.accept());await badPage.goto(new URL('/collection',base).href);assert.match(await badPage.locator('#collection-plan').innerText(),/could not be read|无法读取/);assert.equal(await badPage.locator('[data-plan-auto-remove-completed]').isChecked(),true);assert.equal(await badPage.locator('#collection-auto-status').isVisible(),true);assert.match(await badPage.locator('#collection-auto-status').innerText(),/could not be read|无法读取/);assert.equal(await badPage.locator('#collection-auto-import').isChecked(),false);assert.equal(await badPage.evaluate(()=>localStorage.getItem('dvi-collection-plan-v1')),'bad-json');await badPage.locator('[data-plan-clear]').click();assert.equal(await badPage.locator('#collection-plan [role="alert"]').count(),0);await broken.close();
 results.cases.push('clear plan preserves character; invalid plan/auto settings are visible and kept until explicit repair');
 assert.deepEqual(results.errors,[]);
}catch(error){results.failure=String(error.stack??error);throw error;}
finally{await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(results,null,2)+'\n');await browser?.close();server?.kill();}
console.log(JSON.stringify(results));
