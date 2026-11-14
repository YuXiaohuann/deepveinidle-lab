import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {assertReceipt,packageFiles,readJson,sameFiles,json,runLogged} from './release-common.mjs';
import {allowProduction,git,guardRelease,productionBaseline} from './ci-release-guard.mjs';

const channel=process.argv[2];assert.ok(['preview','production'].includes(channel),'Unknown channel');
const directory='.test-artifacts/ci',record={channel,status:'running',sha:git('rev-parse','HEAD')};
await fs.mkdir(directory,{recursive:true});
async function api(url,token){
 const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
 assert.ok(response.ok,`API request failed: ${response.status} ${new URL(url).hostname}`);return response.json();
}
try{
 const receipt=await assertReceipt(process.cwd(),`${directory}/check`),manifest=await readJson(`${directory}/check/package.json`);
 sameFiles(await packageFiles(`${directory}/package`),manifest.files);
 assert.equal(manifest.inputId,receipt.inputs.id);record.version=receipt.version;record.inputId=receipt.inputs.id;
 for(const name of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','GH_TOKEN','GITHUB_REPOSITORY','GITHUB_OUTPUT'])assert.ok(process.env[name],`Missing ${name}`);
 assert.match(process.env.CLOUDFLARE_ACCOUNT_ID,/^[a-f0-9]{32}$/);
 const main=await api(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/main`,process.env.GH_TOKEN);
 assert.match(main.sha,/^[a-f0-9]{40}$/);
 if(channel==='preview'&&main.sha!==record.sha){
  record.status='skipped';record.reason='Candidate is no longer the latest main commit';
  await fs.appendFile(process.env.GITHUB_OUTPUT,'deployed=false\n');console.log(record.reason);
 }else{
  if(channel==='production'){
   await guardRelease();git('merge-base','--is-ancestor',record.sha,main.sha);
   const project=await api(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/dvi-lab`,process.env.CLOUDFLARE_API_TOKEN);
   const current=productionBaseline(project,hash=>git('rev-parse',`${hash}^{commit}`));
   const currentPackage=JSON.parse(git('show',`${current.sha}:package.json`));
   allowProduction(record.version,currentPackage.version,record.sha,current.sha);record.previousDeployment=current.id;
  }
  // This is the only mutation. Verification remains separate and receives no API token.
  const result=await runLogged('wrangler',['pages','deploy',`${directory}/package`,'--project-name','dvi-lab','--branch',channel==='preview'?'preview':'main','--commit-hash',record.sha],{cwd:process.cwd(),log:`${directory}/deploy.log`,timeout:600000});
  assert.ok(result.exitCode===0&&!result.timedOut,'Wrangler upload failed; see deploy.log');
  record.status='uploaded';await json(`${directory}/deployment.json`,record);
  const log=await fs.readFile(`${directory}/deploy.log`,'utf8');
  const urls=[...new Set(log.match(/https:\/\/[a-f0-9]{8}\.dvi-lab\.pages\.dev\b/g)??[])];
  assert.equal(urls.length,1,'Cannot uniquely identify exact deployment URL; upload may have succeeded');
  record.url=urls[0];await fs.appendFile(process.env.GITHUB_OUTPUT,`deployed=true\nurl=${record.url}\n`);
  console.log(`Uploaded ${record.version} (${record.sha}) to ${record.url}; online verification pending`);
 }
}catch(error){record.failure=error.message;record.status=record.status==='uploaded'?'uploaded-unverified':'failed';throw error;}
finally{await json(`${directory}/deployment.json`,record);}
