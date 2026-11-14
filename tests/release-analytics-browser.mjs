import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {browserPath,json} from '../scripts/release-common.mjs';
import {configureAnalytics,isCloudflareAnalytics} from '../scripts/release-analytics.mjs';
const out=process.argv[2];assert.ok(out,'Result path required');
await fs.mkdir(path.dirname(out),{recursive:true});
const result={status:'running',cases:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:await browserPath()});
 const scripts=['https://static.cloudflareinsights.com/beacon.min.js','https://static.cloudflareinsights.com/beacon.min.js?token=fixture','https://static.cloudflareinsights.com/beacon.min.js/v123abc','https://static.cloudflareinsights.com/other.js','https://static.cloudflareinsights.com.invalid/beacon.min.js','http://static.cloudflareinsights.com/beacon.min.js','https://fixture.invalid/src/app.js'];
 for(const mode of ['live','exclude']){
  const context=await browser.newContext();
  try{
   // All responses are controlled; no request reaches a real analytics service.
   await context.route('**/*',async route=>{
    const url=route.request().url();
    if(url==='http://fixture.invalid/')return route.fulfill({contentType:'text/html',body:`<!doctype html><script>globalThis.fixture={analytics:0,other:0,app:0}</script>${scripts.map(src=>`<script src="${src}"></script>`).join('')}`});
    const body=isCloudflareAnalytics(url)?'fixture.analytics++;console.error("analytics sentinel")':url==='https://fixture.invalid/src/app.js'?'fixture.app++;console.error("application sentinel")':'fixture.other++';
    await route.fulfill({contentType:'application/javascript',body});
   });
   const analytics=await configureAnalytics(context,mode),page=await context.newPage(),errors=[];
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.goto('http://fixture.invalid/',{waitUntil:'load'});
   const execution=await page.evaluate(()=>globalThis.fixture);
   assert.deepEqual(execution,{analytics:mode==='live'?3:0,other:3,app:1});
   assert.equal(analytics.excludedRequests.length,mode==='exclude'?3:0);
   assert.deepEqual(errors,mode==='live'?['analytics sentinel','analytics sentinel','analytics sentinel','application sentinel']:['application sentinel']);
   result.cases.push({mode,execution,analytics,errors,status:'passed'});
  }finally{await context.close();}
 }
 result.status='passed';console.log('PASS analytics isolation: live/exclude, unrelated scripts and application errors preserved');
}catch(error){result.status='failed';result.error=error.message;throw error;}
finally{await json(out,result);await browser?.close();}
