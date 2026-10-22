import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {browserPath} from './release-common.mjs';
import * as game from '../src/upstream.js';
import {craftingDefaults,craftingStorageKey} from '../src/crafting-model.js';
import {enhancementDefaults,enhancementStorageKey} from '../src/enhancement.js';
import {priceDefaults,priceStorageKey} from '../src/item-prices.js';

const base=process.argv[2]??'http://127.0.0.1:4173';
const directory=path.resolve(process.argv[3]??'.test-artifacts/panel-reset');
await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:await browserPath()});
const results={base,cases:[],errors:[]};
const prices=priceDefaults();for(const id of [20,110,208,359])prices.prices[id]={price:id+100,locked:true,source:'manual',updatedAt:Date.now(),quoteCapturedAt:null};
prices.prices[game.encode(game.withRarity(110,3),0)]={price:777,locked:true,source:'manual',updatedAt:Date.now(),quoteCapturedAt:null};
const craft={...craftingDefaults(),levels:{...craftingDefaults().levels,cooking:80,smithing:75},guild:{name:'Test',tag:'T'},guildXp:12,plans:{'61:0':2,'61:4':3,'upgrade-271:2':4},owned:{20:100,21:7},upgradeMigration:true,period:'hour'};
const enhance={...enhancementDefaults(),guild:{name:'Test',tag:'T'},level:60,mastery:12,tier:4,current:3,target:9,protect:false,protectFrom:5,shardPrice:100,scrollPrice:200,basePrice:300,priceModes:{shardPrice:'manual',scrollPrice:'manual',basePrice:'manual'},basePriceItem:game.encode(game.withRarity(110,4),3)};
const snapshot={version:2,capturedAt:Date.now(),guild:enhance.guild,player:{skills:{enhancing:game.levelXp(60)},house:{lectern:8},houseFurniture:{lectern:{cell:1,slot:0}},masteries:{enhance:12},equipment:{mount:game.encode(game.withRarity(328,3),7)},bank:{},pack:[],overflow:{}}};
const read=(page,key)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const omit=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));
try{
 for(const width of [1280,390])for(const language of ['zh','en']){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(({craft,enhance,prices,language,craftingStorageKey,enhancementStorageKey,priceStorageKey})=>{
   const values={[craftingStorageKey]:craft,[enhancementStorageKey]:enhance,[priceStorageKey]:prices,'dvi-simulator-v1':{language}};
   for(const [key,value]of Object.entries(values))if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(value));
  },{craft,enhance,prices,language,craftingStorageKey,enhancementStorageKey,priceStorageKey});
  const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
  await page.goto(base+'/craft');
  await page.locator('[data-craft-skill="smithing"]').click();
  await page.locator('#craft-search').fill('Shrimp');
  await page.locator('#craft-filled').click();
  await page.locator('[data-craft-rarity="4"]').click();
  const group=await page.locator('#craft-group option').nth(1).getAttribute('value');
  await page.selectOption('#craft-group',group);
  await page.locator('#craft-reset').click();
  const left=await read(page,craftingStorageKey),planKeys=['plans','owned','tiers','upgradeMigration'];
  assert.deepEqual(omit(left,planKeys),omit(craftingDefaults(),planKeys));
  for(const key of planKeys)assert.deepEqual(left[key],craft[key]);
  assert.equal(await page.inputValue('#craft-search'),'Shrimp');assert.equal(await page.inputValue('#craft-group'),group);
  assert.equal(await page.locator('#craft-filled').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-craft-rarity="4"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#craft-upgrade-ack').count(),1);
  const label=language==='zh'?'清空计划':'Clear plan';
  for(const selector of ['#craft-clear-plans','#craft-clear-owned']){
   assert.equal(await page.locator(selector).textContent(),label);
   const beforeClear=await read(page,craftingStorageKey);
   await page.locator(selector).click();
   const cleared=await read(page,craftingStorageKey);
   assert.deepEqual(cleared.plans,{});assert.deepEqual(cleared.owned,{});assert.equal(cleared.upgradeMigration,false);
   assert.deepEqual(omit(cleared,planKeys),omit(beforeClear,planKeys));
   assert.deepEqual(await read(page,priceStorageKey),prices);
   assert.equal(await page.locator('#craft-upgrade-ack').count(),0);
   await page.reload();assert.deepEqual(await read(page,craftingStorageKey),cleared);
   if(selector==='#craft-clear-plans'){
    await page.evaluate(({key,craft})=>localStorage.setItem(key,JSON.stringify(craft)),{key:craftingStorageKey,craft});await page.reload();
   }
  }
  await page.screenshot({path:path.join(directory,`craft-${language}-${width}.png`),fullPage:true});
  await page.goto(base+'/enhance');
  await page.evaluate(async({snapshot,language})=>{const m=await import('/src/enhancement-controls.js');m.applyEnhancementImport(snapshot);m.renderEnhancement(language);},{snapshot,language});
  assert.equal(await page.locator('#enhance-candidate').count(),1);
  await page.locator('#enhance-reset').click();
  const resetLeft=await read(page,enhancementStorageKey),roleKeys=['guild','level','mastery'];
  assert.deepEqual(omit(resetLeft,roleKeys),omit(enhance,roleKeys));
  for(const key of roleKeys)assert.deepEqual(resetLeft[key],enhancementDefaults()[key]);
  assert.equal(await page.locator('#enhance-candidate').count(),1);
  await page.evaluate(async({snapshot,language})=>{const m=await import('/src/enhancement-controls.js');m.applyEnhancementImport(snapshot);m.renderEnhancement(language);},{snapshot,language});
  const beforeRight=await read(page,enhancementStorageKey);
  await page.locator('#enhance-equipment-reset').click();
  const resetRight=await read(page,enhancementStorageKey);
  assert.deepEqual(omit(resetRight,roleKeys),omit(enhancementDefaults(),roleKeys));
  for(const key of roleKeys)assert.deepEqual(resetRight[key],beforeRight[key]);
  assert.equal(await page.locator('#enhance-candidate').count(),0);
  for(const [key,value]of [['shardPrice',308],['scrollPrice',459],['basePrice',777]])assert.equal(await page.inputValue(`[data-enhance-field="${key}"]`),String(value));
  assert.deepEqual(await read(page,priceStorageKey),prices);
  await page.reload();assert.deepEqual(await read(page,enhancementStorageKey),resetRight);
  await page.locator('#enhance-equipment-reset').scrollIntoViewIfNeeded();
  const layout=await page.locator('.enhance-equipment .panel-heading').evaluate(el=>{const [title,button]=el.children,a=title.getBoundingClientRect(),b=button.getBoundingClientRect();return {overlap:a.right>b.left,overflow:document.documentElement.scrollWidth>innerWidth,buttonRight:b.right,titleLeft:a.left};});
  assert.equal(layout.overlap,false);assert.equal(layout.overflow,false);
  await page.screenshot({path:path.join(directory,`enhance-${language}-${width}.png`),fullPage:true});
  results.cases.push({width,language,status:'passed',checks:['craft left isolation','both clear plan buttons','enhance left/right isolation','candidate scope','global prices preserved','reload','layout']});
  await context.close();
 }
 assert.deepEqual(results.errors,[]);console.log(JSON.stringify(results));
}catch(error){results.failure=error.stack;throw error;}
finally{await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2)+'\n');await browser.close();}
