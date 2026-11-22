import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {inspect} from 'node:util';
import {fileURLToPath} from 'node:url';
import {analyticsMode} from './release-analytics.mjs';
import {inputs,json,readJson,filesIn,packageFiles,freshDirectory,runLogged,tapSummary,assertReceipt,sameFiles,failureExcerpt} from './release-common.mjs';

function options(argv){
 const result={};for(let i=0;i<argv.length;i+=2){assert.ok(['--out','--evidence','--package','--url','--analytics'].includes(argv[i]),`Unknown option: ${argv[i]}`);assert.ok(argv[i+1]&&!argv[i+1].startsWith('--'),`Missing value: ${argv[i]}`);assert.ok(!(argv[i].slice(2) in result),`Repeated option: ${argv[i]}`);result[argv[i].slice(2)]=argv[i+1];}return result;
}
async function report(directory,data,title){
 const text=`# ${title}\n\n版本：${data.version}。状态：${data.status}。输入摘要：\`${data.inputs?.id??data.inputId}\`。\n\n`+(data.steps??[]).map(s=>`- ${s.name}: ${s.status}，${(s.milliseconds/1000).toFixed(2)} 秒；日志 ${path.basename(s.log)}${s.summary?'；'+JSON.stringify(s.summary):''}`).join('\n')+(data.url?`\n\n目标：${data.url}。HTTP：${JSON.stringify(data.http??{})}。浏览器：${JSON.stringify(data.browser??{})}。`:'')+(data.analytics?`\n\n统计脚本模式：${data.analytics}。${data.analytics==='exclude'?'仅测试浏览器排除 Cloudflare 统计脚本；不验证统计可用性。':'保留真实统计脚本。'}`:'')+'\n\n自动检查不替代变更专项和必要的人工截图审阅；未执行的检查不得标为通过。本工具没有执行部署。\n';
 await fs.writeFile(path.join(directory,'report.md'),text);
}
export async function check(root,out){
 const directory=await freshDirectory(root,out),receipt={schema:1,status:'running',startedAt:new Date().toISOString(),inputs:null,version:null,steps:[]};
 await json(path.join(directory,'check.json'),receipt);
 try{
  receipt.inputs=await inputs(root);receipt.version=receipt.inputs.version;await json(path.join(directory,'check.json'),receipt);
  const definitions=[['static',['scripts/release-static.mjs',path.join(directory,'static.json')]],['tests',['--test','--test-reporter=tap',...(await filesIn(root,'tests')).filter(p=>p.endsWith('.test.mjs'))]],['native',['scripts/native-audit.mjs',path.join(directory,'native.json')]],['extraction',['scripts/release-extraction.mjs',path.join(directory,'extraction.json')]],['local',['scripts/release-local.mjs',directory]]];
  for(const [name,args]of definitions){
   const log=path.join(directory,name+'.log');const result=await runLogged(process.execPath,args,{cwd:root,log,timeout:name==='local'?900000:600000});
   const step={name,status:'failed',...result};receipt.steps.push(step);
   const text=await fs.readFile(log,'utf8');
   if(result.exitCode!==0||result.timedOut){await json(path.join(directory,'check.json'),receipt);throw Error(`${name}: ${result.timedOut?'timed out':'exit '+result.exitCode}\n${failureExcerpt(text)}\nFull log: ${log}`);}
   if(name==='tests')step.summary=tapSummary(text);
   else step.summary=await readJson(path.join(directory,name+'.json'));
   assert.ok(step.summary&&typeof step.summary==='object',`${name}: missing structured result`);
   step.status='passed';await json(path.join(directory,'check.json'),receipt);
   console.log(`PASS ${name} ${(result.milliseconds/1000).toFixed(1)}s ${name==='tests'?JSON.stringify(step.summary):''}`.trim());
  }
  assert.equal((await inputs(root)).id,receipt.inputs.id,'Inputs changed while checks were running');
  receipt.status='passed';receipt.finishedAt=new Date().toISOString();await json(path.join(directory,'check.json'),receipt);await report(directory,receipt,'发布前检查');
  console.log(`PASS release:check ${receipt.version}\nEvidence: ${directory}`);return receipt;
 }catch(error){receipt.status='failed';receipt.error=error.message;await fs.writeFile(path.join(directory,'failure.log'),inspect(error,{depth:8})+'\n');receipt.finishedAt=new Date().toISOString();await json(path.join(directory,'check.json'),receipt);await report(directory,receipt,'发布前检查失败');throw error;}
}
export async function buildPackage(root,evidence,out){
 const receipt=await assertReceipt(root,evidence),expected=await packageFiles(root),directory=await freshDirectory(root,out);
 try{
  for(const file of expected){const destination=path.join(directory,file.path);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(path.join(root,file.path),destination);}
  const actual=await packageFiles(directory);assert.deepEqual(await filesIn(directory),expected.map(f=>f.path).sort((a,b)=>a.localeCompare(b)),'Unexpected package files');sameFiles(actual,expected);
  assert.equal((await inputs(root)).id,receipt.inputs.id,'Inputs changed while packaging');
  const result={schema:1,version:receipt.version,inputId:receipt.inputs.id,package:directory,createdAt:new Date().toISOString(),files:actual};await json(path.join(evidence,'package.json'),result);
  console.log(`PASS release:package ${actual.length} files\nPackage: ${directory}\nManifest: ${path.join(evidence,'package.json')}`);return result;
 }catch(error){await fs.rm(directory,{recursive:true,force:true});throw error;}
}
export async function verify(root,evidence,packageDirectory,url,out,{analytics='live'}={}){
 analyticsMode(analytics);
 assert.ok(url,'--url is required; production is never selected implicitly');const receipt=await assertReceipt(root,evidence),manifest=await readJson(path.join(evidence,'package.json'));
 assert.equal(manifest.inputId,receipt.inputs.id,'Package was built for different inputs');assert.equal(path.resolve(packageDirectory),manifest.package,'Package directory differs from receipt');
 assert.deepEqual((await filesIn(packageDirectory)).sort(),manifest.files.map(f=>f.path).sort(),'Unexpected package files');sameFiles(await packageFiles(packageDirectory),manifest.files);
 const directory=await freshDirectory(root,out),result={schema:1,status:'running',version:receipt.version,inputId:receipt.inputs.id,url,analytics,startedAt:new Date().toISOString()};await json(path.join(directory,'verify.json'),result);
 try{
  const log=path.join(directory,'verify.log');await fs.writeFile(log,`Target: ${url}\nHTTP verification started\n`);
  const {verifyHttp,verifyUsageRoute}=await import('./release-http.mjs'),{verifyBrowser}=await import('./release-browser.mjs');
  result.http=await verifyHttp(url,packageDirectory,manifest.files);
  result.http.usageRoute=await verifyUsageRoute(url);
  await fs.appendFile(log,JSON.stringify(result.http)+'\nBrowser verification started\n');await json(path.join(directory,'verify.json'),result);
  result.browser=await verifyBrowser(url,receipt.version,directory,{analytics});await fs.appendFile(log,JSON.stringify(result.browser)+'\n');
  assert.equal((await inputs(root)).id,receipt.inputs.id,'Inputs changed during verification');sameFiles(await packageFiles(packageDirectory),manifest.files);
  result.status='passed';result.finishedAt=new Date().toISOString();await json(path.join(directory,'verify.json'),result);await report(directory,result,'部署目标验收');
  console.log(`PASS release:verify ${result.http.routes} routes, ${result.http.assets} assets, ${result.browser.cases} browser cases\nEvidence: ${directory}`);return result;
 }catch(error){result.status='failed';result.error=error.message;await fs.appendFile(path.join(directory,'verify.log'),inspect(error,{depth:8})+'\n');result.finishedAt=new Date().toISOString();await json(path.join(directory,'verify.json'),result);await report(directory,result,'部署目标验收失败');throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.cwd();try{
  const phase=process.argv[2];if(phase==='--help'||!phase){console.log('release:check --out <new evidence directory>\nrelease:package --evidence <check directory> --out <new package directory>\nrelease:verify --evidence <check directory> --package <package directory> --url <origin URL> --out <new verification directory> [--analytics live|exclude]');}
  else{
   const opts=options(process.argv.slice(3));assert.ok(opts.out,'--out is required (must be a new directory)');
   if(phase==='check'){assert.deepEqual(Object.keys(opts),['out']);await check(root,opts.out);}
   else if(phase==='package'){assert.ok(opts.evidence,'--evidence required');assert.ok(!opts.url&&!opts.package&&!opts.analytics,'Unexpected package option');await buildPackage(root,path.resolve(opts.evidence),opts.out);}
   else if(phase==='verify'){assert.ok(opts.evidence&&opts.package,'--evidence and --package required');await verify(root,path.resolve(opts.evidence),path.resolve(opts.package),opts.url,opts.out,{analytics:opts.analytics});}
   else throw Error('Unknown release phase: '+phase);
  }
 }catch(error){console.error('FAIL '+error.message);process.exitCode=1;}
}
