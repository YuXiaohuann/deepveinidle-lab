import assert from 'node:assert/strict';

export function analyticsMode(mode='live'){
 assert.ok(['live','exclude'].includes(mode),'Analytics mode must be live or exclude');return mode;
}
export function isCloudflareAnalytics(url){
 const parsed=new URL(url);
 return parsed.origin==='https://static.cloudflareinsights.com'&&/^\/beacon\.min\.js(?:\/v[a-z0-9._-]+)?$/i.test(parsed.pathname);
}
export async function configureAnalytics(context,mode='live'){
 const result={mode:analyticsMode(mode),excludedRequests:[]};
 if(mode==='exclude')await context.route(isCloudflareAnalytics,async route=>{
  if(route.request().resourceType()!=='script')return route.fallback();
  result.excludedRequests.push(route.request().url());
  await route.fulfill({status:200,contentType:'application/javascript',body:'/* Cloudflare Web Analytics excluded from browser verification. */'});
 });
 return result;
}
