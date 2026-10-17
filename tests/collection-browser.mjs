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
 assert.equal(await page.locator('[data-section="collection"]').count(),0);assert.equal(await page.locator('.collection-card').count(),0);
 await page.locator('#collection-manual').click();assert.equal(await page.locator('#collection-type').inputValue(),'craft');assert.equal(await page.locator('#collection-level-met').isChecked(),true);
 const paths=await page.locator('[data-collection-path]').evaluateAll(es=>es.map(e=>e.dataset.collectionPath));assert.equal(new Set(paths).size,paths.length);
 await page.locator('#collection-search').fill('Bronze bar');await page.locator('#collection-tier').selectOption('0');assert.equal(await page.locator('.collection-card').count(),8);
 await page.locator('#collection-points-max').fill('1');assert.equal(await page.locator('.collection-card').count(),1);
 const details=()=>page.locator('.collection-card').first().locator('.collection-detail');
 const openFirst=async()=>{await page.locator('.collection-card').first().evaluate(e=>e.open=true);await details().locator('h3').first().waitFor();};
 const headings=()=>details().locator('h3').allTextContents();
 await openFirst();assert.deepEqual(await headings(),['材料采购','产物回收']);assert.equal(await details().locator('input,button,p').count(),0);assert.equal(await details().locator(':scope>h3,:scope>ul').count(),4);
 assert.match(await details().innerText(),/铜矿/);assert.match(await details().innerText(),/锡矿/);assert.match(await details().innerText(),/青铜锭/);assert.match(await details().innerText(),/缺报价/);
 results.cases.push('hidden route, explicit manual scenario, default filters, shared config, all future goals; expanded recipe has only material purchases and product recovery');
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const [id,ask,bid]of [[1,2,1],[2,3,2],[40,25,20]])prices.quotes[id]={ask:{value:ask,capturedAt:Date.now()},bid:{value:bid,capturedAt:Date.now()}};updatePrices(prices);});
 const metric=field=>page.locator(`[data-collection-metric="${field}"]`).first().evaluate(e=>Number(e.childNodes[1].textContent.replace(/,/g,'')));
 assert.equal(await metric('costPerPoint'),5);assert.equal(await metric('profitPerPoint'),15);assert.match(await details().innerText(),/最低卖单/);
 await page.locator('#collection-buy').selectOption('bid');assert.equal(await metric('costPerPoint'),3);assert.match(await details().innerText(),/最高买单/);
 await page.locator('#collection-buy').selectOption('vendor');assert.equal(await metric('costPerPoint'),game.vendorPrice(1)+game.vendorPrice(2));
 await page.locator('#collection-buy').selectOption('ask');await page.locator('#collection-sell').selectOption('vendor');assert.equal(await metric('costPerPoint'),5);await page.locator('#collection-sell').selectOption('bid');
 assert.deepEqual(await headings(),['材料采购','产物回收']);assert.equal(await page.evaluate(()=>window.collectionWorkers),0);
 results.cases.push('ask/bid/vendor and recovery modes revalue retained material/output lists, prices and sources without a collection Worker');
 await page.locator('#collection-points-max').fill('');
 for(const mode of ['secondsPerPoint','costPerPoint','profitPerPoint']){await page.locator('#collection-sort').selectOption(mode);const values=await page.locator(`[data-collection-metric="${mode}"]`).evaluateAll(es=>es.map(e=>Number(e.childNodes[1].textContent.replace(/,/g,''))));assert.deepEqual(values,[...values].sort((a,b)=>mode==='profitPerPoint'?b-a:a-b));}
 await page.locator('#collection-sort').selectOption('costPerPoint');await page.locator('#collection-points-min').fill('15');await page.locator('#collection-points-max').fill('15');assert.equal(await page.locator('.collection-card').count(),1);
 await page.locator('#collection-points-min').fill('-1');assert.equal(await page.locator('.collection-card').count(),0);assert.match(await page.locator('#collection-error').innerText(),/精通点范围无效/);await page.locator('#collection-points-min').fill('');await page.locator('#collection-points-max').fill('');
 await page.locator('#collection-type').selectOption('gather');assert.equal(await page.locator('.collection-card').count(),0);await page.locator('#collection-type').selectOption('craft');
 const lockedJob=game.recipes.find(j=>j.skill==='smithing'&&j.levelReq>1&&!j.retired&&game.collectionItems.has(j.output.itemId));await page.locator('#collection-search').fill(game.item(lockedJob.output.itemId).name);assert.equal(await page.locator('.collection-card').count(),0);await page.locator('#collection-level-met').uncheck();assert.ok(await page.locator('.collection-card').count()>0);await page.locator('#collection-level-met').check();
 results.cases.push('three numeric sort directions, mastery-point bounds, type intersections and level-only filtering remain unchanged');
 await page.evaluate(()=>{window.testCollectionMissing=false;document.addEventListener('dvi-character-request',async event=>{const request=JSON.parse(event.detail);if(request.action!=='read')return;const {createScenario}=await import('/src/simulation.js');const {craftingSlots,craftingSkills}=await import('/src/crafting-model.js');const {gatheringSlots,gatheringSkills}=await import('/src/gathering-model.js');const {game}=await import('/src/model.js');const {player}=createScenario({});for(const skill of [...craftingSkills,...gatheringSkills])player.skills[skill]=game.levelXp(1);for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;Object.assign(player,{house:{},houseFurniture:{},collections:{40:99},masteries:{},perks:{},ironman:false,homeBank:null});if(window.testCollectionBonuses){player.brews.hunter=player.lastTick+6000;player.brewTier.hunter=3;player.brews.elixir=player.lastTick+6000;player.brewTier.elixir=1;player.brews.blessing=player.lastTick+6000;player.guildBonus=.0125;}if(window.testCollectionMissing)delete player.collections;document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',version:'2.4',id:request.id,snapshot:{version:2,capturedAt:Date.now(),player,worldBuffsVersion:window.testCollectionBonuses?1:undefined,worldTick:player.lastTick,worldBuffs:window.testCollectionBonuses?[{fromTick:player.lastTick,toTick:player.lastTick+6000,xpMult:1.0275,rarityMult:1.0875}]:[],guild:null}})}));});});
 await page.locator('#collection-import-panel').evaluate(e=>e.open=true);await page.locator('#collection-import').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))?.counts[40]===99);
 await page.locator('#collection-search').fill('青铜锭');assert.equal(await page.locator('.collection-card').count(),6);await openFirst();assert.deepEqual(await headings(),['材料采购','产物回收']);
 await page.evaluate(()=>window.testCollectionMissing=true);await page.locator('#collection-import').click();await page.waitForFunction(()=>document.querySelector('#collection-import-status').textContent.includes('不完整'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]),99);
 await page.locator('#mastery-nav').click();await page.goBack();await page.locator('#collection-section').waitFor({state:'visible'});assert.equal(await page.locator('#collection-search').inputValue(),'青铜锭');
 await page.reload();assert.equal(await page.locator('#collection-type').inputValue(),'craft');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')).counts[40]),99);
 results.cases.push('controlled character import updates progress, failed import is atomic; history and refresh retain valid imported data');
 await page.locator('#collection-type').selectOption('gather');await page.locator('#collection-search').fill('铜矿');await page.locator('#collection-tier').selectOption('1');await page.locator('#collection-points-min').fill('3');await page.locator('#collection-points-max').fill('3');await openFirst();assert.equal(await page.locator('.collection-item-heading').first().textContent(),'铜矿 · 罕见');assert.doesNotMatch(await details().innerText(),/Copper/);assert.deepEqual(await headings(),['材料采购','产物回收']);
 await page.locator('#collection-potions').evaluate(e=>e.open=true);await page.locator('[data-collection-path="config.brews.hunter"]').selectOption('2');await page.locator('[data-collection-path="config.blessing"]').check();assert.deepEqual(await headings(),['材料采购','产物回收']);assert.equal(await details().locator('input,button,p').count(),0);assert.doesNotMatch(await details().innerText(),/药剂|祝福|模拟|累计数量/);
 for(const [language,width]of [['zh',1440],['zh',390],['en',1440],['en',390]]){await page.setViewportSize({width,height:960});await page.selectOption('#language',language);assert.deepEqual(await headings(),language==='zh'?['材料采购','产物回收']:['Material purchases','Product recovery']);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(directory,`collection-details-${language}-${width}.png`),fullPage:true});}
 results.cases.push('only two detail sections with potions/blessing enabled; translated rarity names, Chinese search, retained expansion and bilingual 1440px/390px layouts');
 await page.selectOption('#language','zh');await page.locator('#collection-search').fill('Copper');await page.locator('#collection-tier').selectOption('3');await page.locator('#collection-points-min').fill('');await page.locator('#collection-points-max').fill('');
 await page.evaluate(async()=>{const {game}=await import('/src/model.js');const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const item of game.items)prices.prices[item.id]={source:'manual',price:1e6};updatePrices(prices);});
 const overflow=page.locator('[data-collection-key="3001:1:10000000"]');assert.match(await overflow.innerText(),/金额超出计算范围/);await overflow.evaluate(e=>e.open=true);await overflow.locator('h3').first().waitFor();assert.deepEqual(await overflow.locator('h3').allTextContents(),['材料采购','产物回收']);
 await page.evaluate(async()=>{const {priceState,updatePrices}=await import('/src/item-price-store.js');const prices=structuredClone(priceState());for(const item of Object.values(prices.prices))item.price=1;updatePrices(prices);});assert.equal(await page.locator('.collection-overflow').count(),0);
 results.cases.push('amount overflow stays visible in row/summary, while detail remains two lists; price correction clears overflow without simulation');
 assert.equal(await page.evaluate(()=>window.collectionWorkers),0);assert.equal(marketRequests,0);assert.deepEqual(results.errors,[]);await context.close();
 const broken=await browser.newContext();await broken.addInitScript(()=>{localStorage.setItem('dvi-collection-v1','invalid-json');const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='dvi-collection-v1')throw Error('quota');return original.call(this,key,value);};});const errorPage=await broken.newPage();await errorPage.goto(new URL('/collection',base).href);assert.match(await errorPage.locator('#collection-save').innerText(),/could not be read|无法读取/);await errorPage.locator('#collection-manual').click();assert.match(await errorPage.locator('#collection-save').innerText(),/Save failed|保存失败/);assert.ok(await errorPage.locator('.collection-card').count()>0);await broken.close();results.cases.push('storage read/quota errors remain visible with usable estimates');
}catch(error){results.failure=String(error.stack??error);throw error;}
finally{await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(results,null,2)+'\n');await browser?.close();server?.kill();}
console.log(JSON.stringify(results));
