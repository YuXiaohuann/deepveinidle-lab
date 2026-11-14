import test from 'node:test';
import assert from 'node:assert/strict';
import {verify} from '../scripts/release.mjs';
import {analyticsMode,isCloudflareAnalytics,configureAnalytics} from '../scripts/release-analytics.mjs';
test('analytics exclusion matches only the known HTTPS beacon and version/query forms',()=>{
 for(const url of ['https://static.cloudflareinsights.com/beacon.min.js','https://static.cloudflareinsights.com/beacon.min.js?token=test','https://static.cloudflareinsights.com/beacon.min.js/v123abc'])assert.equal(isCloudflareAnalytics(url),true,url);
 for(const url of ['http://static.cloudflareinsights.com/beacon.min.js','https://static.cloudflareinsights.com.invalid/beacon.min.js','https://static.cloudflareinsights.com/other.js','https://example.com/beacon.min.js','https://static.cloudflareinsights.com/beacon.min.js/other','https://static.cloudflareinsights.com:8443/beacon.min.js'])assert.equal(isCloudflareAnalytics(url),false,url);
});
test('analytics defaults to live and rejects unknown modes without registering interception',async()=>{
 assert.equal(analyticsMode(),'live');assert.throws(()=>analyticsMode('ignore-all'));
 const context={route:()=>{throw Error('unexpected interception');}};
 assert.deepEqual(await configureAnalytics(context),{mode:'live',excludedRequests:[]});
 await assert.rejects(configureAnalytics(context,'invalid'),/Analytics mode/);
 await assert.rejects(verify('/missing','/missing','/missing','https://example.com','/missing',{analytics:'invalid'}),/Analytics mode/);
});
