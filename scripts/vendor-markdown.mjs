import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {sha256,json,readJson} from './release-common.mjs';

const root=process.cwd(),source=fileURLToPath(new URL('../',import.meta.resolve('markdown-it'))),target=path.join(root,'vendor/markdown-it');
const project=await readJson(path.join(root,'package.json')),installed=await readJson(path.join(source,'package.json'));
const version=project.devDependencies['markdown-it'];
assert.match(version,/^\d+\.\d+\.\d+$/,'markdown-it must use an exact version');
assert.equal(installed.version,version,'Run pnpm install --frozen-lockfile before syncing markdown-it');
const checking=process.argv.includes('--check'),files={};
for(const [input,output]of [['dist/browser/markdown-it.esm.min.mjs','markdown-it.esm.min.mjs'],['dist/browser/markdown-it.esm.min.mjs.map','markdown-it.esm.min.mjs.map'],['LICENSE','LICENSE.txt']]){
 const content=await fs.readFile(path.join(source,input));files[output]=sha256(content);
 if(checking)assert.equal(sha256(await fs.readFile(path.join(target,output))),files[output],`${output}: run pnpm vendor:markdown`);
 else {await fs.mkdir(target,{recursive:true});await fs.writeFile(path.join(target,output),content);}
}
const metadata={name:installed.name,version,license:installed.license,url:`https://registry.npmjs.org/markdown-it/-/markdown-it-${version}.tgz`,distribution:'dist/browser/markdown-it.esm.min.mjs',files};
if(checking)assert.deepEqual(await readJson(path.join(target,'source.json')),metadata,'markdown-it source metadata differs; run pnpm vendor:markdown');
else await json(path.join(target,'source.json'),metadata);
console.log(`markdown-it ${version}: ${checking?'verified':'synced'} ${Object.keys(files).length} files`);
