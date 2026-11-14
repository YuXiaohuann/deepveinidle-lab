import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function releaseVersion(tag,version){
 assert.match(version,/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,'Production requires a stable three-part version');
 assert.equal(tag,`v${version}`,'Release tag differs from package version');
}
export function allowProduction(candidate,current,candidateSha,currentSha){
 releaseVersion(`v${candidate}`,candidate);releaseVersion(`v${current}`,current);
 const a=candidate.split('.').map(BigInt),b=current.split('.').map(BigInt);
 const difference=a.findIndex((v,i)=>v!==b[i]);
 assert.ok(difference<0?candidateSha===currentSha:a[difference]>b[difference],'Refusing older production version or same version with different commit');
}
export function productionBaseline(project,resolveCommit){
 assert.equal(project.success,true,'Cloudflare project lookup failed');
 assert.equal(project.result.production_branch,'main');
 const current=project.result.canonical_deployment;
 assert.ok(current,'Cannot establish current production baseline');
 assert.equal(current.environment,'production');
 assert.equal(current.latest_stage.status,'success','Current production deployment is not successful');
 const hash=current.deployment_trigger?.metadata?.commit_hash;
 assert.match(hash??'',/^[a-f0-9]{7,40}$/,'Current production commit is unknown');
 const sha=resolveCommit(hash);assert.match(sha,/^[a-f0-9]{40}$/);
 return {id:current.id,sha};
}
export function git(...args){return execFileSync('git',args,{encoding:'utf8'}).trim();}
export async function guardRelease(){
 const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
 assert.equal(process.env.GITHUB_EVENT_NAME,'release');assert.equal(event.action,'published');
 assert.equal(event.release.draft,false);assert.equal(event.release.prerelease,false);
 const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
 releaseVersion(event.release.tag_name,version);
 const sha=git('rev-parse','HEAD');assert.equal(git('rev-parse',`${event.release.tag_name}^{commit}`),sha);
 git('merge-base','--is-ancestor',sha,'refs/remotes/origin/main');
 return {version,sha};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await guardRelease();
