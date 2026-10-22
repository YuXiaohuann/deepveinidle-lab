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
 let marketReads=0;await context.route('https://deepveinidle.com/api/market/prices.json',route=>{marketReads++;return route.fulfill({contentType:'application/json',body:JSON.stringify({game:'Deep Vein Idle',generatedAt:new Date().toISOString(),refreshSeconds:60,items:{40:{lowestSell:20,highestBuy:10}}})});});
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.message));
 const flag=(p,k)=>page.locator(`[data-character-page="${p}"][data-character-update="${k}"]`);
 const wait=async p=>{const button=p==='combat'?'import-character':p==='collection'?'collection-import':`${p}-import`;await page.waitForFunction(id=>!document.getElementById(id)?.disabled,button);};
 const stock=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-crafting-orders-v1')));
 for(const p of ['combat','gather','enhance','mastery','craft','collection']){
  await page.goto(`http://127.0.0.1:${port}/${p==='combat'?'combat':p}`);await wait(p);
  assert.equal(await flag(p,'config').isChecked(),false);assert.equal(await flag(p,'inventory').count(),['craft','collection'].includes(p)?1:0);
  if(['craft','collection'].includes(p)){assert.equal(await flag(p,'inventory').isChecked(),true);assert.equal(await page.evaluate(()=>window.bridge.reads),1);await flag(p,'inventory').uncheck();await wait(p);}
  const before=await page.evaluate(()=>window.bridge.reads);await flag(p,'config').check();await wait(p);assert.equal(await page.evaluate(()=>window.bridge.reads),before+1);
  const settings=await page.evaluate(p=>JSON.parse(localStorage.getItem(`dvi-character-auto-import-${p}-v1`)),p);assert.equal(settings.config,true);assert.equal(settings.inventory,false);
  assert.match(await page.locator(p==='combat'?'#import-status':`#${p==='collection'?'collection':p}-import-status`).innerText(),/已导入/);
  if(p==='craft')await page.evaluate(xp=>window.bridge.snapshot.player.skills.smithing=xp,game.levelXp(56));
  const baseline=await page.evaluate(()=>{window.bridge.hold=true;window.dispatchEvent(new Event('focus'));return window.bridge.reads;});await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));});assert.equal(await page.evaluate(()=>window.bridge.reads),baseline);
  await page.selectOption('#language','en');await page.selectOption('#language','zh');
  await page.evaluate(()=>{window.respond();window.bridge.hold=false;});await wait(p);if(p==='craft')assert.equal((await stock()).build.levels.smithing,56);
  await page.selectOption('#language','en');await page.selectOption('#language','zh');assert.equal(await page.evaluate(()=>window.bridge.reads),baseline);
  result.cases.push(`${p}: configuration option, applicable inventory option, independent persistence, automatic import, coalesced focus and redraw stability`);
 }
 // Collection inventory-only must preserve the imported configuration and collection progress.
 await flag('collection','config').uncheck();const beforeCollection=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1'))),marketBefore=marketReads;
 await page.evaluate(()=>{window.bridge.snapshot.player.bank={1:100};window.bridge.snapshot.player.collections={40:1000};window.bridge.snapshot.player.skills={};});await flag('collection','inventory').check();await wait('collection');
 const afterCollection=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')));assert.deepEqual(afterCollection.config,beforeCollection.config);assert.deepEqual(afterCollection.counts,beforeCollection.counts);assert.equal(afterCollection.bank[1],100);assert.equal(marketReads,marketBefore);
 await flag('collection','inventory').uncheck();await page.evaluate(()=>window.bridge.snapshot.player.bank=null);await flag('collection','config').check();await wait('collection');assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')))).bank[1],100);
 result.cases.push('collection inventory-only accepts stock without valid build, preserves counts/config and skips market; invalid configuration preserves accepted stock');
 // Craft configuration-only must not need or overwrite stock; both enabled validate atomically.
 await page.goto(`http://127.0.0.1:${port}/craft`);await wait('craft');const beforeCraft=await stock();assert.equal(beforeCraft.build.levels.smithing,55);
 await page.evaluate(()=>{window.bridge.snapshot.player.bank=null;window.bridge.snapshot.player.skills.smithing=0;window.dispatchEvent(new Event('focus'));});await wait('craft');const configOnly=await stock();assert.equal(configOnly.build.levels.smithing,1);assert.deepEqual(configOnly.inventory,beforeCraft.inventory);
 await page.evaluate(xp=>window.bridge.snapshot.player.skills.smithing=xp,game.levelXp(70));
 await flag('craft','inventory').check();await wait('craft');assert.deepEqual((await stock()).inventory,configOnly.inventory);assert.equal((await stock()).build.levels.smithing,1);
 await page.evaluate(()=>{window.bridge.snapshot.player.bank={1:30};window.bridge.snapshot.player.skills.smithing=0;});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await wait('craft');assert.equal((await stock()).inventory.items[1],32);assert.deepEqual((await stock()).orders,beforeCraft.orders);
 result.cases.push('craft configuration-only preserves inventory and orders; combined request rejects invalid inventory atomically and retries');
 for(const p of ['collection','craft']){await page.goto(`http://127.0.0.1:${port}/${p}`);await wait(p);for(const width of [1440,390])for(const lang of ['zh','en']){await page.setViewportSize({width,height:1000});await page.selectOption('#language',lang);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator(p==='craft'?'#craft-import-settings':'#collection-import-panel').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${p}-${lang}-${width}.png`)});}}
 result.cases.push('shared options visible in Chinese/English desktop and 390px without page overflow');
 await page.evaluate(()=>{localStorage.setItem('dvi-collection-v1','bad-json');localStorage.setItem('dvi-character-auto-import-collection-v1',JSON.stringify({version:1,config:false,inventory:true}));});
 await page.goto(`http://127.0.0.1:${port}/collection`);await wait('collection');assert.equal(await page.evaluate(()=>window.bridge.reads),0);assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-collection-v1')),'bad-json');
 await page.locator('#collection-import').click();await wait('collection');assert.equal(await page.evaluate(()=>window.bridge.reads),1);assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-collection-v1')))).initialized,true);
 result.cases.push('unreadable collection build storage blocks automatic stock writes; explicit full import repairs storage');
 assert.deepEqual(result.errors,[]);result.status='passed';await context.close();
}catch(error){result.errors.push(error.stack??String(error));if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await fs.writeFile(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');}console.log(JSON.stringify(result,null,2));
