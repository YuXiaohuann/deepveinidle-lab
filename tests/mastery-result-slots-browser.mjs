import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {preset} from '../src/model.js';
import {masteryDefaults} from '../src/mastery.js';
import {priceDefaults} from '../src/item-prices.js';
import {masteryResultStorageKey as key} from '../src/mastery-result-store.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/mastery-result-slots/browser');await fs.mkdir(directory,{recursive:true});
const results={cases:[],errors:[]};let browser,server;
try{
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error('Server exited: '+code);})]);
 const base=`http://127.0.0.1:${port}`;
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const combat=preset('ranged');combat.manual.hotSetting='off';const mastery={...masteryDefaults(),totalPoints:123},prices=priceDefaults();prices.preferences.autoImport=false;
 await context.addInitScript(({combat,mastery,prices})=>{
  if(!localStorage.getItem('dvi-simulator-v1'))localStorage.setItem('dvi-simulator-v1',JSON.stringify({language:'zh',state:combat}));
  if(!localStorage.getItem('dvi-mastery-v1'))localStorage.setItem('dvi-mastery-v1',JSON.stringify(mastery));
  if(!localStorage.getItem('dvi-item-prices-v1'))localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));
  const OriginalWorker=Worker;window.optimizerWorkers=[];
  window.Worker=class extends OriginalWorker{
   constructor(url,options){super(url,options);this.optimizer=String(url).includes('mastery-optimizer-worker.js');if(this.optimizer)window.optimizerWorkers.push(this);}
   postMessage(data,...rest){if(this.optimizer){this.request=structuredClone(data);if(window.waitOptimizer)return;}return super.postMessage(data,...rest);}
   terminate(){this.wasTerminated=true;return super.terminate();}
  };
 },{combat,mastery,prices});
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>results.errors.push(error.message));
 const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const slot=id=>page.locator(`[data-saved-slot="${id}"]`);
 const saved=page.locator('#mastery-saved-results');
 const complete=async()=>{await page.click('#optimizer-start');await page.waitForFunction(()=>document.querySelector('#optimizer-start').textContent!=='取消计算'&&!!document.querySelector('[data-optimizer-save]'));await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'null')?.auto!==null,key);};
 await page.goto(base+'/mastery');assert.equal(await saved.isVisible(),false);assert.equal(await page.locator('#mastery-optimizer #optimizer-results #mastery-saved-results').count(),1);assert.equal(await page.getByRole('heading',{name:'已保存方案',exact:true}).count(),0);
 await page.locator('#mastery-optimizer>summary').click();await page.selectOption('#optimizer-goal','combatCollection');await page.selectOption('#optimizer-effort','fast');await complete();
 await page.waitForFunction(key=>!!JSON.parse(localStorage.getItem(key)||'null')?.auto,key);
 const first=(await stored()).auto;assert.equal(first.input.objective,'combatCollection');assert.equal(first.plan.ranks.maxhit,Number(first.plan.ranks.maxhit));
 const alternatives=await page.locator('[data-optimizer-save]').count();const pick=alternatives>1?1:0;
 await page.click(`[data-optimizer-save="${pick}"]`);await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).manual!==null,key);
 const manual=(await stored()).manual;assert.deepEqual(manual.input,first.input);assert.equal((await stored()).selected,'manual');
 assert.equal(await page.locator('[data-optimizer-save]').first().textContent(),'保存');
 for(const lang of ['zh','en'])for(const width of [1440,390]){
  await page.selectOption('#language',lang);await page.setViewportSize({width,height:1000});
  const card=page.locator('.optimizer-plan').first(),save=card.locator('[data-optimizer-save]'),apply=card.locator('[data-optimizer-apply]');
  assert.equal(await save.textContent(),lang==='zh'?'保存':'Save');
  const geometry=await card.evaluate(el=>{const save=el.querySelector('[data-optimizer-save]'),apply=el.querySelector('[data-optimizer-apply]'),a=save.getBoundingClientRect(),b=apply.getBoundingClientRect();return {sameRow:Math.abs(a.top-b.top)<1,sameSize:a.width===b.width&&a.height===b.height,inHeading:save.parentElement===apply.parentElement,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.deepEqual(geometry,{sameRow:true,sameSize:true,inHeading:true,overflow:false});
  for(const id of ['auto','manual']){
   const savedCard=slot(id);
   assert.equal(await savedCard.locator('.optimizer-plan-heading [data-saved-action="apply"]').textContent(),id==='auto'?(lang==='zh'?'已应用':'Applied'):(lang==='zh'?'应用':'Apply'));
   const alignment=await savedCard.evaluate(el=>{const heading=el.querySelector('.optimizer-plan-heading').getBoundingClientRect(),metrics=el.querySelector('.saved-plan-metrics').getBoundingClientRect(),context=el.querySelector('.saved-plan-context').getBoundingClientRect(),button=el.querySelector('[data-saved-action="apply"]').getBoundingClientRect();return {metricsAfterHeading:metrics.top>=heading.bottom,contextAfterMetrics:context.top>=metrics.bottom,width:button.width,height:button.height};});
   const reference=await apply.boundingBox();assert.equal(alignment.metricsAfterHeading,true);assert.equal(alignment.contextAfterMetrics,true);assert.equal(alignment.width,reference.width);assert.equal(alignment.height,reference.height);
  }
  await card.screenshot({path:path.join(directory,`actions-${lang}-${width}.png`)});
 }
 await page.selectOption('#language','zh');await page.setViewportSize({width:1440,height:1000});
 results.cases.push('real Worker automatically stores best; chosen recommendation is independently saved in manual slot');

 await page.evaluate(async()=>{
  const {setMasteryCombatSource,invalidateMasteryOptimizer}=await import('/src/mastery-optimizer-controls.js');
  const state=JSON.parse(localStorage.getItem('dvi-simulator-v1')).state;state.gear.weapon.plus++;setMasteryCombatSource(()=>state);invalidateMasteryOptimizer();
 });
 assert.equal(await slot('manual').locator('[data-saved-action="apply"]').isDisabled(),true);assert.match(await saved.innerText(),/当前配置已变化/);
 const oldAuto=JSON.stringify(first);await page.click('#optimizer-start');
 await page.waitForFunction(({key,old})=>JSON.stringify(JSON.parse(localStorage.getItem(key)).auto)!==old,{key,old:oldAuto});
 const second=(await stored()).auto;assert.equal(second.input.combat.gear.weapon.plus,first.input.combat.gear.weapon.plus+1);assert.deepEqual((await stored()).manual,manual);assert.equal((await stored()).selected,'manual');
 const currentBefore=await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1'));
 assert.equal(await slot('manual').isVisible(),true);assert.equal(await slot('auto').isVisible(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1')),currentBefore);
 results.cases.push('second real calculation freezes changed equipment and updates auto only; both saved cards are directly visible inside optimizer results');

 const snapshot=JSON.stringify(await stored());await page.evaluate(()=>window.waitOptimizer=true);await page.click('#optimizer-start');const worker=await page.evaluate(()=>window.optimizerWorkers.length);
 await page.click('#optimizer-start');assert.equal(JSON.stringify(await stored()),snapshot);
 await page.evaluate(()=>window.optimizerWorkers.at(-1).onmessage({data:{result:{invalid:true}}}));assert.equal(JSON.stringify(await stored()),snapshot);
 await page.click('#optimizer-start');await page.evaluate(()=>window.optimizerWorkers.at(-1).onerror());assert.equal(JSON.stringify(await stored()),snapshot);
 assert.equal(await page.evaluate(()=>window.optimizerWorkers.length),worker+1);
 await page.click('#optimizer-start');await page.locator('#mastery-total').fill('124');assert.equal(JSON.stringify(await stored()),snapshot);
 results.cases.push('cancel, stale completion, Worker failure and changed input retain both saved slots');

 await page.evaluate(async()=>{const {applyMasteryImport,renderMastery}=await import('/src/mastery-controls.js');applyMasteryImport({version:2,capturedAt:Date.now(),player:{masteries:{xp:1},collections:{},forgeLog:{29:1073741823}}});renderMastery('zh');});
 assert.equal(JSON.stringify(await stored()),snapshot);assert.equal(await slot('manual').locator('[data-saved-action="apply"]').isDisabled(),true);
 await page.click('#mastery-reset');assert.equal(JSON.stringify(await stored()),snapshot);
 const targetBefore=await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1'));await page.reload();assert.equal(JSON.stringify(await stored()),snapshot);assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1')),targetBefore);
 assert.equal(await page.locator('#mastery-optimizer').evaluate(el=>el.open),false);assert.equal(await saved.isVisible(),false);await page.locator('#mastery-optimizer>summary').click();assert.equal(await slot('manual').isVisible(),true);assert.equal(await slot('auto').isVisible(),true);
 results.cases.push('import, reset and refresh retain both slots; expanding optimizer reveals both restored result cards without auto-application');

 for(const language of ['zh','en'])for(const width of [1440,390]){
  await page.selectOption('#language',language);await page.setViewportSize({width,height:1000});
  assert.equal(await saved.locator('details').count(),0);
  assert.equal(await saved.locator('.saved-rank-list').count(),0);
  assert.deepEqual(await saved.locator('.saved-result-card').evaluateAll(es=>es.map(el=>el.dataset.savedSlot)),['auto','manual']);
  assert.deepEqual(await saved.locator('h4').allTextContents(),language==='zh'?['最近一次最优方案','已保存方案']:['Most recent best plan','Saved plan']);
  assert.equal((await saved.innerText()).includes(language==='zh'?'保存时间':'Saved at'),false);
  for(const id of ['auto','manual'])assert.equal(await slot(id).evaluate(el=>!!(el.querySelector('.saved-character-levels').compareDocumentPosition(el.querySelector('.saved-equipment'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await saved.screenshot({path:path.join(directory,`saved-${language}-${width}.png`)});
 }
 results.cases.push('Chinese/English desktop and 390px cards show latest best before saved, levels before equipment, no saved time or rank disclosure, and no overflow');

 // Saved application requires matching effective inputs and uses the original target-only path.
 await page.selectOption('#optimizer-goal','combatCollection');await page.selectOption('#optimizer-effort','fast');await page.locator('#mastery-total').fill('123');
 assert.equal(await slot('manual').locator('[data-saved-action="apply"]').isEnabled(),true);
 const sourceBefore=await page.evaluate(()=>localStorage.getItem('dvi-simulator-v1'));
 await slot('manual').locator('[data-saved-action="apply"]').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-v1')).target),manual.plan.ranks);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-simulator-v1')),sourceBefore);
 await page.locator('#mastery-total').fill('40');assert.equal(await slot('manual').locator('[data-saved-action="apply"]').isDisabled(),true);await page.locator('#mastery-total').fill('123');
 results.cases.push('matching saved manual plan applies target ranks only; changed budget disables application and source build stays intact');

 // Failed storage writes must not claim success or overwrite the existing persisted slot.
 const beforeFailure=JSON.stringify(await stored());await page.evaluate(key=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('quota');return window.originalSet.call(this,k,v);};},key);
 await saved.locator('[data-saved-action="manual"]').click();await page.waitForFunction(()=>document.querySelector('#mastery-result-save-status').textContent.includes('not saved'));
 assert.equal(JSON.stringify(await stored()),beforeFailure);await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);
 results.cases.push('quota failure preserves persisted records and visibly reports unsaved result');

 const other=await context.newPage();await other.goto(base+'/mastery');await other.locator('#mastery-optimizer>summary').click();await other.locator('[data-saved-slot="manual"] [data-saved-action="clear"]').click();await page.waitForFunction(()=>document.querySelector('#mastery-result-save-status').textContent.includes('another tab'));
 await slot('auto').locator('[data-saved-action="clear"]').click();assert.match(await saved.innerText(),/another tab/);const otherState=await other.evaluate(key=>localStorage.getItem(key),key);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),otherState);
 await saved.locator('[data-saved-action="reload"]').click();assert.match(await slot('manual').innerText(),/No saved plan/);await other.close();
 results.cases.push('another tab write is detected; stale clearing is rejected until explicit reload');

 // Automatic persistence failure still leaves a completed, applicable in-memory result.
 await page.selectOption('#optimizer-goal','combatCollection');await page.selectOption('#optimizer-effort','fast');await page.locator('#mastery-total').fill('123');
 const oldRecords=JSON.stringify(await stored());await page.evaluate(key=>{window.waitOptimizer=true;window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('quota');return window.originalSet.call(this,k,v);};},key);
 await page.click('#optimizer-start');
 await page.evaluate(async record=>{const worker=window.optimizerWorkers.at(-1);await worker.onmessage({data:{result:{objective:'combatCollection',allocationMode:'reset',totalPoints:123,baseline:record.baseline,plans:[record.plan]}}});},first);
 await page.waitForFunction(()=>document.querySelector('#mastery-result-save-status').textContent.includes('not saved'));
 assert.equal(JSON.stringify(await stored()),oldRecords);assert.equal(await page.locator('[data-optimizer-save]').count(),1);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-v1')).target),first.plan.ranks);
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);
 results.cases.push('automatic-save failure retains both persisted slots, completed recommendation and automatic target application');

 await page.evaluate(key=>localStorage.setItem(key,'{damaged'),key);await page.reload();await page.locator('#mastery-optimizer>summary').click();assert.match(await saved.innerText(),/could not be read/);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'{damaged');
 await saved.locator('[data-saved-action="recover"]').click();await page.waitForFunction(key=>localStorage.getItem(key)===null,key);assert.match(await saved.innerText(),/saved here after a successful/);
 results.cases.push('damaged data remains untouched until explicit clear, then empty slots recover');
 assert.deepEqual(results.errors,[]);await context.close();
}catch(error){results.errors.push(error.stack??String(error));process.exitCode=1;}
finally{await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');server?.kill();await browser?.close();}
console.log(JSON.stringify(results,null,2));
