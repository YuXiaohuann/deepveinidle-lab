// Independently extract the complete 1.0.1187 native engine for compatibility checks.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';
import {game,preset} from '../src/model.js';
import {createScenario} from '../src/simulation.js';

const manifest=JSON.parse(fs.readFileSync('vendor/manifest.json'));
const metadata=manifest.overrides[0]??{...manifest,file:'vendor/game-original.js'};
const source=fs.readFileSync(metadata.file,'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'),metadata.sha256);
const declarations=new Map();
for(const node of parse(source,{ecmaVersion:'latest',sourceType:'module',ranges:true}).body){
 if(node.type==='FunctionDeclaration')declarations.set(node.id.name,{start:node.start,text:source.slice(node.start,node.end)});
 if(node.type==='VariableDeclaration')for(const d of node.declarations){
  const ids=[];const walk=n=>{if(!n)return;if(n.type==='Identifier')ids.push(n.name);else if(n.type==='ObjectPattern')n.properties.forEach(p=>walk(p.value));else if(n.type==='ArrayPattern')n.elements.forEach(walk);};walk(d.id);
  const entry={start:d.start,text:node.kind+' '+source.slice(d.start,d.end)+';'};ids.forEach(id=>declarations.set(id,entry));
 }
}
const exports={world:'X',monsters:'Bt',predict:'Lr',startFight:'qi',createContext:'kS',gear:'$a',armourMultiplier:'T0',masteryMultiplier:'Re',restock:'PI'};
const selected=new Set(),allowed=new Set(['WeakSet','WeakMap','Uint8Array','Uint16Array','Uint32Array','Int32Array','Float64Array','Math','Map','Set','Number','Object','Array','String','Error','Date','Boolean','Infinity','undefined','JSON','RegExp','parseInt','parseFloat']);
function collect(name){
 const d=declarations.get(name);if(!d)throw Error('Missing native declaration '+name);if(selected.has(d))return;selected.add(d);
 const refs=analyze(parse(d.text,{ecmaVersion:'latest',sourceType:'module',ranges:true}),{ecmaVersion:2024,sourceType:'module'}).globalScope.through.map(r=>r.identifier.name);
 for(const dep of new Set(refs))if(declarations.has(dep))collect(dep);else if(!allowed.has(dep))throw Error('Unexpected native dependency '+dep);
}
Object.values(exports).forEach(collect);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dvi-1187-audit-'));
try{
 const file=path.join(directory,'native.mjs');
 fs.writeFileSync(file,[...selected].sort((a,b)=>a.start-b.start).map(d=>d.text).join('\n')+'\nexport{'+Object.entries(exports).map(([alias,name])=>name+' as '+alias).join(',')+'};');
 const native=await import(pathToFileURL(file));
 // Manufacturing job lists changed; compare map geometry and combat routes.
 const siteGeometry=({jobIds,...site})=>site;
 const geometry=world=>({...world,sites:world.sites.map(siteGeometry),siteById:new Map([...world.siteById].map(([id,site])=>[id,siteGeometry(site)]))});
 assert.deepEqual(geometry(native.world),geometry(game.world));assert.deepEqual(native.monsters,game.monsters);
 let count=0;
 function compare(state,monster){
  const {player}=createScenario(state,monster);
  const localContext=game.createContext(game.world,314),nativeContext=native.createContext(native.world,314);
  const zone=game.world.zones.find(z=>z.monsterId===monster.id);
  const actual=game.predict(player,localContext,p=>game.startFight(p,localContext,zone.id));
  const expected=native.predict(player,nativeContext,p=>native.startFight(p,nativeContext,zone.id));
  assert.deepEqual(actual,expected,`${state.style}: ${state.gear.weapon.id}: ${monster.name}`);count++;
 }
 for(const style of ['melee','ranged','magic'])for(const monster of game.monsters)compare(preset(style),monster);
 for(const[id,style]of[[394,'melee'],[151,'ranged'],[629,'ranged'],[630,'ranged'],[631,'magic']])for(const tier of [0,4]){
  const state=preset(style);for(const k of Object.keys(state.levels))state.levels[k]=99;
  state.masteries.accuracy=13;state.gear.weapon={id,tier,plus:17};state.manual.foodPerTrip=5;
  if(style==='magic')for(const[slot,id]of[['helmet',632],['body',633],['legs',634],['shield',635]])state.gear[slot]={id,tier,plus:17};
  for(const monster of game.monsters)compare(state,monster);
 }
 for(const id of [629,630,631,632,633,634,635])for(let tier=0;tier<5;tier++)for(const plus of [0,17,100]){
  const encoded=game.encode(game.withRarity(id,tier),plus);assert.deepEqual(game.gear(encoded),native.gear(encoded));
 }
 console.log(`Native 1.0.1187 comparison: ${count}/${count} complete 1-hour predictions matched; world geometry, monsters and 105 new-gear variants matched.`);
}finally{fs.rmSync(directory,{recursive:true});}
