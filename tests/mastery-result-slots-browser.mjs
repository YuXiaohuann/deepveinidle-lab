import {openMasteryBrowser,masteryBrowserBuild} from './helpers/mastery-browser.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {masteryDefaults} from '../src/mastery.js';
import {masteryResultStorageKey as key} from '../src/mastery-result-store.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/mastery-result-slots/browser');await fs.mkdir(directory,{recursive:true});
const results={base:process.argv[3]??'local',cases:[],errors:[]};let session;const base=process.argv[3]?.replace(/\/$/,'');
try{
 const build=masteryBrowserBuild();build.mastery={...masteryDefaults(),totalPoints:123};
 session=await openMasteryBrowser({url:base,results,build,viewport:{width:1440,height:1000}});const {page,context}=session;
 const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const slot=id=>page.locator(`[data-saved-slot="${id}"]`);
 const saved=page.locator('#mastery-saved-results');
 const complete=async()=>{await page.click('#optimizer-start');await page.waitForFunction(()=>document.querySelector('#optimizer-start').textContent!=='取消计算'&&!!document.querySelector('[data-optimizer-save]'));await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'null')?.auto,key);};
 assert.equal(await saved.isVisible(),false);assert.equal(await page.locator('#mastery-optimizer #optimizer-results #mastery-saved-results').count(),1);assert.equal(await page.getByRole('heading',{name:'已保存方案',exact:true}).count(),0);
 await page.locator('#mastery-optimizer>summary').click();
 assert.equal(await page.locator('#mastery-optimizer .simulation-caveat').textContent(),'计算结果仅针对当前装备和所选目标，应用于其他目标时效果可能更差。');
 assert.equal(await page.locator('#optimizer-method').count(),0);
 assert.equal(await page.locator('#optimizer-explanation').evaluate(el=>el.open),false);
 const scenarioBefore=await page.locator('#optimizer-scenario').textContent();
 await page.locator('#optimizer-explanation>summary').focus();await page.keyboard.press('Enter');
 assert.match(await page.locator('#optimizer-explanation').innerText(),/1／3／10／30／100/);
 await page.selectOption('#language','en');assert.equal(await page.locator('#optimizer-explanation').evaluate(el=>el.open),true);
 await page.selectOption('#language','zh');assert.equal(await page.locator('#optimizer-scenario').textContent(),scenarioBefore);
 await page.locator('#optimizer-explanation>summary').click();
 assert.equal(await page.locator('#optimizer-status').getAttribute('data-kind'),'normal');
 results.cases.push('top warning and current build remain unchanged; both brief explanations are removed while full keyboard-accessible calculation details preserve disclosure state');
 await page.selectOption('#optimizer-goal','combatCollection');assert.equal(await page.locator('#optimizer-method').count(),0);await page.locator('#mastery-optimizer').screenshot({path:path.join(directory,'panel-brief-zh-1440.png')});await page.selectOption('#optimizer-effort','fast');await complete();
 await page.waitForFunction(key=>!!JSON.parse(localStorage.getItem(key)||'null')?.auto,key);
 assert.equal(await page.locator('#optimizer-status').getAttribute('data-running'),'false');
 const first=(await stored()).auto;assert.equal(first.input.objective,'combatCollection');assert.equal(first.plan.ranks.maxhit,Number(first.plan.ranks.maxhit));
 const alternatives=await page.locator('[data-optimizer-save]').count();const pick=alternatives>1?1:0;
 await page.click(`[data-optimizer-save="${pick}"]`);await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).manual!==null,key);
 const manual=(await stored()).manual;assert.deepEqual(manual.input,first.input);
 assert.equal(await page.locator('[data-optimizer-save]').first().textContent(),'保存');
 for(const lang of ['zh','en'])for(const width of [1440,390]){
  await page.selectOption('#language',lang);await page.setViewportSize({width,height:1000});
  const card=page.locator('.optimizer-plan').first(),save=card.locator('[data-optimizer-save]'),apply=card.locator('[data-optimizer-apply]');
  assert.equal(await save.textContent(),lang==='zh'?'保存':'Save');
  const geometry=await card.evaluate(el=>{const save=el.querySelector('[data-optimizer-save]'),apply=el.querySelector('[data-optimizer-apply]'),a=save.getBoundingClientRect(),b=apply.getBoundingClientRect();return {sameRow:Math.abs(a.top-b.top)<1,sameSize:a.width===b.width&&a.height===b.height,inHeading:save.parentElement===apply.parentElement,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.deepEqual(geometry,{sameRow:true,sameSize:true,inHeading:true,overflow:false});
  for(const id of ['auto','manual']){
   const savedCard=slot(id);
   assert.equal(await savedCard.locator('[data-saved-action="manual"]').count(),0);
   assert.deepEqual(await savedCard.locator('.optimizer-plan-heading [data-saved-action]').evaluateAll(es=>es.map(el=>el.dataset.savedAction)),['clear','apply']);
   assert.equal(await savedCard.locator('[data-saved-action="clear"]').textContent(),lang==='zh'?'删除':'Delete');
   const buttons=await savedCard.locator('.optimizer-plan-heading').evaluate(el=>{const a=el.querySelector('[data-saved-action="clear"]').getBoundingClientRect(),b=el.querySelector('[data-saved-action="apply"]').getBoundingClientRect();return a.left<b.left&&Math.abs(a.top-b.top)<1;});assert.equal(buttons,true);
   assert.equal(await savedCard.locator('.optimizer-plan-heading [data-saved-action="apply"]').textContent(),id==='auto'?(lang==='zh'?'已应用':'Applied'):(lang==='zh'?'应用':'Apply'));
   const alignment=await savedCard.evaluate(el=>{const heading=el.querySelector('.optimizer-plan-heading').getBoundingClientRect(),metrics=el.querySelector('.optimizer-plan-metrics').getBoundingClientRect(),context=el.querySelector('.saved-plan-context').getBoundingClientRect(),button=el.querySelector('[data-saved-action="apply"]').getBoundingClientRect();return {metricsAfterHeading:metrics.top>=heading.bottom,contextAfterMetrics:context.top>=metrics.bottom,width:button.width,height:button.height};});
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
 assert.equal(await slot('manual').locator('[data-saved-action="apply"]').isEnabled(),true);assert.doesNotMatch(await saved.innerText(),/配置已变化/);
 const oldAuto=JSON.stringify(first);await page.click('#optimizer-start');
 await page.waitForFunction(({key,old})=>JSON.stringify(JSON.parse(localStorage.getItem(key)).auto)!==old,{key,old:oldAuto});
 const second=(await stored()).auto;assert.equal(second.input.combat.gear.weapon.plus,first.input.combat.gear.weapon.plus+1);assert.deepEqual((await stored()).manual,manual);
 const currentBefore=await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1'));
 assert.equal(await slot('manual').isVisible(),true);assert.equal(await slot('auto').isVisible(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1')),currentBefore);
 results.cases.push('second real calculation freezes changed equipment and updates auto only; both saved cards are directly visible inside optimizer results');

 const snapshot=JSON.stringify(await stored());await page.evaluate(()=>window.optimizerMode='wait');await page.click('#optimizer-start');const worker=await page.evaluate(()=>window.optimizerWorkers.length);
 for(const lang of ['zh','en'])for(const width of [1440,390]){
  await page.selectOption('#language',lang);await page.setViewportSize({width,height:1000});
  await page.locator('#optimizer-status').scrollIntoViewIfNeeded();
  const style=await page.locator('#optimizer-status').evaluate(el=>{const rect=el.getBoundingClientRect(),row=document.querySelector('#optimizer-start').parentElement.getBoundingClientRect(),css=getComputedStyle(el);return {running:el.dataset.running,gap:rect.top-row.bottom,highlighted:css.color===getComputedStyle(document.querySelector('#mastery-optimizer .simulation-caveat')).color,bold:Number(css.fontWeight)>=600,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.equal(style.running,'true');assert.ok(style.gap>=12);assert.equal(style.highlighted,true);assert.equal(style.bold,true);assert.equal(style.overflow,false);
  await page.locator('#optimizer-status').screenshot({path:path.join(directory,`running-${lang}-${width}.png`)});
 }
 await page.selectOption('#language','zh');await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>window.optimizerWorkers.at(-1).onmessage({data:{progress:{phase:'review',candidates:4,maxCandidates:60,simulations:18}}}));
 assert.equal(await page.locator('#optimizer-status').getAttribute('data-running'),'true');assert.match(await page.locator('#optimizer-status').innerText(),/独立种子复核/);
 results.cases.push('running search/review status has a 12px action-row gap and gold bold text across Chinese/English desktop/mobile redraw');
 await page.click('#optimizer-start');assert.equal(await page.locator('#optimizer-status').getAttribute('data-running'),'false');assert.equal(await page.locator('#optimizer-status').evaluate(el=>Number(getComputedStyle(el).fontWeight)<600),true);assert.equal(JSON.stringify(await stored()),snapshot);
 await page.evaluate(()=>window.optimizerWorkers.at(-1).onmessage({data:{result:{invalid:true}}}));assert.equal(JSON.stringify(await stored()),snapshot);
 await page.click('#optimizer-start');await page.evaluate(()=>window.optimizerWorkers.at(-1).onerror());assert.equal(await page.locator('#optimizer-status').getAttribute('data-running'),'false');assert.equal(JSON.stringify(await stored()),snapshot);
 assert.equal(await page.evaluate(()=>window.optimizerWorkers.length),worker+1);
 await page.click('#optimizer-start');await page.locator('#mastery-total').fill('124');assert.equal(JSON.stringify(await stored()),snapshot);
 results.cases.push('cancel, stale completion, Worker failure and changed input retain both saved slots');

 await page.evaluate(async()=>{const {applyMasteryImport,renderMastery}=await import('/src/mastery-controls.js');applyMasteryImport({version:2,capturedAt:Date.now(),player:{masteries:{xp:1},collections:{},forgeLog:{29:1073741823}}});renderMastery('zh');});
 assert.equal(JSON.stringify(await stored()),snapshot);assert.equal(await slot('manual').locator('[data-saved-action="apply"]').isEnabled(),true);
 await page.click('#mastery-reset');assert.equal(JSON.stringify(await stored()),snapshot);
 const targetBefore=await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1'));await page.reload();assert.equal(JSON.stringify(await stored()),snapshot);assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1')),targetBefore);
 assert.equal(await page.locator('#mastery-optimizer').evaluate(el=>el.open),false);assert.equal(await saved.isVisible(),false);await page.locator('#mastery-optimizer>summary').click();assert.equal(await slot('manual').isVisible(),true);assert.equal(await slot('auto').isVisible(),true);
 results.cases.push('import, reset and refresh retain both slots; expanding optimizer reveals both restored result cards without auto-application');

 for(const language of ['zh','en'])for(const width of [1440,390]){
  await page.selectOption('#language',language);await page.setViewportSize({width,height:1000});
  assert.equal(await page.locator('#optimizer-history-note').count(),0);assert.doesNotMatch(await page.locator('#mastery-optimizer').innerText(),/指标为计算时估算|Metrics are estimates from the calculation/);
  assert.equal(await saved.locator('details').count(),0);
  assert.equal(await saved.locator('.saved-rank-list').count(),0);
  assert.deepEqual(await saved.locator('.saved-result-card').evaluateAll(es=>es.map(el=>el.dataset.savedSlot)),['auto','manual']);
  assert.deepEqual(await saved.locator('h4').allTextContents(),language==='zh'?['最近一次最优方案','已保存方案']:['Most recent best plan','Saved plan']);
  assert.equal((await saved.innerText()).includes(language==='zh'?'保存时间':'Saved at'),false);
  assert.equal(await saved.locator('[role="status"]').count(),0);
  for(const id of ['auto','manual']){
   const context=await slot(id).locator('.saved-plan-context').innerText();
   assert.doesNotMatch(context,language==='zh'?/快速|标准|深入|全面|24 小时/:/(?:^| · )(?:Fast|Standard|Deep|Comprehensive)(?: ·|\n|$)|24 hours/);
   assert.doesNotMatch(context,/Calculated|计算于|\d{2}:\d{2}/);
   const time=slot(id).locator('.optimizer-plan-title .saved-calculation-time');assert.match(await time.innerText(),/\b\d{2}-\d{2} \d{2}:\d{2}\b/);assert.doesNotMatch(await time.innerText(),/\d{2}:\d{2}:\d{2}/);
   assert.equal(await time.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)<parseFloat(getComputedStyle(el.parentElement.querySelector('h4')).fontSize)),true);
   if(width===1440)assert.equal(await time.evaluate(el=>el.getBoundingClientRect().left>=el.parentElement.querySelector('h4').getBoundingClientRect().right),true);
   const levels=await slot(id).locator('.saved-character-levels').innerText();
   assert.match(levels,language==='zh'?/远程 85 · 防御 85 · 生命 85/:/Ranged 85 · Defence 85 · Hitpoints 85/);
   assert.doesNotMatch(levels,language==='zh'?/近战|魔法/:/Melee|Magic/);
  }
  for(const id of ['auto','manual'])assert.equal(await slot(id).evaluate(el=>!!(el.querySelector('.saved-character-levels').compareDocumentPosition(el.querySelector('.saved-equipment'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await saved.screenshot({path:path.join(directory,`saved-${language}-${width}.png`)});
 }
 results.cases.push('Chinese/English desktop and 390px cards show latest best before saved, calculation time beside headings, levels before equipment, no saved time or rank disclosure, and no overflow');

 // Saved application restores target ranks independently of live inputs.
 await page.selectOption('#optimizer-goal','combatCollection');await page.selectOption('#optimizer-effort','fast');await page.locator('#mastery-total').fill('123');
 assert.equal(await slot('manual').locator('[data-saved-action="apply"]').isEnabled(),true);
 const sourceBefore=await page.evaluate(()=>localStorage.getItem('dvi-simulator-v1'));
 await slot('manual').locator('[data-saved-action="apply"]').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-v1')).target),manual.plan.ranks);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-simulator-v1')),sourceBefore);
 await page.locator('#mastery-total').fill('40');await page.locator('[data-mastery-row="xp"] [data-mastery-field="target"]').fill('20');assert.equal(await slot('manual').locator('[data-saved-action="apply"]').isEnabled(),true);await slot('manual').locator('[data-saved-action="apply"]').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-v1')).target),manual.plan.ranks);await page.locator('#mastery-total').fill('123');
 results.cases.push('saved manual plan applies target ranks despite changed equipment and budget; source build stays intact');

 // A new completed recommendation remains the manual-save entry point.
 await page.evaluate(()=>window.optimizerMode='wait');await page.click('#optimizer-start');
 await page.evaluate(async record=>{await window.optimizerWorkers.at(-1).onmessage({data:{result:{objective:'combatCollection',allocationMode:'reset',totalPoints:123,baseline:record.baseline,plans:[record.plan]}}});},first);
 // Failed storage writes must not claim success or overwrite the existing persisted slot.
 const beforeFailure=JSON.stringify(await stored());await page.evaluate(key=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('quota');return window.originalSet.call(this,k,v);};},key);
 await page.locator('[data-optimizer-save="0"]').click();await page.waitForFunction(()=>document.querySelector('#optimizer-status').textContent.includes('not saved'));
 assert.equal(await page.locator('#optimizer-status').getAttribute('data-kind'),'warning');assert.equal(JSON.stringify(await stored()),beforeFailure);await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);
 results.cases.push('quota failure preserves persisted records and visibly reports unsaved result');

 const other=await context.newPage();await other.goto(page.url());await other.locator('#mastery-optimizer>summary').click();await other.locator('[data-saved-slot="manual"] [data-saved-action="clear"]').click();await page.waitForFunction(()=>document.querySelector('#optimizer-status').textContent.includes('another tab'));
 await slot('auto').locator('[data-saved-action="clear"]').click();assert.match(await page.locator('#optimizer-status').innerText(),/another tab/);const otherState=await other.evaluate(key=>localStorage.getItem(key),key);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),otherState);
 await saved.locator('[data-saved-action="reload"]').click();assert.match(await slot('manual').innerText(),/No saved plan/);await other.close();
 results.cases.push('another tab write is detected; stale clearing is rejected until explicit reload');

 // Automatic persistence failure still leaves a completed, applicable in-memory result.
 await page.selectOption('#optimizer-goal','combatCollection');await page.selectOption('#optimizer-effort','fast');await page.locator('#mastery-total').fill('123');
 const oldRecords=JSON.stringify(await stored());await page.evaluate(key=>{window.optimizerMode='wait';window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('quota');return window.originalSet.call(this,k,v);};},key);
 await page.click('#optimizer-start');
 await page.evaluate(async record=>{const worker=window.optimizerWorkers.at(-1);await worker.onmessage({data:{result:{objective:'combatCollection',allocationMode:'reset',totalPoints:123,baseline:record.baseline,plans:[record.plan]}}});},first);
 await page.waitForFunction(()=>document.querySelector('#optimizer-status').textContent.includes('not saved'));
 assert.equal(JSON.stringify(await stored()),oldRecords);assert.equal(await page.locator('[data-optimizer-save]').count(),1);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-v1')).target),first.plan.ranks);
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);
 results.cases.push('automatic-save failure retains both persisted slots, completed recommendation and automatic target application');

 // Identical repeated import and source UI edits preserve running tasks.
 await page.evaluate(async()=>{const {applyMasteryImport,renderMastery}=await import('/src/mastery-controls.js');const snapshot={version:2,capturedAt:Date.now()-1000,player:{masteries:{},collections:{},forgeLog:{29:1073741823}}};window.sameMasterySnapshot=snapshot;applyMasteryImport(snapshot);renderMastery('en');});
 await page.click('#optimizer-start');
 await page.evaluate(async()=>{const {setMasteryCombatSource,invalidateMasteryOptimizer}=await import('/src/mastery-optimizer-controls.js');window.taskSource=JSON.parse(localStorage.getItem('dvi-simulator-v1')).state;window.taskSource.masteries.maxhit=3;window.taskSource.manual.enemySelection='monster-7';window.taskSource.manual.allGear=true;window.taskSource.guild={name:'Another guild',tag:'TAG'};setMasteryCombatSource(()=>window.taskSource);invalidateMasteryOptimizer();});
 assert.equal(await page.locator('#optimizer-start').textContent(),'Cancel calculation');
 await page.evaluate(async record=>{const w=window.optimizerWorkers.at(-1);await w.onmessage({data:{result:{objective:'combatCollection',allocationMode:'reset',totalPoints:w.request.totalPoints,baseline:record.baseline,plans:[record.plan]}}});},first);
 assert.equal(await slot('auto').locator('.saved-result-warning').count(),0);
 await page.evaluate(async()=>{const {applyMasteryImport,renderMastery}=await import('/src/mastery-controls.js');applyMasteryImport({...window.sameMasterySnapshot,capturedAt:Date.now()});renderMastery('en');});
 assert.equal(await slot('auto').locator('.saved-result-warning').count(),0);assert.ok(await page.locator('.optimizer-plan').count()>0);assert.doesNotMatch(await page.locator('#optimizer-status').innerText(),/Inputs updated/);
 await page.selectOption('#optimizer-effort','deep');assert.equal(await slot('auto').locator('.saved-result-warning').count(),0);
 await page.selectOption('#optimizer-effort','fast');await page.click('#optimizer-start');
 await page.evaluate(async()=>{const {invalidateMasteryOptimizer}=await import('/src/mastery-optimizer-controls.js');window.taskSource.levels.magic++;invalidateMasteryOptimizer();});
 assert.equal(await page.locator('#optimizer-start').textContent(),'Start calculation');assert.match(await page.locator('#optimizer-status').innerText(),/Inputs updated/);assert.equal(await slot('auto').locator('.saved-result-warning').count(),0);
 await page.evaluate(async()=>{const {invalidateMasteryOptimizer}=await import('/src/mastery-optimizer-controls.js');window.taskSource.levels.magic--;invalidateMasteryOptimizer();});
 assert.match(await page.locator('#optimizer-status').innerText(),/Inputs updated/);assert.equal(await slot('auto').locator('.saved-result-warning').count(),0);
 results.cases.push('identical repeated import, source filters/masteries/guild identity do not cancel tasks; effort controls search only; whole-level changes cancel running tasks while completed results remain available');

 // Historical metadata cannot invalidate an otherwise legal allocation.
 const legacy=await stored();legacy.manual=structuredClone(legacy.auto);legacy.manual.engine='mastery-1/game-previous';legacy.auto.input=null;legacy.auto.baseline=null;legacy.auto.plan.stats=null;legacy.revision++;
 await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:legacy});await page.reload();await page.locator('#mastery-optimizer>summary').click();
 assert.match(await slot('manual').innerText(),/Historical calculation version/);assert.match(await slot('auto').innerText(),/Historical calculation details unavailable/);
 const historical=await slot('manual').locator('dd').nth(2).innerText();
 await page.locator('#mastery-total').fill('0');assert.match(await slot('manual').innerText(),/Plan exceeds current points/);assert.equal(await slot('manual').locator('dd').nth(2).innerText(),historical);
 await page.locator('[data-mastery-row="xp"] [data-mastery-field="target"]').fill('200');
 await slot('auto').locator('[data-saved-action="apply"]').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-v1')).target),legacy.auto.plan.ranks);
 const currentBeforeImport=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-v1')));
 await page.evaluate(async()=>{const {applyMasteryImport,renderMastery}=await import('/src/mastery-controls.js');applyMasteryImport({version:2,capturedAt:Date.now(),player:{masteries:{xp:9},collections:{},forgeLog:{29:1073741823}}});renderMastery('en');});
 const imported=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-v1')));assert.equal(imported.current.xp,9);assert.deepEqual(imported.target,currentBeforeImport.target);assert.equal(imported.planned,true);
 await page.locator('[data-mastery-row="xp"] [data-mastery-field="target"]').fill('200');await page.locator('#mastery-total').fill('');
 const draftBefore=await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1'));
 await slot('auto').locator('[data-saved-action="apply"]').click();assert.match(await page.locator('#optimizer-status').innerText(),/Enter valid total points to save/);assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-mastery-v1')),draftBefore);
 assert.deepEqual(await page.locator('[data-mastery-field="target"]').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.dataset.masteryId,Number(e.value)]))),legacy.auto.plan.ranks);
 await page.locator('#mastery-total').fill('0');await page.reload();await page.locator('#mastery-optimizer>summary').click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-v1')).target),legacy.auto.plan.ranks);assert.deepEqual(await stored(),legacy);
 await page.setViewportSize({width:390,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await saved.screenshot({path:path.join(directory,'historical-overbudget-en-390.png')});
 results.cases.push('old engine and damaged auxiliary data preserve legal allocations; over-budget and lower-than-current application, invalid-total draft feedback, import preservation and reload are verified');

 await page.evaluate(key=>localStorage.setItem(key,'{damaged'),key);await page.reload();await page.locator('#mastery-optimizer>summary').click();assert.match(await page.locator('#optimizer-status').innerText(),/could not be read/);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'{damaged');
 await saved.locator('[data-saved-action="recover"]').click();await page.waitForFunction(key=>localStorage.getItem(key)===null,key);assert.match(await saved.innerText(),/saved here after a successful/);
 results.cases.push('damaged data remains untouched until explicit clear, then empty slots recover');
 assert.deepEqual(results.errors,[]);await context.close();
}catch(error){results.errors.push(error.stack??String(error));process.exitCode=1;}
finally{await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');await session?.close();}
console.log(JSON.stringify(results,null,2));
