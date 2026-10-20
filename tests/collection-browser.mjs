import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {game,preset} from '../src/model.js';

const args={};
for(let i=2;i<process.argv.length;i+=2){
 const key=process.argv[i],value=process.argv[i+1];
 assert.ok(['--url','--out'].includes(key)&&value&&!Object.hasOwn(args,key),`Invalid argument: ${key}`);args[key]=value;
}
const directory=path.resolve(args['--out']??'.test-artifacts/collection');await fs.mkdir(directory,{recursive:true});
let base=args['--url'],server,browser;
if(base){const url=new URL(base);assert.ok(['http:','https:'].includes(url.protocol),'Expected HTTP(S) URL');base=url.origin;}
const results={cases:[],errors:[]};
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
 await context.addInitScript(build=>{if(!localStorage.getItem('dvi-simulator-v1'))localStorage.setItem('dvi-simulator-v1',JSON.stringify({language:'zh',state:build}));window.collectionWorkers=0;const OriginalWorker=Worker;window.Worker=class extends OriginalWorker{constructor(url,options){super(url,options);if(String(url).includes('collection-worker.js'))window.collectionWorkers++;}};},build);
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>results.errors.push(e.message));let marketRequests=0;page.on('request',r=>{if(r.url().includes('/api/market/'))marketRequests++;});
 await context.route('https://deepveinidle.com/api/market/prices.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({game:'Deep Vein Idle',generatedAt:new Date().toISOString(),refreshSeconds:60,items:{40:{lowestSell:25,highestBuy:20}}})}));
 await page.goto(new URL('/collection/',base).href);await page.locator('#collection-section').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-section="collection"]').count(),0);assert.equal(await page.locator('.collection-card').count(),0);
 await page.locator('#collection-manual').click();assert.equal(await page.locator('#collection-buy').inputValue(),'global');await page.locator('#collection-buy').selectOption('ask');assert.equal(await page.locator('#collection-type').inputValue(),'craft');assert.equal(await page.locator('#collection-level-met,#collection-completed').count(),0);
 const cards=()=>page.locator('.collection-card');
 const keys=()=>cards().evaluateAll(es=>es.map(e=>e.dataset.collectionKey));
 // Verify each categorical option against recipe metadata and partition totals.
 const matchCount=async()=>Number((await page.locator('#collection-summary').innerText()).match(/匹配 (\d+)/)[1]);
 const originalBuild=await page.evaluate(()=>localStorage.getItem('dvi-collection-v1'));
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('dvi-collection-v1'));for(const skill in state.config.levels)state.config.levels[skill]=100;localStorage.setItem('dvi-collection-v1',JSON.stringify(state));});await page.reload();await page.locator('#collection-type').selectOption('all');
 const allCount=await matchCount();assert.ok(allCount>0);let typeTotal=0;
 for(const [type,allowed]of [['gather',['mining','fishing','woodcutting','thieving']],['craft',['cooking','smithing','fletching','alchemy','crafting']]]){
  await page.locator('#collection-type').selectOption(type);const count=await matchCount();assert.ok(count>0);typeTotal+=count;
  assert.ok((await keys()).every(key=>allowed.includes(game.recipes.find(r=>r.id===Number(key.split(':')[1])).skill)));
 }
 assert.equal(typeTotal,allCount);await page.locator('#collection-type').selectOption('all');
 let skillTotal=0;
 const skillOptions=await page.locator('#collection-skill option').evaluateAll(es=>es.map(e=>e.value).filter(v=>v!=='all'));assert.equal(skillOptions.length,9);
 for(const skill of skillOptions){
  await page.locator('#collection-skill').selectOption(skill);const count=await matchCount();assert.ok(count>0,skill);skillTotal+=count;
  assert.ok((await keys()).every(key=>game.recipes.find(r=>r.id===Number(key.split(':')[1])).skill===skill),skill);
  await page.locator('#collection-type').selectOption(['mining','fishing','woodcutting','thieving'].includes(skill)?'craft':'gather');assert.equal(await matchCount(),0,skill+' incompatible type');await page.locator('#collection-type').selectOption('all');
 }
 assert.equal(skillTotal,allCount);await page.locator('#collection-skill').selectOption('all');let tierTotal=0;
 for(const tier of ['0','1','2','3','4']){await page.locator('#collection-tier').selectOption(tier);const count=await matchCount();assert.ok(count>0);tierTotal+=count;assert.ok((await keys()).every(key=>game.itemTier(Number(key.split(':')[0]))===Number(tier)));}
 assert.equal(tierTotal,allCount);await page.locator('#collection-tier').selectOption('all');await page.locator('#collection-type').selectOption('craft');
 await page.locator('#collection-search').fill('  bRoNzE BaR  ');const englishSearch=await keys();const englishCount=await matchCount();await page.locator('#collection-search').fill('青铜锭');assert.equal(await matchCount(),englishCount);assert.deepEqual(await keys(),englishSearch);await page.locator('#collection-search').fill('');
 await page.evaluate(original=>{localStorage.setItem('dvi-collection-v1',original);localStorage.removeItem('dvi-collection-filters-v1');},originalBuild);await page.reload();
 results.cases.push('all type, nine skill and five rarity options filter actual recipe metadata; partitions sum to all results, incompatible intersections are empty, bilingual trimmed case-insensitive search agrees');

 await page.locator('#collection-search').fill('Bronze bar');
 assert.equal(await cards().count(),10);
 const firstPage=await keys();const matching=Number((await page.locator('#collection-summary').innerText()).match(/匹配 (\d+)/)[1]);assert.equal(matching,40);
 const bottom=page.locator('#collection-pages-bottom');
 assert.equal(await page.locator('#collection-pages-top').count(),0);
 assert.equal(await page.locator('#collection-results + #collection-pages-bottom').count(),1);
 assert.match(await bottom.innerText(),/第 1 \/ 4 页/);
 assert.equal(await bottom.locator('[data-page-step="-1"]').isDisabled(),true);
 await bottom.locator('[data-page-step="1"]').click();assert.equal(await cards().count(),10);assert.notDeepEqual(await keys(),firstPage);
 assert.ok(await page.locator('#collection-results').evaluate(e=>Math.abs(e.getBoundingClientRect().top-16)<2));
 assert.match(await bottom.innerText(),/第 2 \/ 4 页/);
 await page.selectOption('#language','en');assert.match(await bottom.innerText(),/Page 2 \/ 4/);
 await page.selectOption('#language','zh');
 await bottom.locator('[data-page-step="-1"]').click();assert.deepEqual(await keys(),firstPage);
 for(let i=0;i<3;i++)await bottom.locator('[data-page-step="1"]').click();assert.equal(await bottom.locator('[data-page-step="1"]').isDisabled(),true);
 await page.locator('#collection-sort').selectOption('secondsPerPoint');assert.match(await bottom.innerText(),/第 1 \/ 4 页/);
 await bottom.locator('[data-page-step="1"]').click();
 assert.match(await page.locator('#collection-add-filtered').innerText(),/40 个方案/);
 await page.locator('#collection-add-filtered').click();
 const selected=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1')).selections);
 assert.equal(selected.length,5);assert.ok(selected.every(s=>s.target===10000000));assert.match(await bottom.innerText(),/第 2 \/ 4 页/);
 await page.locator('#collection-add-filtered').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1')).selections),selected);
 await page.setViewportSize({width:390,height:960});
 await bottom.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(directory,'candidate-pagination-390.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:960});
 await page.locator('#collection-tier').selectOption('0');assert.equal(await cards().count(),8);assert.equal(await bottom.isHidden(),true);
 await page.locator('#collection-filter-minutes').fill('0.04');await page.locator('#collection-add-filtered').click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-plan-v1')).selections),selected);
 await page.locator('#collection-search').fill('no-such-item');assert.equal(await cards().count(),0);assert.equal(await page.locator('#collection-add-filtered').isDisabled(),true);assert.equal(await bottom.isHidden(),true);
 await page.locator('#collection-filter-cost').fill('bad');assert.equal(await page.locator('#collection-add-filtered').isDisabled(),true);
 await page.setViewportSize({width:390,height:960});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1440,height:960});
 await page.evaluate(()=>{localStorage.removeItem('dvi-collection-plan-v1');localStorage.removeItem('dvi-collection-filters-v1');});await page.reload();
 results.cases.push('10 candidates per page; bottom-only navigation, scrolling, filter reset, language retention; cross-page bulk add deduplicates highest targets and preserves plan; empty/invalid controls disabled');
 const paths=await page.locator('[data-collection-path]').evaluateAll(es=>es.map(e=>e.dataset.collectionPath));assert.equal(new Set(paths).size,paths.length);
 await page.locator('#collection-search').fill('Bronze bar');await page.locator('#collection-tier').selectOption('0');assert.equal(await page.locator('.collection-card').count(),8);
 assert.deepEqual(await page.locator('.collection-filter-row').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('input,select')].map(e=>e.id))),[['collection-buy','collection-sort'],['collection-type','collection-skill','collection-tier','collection-search'],['collection-filter-points','collection-filter-secondsPerPoint','collection-filter-costPerPoint','collection-filter-cost','collection-filter-minutes']]);
 await page.locator('#collection-filter-minutes').fill('0.04');assert.equal(await page.locator('.collection-card').count(),1);
 assert.equal(await page.locator('.collection-card').first().locator('summary > span').count(),8);assert.equal(await page.locator('#collection-sort option').count(),2);assert.equal(await page.locator('[data-collection-metric="profitPerPoint"],#collection-sell').count(),0);
 assert.equal(await page.locator('.collection-total-time').first().innerText(),'总时间\n2.4 秒');assert.equal(await page.locator('.collection-total-cost + .collection-total-time').count(),1);

 for(const language of ['zh','en'])for(const width of [320,390,740,1440]){
  await page.selectOption('#language',language);await page.setViewportSize({width,height:960});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.locator('.collection-metric-filters').evaluate((row,narrow)=>{const labels=[...row.children],first=labels[0].getBoundingClientRect(),next=labels[1].getBoundingClientRect(),box=row.getBoundingClientRect();return narrow?Math.abs(first.width-box.width)<2&&next.top>=first.bottom:labels.every(label=>Math.abs(label.getBoundingClientRect().top-first.top)<2);},width<=740));
  await page.locator('.collection-filters').screenshot({path:path.join(directory,`filters-${language}-${width}.png`)});
 }
 await page.selectOption('#language','zh');await page.setViewportSize({width:1440,height:960});
 results.cases.push('filter DOM and keyboard order follow cost/sort, category fields, then reordered metrics; points occupies its own row at 320/390/740px in both languages');
 const details=()=>page.locator('.collection-card').first().locator('.collection-detail');
 const openFirst=async()=>{await page.locator('.collection-card').first().evaluate(e=>e.open=true);await details().locator('h3').first().waitFor();};
 const headings=()=>details().locator('h3').allTextContents();
 await openFirst();assert.deepEqual(await headings(),['材料采购']);assert.equal(await details().locator('input,button,p').count(),0);assert.equal(await details().locator(':scope>h3,:scope>ul').count(),2);
 assert.match(await details().innerText(),/铜矿/);assert.match(await details().innerText(),/锡矿/);assert.doesNotMatch(await details().innerText(),/产物回收/);assert.match(await details().innerText(),/缺报价/);
 await page.locator('#collection-filter-cost').fill('100');assert.equal(await page.locator('.collection-card').count(),0);await page.locator('#collection-filter-cost').fill('');assert.equal(await page.locator('.collection-card').count(),1);
 results.cases.push('hidden route, explicit manual scenario, default filters, shared config, all future goals; expanded recipe shows only material purchases');
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const [id,ask,bid]of [[1,2,1],[2,3,2],[40,25,20]])prices.quotes[id]={ask:{value:ask,capturedAt:Date.now()},bid:{value:bid,capturedAt:Date.now()}};updatePrices(prices);});
 const metric=field=>page.locator(`[data-collection-metric="${field}"]`).first().evaluate(e=>Number(e.childNodes[1].textContent.replace(/,/g,'')));
 assert.equal(await metric('costPerPoint'),5);assert.match(await details().innerText(),/最低卖单/);
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());prices.quotes[1].ask.value=2.26;prices.quotes[2].ask.value=3.29;updatePrices(prices);});
 assert.equal(await metric('costPerPoint'),6);assert.equal(await page.locator('.collection-total-cost').first().innerText(),'总材料成本\n6');
 await page.locator('#collection-filter-cost').fill('5.55');assert.equal(await cards().count(),1);await page.locator('#collection-filter-cost').fill('5.549');assert.equal(await cards().count(),0);await page.locator('#collection-filter-cost').fill('');
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());prices.quotes[1].ask.value=2;prices.quotes[2].ask.value=3;updatePrices(prices);});

 for(const [key,equal,outside]of [['points','1','1.001'],['cost','5','4.999'],['minutes','0.04','0.039999'],['secondsPerPoint','2.4','2.399'],['costPerPoint','5','4.999']]){
  const field=page.locator('#collection-filter-'+key);await field.fill(equal);assert.equal(await page.locator('.collection-card').count(),1,key+' equal');await field.fill(outside);assert.equal(await page.locator('.collection-card').count(),0,key+' outside');await field.fill(key==='minutes'?'0.04':'');
 }
 for(const [key,value]of [['points','1'],['cost','5'],['secondsPerPoint','2.4'],['costPerPoint','5']])await page.locator('#collection-filter-'+key).fill(value);
 assert.equal(await page.locator('.collection-card').count(),1);for(const key of ['points','cost','secondsPerPoint','costPerPoint'])await page.locator('#collection-filter-'+key).fill('');
 for(const key of ['cost','minutes','secondsPerPoint','costPerPoint']){await page.locator('#collection-filter-'+key).fill('0');assert.equal(await page.locator('.collection-card').count(),0);await page.locator('#collection-filter-'+key).fill(key==='minutes'?'0.04':'');}
 await page.locator('#collection-filter-points').fill('0');assert.equal(await page.locator('.collection-card').count(),1);await page.locator('#collection-filter-points').fill('');
 for(const invalid of ['abc','Infinity','9007199254740992']){await page.locator('#collection-filter-cost').fill(invalid);assert.equal(await page.locator('.collection-card').count(),0);assert.match(await page.locator('#collection-error').innerText(),/筛选数值无效/);}await page.locator('#collection-filter-cost').fill('');
 results.cases.push('three ordered filter rows; all five inclusive numeric boundaries, decimals, intersections, missing quotes and invalid bounds');
 await page.locator('#collection-buy').selectOption('bid');assert.equal(await metric('costPerPoint'),3);assert.match(await details().innerText(),/最高买单/);
 await page.locator('#collection-buy').selectOption('ask');assert.equal(await page.locator('#collection-buy option').count(),4);assert.equal(await page.locator('#collection-sell').count(),0);
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());prices.prices[1]={price:0,source:'manual',locked:true,updatedAt:Date.now(),quoteCapturedAt:null};prices.preferences.categories.ore='vendor';updatePrices(prices);});assert.equal(await metric('costPerPoint'),5);
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());prices.prices[2]={price:7,source:'manual',locked:true,updatedAt:Date.now(),quoteCapturedAt:null};updatePrices(prices);});await page.locator('#collection-buy').selectOption('global');assert.equal(await metric('costPerPoint'),7);await page.locator('#collection-buy').selectOption('ask');assert.equal(await metric('costPerPoint'),5);await page.locator('#collection-buy').selectOption('vendor');assert.equal(await metric('costPerPoint'),game.vendorPrice(1)+game.vendorPrice(2));assert.match(await details().innerText(),/商人估值/);await page.reload();assert.equal(await page.locator('#collection-buy').inputValue(),'vendor');await page.locator('#collection-search').fill('Bronze bar');await page.locator('#collection-tier').selectOption('0');await page.locator('#collection-filter-minutes').fill('0.04');await openFirst();await page.locator('#collection-buy').selectOption('ask');
 assert.deepEqual(await headings(),['材料采购']);assert.equal(await page.evaluate(()=>window.collectionWorkers),0);
 results.cases.push('ask/bid and vendor material valuation ignore global settings; vendor selection survives refresh');
 await page.locator('#collection-filter-minutes').fill('');
 assert.equal(await page.locator('[data-collection-key="40:41:100"] .collection-total-time').innerText(),'总时间\n4.0 分钟');assert.equal(await page.locator('[data-collection-key="40:41:1000000"] [data-collection-metric="secondsPerPoint"]').innerText(),'秒／点\n4,067.8');assert.match(await page.locator('[data-collection-key="40:41:10000000"] .collection-total-time').innerText(),/小时/);
 for(const mode of ['secondsPerPoint','costPerPoint']){await page.locator('#collection-sort').selectOption(mode);const values=await page.locator(`[data-collection-metric="${mode}"]`).evaluateAll(es=>es.map(e=>Number(e.childNodes[1].textContent.replace(/,/g,''))));assert.deepEqual(values,[...values].sort((a,b)=>a-b));}
 await page.locator('#collection-sort').selectOption('costPerPoint');await page.locator('#collection-filter-points').fill('15');await page.locator('#collection-filter-cost').fill('5000');assert.equal(await page.locator('.collection-card').count(),1);
 await page.locator('#collection-filter-points').fill('-1');assert.equal(await page.locator('.collection-card').count(),0);assert.match(await page.locator('#collection-error').innerText(),/筛选数值无效/);await page.locator('#collection-filter-points').fill('');await page.locator('#collection-filter-cost').fill('');await page.locator('#collection-filter-minutes').fill('');
 await page.locator('#collection-type').selectOption('gather');assert.equal(await page.locator('.collection-card').count(),0);await page.locator('#collection-type').selectOption('craft');
 const lockedJob=game.recipes.find(j=>j.skill==='smithing'&&j.levelReq>1&&!j.retired&&game.collectionItems.has(j.output.itemId));await page.locator('#collection-search').fill(game.item(lockedJob.output.itemId).name);assert.equal(await page.locator('.collection-card').count(),0);await page.locator('#collection-levels').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.levels.smithing"]').fill(String(lockedJob.levelReq));await page.locator('[data-collection-path="config.levels.smithing"]').press('Tab');assert.ok(await cards().count()>0);await page.locator('[data-collection-path="config.levels.smithing"]').fill('1');await page.locator('[data-collection-path="config.levels.smithing"]').press('Tab');assert.equal(await cards().count(),0);
 results.cases.push('two ascending numeric sorts, inclusive numeric limits, type intersections and level-only filtering remain unchanged');
 await page.evaluate(()=>{window.testCollectionMissing=false;document.addEventListener('dvi-character-request',async event=>{const request=JSON.parse(event.detail);if(request.action!=='read')return;const {createScenario}=await import('/src/simulation.js');const {craftingSlots,craftingSkills}=await import('/src/crafting-model.js');const {gatheringSlots,gatheringSkills}=await import('/src/gathering-model.js');const {game}=await import('/src/model.js');const {player}=createScenario({});for(const skill of [...craftingSkills,...gatheringSkills])player.skills[skill]=game.levelXp(1);for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;Object.assign(player,{house:{},houseFurniture:{},collections:{40:99,42341:1,42343:1,53341:2,53343:1},masteries:{},perks:{},ironman:false,homeBank:null});if(window.testCollectionBonuses){player.brews.hunter=player.lastTick+6000;player.brewTier.hunter=3;player.brews.elixir=player.lastTick+6000;player.brewTier.elixir=1;player.brews.blessing=player.lastTick+6000;player.guildBonus=.0125;}if(window.testCollectionMissing)delete player.collections;document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',version:'2.4',id:request.id,snapshot:{version:2,capturedAt:Date.now(),player,worldBuffsVersion:window.testCollectionBonuses?1:undefined,worldTick:player.lastTick,worldBuffs:window.testCollectionBonuses?[{fromTick:player.lastTick,toTick:player.lastTick+6000,xpMult:1.0275,rarityMult:1.0875}]:[],guild:null}})}));});});
 await page.locator('#collection-import-panel').evaluate(e=>e.open=true);await page.locator('#collection-import').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===99);
 assert.match(await page.locator('#collection-buff-warning').innerText(),/已跳过 4 条/);await page.selectOption('#language','en');assert.match(await page.locator('#collection-buff-warning').innerText(),/skipped 4/);await page.selectOption('#language','zh');
 await page.locator('#collection-search').fill('青铜锭');assert.equal(await page.locator('.collection-card').count(),6);
await openFirst();assert.deepEqual(await headings(),['材料采购']);
 await page.evaluate(()=>window.testCollectionMissing=true);await page.locator('#collection-import').click();await page.waitForFunction(()=>document.querySelector('#collection-import-status').textContent.includes('不完整'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]),99);
 await page.locator('#mastery-nav').click();await page.goBack();await page.locator('#collection-section').waitFor({state:'visible'});assert.equal(await page.locator('#collection-search').inputValue(),'青铜锭');
 await page.reload();assert.equal(await page.locator('#collection-type').inputValue(),'craft');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]),99);
 assert.match(await page.locator('#collection-buff-warning').innerText(),/已跳过 4 条/);
 results.cases.push('invalid collection records are skipped with a persisted bilingual warning');
 results.cases.push('controlled character import updates progress, failed import is atomic; history and refresh retain valid imported data');
 await page.locator('#collection-type').selectOption('gather');await page.locator('#collection-search').fill('铜矿');await page.locator('#collection-tier').selectOption('1');await page.locator('#collection-filter-points').fill('3');await page.locator('#collection-filter-minutes').fill('1');await openFirst();assert.equal(await page.locator('.collection-item-heading').first().textContent(),'铜矿 · 罕见');assert.doesNotMatch(await details().innerText(),/Copper/);assert.deepEqual(await headings(),['材料采购']);
 await page.locator('#collection-potions').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.brews.hunter"]').selectOption('2');await page.locator('[data-collection-path="config.blessing"]').check();assert.deepEqual(await headings(),['材料采购']);assert.equal(await details().locator('input,button,p').count(),0);assert.doesNotMatch(await details().innerText(),/药剂|祝福|模拟|累计数量/);
 for(const [language,width]of [['zh',1440],['zh',390],['en',1440],['en',390]]){await page.setViewportSize({width,height:960});await page.selectOption('#language',language);assert.deepEqual(await headings(),language==='zh'?['材料采购']:['Material purchases']);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(directory,`collection-details-${language}-${width}.png`),fullPage:true});}
 const filterSnapshot=()=>page.locator('.collection-filters input,.collection-filters select').evaluateAll(es=>es.map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]));
 await page.locator('#collection-skill').selectOption('mining');await page.locator('#collection-sort').selectOption('secondsPerPoint');
 await page.locator('#collection-filter-cost').fill('12345.67');await page.locator('#collection-filter-secondsPerPoint').fill('1000');await page.locator('#collection-filter-costPerPoint').fill('1000');
 const savedFilters=await filterSnapshot();await page.reload();assert.deepEqual(await filterSnapshot(),savedFilters);
 await page.locator('#collection-filter-cost').fill('bad');await page.reload();assert.equal(await page.locator('#collection-filter-cost').inputValue(),'bad');assert.match(await page.locator('#collection-error').innerText(),/Invalid filter|筛选数值无效/);
 for(const key of ['cost','secondsPerPoint','costPerPoint'])await page.locator('#collection-filter-'+key).fill('');
 await page.locator('#collection-skill').selectOption('all');await page.locator('#collection-sort').selectOption('costPerPoint');
 results.cases.push('all filters and sort survive refresh independently; invalid threshold drafts restore with validation');
 results.cases.push('only material purchase details with potions/blessing enabled; translated rarity names, Chinese search, retained expansion and bilingual 1440px/390px layouts');
 await page.selectOption('#language','zh');await page.locator('#collection-type').selectOption('craft');await page.locator('#collection-search').fill('青铜锭');await page.locator('#collection-tier').selectOption('0');await page.locator('#collection-filter-points').fill('');await page.locator('#collection-filter-minutes').fill('');
 await page.evaluate(async()=>{const {game}=await import('/src/model.js');const {itemFamily}=await import('/src/item-prices.js');const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const item of game.items.filter(item=>itemFamily(item.id)))prices.quotes[item.id]={ask:{value:1e9,capturedAt:Date.now()},bid:{value:1e9,capturedAt:Date.now()}};updatePrices(prices);});
 const overflow=page.locator('[data-collection-key="40:41:10000000"]');assert.match(await overflow.innerText(),/金额超出计算范围/);await overflow.evaluate(e=>e.open=true);await overflow.locator('h3').first().waitFor();assert.deepEqual(await overflow.locator('h3').allTextContents(),['材料采购']);
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const item of Object.values(prices.quotes))for(const quote of Object.values(item))quote.value=1;updatePrices(prices);});assert.equal(await page.locator('.collection-overflow').count(),0);
 results.cases.push('amount overflow stays visible in row/summary, while detail remains a material list; price correction clears overflow without simulation');

 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('dvi-collection-v1'));state.counts[40]=10000000;localStorage.setItem('dvi-collection-v1',JSON.stringify(state));});await page.reload();
 assert.equal(await cards().count(),0);assert.equal(await page.locator('#collection-level-met,#collection-completed').count(),0);
 await page.evaluate(()=>{const filters=JSON.parse(localStorage.getItem('dvi-collection-filters-v1'));filters.onlyLevelMet=false;filters.includeComplete=true;localStorage.setItem('dvi-collection-filters-v1',JSON.stringify(filters));});await page.reload();assert.equal(await cards().count(),0);
 await page.locator('#collection-filter-points').fill('0');assert.equal(await cards().count(),0);const fixed=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-filters-v1')));assert.equal('onlyLevelMet' in fixed,false);assert.equal('includeComplete' in fixed,false);
 await page.locator('#collection-search').fill('Steel bar');assert.equal(await cards().count(),0);await page.reload();assert.equal(await cards().count(),0);assert.equal(await page.locator('#collection-search').inputValue(),'Steel bar');assert.doesNotMatch(await page.locator('#collection-save').innerText(),/筛选无法读取/);
 results.cases.push('completed and level-ineligible routes stay excluded, removed controls are absent, legacy flags cannot override fixed rules and are omitted on save while other filters persist');
 assert.equal(await page.locator('#collection-error').innerText(),'');assert.equal(await page.evaluate(()=>window.collectionWorkers),0);assert.ok(marketRequests>0);assert.deepEqual(results.errors,[]);await context.close();
 const broken=await browser.newContext();await broken.addInitScript(()=>{localStorage.setItem('dvi-collection-v1','invalid-json');localStorage.setItem('dvi-collection-filters-v1','invalid-json');const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='dvi-collection-v1'||key==='dvi-collection-filters-v1')throw Error('quota');return original.call(this,key,value);};});const errorPage=await broken.newPage();await errorPage.goto(new URL('/collection',base).href);assert.match(await errorPage.locator('#collection-save').innerText(),/could not be read|无法读取/);await errorPage.locator('#collection-manual').click();assert.match(await errorPage.locator('#collection-save').innerText(),/Save failed|保存失败/);assert.ok(await errorPage.locator('.collection-card').count()>0);assert.match(await errorPage.locator('#collection-save').innerText(),/Filters could not be read|筛选无法读取/);await errorPage.locator('#collection-search').fill('Bronze bar');assert.match(await errorPage.locator('#collection-save').innerText(),/Filters could not be saved|筛选保存失败/);assert.ok(await errorPage.locator('.collection-card').count()>0);await broken.close();results.cases.push('storage read/quota errors remain visible with usable estimates');
}catch(error){results.failure=String(error.stack??error);throw error;}
finally{await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(results,null,2)+'\n');await browser?.close();server?.kill();}
console.log(JSON.stringify(results));
