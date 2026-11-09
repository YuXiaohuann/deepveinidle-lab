import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {priceDefaults} from '../src/item-prices.js';

const directory=path.resolve(process.argv[2]??'.test-artifacts/heading-status');await fs.mkdir(directory,{recursive:true});
const target=process.argv[3]?.replace(/\/$/,'')??null;let server,port;
if(!target){
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
}
const base=target??`http://127.0.0.1:${port}`;
const results={target:target??'local',cases:[],errors:[]};let browser;
import {defaults} from '../src/model.js';
try{
 if(server)await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Server stopped');})]);
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 for(const section of ['combat','gather','craft'])for(const language of ['zh','en'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>results.errors.push(e.message));
  const state=defaults();state.manual.enemySelection='monster-1';state.manual.simulationHours=1;
  const prices=priceDefaults();prices.preferences.autoImport=false;
  await context.addInitScript(({state,language,prices})=>{
   localStorage.setItem('dvi-simulator-v1',JSON.stringify({state,language}));localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));
   window.holdSimulation=true;window.testWorkers=[];const OriginalWorker=Worker;
   window.Worker=class extends OriginalWorker{
    constructor(url,options){super(url,options);this.testUrl=String(url);window.testWorkers.push(this);}
    postMessage(data,...rest){if(window.holdSimulation)return;return super.postMessage(data,...rest);}
   };
  },{state,language,prices});
  await page.goto(`${base}/${section}`);
  const root=section==='combat'?'#combat-section':section==='gather'?'#gather-results':'#craft-recipes-panel';
  const status=page.locator(root+' .simulation-progress');await status.waitFor({state:'visible'});
  await page.waitForFunction(section=>window.testWorkers.some(w=>w.testUrl.includes(section==='combat'?'simulation-worker':section==='gather'?'gathering-worker':'crafting-worker')),section);
  const check=async()=>{
   assert.ok(await status.evaluate(el=>{
    const heading=el.parentElement,box=el.getBoundingClientRect(),parent=heading.getBoundingClientRect();
    return heading.classList.contains('simulation-heading')&&heading.lastElementChild===el&&getComputedStyle(el).textAlign==='right'&&Math.abs(box.right-(parent.right-parseFloat(getComputedStyle(heading).paddingRight)))<2;
   }));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  };
  await check();
  if(section!=='combat'){
   await page.evaluate(section=>window.testWorkers.find(w=>w.testUrl.includes(section==='gather'?'gathering-worker':'crafting-worker')).onmessage({data:{progress:{completed:1,total:8}}}),section);
   await page.waitForFunction(selector=>document.querySelector(selector).textContent.includes('1/8'),root+' .simulation-progress');await check();
  }
  await status.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`${section}-${language}-${width}-running.png`)});
  await page.evaluate(section=>window.testWorkers.find(w=>w.testUrl.includes(section==='combat'?'simulation-worker':section==='gather'?'gathering-worker':'crafting-worker')).onmessage({data:{error:'invalidRoute',done:true}}),section);
  await page.waitForFunction(selector=>document.querySelector(selector).textContent.includes('invalidRoute')||document.querySelector(selector).textContent.includes('路线')||document.querySelector(selector).textContent.includes('route'),root+' .simulation-progress');await check();
  await status.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`${section}-${language}-${width}-failed.png`)});
  await page.evaluate(()=>window.holdSimulation=false);
  await page.locator(section==='combat'?'#rerun-combat':section==='gather'?'#gather-rerun':'#craft-rerun').click();
  await status.waitFor({state:'hidden'});results.cases.push(`${section} ${language} ${width}: heading progress, failure and completion`);await context.close();
 }
 assert.deepEqual(results.errors,[]);
}catch(error){results.errors.push(error.stack??String(error));process.exitCode=1;}
finally{if(browser)await browser.close();server?.kill();await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results,null,2));
