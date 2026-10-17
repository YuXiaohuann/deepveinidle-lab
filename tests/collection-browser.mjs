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
 await page.goto(new URL('/collection/',base).href);await page.locator('#collection-section').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-section="collection"]').count(),0);assert.match(await page.locator('#collection-results').innerText(),/请先导入/);assert.equal(await page.locator('.collection-card').count(),0);
 await page.locator('#collection-manual').click();
 assert.equal(await page.locator('.collection-information h2').innerText(),'精通性价比');
 assert.equal(await page.locator('#collection-level-met').isChecked(),true);
 assert.deepEqual(await page.locator('.collection-filter-row').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('input,select')].map(el=>el.id))),[['collection-type','collection-skill','collection-tier','collection-search','collection-buy','collection-sell'],['collection-sort','collection-points-min','collection-points-max','collection-level-met','collection-completed']]);
 assert.ok(await page.locator('#collection-sort').evaluate(el=>el.getBoundingClientRect().top>document.querySelector('#collection-sell').getBoundingClientRect().bottom));

 assert.equal(await page.locator('#collection-type').inputValue(),'craft');
 await page.locator('#collection-search').fill('Bronze bar');await page.locator('#collection-tier').selectOption('0');
 await page.locator('#collection-type').selectOption('gather');assert.equal(await page.locator('.collection-card').count(),0);
 await page.locator('#collection-type').selectOption('craft');assert.equal(await page.locator('.collection-card').count(),8);
 await page.locator('#collection-skill').selectOption('mining');assert.equal(await page.locator('.collection-card').count(),0);
 await page.locator('#collection-skill').selectOption('all');await page.locator('#collection-points-max').fill('1');assert.equal(await page.locator('.collection-card').count(),1);
 await page.selectOption('#language','en');assert.equal(await page.locator('.collection-information h2').innerText(),'Mastery efficiency');assert.equal(await page.locator('#collection-type').inputValue(),'craft');
 await page.selectOption('#language','zh');await page.locator('#collection-search').fill('Copper');assert.equal(await page.locator('.collection-card').count(),0);
 await page.locator('#collection-type').selectOption('gather');assert.equal(await page.locator('.collection-card').count(),1);
 assert.equal(await page.evaluate(()=>window.collectionWorkers),0);
 await page.reload();assert.equal(await page.locator('#collection-type').inputValue(),'craft');assert.equal(await page.locator('#collection-level-met').isChecked(),true);await page.locator('#collection-type').selectOption('all');
 results.cases.push('mastery efficiency title and gathering/crafting type filter intersect skills, name, rarity and points; language retention and refresh default');


 assert.deepEqual(await page.locator('#collection-skill option').evaluateAll(es=>es.map(e=>e.value)),['all','mining','fishing','woodcutting','thieving','cooking','smithing','fletching','herblore','crafting']);
 assert.equal(await page.getByLabel('仅显示等级达标',{exact:true}).isChecked(),true);await page.locator('#collection-level-met').uncheck();
 assert.doesNotMatch(await page.locator('#collection-results').innerText(),/来源暂未支持计算/);
 const lockedJob=game.recipes.find(j=>j.skill==='smithing'&&j.levelReq>1&&!j.retired&&game.collectionItems.has(j.output.itemId));
 await page.locator('#collection-search').fill(game.item(lockedJob.output.itemId).name);await page.locator('#collection-tier').selectOption('0');
 assert.ok(await page.locator('.collection-card').count()>0);assert.match(await page.locator('#collection-results').innerText(),/等级不足/);
 await page.locator('#collection-level-met').check();assert.equal(await page.locator('.collection-card').count(),0);
 await page.locator('#collection-levels').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.levels.smithing"]').fill(String(lockedJob.levelReq));await page.locator('[data-collection-path="config.levels.smithing"]').press('Tab');assert.ok(await page.locator('.collection-card').count()>0);
 await page.locator('[data-collection-path="config.levels.smithing"]').fill('1');await page.locator('[data-collection-path="config.levels.smithing"]').press('Tab');assert.equal(await page.locator('.collection-card').count(),0);
 await page.locator('#collection-search').fill('Copper');await page.locator('#collection-bonuses').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.worldRarity"]').fill('10000000');await page.locator('[data-collection-path="config.worldRarity"]').press('Tab');
 assert.ok(await page.locator('.collection-card').count()>0);assert.match(await page.locator('#collection-results').innerText(),/当前概率为零/);
 await page.selectOption('#language','en');assert.equal(await page.getByLabel('Meets level requirement',{exact:true}).isChecked(),true);await page.selectOption('#language','zh');
 await page.locator('[data-collection-path="config.worldRarity"]').fill('0');await page.locator('[data-collection-path="config.worldRarity"]').press('Tab');await page.locator('#collection-level-met').uncheck();await page.locator('#collection-search').fill('');await page.locator('#collection-tier').selectOption('all');
 results.cases.push('supported skill options only; level filter follows recipe requirements and retains zero-probability routes, language state and missing prices');
 // One configuration supplies all work skills.
 assert.equal(await page.locator('[data-collection-path="config.masteries.xp"]').count(),1);assert.equal(await page.locator('[data-collection-path="config.gear.mount.id"]').count(),1);
 assert.equal(await page.locator('[data-collection-path^="config.brews."]').count(),4);
 const configurationIds=await page.locator('#collection-content [id]').evaluateAll(es=>es.map(e=>e.id));assert.equal(new Set(configurationIds).size,configurationIds.length);
 const configurationPaths=await page.locator('[data-collection-path]').evaluateAll(es=>es.map(e=>e.dataset.collectionPath));assert.equal(new Set(configurationPaths).size,configurationPaths.length);
 await page.locator('#collection-levels').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.levels.mining"]').fill('2');await page.locator('[data-collection-path="config.levels.mining"]').press('Tab');await page.locator('#collection-masteries').evaluate(e=>e.open=true);
 assert.equal(await page.locator('[data-collection-path="config.masteries.gather"]').isVisible(),true);assert.equal(await page.locator('[data-collection-path="config.masteries.craft"]').isVisible(),true);
 await page.locator('#collection-search').fill('Copper');await page.locator('#collection-tier').selectOption('0');await page.locator('#collection-points-max').fill('1');
 const gatherTime=()=>page.locator('[data-collection-key="1:1:1"] summary>[data-collection-metric="secondsPerPoint"]').evaluate(e=>Number(e.lastChild.textContent.replace(/,/g,'')));
 const initialGatherTime=await gatherTime();await page.locator('[data-collection-path="config.masteries.gather"]').fill('20');await page.locator('[data-collection-path="config.masteries.gather"]').press('Tab');
 assert.ok(await gatherTime()<initialGatherTime);assert.equal(await page.locator('[data-collection-path="config.masteries.craft"]').inputValue(),'0');assert.match(await page.locator('.collection-mastery-group').first().innerText(),/10%/);
 await page.selectOption('#language','en');assert.equal(await page.locator('[data-collection-path="config.masteries.gather"]').inputValue(),'20');await page.selectOption('#language','zh');
 await page.locator('[data-collection-path="config.masteries.gather"]').fill('0');await page.locator('[data-collection-path="config.masteries.gather"]').press('Tab');assert.equal(await gatherTime(),initialGatherTime);await page.locator('#collection-points-max').fill('');
 results.cases.push('one shared configuration with unique fields; gather mastery changes a non-starter action without affecting crafting');
 await page.locator('#collection-tier').selectOption('0');await page.locator('#collection-search').fill('Bronze bar');
 assert.equal(await page.locator('#collection-sort').inputValue(),'costPerPoint');assert.equal(await page.locator('.collection-card').count(),8);await page.locator('#collection-points-max').fill('1');assert.equal(await page.locator('.collection-card').count(),1);await page.locator('.collection-card summary').click();
 const count=page.locator('[data-collection-count="40"]');await count.fill('9');await count.press('Tab');await page.locator('.collection-card summary').click();await page.waitForFunction(()=>document.querySelector('[data-collection-count="40"]')?.value==='9');
 assert.match(await page.locator('.collection-card summary').innerText(),/9 → 10/);assert.equal(await page.locator('.collection-points strong').innerText(),'1');assert.match(await page.locator('.collection-points').innerText(),/新增精通点/);
 await page.locator('[data-collection-simulate]').click();await page.waitForFunction(()=>document.querySelector('.collection-detail').textContent.includes('单次原始模拟样本'));assert.match(await page.locator('.collection-detail').innerText(),/已完成/);
 assert.equal(await page.locator('#collection-buy').inputValue(),'ask');
 assert.equal(await page.locator('.collection-total-cost').innerText(),'总材料成本\n—');assert.equal(await page.locator('.collection-card summary>span:nth-child(4)').getAttribute('class'),'collection-total-cost');
 const pricingWorkers=await page.evaluate(()=>window.collectionWorkers);
 const vendorCost=await page.evaluate(async()=>{const {game}=await import('/src/model.js');const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const [id,ask,bid]of [[1,2,1],[2,3,2],[40,25,20]])prices.quotes[id]={ask:{value:ask,capturedAt:Date.now()},bid:{value:bid,capturedAt:Date.now()}};updatePrices(prices);return game.vendorPrice(1)+game.vendorPrice(2);});
 const materialPerPoint=()=>page.locator('.collection-card summary>[data-collection-metric="costPerPoint"]').evaluate(e=>Number(e.lastChild.textContent.replace(/,/g,'')));
 assert.equal(await materialPerPoint(),5);assert.equal(await page.locator('.collection-total-cost').innerText(),'总材料成本\n5');await page.locator('#collection-buy').selectOption('bid');assert.equal(await materialPerPoint(),3);assert.equal(await page.locator('.collection-total-cost').innerText(),'总材料成本\n3');assert.match(await page.locator('.collection-detail').innerText(),/单次原始模拟样本/);
 await page.locator('#collection-buy').selectOption('vendor');assert.equal(await materialPerPoint(),vendorCost);await page.locator('#collection-sell').selectOption('vendor');assert.equal(await materialPerPoint(),vendorCost);await page.locator('#collection-sell').selectOption('bid');
 await page.locator('#collection-buy').selectOption('bid');await page.selectOption('#language','en');assert.equal(await page.locator('#collection-buy').inputValue(),'bid');await page.selectOption('#language','zh');assert.equal(await page.evaluate(()=>window.collectionWorkers),pricingWorkers);
 results.cases.push('material ask/bid/vendor prices, independent recovery mode and retained simulation/language state');
 const workers=await page.evaluate(()=>window.collectionWorkers);await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const state=structuredClone(priceState());for(const [id,value]of [[1,2],[2,3],[40,20]])state.prices[id]={price:value,source:'manual',locked:true,updatedAt:Date.now(),quoteCapturedAt:null};updatePrices(state);});
 assert.equal(await page.evaluate(()=>window.collectionWorkers),workers);assert.match(await page.locator('.collection-card summary').innerText(),/利润／点\s*15/);assert.match(await page.locator('.collection-detail').innerText(),/单次原始模拟样本/);results.cases.push('hidden URL, explicit manual start, target edit, real Worker completion and price-only revaluation');

 assert.deepEqual(await page.locator('#collection-sort option').allTextContents(),['时间（升序）','材料成本（升序）','利润（降序）']);
 await page.locator('#collection-points-max').fill('');
 const totals=await page.locator('.collection-card').evaluateAll(es=>es.map(e=>({target:Number(e.dataset.collectionKey.split(':')[2]),cost:Number(e.querySelector('.collection-total-cost').lastChild.textContent.replace(/,/g,''))})));for(const row of totals)assert.equal(row.cost,(row.target-9)*5);
 const orderFor=async field=>page.locator(`[data-collection-metric="${field}"]`).evaluateAll(els=>els.map(e=>Number(e.childNodes[1].textContent.replace(/,/g,''))));
 assert.match(await page.locator('.collection-card summary').first().innerText(),/利润／点/);
 const targetOrder=()=>page.locator('.collection-card').evaluateAll(es=>es.map(e=>Number(e.dataset.collectionKey.split(':')[2])));
 for(const mode of ['secondsPerPoint','costPerPoint','profitPerPoint']){
  await page.locator('#collection-sort').selectOption(mode);const values=await orderFor(mode);assert.deepEqual(values,[...values].sort((a,b)=>mode==='profitPerPoint'?b-a:a-b));
  assert.equal((await targetOrder())[0],mode==='profitPerPoint'?10000000:10);
 }
 await page.selectOption('#language','en');assert.deepEqual(await page.locator('#collection-sort option').allTextContents(),['Time (ascending)','Material cost (ascending)','Profit (descending)']);assert.equal(await page.locator('#collection-sort').inputValue(),'profitPerPoint');await page.selectOption('#language','zh');
 assert.equal(await page.evaluate(()=>window.collectionWorkers),workers);await page.locator('#collection-sort').selectOption('costPerPoint');await page.locator('#collection-points-max').fill('1');
 results.cases.push('time/material ascending and profit descending per mastery point, bilingual labels, numeric order and no extra simulation');
 await page.locator('[data-collection-count="40"]').fill('-1');await page.locator('[data-collection-count="40"]').press('Tab');assert.match(await page.locator('#collection-error').innerText(),/非负整数/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]),9);
 await page.selectOption('#language','en');assert.equal(await page.locator('[data-collection-count="40"]').inputValue(),'-1');await page.locator('#collection-points-max').fill('3');await page.locator('[data-collection-count="40"]').fill('10');await page.locator('[data-collection-count="40"]').press('Tab');
 await page.locator('#mastery-nav').click();await page.goBack();await page.locator('#collection-section').waitFor({state:'visible'});assert.match(await page.locator('.collection-card summary').innerText(),/10 → 100/);
 await page.reload();await page.locator('#collection-type').selectOption('all');assert.equal(await page.locator('#collection-buy').inputValue(),'bid');await page.locator('#collection-search').fill('Bronze bar');await page.locator('#collection-tier').selectOption('0');assert.equal(await page.locator('#collection-points-max').inputValue(),'');assert.equal(await page.locator('.collection-card').count(),6);await page.locator('#collection-points-max').fill('3');await page.locator('.collection-card summary').click();assert.equal(await page.locator('[data-collection-count="40"]').inputValue(),'10');results.cases.push('invalid edits do not overwrite storage; language preserves drafts; history and refresh preserve progress');
 const filterWorkers=await page.evaluate(()=>window.collectionWorkers);
 await page.locator('#collection-points-min').fill('3');assert.equal(await page.locator('.collection-card').count(),1);
 await page.locator('#collection-points-min').fill('4');assert.equal(await page.locator('.collection-card').count(),0);assert.match(await page.locator('#collection-error').innerText(),/Invalid mastery point range/);
 await page.selectOption('#language','zh');assert.equal(await page.locator('#collection-points-min').inputValue(),'4');assert.equal(await page.locator('#collection-points-max').inputValue(),'3');assert.match(await page.locator('#collection-error').innerText(),/精通点范围无效/);
 for(const invalid of ['-1','1.5','abc']){await page.locator('#collection-points-min').fill(invalid);assert.equal(await page.locator('.collection-card').count(),0);assert.match(await page.locator('#collection-error').innerText(),/精通点范围无效/);}
 await page.locator('#collection-points-min').fill('0');await page.locator('#collection-points-max').fill('0');assert.equal(await page.locator('.collection-card').count(),0);
 await page.locator('#collection-points-min').fill('');await page.locator('#collection-points-max').fill('');assert.equal(await page.locator('.collection-card').count(),6);const materialCosts=await page.locator('.collection-card summary>[data-collection-metric="costPerPoint"]').evaluateAll(es=>es.map(e=>Number(e.textContent.replace(/[^0-9.-]/g,''))));assert.deepEqual(materialCosts,[...materialCosts].sort((a,b)=>a-b));
 await page.locator('#collection-points-min').fill('13');await page.locator('#collection-points-max').fill('13');assert.equal(await page.locator('.collection-card').count(),1);assert.match(await page.locator('.collection-card summary').innerText(),/10 → 1,000/);assert.equal(await page.locator('.collection-points strong').innerText(),'13');
 await page.locator('.collection-card summary').click();await page.locator('[data-collection-simulate]').click();await page.waitForFunction(()=>document.querySelector('.collection-detail').textContent.includes('单次原始模拟样本'));assert.match(await page.locator('.collection-detail').innerText(),/已完成/);
 await page.locator('#collection-points-min').fill('3');await page.locator('#collection-points-max').fill('3');assert.match(await page.locator('.collection-card summary').innerText(),/10 → 100/);assert.equal(await page.locator('.collection-detail').getByText(/单次原始模拟样本/).count(),0);
 assert.equal(await page.evaluate(()=>window.collectionWorkers),filterWorkers+1);results.cases.push('all future targets, inclusive point bounds, exact reward, invalid/zero/cleared filters, language preservation and per-target Worker isolation');
 for(const width of [1440,390])for(const language of ['zh','en']){
  await page.setViewportSize({width,height:960});await page.selectOption('#language',language);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${language} overflow`);
  await page.screenshot({path:path.join(directory,`collection-${language}-${width}.png`),fullPage:true});
 }
 results.cases.push('Chinese/English desktop and 390px layouts');
 // Exercise a real DOM bridge response and failure atomicity without an account.
 await page.evaluate(()=>{window.testCollectionMissing=false;document.addEventListener('dvi-character-request',async event=>{const request=JSON.parse(event.detail);if(request.action!=='read')return;const {createScenario}=await import('/src/simulation.js');const {craftingSlots,craftingSkills}=await import('/src/crafting-model.js');const {gatheringSlots,gatheringSkills}=await import('/src/gathering-model.js');const {game}=await import('/src/model.js');const {player}=createScenario({});for(const skill of [...craftingSkills,...gatheringSkills])player.skills[skill]=game.levelXp(1);for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;Object.assign(player,{house:{},houseFurniture:{},collections:{40:99},masteries:{},perks:{},ironman:false,homeBank:null});if(window.testCollectionBonuses){player.brews.hunter=player.lastTick+6000;player.brewTier.hunter=3;player.brews.elixir=player.lastTick+6000;player.brewTier.elixir=1;player.brews.blessing=player.lastTick+6000;player.guildBonus=.0125;}if(window.testCollectionMissing)delete player.collections;document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',version:'2.4',id:request.id,snapshot:{version:2,capturedAt:Date.now(),player,worldBuffsVersion:window.testCollectionBonuses?1:undefined,worldTick:player.lastTick,worldBuffs:window.testCollectionBonuses?[{fromTick:player.lastTick,toTick:player.lastTick+6000,xpMult:1.0275,rarityMult:1.0875}]:[],guild:null}})}));});});
 await page.locator('#collection-import').click();await page.waitForFunction(()=>document.querySelector('#collection-import-status').textContent.includes('Imported'));assert.match(await page.locator('.collection-card summary').innerText(),/99 → 100/);
 await page.evaluate(()=>window.testCollectionMissing=true);await page.locator('#collection-import').click();await page.waitForFunction(()=>document.querySelector('#collection-import-status').textContent.includes('incomplete'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]),99);
 results.cases.push('DOM character bridge success, missing collections failure and old data preserved');
 // A long target can be cancelled; a stale Worker must never write its result.
 await page.locator('#collection-search').fill('Bronze bar');await page.locator('#collection-points-min').fill('');await page.locator('#collection-points-max').fill('');const longTarget=page.locator('[data-collection-key="40:41:10000000"]');await longTarget.evaluate(e=>e.open=true);await longTarget.locator('[data-collection-simulate]').click();await longTarget.locator('[data-collection-cancel]').click();assert.equal(await longTarget.locator('[data-collection-cancel]').count(),0);assert.equal(await longTarget.getByText(/Single original-engine sample/).count(),0);
 results.cases.push('long target Worker cancellation');
 // Unrestricted future targets must survive an individual huge recovery amount.
 const beforeOverflowWorkers=await page.evaluate(()=>window.collectionWorkers);
 await page.locator('#collection-search').fill('');await page.locator('#collection-tier').selectOption('all');await page.locator('#collection-skill').selectOption('all');
 await page.evaluate(async()=>{const {game}=await import('/src/model.js');const {priceDefaults}=await import('/src/item-prices.js');const {updatePrices}=await import('/src/item-price-store.js');const prices=priceDefaults();for(const item of game.items)prices.prices[item.id]={price:1e6,source:'manual',locked:true,updatedAt:Date.now(),quoteCapturedAt:null};updatePrices(prices);});
 assert.equal(await page.locator('#collection-points-min').inputValue(),'');assert.equal(await page.locator('#collection-points-max').inputValue(),'');assert.equal(await page.locator('#collection-error').innerText(),'');assert.ok(await page.locator('.collection-card').count()>0);assert.match(await page.locator('#collection-summary').innerText(),/Amount overflow/);
 await page.locator('#collection-tier').selectOption('3');await page.locator('#collection-skill').selectOption('mining');const overflowTarget=page.locator('[data-collection-key="3001:1:10000000"]');await overflowTarget.locator('summary').click();assert.match(await overflowTarget.innerText(),/Amount exceeds supported range: Product recovery/);assert.match(await overflowTarget.locator('summary>[data-collection-metric="costPerPoint"]').innerText(),/0/);assert.match(await overflowTarget.locator('summary>[data-collection-metric="profitPerPoint"]').innerText(),/—/);assert.equal(await page.locator('[data-collection-key="3001:1:1"] .collection-overflow').count(),0);
 await page.selectOption('#language','zh');assert.match(await page.locator('[data-collection-key="3001:1:10000000"]').innerText(),/金额超出计算范围：产物回收/);
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const entry of Object.values(prices.prices))entry.price=1;updatePrices(prices);});
 assert.equal(await page.locator('.collection-overflow').count(),0);assert.equal(await page.locator('#collection-error').innerText(),'');assert.doesNotMatch(await page.locator('#collection-summary').innerText(),/金额超限/);assert.equal(await page.evaluate(()=>window.collectionWorkers),beforeOverflowWorkers);
 results.cases.push('blank point bounds with all targets, isolated huge recovery, visible bilingual warning and price correction without simulation');
 // Bonus controls must change actual rarity, keep fractional values and survive saving.
 await page.locator('#collection-search').fill('Copper');await page.locator('#collection-tier').selectOption('1');await page.locator('#collection-points-min').fill('3');await page.locator('#collection-points-max').fill('3');
 await page.locator('#collection-bonuses').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.hotSetting"]').selectOption('off');
 const secondsPerPoint=()=>page.locator('.collection-card summary>[data-collection-metric="secondsPerPoint"]').evaluate(e=>Number(e.lastChild.textContent.replace(/,/g,'')));
 const originalSeconds=await secondsPerPoint();
 for(const [field,value]of [['config.guildXp','1.25'],['config.weeklyXp','2.75'],['config.worldRarity','8.75']]){const input=page.locator(`[data-collection-path="${field}"]`);await input.fill(value);await input.press('Tab');assert.equal(await page.locator(`[data-collection-path="${field}"]`).inputValue(),value);}
 await page.locator('#collection-potions').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.brews.hunter"]').selectOption('2');await page.locator('[data-collection-path="config.blessing"]').check();assert.ok(await secondsPerPoint()<originalSeconds);
 for(const mode of ['current','game','off']){await page.locator('[data-collection-path="config.hotSetting"]').selectOption(mode);assert.equal(await page.locator('[data-collection-path="config.hotSetting"]').inputValue(),mode);}
 const boostedTarget=page.locator('[data-collection-key="1001:1:1"]');await boostedTarget.evaluate(e=>e.open=true);await boostedTarget.getByRole('heading',{name:'药剂持续消耗',exact:true}).waitFor();assert.match(await boostedTarget.innerText(),/药剂持续消耗/);assert.match(await boostedTarget.innerText(),/祝福全程有效/);

 assert.equal(await boostedTarget.locator('.collection-item-name').innerText(),'铜矿');assert.equal(await boostedTarget.locator('.collection-item-tier').innerText(),'罕见');assert.equal(await boostedTarget.locator('.collection-item-heading').textContent(),'铜矿 · 罕见');assert.equal(await boostedTarget.locator('.collection-item-heading').evaluate(e=>getComputedStyle(e.children[0]).font===getComputedStyle(e.children[1]).font),true);assert.doesNotMatch(await boostedTarget.locator('.collection-detail').innerText(),/Copper|Hunter's brew/);assert.match(await boostedTarget.locator('.collection-detail').innerText(),/猎人酿剂/);
 const translationWorkers=await page.evaluate(()=>window.collectionWorkers);await page.locator('#collection-search').fill('铜矿');assert.equal(await page.locator('[data-collection-key="1001:1:1"]').count(),1);await page.selectOption('#language','en');assert.equal(await page.locator('[data-collection-key="1001:1:1"] .collection-item-name').innerText(),'Copper');await page.selectOption('#language','zh');assert.equal(await page.locator('[data-collection-key="1001:1:1"] .collection-item-name').innerText(),'铜矿');await page.locator('#collection-search').fill('Copper');assert.equal(await page.evaluate(()=>window.collectionWorkers),translationWorkers);
 await boostedTarget.locator('[data-collection-simulate]').click();await page.waitForFunction(()=>document.querySelector('.collection-detail').textContent.includes('单次原始模拟样本'));assert.match(await boostedTarget.innerText(),/药剂投入/);
 const bonusWorkers=await page.evaluate(()=>window.collectionWorkers);await page.selectOption('#language','en');assert.equal(await page.locator('[data-collection-path="config.worldRarity"]').inputValue(),'8.75');assert.equal(await page.locator('[data-collection-path="config.brews.hunter"]').inputValue(),'2');assert.equal(await page.locator('[data-collection-path="config.blessing"]').isChecked(),true);assert.equal(await page.evaluate(()=>window.collectionWorkers),bonusWorkers);
 // Complete capture imports all bonuses; legacy capture retains an explicit warning.
 await page.evaluate(()=>{window.testCollectionMissing=false;window.testCollectionBonuses=true;});await page.locator('#collection-import').click();await page.waitForFunction(()=>document.querySelector('#collection-import-status').textContent.includes('Imported'));assert.equal(await page.locator('[data-collection-path="config.brews.hunter"]').inputValue(),'3');assert.equal(await page.locator('[data-collection-path="config.weeklyXp"]').inputValue(),'2.75');assert.equal(await page.locator('#collection-buff-warning').innerText(),'');
 await page.evaluate(()=>window.testCollectionBonuses=false);await page.locator('#collection-import').click();await page.waitForFunction(()=>document.querySelector('#collection-buff-warning').textContent.includes('Update userscript'));assert.equal(await page.locator('[data-collection-path="config.worldRarity"]').inputValue(),'0');
 await page.locator('[data-collection-path="config.worldRarity"]').fill('8.75');await page.locator('[data-collection-path="config.worldRarity"]').press('Tab');await page.locator('[data-collection-path="config.brews.hunter"]').selectOption('2');await page.locator('[data-collection-path="config.blessing"]').check();
 await page.reload();await page.locator('#collection-type').selectOption('all');await page.locator('#collection-potions').evaluate(e=>e.open=true);await page.locator('#collection-bonuses').evaluate(e=>e.open=true);assert.equal(await page.locator('[data-collection-path="config.worldRarity"]').inputValue(),'8.75');assert.equal(await page.locator('[data-collection-path="config.brews.hunter"]').inputValue(),'2');assert.equal(await page.locator('[data-collection-path="config.blessing"]').isChecked(),true);
 await page.locator('#collection-search').fill('Copper');await page.locator('#collection-tier').selectOption('1');await page.locator('#collection-points-min').fill('3');await page.locator('#collection-points-max').fill('3');await page.locator('.collection-card').evaluate(e=>e.open=true);await page.getByRole('heading',{name:'Potion upkeep',exact:true}).waitFor();
 for(const [language,width]of [['zh',390],['en',1440]]){await page.setViewportSize({width,height:960});await page.selectOption('#language',language);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(directory,`collection-bonuses-${language}-${width}.png`),fullPage:true});}
 results.cases.push('bonus controls, fractional inputs, real rarity changes, potion upkeep, full/legacy imports, persistence and bilingual narrow layouts');results.cases.push('rarity item names and potion/output details use base Chinese translations; Chinese search matches rarity items in both languages without simulation');
 assert.equal(marketRequests,0);assert.deepEqual(results.errors,[]);await context.close();
 // Storage errors stay visible, while manual computation remains usable.
 const broken=await browser.newContext();await broken.addInitScript(()=>{localStorage.setItem('dvi-collection-v1','invalid-json');const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='dvi-collection-v1')throw Error('quota');return original.call(this,key,value);};});const errorPage=await broken.newPage();await errorPage.goto(new URL('/collection',base).href);assert.match(await errorPage.locator('#collection-save').innerText(),/could not be read|无法读取/);await errorPage.locator('#collection-manual').click();assert.match(await errorPage.locator('#collection-save').innerText(),/Save failed|保存失败/);assert.ok(await errorPage.locator('.collection-card').count()>0);await broken.close();results.cases.push('invalid storage and quota failure with usable calculations');
}catch(error){results.failure=String(error.stack??error);throw error;}
finally{await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(results,null,2)+'\n');await browser?.close();server?.kill();}
console.log(JSON.stringify(results));
