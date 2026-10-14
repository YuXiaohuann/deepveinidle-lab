import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {routes,sha256} from './release-common.mjs';

export function normalizeHostedHtml(html){
 // Cloudflare's analytics loader is the only permitted hosting modification.
 return html.replace(/<script\b(?=[^>]*\bsrc=["']https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js(?:\/[^"']*)?["'])[^>]*>\s*<\/script>/gi,'').replace(/<!--\s*Cloudflare Web Analytics\s*-->/gi,'').replace(/<!--\s*End Cloudflare Web Analytics\s*-->/gi,'').replace(/>\s+</g,'><').trim();
}
export async function verifyHttp(base,root,manifest){
 const url=new URL(base);assert.ok(['http:','https:'].includes(url.protocol),'Expected HTTP(S) target');assert.equal(url.pathname,'/','Target must be an origin URL');assert.ok(!url.search&&!url.hash&&!url.username&&!url.password,'Target must not contain credentials/query/fragment');
 const html=await fs.readFile(path.join(root,'index.html'),'utf8');
 async function fetchPath(relative){
  const response=await fetch(new URL(relative,url),{signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});
  assert.equal(response.status,200,`${relative}: HTTP ${response.status}`);
  assert.equal(new URL(response.url).pathname,relative,`${relative}: route path changed`);
  return response;
 }
 for(const route of routes){const response=await fetchPath(route);assert.match(response.headers.get('content-type')??'',/text\/html/);assert.equal(normalizeHostedHtml(await response.text()),normalizeHostedHtml(html),`${route}: unexpected HTML content`);}
 const assets=manifest.filter(f=>!['index.html','_redirects'].includes(f.path));
 // Limited batches avoid flooding the production origin; all resources are verified.
 for(let i=0;i<assets.length;i+=6){const results=await Promise.allSettled(assets.slice(i,i+6).map(async file=>{
  const response=await fetchPath('/'+file.path);const data=Buffer.from(await response.arrayBuffer());assert.equal(data.length,file.bytes,`${file.path}: byte length mismatch`);assert.equal(sha256(data),file.sha256,`${file.path}: SHA-256 mismatch`);
 }));for(const result of results)if(result.status==='rejected')throw result.reason;}
 return {base:url.origin,routes:routes.length,assets:assets.length,html:'exact except Cloudflare analytics loader',redirects:'verified by route behavior'};
}
