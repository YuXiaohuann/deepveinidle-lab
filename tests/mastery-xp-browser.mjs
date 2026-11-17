import {openMasteryBrowser} from './helpers/mastery-browser.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {game} from '../src/model.js';
import {selectSearchOption} from './helpers/search-select.mjs';
import {craftingJobs} from '../src/crafting-model.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/mastery-xp/browser');await fs.mkdir(directory,{recursive:true});
const baseURL=process.argv[3]?.replace(/\/$/,'');
const results={base:baseURL??'local',cases:[],errors:[]};let session;
try{
 session=await openMasteryBrowser({url:baseURL,results});const {page,context}=session;

 await page.locator('#mastery-optimizer>summary').click();
 await page.locator('#mastery-total').fill('40');
 await page.selectOption('#optimizer-effort','standard');
 const sourceBefore=await page.evaluate(()=>({combat:localStorage.getItem('dvi-simulator-v1'),gather:localStorage.getItem('dvi-gathering-v1'),craft:localStorage.getItem('dvi-crafting-config-v1')}));
 for(const objective of ['combatXp','gatherXp','craftXp']){
  await page.selectOption('#optimizer-goal',objective);
  if(objective==='craftXp'){
   assert.equal(await page.locator('#optimizer-recipe').count(),1);
   assert.ok(await page.locator('#optimizer-tier option').count()>0);
   await selectSearchOption(page,'optimizer-recipe',craftingJobs.find(j=>j.levelReq===1));
   await page.selectOption('#optimizer-tier','1');
   assert.match(await page.locator('#optimizer-scenario').innerText(),/罕见/);
  }
  await page.click('#optimizer-start');
  await page.waitForFunction(objective=>window.optimizerWorkers.at(-1)?.result?.objective===objective,objective,{timeout:120000});
  await page.waitForFunction(objective=>JSON.parse(localStorage.getItem('dvi-mastery-results-v1'))?.auto?.input.objective===objective,objective);
  assert.equal(await page.locator('.optimizer-plan').first().locator('dt').nth(2).innerText(),'计算时经验');
  assert.equal(await page.locator('[data-saved-slot="auto"] dt').nth(2).innerText(),'计算时经验');
  assert.equal(await page.locator('#optimizer-output [data-optimizer-apply="0"]').innerText(),'已应用');
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-mastery-results-v1')).auto);
  assert.deepEqual(record.input.prices,{});assert.ok(record.plan.stats.mean>0);
  if(objective==='craftXp'){assert.equal(record.input.tier,1);assert.equal(record.input.crafting.simulationHours,24);}
  await page.locator('[data-optimizer-save="0"]').click();
  await page.waitForFunction(objective=>JSON.parse(localStorage.getItem('dvi-mastery-results-v1'))?.manual?.input.objective===objective,objective);
  for(const lang of ['en','zh']){
   await page.selectOption('#language',lang);await page.setViewportSize({width:390,height:1000});
   assert.equal(await page.locator('#optimizer-goal').inputValue(),objective);
   assert.equal(await page.locator('.optimizer-plan').first().locator('dt').nth(2).innerText(),lang==='zh'?'计算时经验':'XP at calculation');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('#mastery-optimizer').screenshot({path:path.join(directory,`${objective}-${lang}-390.png`)});
  }
  await page.setViewportSize({width:1440,height:1100});
  results.cases.push(objective+' real Worker, XP metric, automatic apply, two saved slots, bilingual mobile layout');
 }
 assert.deepEqual(await page.evaluate(()=>({combat:localStorage.getItem('dvi-simulator-v1'),gather:localStorage.getItem('dvi-gathering-v1'),craft:localStorage.getItem('dvi-crafting-config-v1')})),sourceBefore);
 await page.reload();await page.locator('#mastery-optimizer>summary').click();
 assert.match(await page.locator('[data-saved-slot="auto"]').innerText(),/制造经验/);
 await page.selectOption('#optimizer-goal','craftXp');await selectSearchOption(page,'optimizer-recipe',craftingJobs.find(j=>j.levelReq===1));await page.selectOption('#optimizer-tier','1');
 assert.equal(await page.locator('[data-saved-slot="auto"] .saved-result-warning').count(),0);
 await page.selectOption('#optimizer-tier','0');
 assert.equal(await page.locator('[data-saved-slot="auto"] .saved-result-warning').count(),0);
 await page.click('#optimizer-edit-combat');await page.waitForURL('**/craft');
 results.cases.push('source settings unchanged; reload restores XP records; crafting rarity changes preserve plans and edit navigation');
 assert.deepEqual(results.errors,[]);await context.close();
}catch(error){results.errors.push(error.stack??String(error));console.error(error.stack??String(error));process.exitCode=1;}
finally{await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');await session?.close();}
console.log(JSON.stringify(results,null,2));
