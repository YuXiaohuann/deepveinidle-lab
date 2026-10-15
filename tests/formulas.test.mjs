import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {renderFormulaMarkdown} from '../src/formulas-markdown.js';
import {packageFiles,checkRedirects} from '../scripts/release-common.mjs';

test('formula Markdown renders the published Chinese chapters, tables and literal formulas',async()=>{
 const source=await fs.readFile(new URL('../src/content/formulas/combat.zh.md',import.meta.url),'utf8');
 const result=renderFormulaMarkdown(source);
 assert.equal(result.chapters.filter(chapter=>chapter.level===2).length,8);
 assert.match(result.html,/<table>/);assert.match(result.html,/<pre><code class="language-text">/);
 assert.match(result.html,/基础最大伤害 = 1 \+ floor/);
 assert.match(result.toc,/一、装备/);assert.match(result.toc,/二、角色属性/);
 assert.doesNotMatch(result.html,/待确认|维护入口|src\/upstream/);
 assert.equal(new Set(result.chapters.map(chapter=>chapter.id)).size,result.chapters.length);
});

test('formula renderer escapes HTML and dangerous links and distinguishes duplicate headings',()=>{
 const result=renderFormulaMarkdown('# 战斗公式\n\n## 相同\n\n<script>alert(1)</script>\n\n[危险](javascript:alert(1))\n\n### 小节\n\n## 相同');
 assert.deepEqual(result.chapters.map(chapter=>chapter.id),['formula-1','formula-1-1','formula-2']);
 assert.match(result.html,/&lt;script&gt;/);assert.doesNotMatch(result.html,/<script|href="javascript:/);
 assert.match(result.toc,/href="#formula-2"/);
 assert.throws(()=>renderFormulaMarkdown('<html>Not found</html>'),/格式不正确/);
 assert.throws(()=>renderFormulaMarkdown('# 战斗公式'),/缺少章节/);
});

test('formula resources are packaged with the renderer license and routes',async()=>{
 const files=await packageFiles(process.cwd());
 for(const name of ['src/content/formulas/combat.zh.md','vendor/markdown-it/LICENSE.txt','vendor/markdown-it/markdown-it.esm.min.mjs'])assert.ok(files.some(file=>file.path===name),name);
 assert.ok(files.every(file=>!file.path.startsWith('reports/')&&!file.path.startsWith('docs/')));
 await checkRedirects(process.cwd());
});

test('Markdown outside the dedicated public directory remains excluded',async context=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'formula-package-'));
 context.after(()=>fs.rm(directory,{recursive:true,force:true}));
 await fs.mkdir(path.join(directory,'src'));await fs.mkdir(path.join(directory,'vendor'));
 await fs.writeFile(path.join(directory,'src','notes.md'),'private');
 await assert.rejects(packageFiles(directory),/Not an application file: src\/notes.md/);
});

test('the pinned Markdown renderer, source map and license match their recorded digests',async()=>{
 const metadata=JSON.parse(await fs.readFile(new URL('../vendor/markdown-it/source.json',import.meta.url),'utf8'));
 const project=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(metadata.version,project.devDependencies['markdown-it']);
 for(const [file,digest]of Object.entries(metadata.files)){
  const content=await fs.readFile(new URL('../vendor/markdown-it/'+file,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(content).digest('hex'),digest,file);
 }
 execFileSync(process.execPath,['scripts/vendor-markdown.mjs','--check'],{cwd:process.cwd()});
});
