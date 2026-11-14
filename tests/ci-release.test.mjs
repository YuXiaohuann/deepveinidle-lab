import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseVersion,allowProduction,productionBaseline} from '../scripts/ci-release-guard.mjs';
test('production requires matching stable tag and rejects malformed or prerelease versions',()=>{
 releaseVersion('v1.10.5','1.10.5');
 for(const [tag,version]of [['v1.10.4','1.10.5'],['v1.10.5-preview.1','1.10.5-preview.1'],['v01.2.3','01.2.3'],['v1.2','1.2']])assert.throws(()=>releaseVersion(tag,version));
});
test('production permits upgrades and exact reruns, refuses downgrade and version replacement',()=>{
 allowProduction('1.10.5','1.10.4','new','old');allowProduction('1.10.4','1.10.4','same','same');allowProduction('1.11.0','1.9.99','new','old');
 assert.throws(()=>allowProduction('1.10.3','1.10.4','new','old'));assert.throws(()=>allowProduction('1.10.4','1.10.4','new','old'));assert.throws(()=>allowProduction('1.10.5','unknown','new','old'));
});

test('production baseline uses canonical deployment and refuses unknown or unsuccessful provenance',()=>{
 const sha='a'.repeat(40),project={success:true,result:{production_branch:'main',canonical_deployment:{id:'current',environment:'production',latest_stage:{status:'success'},deployment_trigger:{metadata:{commit_hash:'aaaaaaa'}}}}};
 assert.deepEqual(productionBaseline(project,hash=>{assert.equal(hash,'aaaaaaa');return sha;}),{id:'current',sha});
 const invalid=structuredClone(project);invalid.result.canonical_deployment.latest_stage.status='failure';assert.throws(()=>productionBaseline(invalid,()=>sha));
 invalid.result.canonical_deployment.latest_stage.status='success';delete invalid.result.canonical_deployment.deployment_trigger.metadata.commit_hash;assert.throws(()=>productionBaseline(invalid,()=>sha));
 assert.throws(()=>productionBaseline({success:true,result:{production_branch:'main'}},()=>sha));
});
