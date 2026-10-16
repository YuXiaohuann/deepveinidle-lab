import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {browserPath} from '../scripts/release-common.mjs';
import {defaults,slots,game} from '../src/model.js';

const base=process.argv[2]??'http://127.0.0.1:4173';
const directory=path.resolve(process.argv[3]??'.test-artifacts/combat-world-buffs');
await fs.mkdir(directory,{recursive:true});
const source=await fs.readFile(new URL('../src/character-import.user.js',import.meta.url),'utf8');
const player={lastTick:100,skills:Object.fromEntries(game.allSkills.map(k=>[k,0])),equipment:Object.fromEntries(slots.map(k=>[k,null])),brews:{},house:{},houseFurniture:{},masteries:{},perks:{},guildBonus:0,homeBank:null,ironman:false,bank:{64:100},pack:[],overflow:{}};
const windows=[{label:'Weekly goal: gathered',fromTick:0,toTick:200,xpMult:1.1},{label:'Event',fromTick:100,toTick:200,xpMult:1.2525,rarityMult:1.5},{fromTick:0,toTick:100,rarityMult:1.2075}];
const browser=await chromium.launch({headless:true,executablePath:await browserPath()});
const results={base,cases:[],errors:[]};
try{
 const capture=await browser.newPage();await capture.goto(base);
 const snapshot=await capture.evaluate(async({source,player,windows})=>{
  const fake=new EventTarget();fake.WebSocket=class extends EventTarget{};
  let resolve;const saved=new Promise(r=>resolve=r);
  new Function('unsafeWindow','location','GM_setValue',source)(fake,{origin:'https://deepveinidle.com',host:'deepveinidle.com',href:'https://deepveinidle.com/'},async(key,snapshot)=>resolve(snapshot));
  const socket=new fake.WebSocket('wss://deepveinidle.com/ws');
  socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({tick:100,m:[{t:'welcome',you:player,windows}]})}));
  const result=await Promise.race([saved,new Promise((_,reject)=>setTimeout(()=>reject(Error('capture timeout')),5000))]);
  fake.dispatchEvent(new Event('pagehide'));return result;
 },{source,player,windows});
 assert.equal(snapshot.worldBuffsVersion,1);assert.equal(snapshot.worldBuffs[1].rarityMult,1.5);
 results.cases.push('native Blob Worker captures both effects and capability marker');await capture.close();
 for(const language of ['zh','en'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
  const state=defaults();state.manual.simulationHours=1;state.manual.enemySelection='monster-1';
  await page.addInitScript(({language,state,snapshot})=>{
   if(!localStorage.getItem('dvi-simulator-v1'))localStorage.setItem('dvi-simulator-v1',JSON.stringify({language,state}));
   window.worldSnapshot=snapshot;
   document.addEventListener('dvi-character-request',e=>{
    const request=JSON.parse(e.detail);
    document.dispatchEvent(new CustomEvent('dvi-character-response',{detail:JSON.stringify({source:'dvi-character-script',id:request.id,version:'2.4',...(request.action==='probe'?{ready:true}:{snapshot:window.worldSnapshot})})}));
   });
  },{language,state,snapshot});
  await page.goto(base+'/combat');await page.locator('#import-character').click();
  await page.locator('#other-settings').evaluate(el=>el.open=true);
  const xp=page.locator('[data-path="manual.weeklyXp"]'),rare=page.locator('[data-path="manual.worldRarity"]');
  await page.waitForFunction(()=>document.querySelector('[data-path="manual.worldRarity"]')?.value==='70.75');
  assert.equal(await xp.inputValue(),'35.25');assert.equal(await rare.getAttribute('step'),'0.1');
  assert.equal(await rare.getAttribute('aria-label'),language==='zh'?'世界增益稀有发现 (%)':'World buff rare finds (%)');
  const description=language==='zh'?'导入捕获时生效的世界增益，整个模拟周期保持生效。':'Imports world buffs active at capture; they remain active throughout the simulation.';
  for(const input of [xp,rare])assert.equal(await input.locator('xpath=../following-sibling::p[1]').innerText(),description);
  await rare.scrollIntoViewIfNeeded();
  const bounds=await rare.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
  await page.screenshot({path:path.join(directory,`${language}-${width}.png`)});
  await rare.fill('20.75');await rare.blur();await page.reload();
  await page.locator('#other-settings').evaluate(el=>el.open=true);assert.equal(await rare.inputValue(),'20.75');assert.equal(await xp.inputValue(),'35.25');
  await page.evaluate(()=>delete window.worldSnapshot.worldBuffsVersion);await page.locator('#import-character').click();
  await page.waitForFunction(()=>document.querySelector('#import-status')?.textContent.includes('2.8.0'));
  assert.equal(await rare.inputValue(),'0');assert.equal(await xp.inputValue(),'0');
  await page.evaluate(()=>window.worldSnapshot.worldBuffsVersion=1);await page.locator('#import-character').click();
  await page.waitForFunction(()=>document.querySelector('[data-path="manual.worldRarity"]')?.value==='70.75');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#reset').click();
  assert.equal(await rare.inputValue(),'0');assert.equal(await xp.inputValue(),'0');
  results.cases.push(`${language}/${width}: import, decimals, persistence, old capture warning, reset, layout`);
  await context.close();
 }
 assert.deepEqual(results.errors,[]);
}finally{
 await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(results,null,2)+'\n');await browser.close();
}
console.log(JSON.stringify(results,null,2));
