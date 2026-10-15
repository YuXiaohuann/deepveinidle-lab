import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

export const pages=['combat','gather','craft','enhance','mastery','forecast','formulas','debug'];
export const routes=['/',...pages.flatMap(p=>['/'+p,'/'+p+'/'])];
export const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
export async function json(file,value){await fs.writeFile(file,JSON.stringify(value,null,2)+'\n');}
export async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'));}
export async function filesIn(root,relative=''){
 assert.ok(!(await fs.lstat(path.join(root,relative))).isSymbolicLink(),`Symbolic directory is not allowed: ${relative||root}`);
 const entries=await fs.readdir(path.join(root,relative),{withFileTypes:true});const files=[];
 for(const e of entries.sort((a,b)=>a.name.localeCompare(b.name))){
  const name=relative?relative+'/'+e.name:e.name;
  assert.ok(!e.isSymbolicLink(),`Symbolic link is not allowed: ${name}`);
  if(e.isDirectory())files.push(...await filesIn(root,name));
  else {assert.ok(e.isFile(),`Not a regular file: ${name}`);files.push(name);}
 }
 return files;
}
export async function digestFiles(root,names){
 const files=[];
 for(const name of names.sort()){
  assert.ok(!(await fs.lstat(path.join(root,name))).isSymbolicLink(),`Symbolic link is not allowed: ${name}`);
  const data=await fs.readFile(path.join(root,name));files.push({path:name,bytes:data.length,sha256:sha256(data)});
 }
 return files;
}
export async function packageFiles(root){
 const names=['index.html','_redirects',...await filesIn(root,'src'),...await filesIn(root,'vendor')];
 for(const name of names)assert.ok(!name.split('/').some(p=>p.startsWith('.'))&&(['index.html','_redirects'].includes(name)||/\.(js|css|svg|json)$/.test(name)||/^src\/content\/formulas\/[a-z][a-z.-]*\.md$/.test(name)||['vendor/markdown-it/LICENSE.txt','vendor/markdown-it/markdown-it.esm.min.mjs','vendor/markdown-it/markdown-it.esm.min.mjs.map'].includes(name)),`Not an application file: ${name}`);
 return digestFiles(root,names);
}
export async function browserPath(){
 if(process.env.RELEASE_BROWSER){await fs.access(process.env.RELEASE_BROWSER);return path.resolve(process.env.RELEASE_BROWSER);}
 const candidates=process.platform==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']:process.platform==='win32'?[path.join(process.env.PROGRAMFILES??'C:/Program Files','Google/Chrome/Application/chrome.exe')]:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
 for(const candidate of candidates){try{await fs.access(candidate);return candidate;}catch(error){if(error.code!=='ENOENT')throw error;}}
 throw Error('Chrome/Chromium not found. Install a browser or set RELEASE_BROWSER to its executable.');
}
export async function inputs(root){
 const names=['index.html','_redirects','package.json','pnpm-lock.yaml','README.md','DESIGN.md','AGENTS.md','.gitignore'];
 for(const directory of ['src','vendor','tests','scripts','docs','reports'])names.push(...await filesIn(root,directory));
 const files=await digestFiles(root,names);
 const environment={node:process.version,platform:process.platform,arch:process.arch,browserOverride:process.env.RELEASE_BROWSER??null,dependencies:{}};
 const pkg=await readJson(path.join(root,'package.json'));
 for(const name of Object.keys(pkg.devDependencies??{}).sort()){const installed=(await readJson(path.join(root,'node_modules',name,'package.json'))).version;assert.equal(installed,pkg.devDependencies[name],`Installed dependency differs from pinned version: ${name}`);environment.dependencies[name]=installed;}
 if(pkg.devDependencies?.['playwright-core']){const executable=await browserPath();environment.browser={executable,sha256:sha256(await fs.readFile(executable))};}
 return {id:sha256(JSON.stringify({files,environment})),files,environment,version:pkg.version};
}
export async function freshDirectory(root,target){
 const resolved=path.resolve(target),relative=path.relative(root,resolved);
 assert.ok(relative!=='','Output must not be the repository root');
 assert.ok(relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'||resolved.startsWith(path.resolve(process.env.TMPDIR||'/tmp')+path.sep)||resolved.startsWith('/private/tmp/')||resolved.startsWith('/tmp/'),`Output must be in the repository or a temporary directory: ${resolved}`);
 if(!relative.startsWith('..')&&relative!=='')assert.ok(relative.split(path.sep)[0]==='.test-artifacts', 'Repository output must be below .test-artifacts');
 if(!relative.startsWith('..')){
  let cursor=root;
  for(const segment of relative.split(path.sep).slice(0,-1)){cursor=path.join(cursor,segment);try{assert.ok(!(await fs.lstat(cursor)).isSymbolicLink(),`Symbolic output parent is not allowed: ${cursor}`);}catch(error){if(error.code!=='ENOENT')throw error;}}
 }
 await fs.mkdir(path.dirname(resolved),{recursive:true});await fs.mkdir(resolved);return resolved;
}
export async function runLogged(command,args,{cwd,log,timeout=600000}){
 const handle=await fs.open(log,'w');const start=Date.now();let timer,killer,timedOut=false;
 try{
  const result=await new Promise((resolve,reject)=>{
   const taskEnvironment={...process.env};delete taskEnvironment.NODE_TEST_CONTEXT;
   const child=spawn(command,args,{cwd,env:taskEnvironment,detached:process.platform!=='win32',stdio:['ignore',handle.fd,handle.fd]});
   child.once('error',reject);
   const stop=signal=>{try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')reject(error);}};
   timer=setTimeout(()=>{timedOut=true;stop('SIGTERM');killer=setTimeout(()=>stop('SIGKILL'),2000);},timeout);
   child.once('close',(code,signal)=>resolve({exitCode:code,signal}));
  });
  return {...result,timedOut,milliseconds:Date.now()-start,log};
 }finally{clearTimeout(timer);clearTimeout(killer);await handle.close();}
}
export function tapSummary(log){
 const summary={};for(const key of ['tests','pass','fail','cancelled','skipped','todo']){
  const matches=[...log.matchAll(new RegExp('^# '+key+' (\\d+)\\s*$','gm'))];assert.ok(matches.length,`Missing TAP summary: ${key}`);summary[key]=Number(matches.at(-1)[1]);
 }
 assert.ok(summary.tests>0,'No tests ran');assert.equal(summary.pass,summary.tests,'Some tests did not pass');
 for(const key of ['fail','cancelled','skipped','todo'])assert.equal(summary[key],0,`TAP ${key} is nonzero`);
 return summary;
}
export function slug(text){return text.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu,'').replace(/ /g,'-');}
export function markdownAnchors(text){
 const anchors=new Set([...text.matchAll(/<a id="([^"]+)"/g)].map(m=>m[1])),counts=new Map();
 for(const m of text.matchAll(/^#+ (.+)$/gm)){const key=slug(m[1]),count=counts.get(key)??0;anchors.add(key+(count?'-'+count:''));counts.set(key,count+1);}
 return anchors;
}
export async function checkDocs(root){
 const paths=['README.md','DESIGN.md','AGENTS.md',...await filesIn(root,'docs'),...await filesIn(root,'reports')].filter(p=>p.endsWith('.md'));
 let links=0;const cache=new Map();
 for(const name of paths){const text=await fs.readFile(path.join(root,name),'utf8');
  for(const m of text.matchAll(/\]\(([^)]+)\)/g)){
   const target=m[1];if(/^[a-z][a-z\d+.-]*:/i.test(target))continue;
   const [raw,fragment]=target.split('#');const file=raw?path.resolve(root,path.dirname(name),decodeURIComponent(raw)):path.join(root,name);links++;
   assert.ok(file===root||file.startsWith(root+path.sep),`Document link leaves repository: ${name}: ${target}`);
   assert.ok((await fs.stat(file)).isFile(),`Missing document target: ${name}: ${target}`);
   if(fragment&&file.endsWith('.md')){
    if(!cache.has(file))cache.set(file,markdownAnchors(await fs.readFile(file,'utf8')));
    assert.ok(cache.get(file).has(decodeURIComponent(fragment)),`Missing document anchor: ${name}: ${target}`);
   }
  }
 }
 return {documents:paths.length,links};
}
export async function checkRedirects(root){
 const lines=(await fs.readFile(path.join(root,'_redirects'),'utf8')).trim().split(/\r?\n/).filter(l=>l.trim()&&!l.trim().startsWith('#'));
 assert.equal(lines.length,routes.length-1,'Unexpected route rules');
 for(const route of routes.slice(1))assert.ok(lines.some(l=>l.trim().split(/\s+/).join(' ')===`${route} / 200`),`Missing route rule: ${route}`);
}
export function sameFiles(actual,expected){assert.deepEqual(actual,expected,'Package file list or content changed');}
export async function assertReceipt(root,evidence){
 const receipt=await readJson(path.join(evidence,'check.json'));
 assert.equal(receipt.status,'passed','Release checks did not pass');
 assert.deepEqual(receipt.steps.map(s=>s.name),['static','tests','native','extraction','local'], 'Incomplete check receipt');
 assert.ok(receipt.steps.every(s=>s.status==='passed'),'Incomplete check results');
 assert.equal((await inputs(root)).id,receipt.inputs.id,'Release inputs/environment changed; rerun release:check');
 return receipt;
}
export function failureExcerpt(log){
 const lines=log.split('\n'),index=lines.findIndex(l=>/^not ok\b|^Error:|^AssertionError|^node:internal/.test(l));
 return lines.slice(index<0?Math.max(0,lines.length-35):index,index<0?undefined:index+45).join('\n').slice(0,5000);
}
