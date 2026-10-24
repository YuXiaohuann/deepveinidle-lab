import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {routes,checkRedirects} from '../scripts/release-common.mjs';

const root=new URL('../',import.meta.url);

test('known routes retain their URLs; unknown history entries are replaced with combat',async()=>{
 const source=await fs.readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const resolver=source.slice(source.indexOf('function sectionForPath(){'),source.indexOf('function showSection('));
 for(const pathname of [...routes,'/missing','/missing/nested/','/COMBAT','/combat//']){
  const replacements=[];
  const section=vm.runInNewContext(resolver+'sectionForPath()',{location:{pathname,search:'?unused=1',hash:'#anchor'},history:{replaceState:(...args)=>replacements.push(args)}});
  if(routes.includes(pathname)){
   assert.equal(section,pathname.replaceAll('/','')||'combat');
   assert.deepEqual(replacements,[]);
  }else{
   assert.equal(section,'combat');
   assert.equal(replacements.length,1);
   assert.equal(replacements[0][2],'/combat#anchor');
  }
 }
 await checkRedirects(root.pathname);
});

test('local HTTP server redirects unknown paths and preserves pages, assets and access restrictions',async t=>{
 const child=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill();await once(child,'exit');}});
 const base=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Server startup timed out')),10000);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  let stderr='';
  child.stderr.on('data',data=>{stderr+=data;});
  child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited (${code}): ${stderr}`));});
  child.stdout.on('data',data=>{const match=String(data).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
 });
 for(const route of routes){
  const response=await fetch(base+route,{redirect:'manual'});
  assert.equal(response.status,200,route);
  assert.match(response.headers.get('content-type'),/text\/html/);
  await response.arrayBuffer();
 }
 for(const route of ['/missing','/missing/nested/?unused=1','/src/missing.js']){
  const response=await fetch(base+route,{redirect:'manual'});
  assert.equal(response.status,302,route);
  assert.equal(response.headers.get('location'),'/combat');
  const followed=await fetch(base+route);
  assert.equal(new URL(followed.url).pathname,'/combat');
  assert.equal(followed.status,200);
  await followed.arrayBuffer();
 }
 const asset=await fetch(base+'/src/app.js');
 assert.equal(asset.status,200);
 assert.match(asset.headers.get('content-type'),/javascript/);
 await asset.arrayBuffer();
 for(const route of ['/AGENTS.md','/docs/shared.md','/reports/README.md','/.git/config','/node_modules/test.js']){
  const response=await fetch(base+route,{redirect:'manual'});
  assert.equal(response.status,403,route);
  await response.arrayBuffer();
 }
});
