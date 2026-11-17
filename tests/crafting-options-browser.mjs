import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {craftingDefaults,craftingPlayer} from '../src/crafting-model.js';
import {defaults} from '../src/model.js';
import * as game from '../src/upstream.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/crafting-options');await fs.mkdir(directory,{recursive:true});
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const results={cases:[],errors:[]};let browser;
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited: ${code}`);})]);
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const {player}=craftingPlayer(craftingDefaults());player.ironman=true;
 const snapshot={version:2,worldBuffsVersion:1,capturedAt:Date.now(),player,worldTick:100,worldBuffs:[{label:'Event',fromTick:100,toTick:200,xpMult:1.1},{label:'Event',fromTick:0,toTick:100,xpMult:1.2525,rarityMult:1.5},{fromTick:101,toTick:200,xpMult:4}]};
 for(const language of ['zh','en'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>results.errors.push(error.message));
  const state={...craftingDefaults(),weeklyXp:12.3,hotSetting:'off'};delete state.ironman;
  const combat=defaults();combat.manual.simulationHours=1;combat.manual.enemySelection='monster-1';
  await context.addInitScript(({state,combat,language,snapshot})=>{
   if(!localStorage.getItem('dvi-crafting-config-v1'))localStorage.setItem('dvi-crafting-config-v1',JSON.stringify({version:1,build:state}));
   if(!localStorage.getItem('dvi-simulator-v1'))localStorage.setItem('dvi-simulator-v1',JSON.stringify({state:combat,language}));
   window.worldSnapshot=snapshot;window.craftRuns=[];const OriginalWorker=Worker;
   window.Worker=class extends OriginalWorker{
    constructor(url,options){super(url,options);if(String(url).includes('crafting-worker.js')){this.run={results:[]};window.craftRuns.push(this.run);this.addEventListener('message',({data})=>{if(data.result)this.run.results.push(data.result);if(data.done)this.run.done=true;if(data.jobError||data.error)this.run.error=data.jobError??data.error;});}}
    postMessage(data,...rest){if(this.run)this.run.input=data.state;return super.postMessage(data,...rest);}
    terminate(){if(this.run)this.run.terminated=true;return super.terminate();}
   };
   document.addEventListener('dvi-character-request',event=>{const request=JSON.parse(event.detail);document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',id:request.id,version:'2.4',...(request.action==='probe'?{ready:true}:{snapshot:window.worldSnapshot})})}));});
  },{state,combat,language,snapshot});
  const completed=()=>page.waitForFunction(()=>{const run=window.craftRuns.at(-1),saved=JSON.parse(localStorage.getItem('dvi-crafting-config-v1')).build;return run?.done&&run.input.weeklyXp===saved.weeklyXp&&run.input.ironman===(saved.ironman??false)&&run.input.skill===saved.skill;});
  await page.goto(`http://127.0.0.1:${port}/craft`);await completed();
  await page.locator('#craft-other').evaluate(element=>element.open=true);
  const xp=page.locator('[data-craft-field="weeklyXp"]'),ironman=page.locator('[data-craft-field="ironman"]');
  assert.equal(await xp.inputValue(),'12.3');assert.equal(await ironman.isChecked(),false);assert.equal(await page.locator('[data-craft-field="worldRarity"]').count(),0);
  await page.locator('#craft-import').click();await page.waitForFunction(()=>document.querySelector('[data-craft-field="weeklyXp"]')?.value==='35.25');await completed();assert.equal(await ironman.isChecked(),true);
  assert.equal(await xp.getAttribute('step'),'0.1');assert.equal(await xp.getAttribute('max'),'10000000');
  assert.equal(await xp.locator('xpath=../following-sibling::p[1]').innerText(),language==='zh'?'导入捕获时生效的世界增益，整个模拟周期保持生效。':'Imports world buffs active at capture; they remain active throughout the simulation.');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await ironman.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`${language}-${width}.png`)});
  const runResults=await page.evaluate(()=>window.craftRuns.at(-1).results);assert.ok(runResults.length>0);
  assert.ok(runResults.every(r=>!Object.keys(r.items).some(id=>game.baseItemId(Number(id))===game.mountItemId)));
  await xp.fill('20.75');await xp.blur();await completed();
  await ironman.uncheck();await completed();assert.equal(await page.evaluate(()=>window.craftRuns.at(-1).input.ironman),false);
  assert.ok(await page.evaluate(()=>window.craftRuns.slice(0,-1).every(run=>run.terminated)));
  await page.reload();await completed();await page.locator('#craft-other').evaluate(element=>element.open=true);assert.equal(await xp.inputValue(),'20.75');assert.equal(await ironman.isChecked(),false);
  await page.locator('[data-craft-skill="herblore"]').click();await completed();assert.equal(await xp.inputValue(),'20.75');
  const workers=await page.evaluate(()=>window.craftRuns.length);await page.selectOption('#language',language==='zh'?'en':'zh');assert.equal(await page.evaluate(()=>window.craftRuns.length),workers);await page.selectOption('#language',language);
  await page.evaluate(()=>delete window.worldSnapshot.worldBuffsVersion);await page.locator('#craft-import-settings').evaluate(element=>element.open=true);await page.locator('#craft-import').click();
  await page.waitForFunction(()=>document.querySelector('#craft-import-status').textContent.includes('2.8.0'));await completed();assert.equal(await xp.inputValue(),'0');
  assert.doesNotMatch(await page.locator('#craft-import-status').innerText(),/已保留原值|previous values were kept|稀有度|rarity/);
  await page.evaluate(()=>{window.worldSnapshot.worldBuffsVersion=1;window.worldSnapshot.worldBuffs=[{fromTick:0,toTick:200,xpMult:.5}];});await page.locator('#craft-import').click();
  await page.waitForFunction(()=>/数据缺失或无效|Missing or invalid data/.test(document.querySelector('#craft-import-status').textContent));assert.equal(await xp.inputValue(),'0');
  await page.evaluate(()=>window.worldSnapshot.worldBuffs=[]);await page.locator('#craft-import').click();await page.waitForFunction(()=>!/数据缺失或无效|Missing or invalid data/.test(document.querySelector('#craft-import-status').textContent));await completed();
  await xp.fill('10.5');await xp.blur();await page.locator('#craft-reset').click();await completed();assert.equal(await xp.inputValue(),'0');assert.equal(await ironman.isChecked(),false);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-crafting-config-v1')));assert.deepEqual(saved,{version:1,build:craftingDefaults()});
  assert.ok(await page.evaluate(()=>window.craftRuns.every(run=>!run.error)));
  results.cases.push(`${language}/${width}: configuration storage, full XP import, fractions, ironman, rate invalidation, persistence, skill/language switch, legacy/invalid/empty captures and reset isolation`);await context.close();
 }
 assert.deepEqual(results.errors,[]);
}catch(error){results.errors.push(error.stack??String(error));process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results,null,2));
