import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {filesIn,checkDocs,checkRedirects,readJson} from './release-common.mjs';
const root=process.cwd();let count=0;
for(const args of [['diff','--check'],['diff','--cached','--check']]){const result=spawnSync('git',args,{encoding:'utf8'});assert.equal(result.status,0,result.error??result.stdout+result.stderr);}
for(const folder of ['src','scripts','tests'])for(const file of await filesIn(root,folder))if(/\.(mjs|js)$/.test(file)){
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 assert.equal(result.status,0,`${file}: ${result.error??result.stderr}`);count++;
}
const {version}=await readJson('package.json');const source=await fs.readFile('src/app.js','utf8');
const versions=[...source.matchAll(/\bbeta:\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);assert.deepEqual(versions,[version,version],'Chinese/English UI versions must match package.json');
await checkRedirects(root);const docs=await checkDocs(root);
console.log(JSON.stringify({syntaxFiles:count,...docs,version,routes:15}));
