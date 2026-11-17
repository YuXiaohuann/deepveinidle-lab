import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {createScenario} from '../src/simulation.js';
import {game,preset} from '../src/model.js';
import {craftingSkills,craftingSlots} from '../src/crafting-model.js';
import {gatheringSkills,gatheringSlots} from '../src/gathering-model.js';
import {priceDefaults} from '../src/item-prices.js';
const out=path.resolve(process.argv[2]??'.test-artifacts/character-auto-import/browser');await fs.mkdir(out,{recursive:true});
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let browser,page;const result={cases:[],errors:[]};
try{
 await once(server.stdout,'data');browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const {player}=createScenario({});for(const skill of [...craftingSkills,...gatheringSkills,'melee','ranged','magic','defence','hitpoints','enhancing'])player.skills[skill]=game.levelXp(55);for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;
 Object.assign(player,{house:{},houseFurniture:{},masteries:{},perks:{},ironman:false,homeBank:null,bank:{1:5},pack:[{itemId:1,qty:2}],overflow:{},collections:{40:9}});
 const snapshot=JSON.parse(JSON.stringify({version:2,capturedAt:Date.now(),worldBuffsVersion:1,worldTick:player.lastTick,worldBuffs:[],guild:null,player}));
 const build=preset('ranged');build.manual.simulationHours=1;build.manual.enemySelection='monster-1';const prices=priceDefaults();prices.preferences.autoImport=false;
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(({snapshot,build,prices})=>{
  if(!localStorage.getItem('dvi-simulator-v1'))localStorage.setItem('dvi-simulator-v1',JSON.stringify({language:'zh',state:build}));localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));
  window.bridge={snapshot,reads:0,hold:false,pending:[]};const seen=new Set();
  window.respond=()=>{const entry=window.bridge.pending.shift();if(entry)document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify(entry)}));};
  document.addEventListener('dvi-character-request',event=>{const req=JSON.parse(event.detail);if(seen.has(req.id))return;seen.add(req.id);const data={source:'dvi-character-script',version:'2.4',id:req.id};if(req.action==='read'){window.bridge.reads++;data.snapshot=structuredClone(window.bridge.snapshot);data.snapshot.capturedAt=Date.now();if(window.bridge.hold){window.bridge.pending.push(data);return;}}document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify(data)}));});
 },{snapshot,build,prices});
 await context.route('https://deepveinidle.com/api/market/prices.json',route=>{return route.fulfill({contentType:'application/json',body:JSON.stringify({game:'Deep Vein Idle',generatedAt:new Date().toISOString(),refreshSeconds:60,items:{40:{lowestSell:20,highestBuy:10}}})});});
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.message));
 const flag=(p,k)=>page.locator(`[data-character-page="${p}"][data-character-update="${k}"]`);
 const wait=async p=>{const button=p==='combat'?'import-character':`${p}-import`;await page.waitForFunction(id=>!document.getElementById(id)?.disabled,button);};
 const stock=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-crafting-config-v1')));
 for(const p of ['combat','gather','enhance','mastery','craft']){
  await page.goto(`http://127.0.0.1:${port}/${p==='combat'?'combat':p}`);await wait(p);
  assert.equal(await flag(p,'config').isChecked(),false);assert.equal(await flag(p,'inventory').count(),0);

  const before=await page.evaluate(()=>window.bridge.reads);await flag(p,'config').check();await wait(p);assert.equal(await page.evaluate(()=>window.bridge.reads),before+1);
  const settings=await page.evaluate(p=>JSON.parse(localStorage.getItem(`dvi-character-auto-import-${p}-v1`)),p);assert.equal(settings.config,true);assert.equal(settings.inventory,undefined);
  assert.match(await page.locator(p==='combat'?'#import-status':`#${p}-import-status`).innerText(),/已导入/);
  if(p==='craft')await page.evaluate(xp=>window.bridge.snapshot.player.skills.smithing=xp,game.levelXp(56));
  const baseline=await page.evaluate(()=>{window.bridge.hold=true;window.dispatchEvent(new Event('focus'));return window.bridge.reads;});await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));});assert.equal(await page.evaluate(()=>window.bridge.reads),baseline);
  await page.selectOption('#language','en');await page.selectOption('#language','zh');
  await page.evaluate(()=>{window.respond();window.bridge.hold=false;});await wait(p);if(p==='craft')assert.equal((await stock()).build.levels.smithing,56);
  await page.selectOption('#language','en');await page.selectOption('#language','zh');assert.equal(await page.evaluate(()=>window.bridge.reads),baseline);
  result.cases.push(`${p}: configuration option, no inventory option, independent persistence, automatic import, coalesced focus and redraw stability`);
 }
 // Invalid warehouse data must not prevent configuration updates.
 await page.goto(`http://127.0.0.1:${port}/craft`);await wait('craft');
 await page.evaluate(()=>{window.bridge.snapshot.player.bank=null;window.bridge.snapshot.player.pack=null;window.bridge.snapshot.player.skills.smithing=0;window.dispatchEvent(new Event('focus'));});await wait('craft');
 assert.equal((await stock()).build.levels.smithing,1);assert.equal((await stock()).inventory,undefined);assert.equal((await stock()).orders,undefined);
 result.cases.push('craft imports configuration with invalid warehouse and pack; no stock or orders saved');
 for(const p of ['craft']){await page.goto(`http://127.0.0.1:${port}/${p}`);await wait(p);for(const width of [1440,390])for(const lang of ['zh','en']){await page.setViewportSize({width,height:1000});await page.selectOption('#language',lang);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#craft-import-settings').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${p}-${lang}-${width}.png`)});}}
 result.cases.push('shared options visible in Chinese/English desktop and 390px without page overflow');
 const collectionRequests=[];page.on('request',request=>{if(/\/src\/collection-/.test(request.url()))collectionRequests.push(request.url());});
 await page.evaluate(()=>localStorage.setItem('dvi-collection-v1','preserved-old-data'));
 for(const route of ['/collection','/collection/']){
  await page.goto(`http://127.0.0.1:${port}${route}?removed=1`);await wait('combat');
  assert.equal(new URL(page.url()).pathname,'/combat');assert.equal(new URL(page.url()).search,'?removed=1');
  assert.equal(await page.locator('#collection-section').count(),0);
  await page.evaluate(route=>{history.pushState(null,'',route+'?history=1#anchor');window.dispatchEvent(new PopStateEvent('popstate'));},route);
  assert.equal(new URL(page.url()).pathname,'/combat');assert.equal(new URL(page.url()).search,'?history=1');assert.equal(new URL(page.url()).hash,'#anchor');
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-collection-v1')),'preserved-old-data');assert.deepEqual(collectionRequests,[]);
 result.cases.push('removed collection routes redirect, history preserves query/hash, no collection DOM or requests, old storage preserved');
 assert.deepEqual(result.errors,[]);result.status='passed';await context.close();
}catch(error){result.errors.push(error.stack??String(error));if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await fs.writeFile(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');}console.log(JSON.stringify(result,null,2));
