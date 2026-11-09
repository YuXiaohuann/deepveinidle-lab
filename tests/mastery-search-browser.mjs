import {openMasteryBrowser} from './helpers/mastery-browser.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {game} from '../src/model.js';
import {selectSearchOption} from './helpers/search-select.mjs';
import {translatedName} from '../src/i18n.js';
import {gatheringJobs,gatheringSkills} from '../src/gathering-model.js';
import {craftingJobs,craftingSkills} from '../src/crafting-model.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/mastery-search/search');await fs.mkdir(directory,{recursive:true});
const baseURL=process.argv[3]?.replace(/\/$/,'');
const results={base:baseURL??'local',cases:[],errors:[]};let session;
try{
 session=await openMasteryBrowser({url:baseURL,results});const {page,context}=session;

 await page.locator('#mastery-optimizer>summary').click();
 await page.locator('#mastery-total').fill('0');
 const cases=[
  {objective:'combatXp',id:'optimizer-monster',item:game.monsters.find(m=>m.id===7),key:'monsterId',catalog:[...game.monsters].sort((a,b)=>b.level-a.level)},
  {objective:'gatherXp',id:'optimizer-job',item:gatheringJobs.find(j=>j.skill==='mining'&&j.levelReq===1),key:'jobId',catalog:[...gatheringJobs].sort((a,b)=>gatheringSkills.indexOf(a.skill)-gatheringSkills.indexOf(b.skill)||b.levelReq-a.levelReq)},
  {objective:'craftXp',id:'optimizer-recipe',item:craftingJobs.find(j=>j.levelReq===1),key:'recipeId',catalog:[...craftingJobs].sort((a,b)=>craftingSkills.indexOf(a.skill)-craftingSkills.indexOf(b.skill)||b.levelReq-a.levelReq)},
 ];
 for(const c of cases){
  await page.selectOption('#optimizer-goal',c.objective);
  await selectSearchOption(page,c.id,c.item);
  for(const language of ['zh','en']){
   await page.selectOption('#language',language);
   const input=page.locator(`#${c.id}`),list=page.locator(`#${c.id}-list`);
   const selected=`${translatedName(c.item.name,language)} · ${c.item.levelReq??c.item.level}`;
   assert.equal(await input.getAttribute('role'),'combobox');assert.equal(await input.inputValue(),selected);
   await input.focus();
   assert.deepEqual(await list.getByRole('option').allTextContents(),c.catalog.map(j=>`${translatedName(j.name,language)} · ${j.levelReq??j.level}`));
   assert.equal(await input.getAttribute('aria-expanded'),'true');
   for(const query of [translatedName(c.item.name,'zh'),c.item.name.toUpperCase()]){
    await input.fill(query);assert.equal(await list.getByRole('option',{name:selected,exact:true}).count(),1);
   }
   await input.fill('unmatched-example-xyz');assert.equal(await list.getByRole('option').count(),0);
   assert.equal(await page.locator(`#${c.id}-status`).innerText(),language==='zh'?'没有匹配的选项':'No matching options');
   await input.press('Enter');assert.equal(await input.inputValue(),'unmatched-example-xyz');
   await input.press('Escape');assert.equal(await input.inputValue(),selected);assert.equal(await input.getAttribute('aria-expanded'),'false');
   await input.click();await input.fill('unmatched-example-xyz');await input.press('Tab');assert.equal(await input.inputValue(),selected);
   await input.click();await input.fill('unmatched-example-xyz');await page.locator('#optimizer-scenario').click();assert.equal(await input.inputValue(),selected);
   await input.click();await input.press('ArrowDown');assert.ok(await input.getAttribute('aria-activedescendant'));
   await input.press('Enter');assert.equal(await page.locator(`#${c.id}`).inputValue(),`${translatedName(c.catalog[0].name,language)} · ${c.catalog[0].levelReq??c.catalog[0].level}`);
   await selectSearchOption(page,c.id,c.item);
   await page.locator(`#${c.id}`).fill(c.item.name);await page.locator(`#${c.id}`).press('Enter');assert.equal(await page.locator(`#${c.id}`).inputValue(),selected);
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.locator(`#${c.id}`).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await list.evaluate(el=>el.clientHeight<=260&&el.scrollHeight>=el.clientHeight));
    assert.ok(await list.getByRole('option').first().evaluate(el=>el.getBoundingClientRect().height>=44));
    await page.locator('#mastery-optimizer').screenshot({path:path.join(directory,`${c.id}-${language}-${width}.png`)});
    await page.locator(`#${c.id}`).press('Escape');
   }
  }
  await page.setViewportSize({width:1440,height:1100});await page.selectOption('#language','zh');
  await page.evaluate(()=>window.optimizerMode='wait');await page.click('#optimizer-start');
  assert.equal(await page.evaluate(key=>window.optimizerWorkers.at(-1).request[key],c.key),c.item.id);
  await page.locator(`#${c.id}`).fill('unmatched-example-xyz');
  assert.equal(await page.evaluate(()=>window.optimizerWorkers.at(-1).wasTerminated===true),false);
  await page.locator(`#${c.id}`).press('Escape');
  await selectSearchOption(page,c.id,c.item);
  assert.equal(await page.evaluate(()=>window.optimizerWorkers.at(-1).wasTerminated===true),false);
  const alternative=c.catalog.find(j=>j.id!==c.item.id);await selectSearchOption(page,c.id,alternative);
  assert.equal(await page.evaluate(()=>window.optimizerWorkers.at(-1).wasTerminated),true);
  await page.selectOption('#language','en');assert.equal(await page.locator(`#${c.id}`).inputValue(),`${alternative.name} · ${alternative.levelReq??alternative.level}`);
  results.cases.push(`${c.id}: sorted complete catalog; bilingual case-insensitive search; keyboard, no-match, escape, tab and blur; desktop/mobile; confirmed-only cancellation and correct Worker target`);
 }
 assert.deepEqual(results.errors,[]);await context.close();
}catch(error){results.errors.push(error.stack??String(error));console.error(error.stack??String(error));process.exitCode=1;}
finally{await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');await session?.close();}
console.log(JSON.stringify(results,null,2));
