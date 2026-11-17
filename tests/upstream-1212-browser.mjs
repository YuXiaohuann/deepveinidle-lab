import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {gatheringDefaults,gatheringStorageKey} from '../src/gathering-model.js';
import {craftingDefaults} from '../src/crafting-model.js';
import {craftingStorageKey} from '../src/crafting-model.js';
import {priceDefaults} from '../src/item-prices.js';
const output=path.resolve(process.argv[2]??'.test-artifacts/upstream-1212/browser');
await fs.mkdir(output,{recursive:true});
const result={cases:[],errors:[]};let server,browser;
try{
 let base=process.argv[3];
 if(!base){
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited ${code}`);})]);
 base=`http://127.0.0.1:${port}`;
 }
 result.target=base;
  browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 for(const language of ['zh','en'])for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>result.errors.push(e.message));
  const gather=gatheringDefaults();gather.levels.mining=105;gather.jobSelection=344;gather.simulationHours=1;gather.hotSetting='off';gather.gear.pickaxe={id:698,tier:4,plus:17};gather.gear.shield={id:720,tier:4,plus:17};
  const craft=craftingDefaults();craft.skill='smithing';craft.levels.smithing=105;craft.simulationHours=1;craft.hotSetting='off';craft.gear.shield={id:721,tier:4,plus:17};
  for(const build of [gather,craft])for(const [slot,id]of [['helmet',741],['body',742],['legs',743]])build.gear[slot]={id,tier:0,plus:0};
  const prices=priceDefaults();prices.preferences.autoImport=false;
  await context.addInitScript(({language,gather,craft,prices,gatherKey,craftKey})=>{
   if(localStorage.getItem('upstream-1212-initialized'))return;
   localStorage.setItem('upstream-1212-initialized','1');localStorage.setItem('dvi-simulator-v1',JSON.stringify({language,state:{manual:{simulationHours:1,enemySelection:'monster-11'}}}));
   localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));localStorage.setItem(gatherKey,JSON.stringify(gather));
   localStorage.setItem(craftKey,JSON.stringify({version:1,build:craft}));
  },{language,gather,craft,prices,gatherKey:gatheringStorageKey,craftKey:craftingStorageKey});
  for(const [route,prefix,tool,shield]of [['gather','gather','pickaxe','720'],['craft','craft','hammer','721']]){
   await page.goto(base+'/'+route);await page.locator(`#${prefix}-equipment`).evaluate(e=>e.open=true);
   const field=k=>page.locator(`[data-${prefix}-field="gear.${k}"]`);
   assert.equal(await field('shield.id').inputValue(),shield);
   assert.equal(await field('helmet.id').inputValue(),'741');assert.equal(await field('helmet.tier').isDisabled(),true);assert.equal(await field('helmet.plus').isDisabled(),true);
   assert.match(await field('shield.id').locator('xpath=ancestor::div[contains(@class,"gear-row")]').innerText(),/18\.18%/);
   assert.match(await field('helmet.id').locator('xpath=ancestor::div[contains(@class,"gear-row")]').innerText(),/8(?:\.00)?%/);
   assert.equal(await field(`${tool}.id`).locator('option[value="'+(route==='gather'?'698':'699')+'"]').count(),1);
   await field('shield.id').selectOption(route==='gather'?'723':'720');
   assert.match(await field('shield.id').locator('xpath=ancestor::div[contains(@class,"gear-row")]').innerText(),/0(?:\.00)?%/);
   await field('shield.id').selectOption(shield);
   await page.reload();assert.equal(await field('shield.id').inputValue(),shield);assert.equal(await field('helmet.id').inputValue(),'741');
   await page.locator(`#${prefix}-equipment`).evaluate(e=>e.open=true);
   if(route==='gather'){
    await page.waitForFunction(()=>document.getElementById('gather-344-level')&&document.querySelector('#gather-results .gather-progress')?.hidden&&!/计算中|Calculating/.test(document.querySelector('#gather-results tbody').textContent));
    assert.doesNotMatch(await page.locator('#gather-results').innerText(),/模拟失败|Simulation failed|invalidRoute/);
   }else{
    await page.locator('[data-craft-rarity="4"]').click();
    await page.waitForFunction(()=>{const rows=document.querySelectorAll('#craft-results tbody tr');return rows.length>0&&[...rows].some(r=>r.querySelector('[id="craft-upgrade-281:4-recipe"]'))&&!/计算中|Calculating/.test(document.querySelector('#craft-results tbody')?.textContent??'');},null,{timeout:180000});
    assert.doesNotMatch(await page.locator('#craft-results tbody').first().innerText(),/模拟失败|Simulation failed|invalidRoute|未解锁|Locked/);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const screenshot=`${route}-${language}-${width}.png`;await page.screenshot({path:path.join(output,screenshot),fullPage:true});
   result.cases.push({route,language,width,status:'passed',screenshot});
  }
  await context.close();
 }
 assert.deepEqual(result.errors,[]);result.status='passed';
}catch(error){result.status='failed';result.error=error.stack;throw error;}
finally{if(browser)await browser.close();if(server)server.kill();await fs.writeFile(path.join(output,'summary.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
