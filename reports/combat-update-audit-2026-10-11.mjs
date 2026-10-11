// Independent extraction of the reviewed current native predictor for battle comparison.
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {game,preset} from '../src/model.js';
import {createScenario} from '../src/simulation.js';
import fs from 'node:fs';import {parse} from 'acorn';import {analyze} from 'eslint-scope';
const source=fs.readFileSync('vendor/game-combat-update.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module',ranges:true}),decl=new Map();for(const n of ast.body){if(n.type==='FunctionDeclaration')decl.set(n.id.name,{start:n.start,text:source.slice(n.start,n.end)});if(n.type==='VariableDeclaration')for(const d of n.declarations){const ids=[];function walk(n){if(!n)return;if(n.type==='Identifier')ids.push(n.name);else if(n.type==='ObjectPattern')n.properties.forEach(p=>walk(p.value));else if(n.type==='ArrayPattern')n.elements.forEach(walk);}walk(d.id);const x={start:d.start,text:n.kind+' '+source.slice(d.start,d.end)+';'};ids.forEach(id=>decl.set(id,x));}}
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'dvi-combat-native-')),nativePath=path.join(tempDir,'native.mjs');
const manifest=JSON.parse(fs.readFileSync('vendor/manifest.json','utf8'));
assert.equal(createHash('sha256').update(source).digest('hex'),manifest.overrides[0].sha256);
const selected=new Set(),allowed=new Set(['WeakSet','WeakMap','Uint8Array','Uint16Array','Uint32Array','Int32Array','Float64Array','Math','Map','Set','Number','Object','Array','String','Error','Date','Boolean','Infinity','undefined','JSON','RegExp','parseInt','parseFloat']);
function collect(name){const d=decl.get(name);if(!d)throw Error(name);if(selected.has(d))return;selected.add(d);const refs=analyze(parse(d.text,{ecmaVersion:'latest',sourceType:'module',ranges:true}),{ecmaVersion:2024,sourceType:'module'}).globalScope.through.map(r=>r.identifier.name);for(const r of new Set(refs))if(decl.has(r))collect(r);else if(!allowed.has(r))throw Error('External '+r);}
const exports={tick:'F4',consume:'Q3',item:'ko',brewScale:'we',accuracy:'pn',maxHit:'wn',evasion:'gn',maxHp:'yt',attackTicks:'Rw',offline:'LP',predict:'Wr',createContext:'Y2',world:'Y',startFight:'$i',monsters:'Kt',eventAt:'oh',randomFloat:'_g',killMonster:'Z6',combatTick:'eq'};Object.values(exports).forEach(collect);fs.writeFileSync(nativePath,[...selected].sort((a,b)=>a.start-b.start).map(d=>d.text).join('\n')+'\nexport{'+Object.entries(exports).map(([a,b])=>b+' as '+a).join(',')+'};');console.log('Extracted',selected.size);

try{
const latest=await import(pathToFileURL(nativePath));
assert.deepEqual(latest.monsters,game.monsters);assert.deepEqual(latest.world,game.world);
let matched=0;const differences=[];
for(const style of ['melee','ranged','magic'])for(const monster of game.monsters){
 const player=createScenario(preset(style)).player;Object.assign(player,{id:127,lastTick:1500000,bank:{64:100,65:100,66:100},bankLocked:[65],foodItemId:null,guildBonus:.095,forgeLog:{3:7}});
 const windows=[{fromTick:1000000,toTick:1006000,xpMult:1.1,rarityMult:1.2}];const oldContext={...game.createContext(game.world,314),windows:structuredClone(windows)},newContext={...latest.createContext(latest.world,314),windows:structuredClone(windows)};const zone=game.world.zones.find(z=>z.monsterId===monster.id);
 const old=game.predict(player,oldContext,p=>game.startFight(p,oldContext,zone.id));const current=latest.predict(player,newContext,p=>latest.startFight(p,newContext,zone.id));try{assert.deepEqual(current,old);matched++;}catch{differences.push({style,monster:monster.id,old,current});}
}
assert.equal(matched,60,JSON.stringify(differences));
console.log('Updated predictor and current upstream: 60/60 complete results matched.');
}finally{fs.rmSync(tempDir,{recursive:true});}
