import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {gatheringDefaults} from '../src/gathering-model.js';

const directory=path.resolve('.test-artifacts/gathering-discard');await fs.mkdir(directory,{recursive:true});
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const results={cases:[],errors:[]};let browser;
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited: ${code}`);})]);
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 const legacy={...gatheringDefaults(),simulationHours:1,hotSetting:'off'};delete legacy.discardGathered;
 await context.addInitScript(legacy=>{
  if(!localStorage.getItem('dvi-gathering-v1'))localStorage.setItem('dvi-gathering-v1',JSON.stringify(legacy));
  window.gatherRuns=[];const OriginalWorker=Worker;
  window.Worker=class extends OriginalWorker{
   constructor(url,options){super(url,options);if(String(url).includes('gathering-worker.js')){this.run={results:[]};window.gatherRuns.push(this.run);this.addEventListener('message',({data})=>{if(data.result)this.run.results.push(data.result);if(data.done)this.run.done=true;});}}
   postMessage(data,...rest){if(this.run)this.run.input=data;return super.postMessage(data,...rest);}
   terminate(){if(this.run)this.run.terminated=true;return super.terminate();}
  };
 },legacy);
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>results.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/gather`);
 await page.locator('#gather-other').evaluate(el=>el.open=true);
 const checkbox=()=>page.locator('[data-gather-field="discardGathered"]');
 const completed=()=>page.waitForFunction(()=>{
  const run=window.gatherRuns.at(-1),saved=JSON.parse(localStorage.getItem('dvi-gathering-v1'));
  return run?.done&&run.input.state.discardGathered===(saved.discardGathered===true)&&run.input.state.skill===saved.skill&&run.input.state.simulationHours===saved.simulationHours;
 });
 await completed();assert.equal(await checkbox().isChecked(),false);
 assert.equal(await checkbox().locator('xpath=ancestor::details').getAttribute('id'),'gather-other');
 await checkbox().check();await completed();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-gathering-v1')).discardGathered),true);
 const current=await page.evaluate(()=>window.gatherRuns.at(-1));
 assert.equal(current.input.state.discardGathered,true);assert.ok(current.results[0].completed>current.results[0].normal);
 assert.equal(current.results[0].deposits,0);assert.match(await page.locator('#gather-results').innerText(),/已丢弃部分不估值/);
 assert.ok(await page.evaluate(()=>window.gatherRuns.slice(0,-1).every(r=>r.terminated)));
 results.cases.push('legacy default, Other placement, saved checkbox, real Worker retained output and previous Worker termination');
 await page.reload();await completed();await page.locator('#gather-other').evaluate(el=>el.open=true);assert.equal(await checkbox().isChecked(),true);
 await page.locator('[data-gather-skill="fishing"]').click();await completed();assert.equal(await checkbox().isChecked(),true);
 results.cases.push('refresh and skill switching preserve discard');
 for(const width of [1440,390])for(const language of ['zh','en']){
  await page.setViewportSize({width,height:960});await page.selectOption('#language',language);await page.locator('#gather-other').evaluate(el=>el.open=true);
  assert.equal(await checkbox().isChecked(),true);
  assert.match(await checkbox().locator('..').innerText(),language==='zh'?/丢弃采集物/:/Drop what I gather/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${language} overflow`);
  await page.locator('#gather-other').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`gather-discard-${language}-${width}.png`)});
 }
 results.cases.push('Chinese/English desktop and 390px layouts');
 // A successful character import resets this simulation policy, independent of the live route.
 await page.evaluate(()=>{document.addEventListener('dvi-character-request',async event=>{const request=JSON.parse(event.detail);if(request.action!=='read')return;const {gatheringDefaults,gatheringPlayer}=await import('/src/gathering-model.js');const {player}=gatheringPlayer(gatheringDefaults());document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',version:'2.4',id:request.id,snapshot:{version:2,capturedAt:Date.now(),player,worldTick:player.lastTick,worldBuffs:[]}})}));});});
 await page.locator('#gather-import-settings').evaluate(el=>el.open=true);await page.locator('#gather-import').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dvi-gathering-v1')).discardGathered===false);await completed();assert.equal(await checkbox().isChecked(),false);
 await page.locator('#gather-other').evaluate(el=>el.open=true);await checkbox().check();await completed();await page.locator('#gather-reset').click();await completed();
 assert.equal(await checkbox().isChecked(),false);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-gathering-v1')).discardGathered),false);
 results.cases.push('DOM character import and reset disable discard');assert.deepEqual(results.errors,[]);await context.close();
}catch(error){results.errors.push(error.stack??String(error));process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results,null,2));
