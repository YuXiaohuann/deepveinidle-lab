import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const source = fs.readFileSync('vendor/game-original.js','utf8');
const ast = parse(source,{ecmaVersion:'latest',sourceType:'module',ranges:true});
const declarations = new Map();
for (const node of ast.body) {
  if (node.type === 'FunctionDeclaration') declarations.set(node.id.name,{name:node.id.name,start:node.start,end:node.end,text:source.slice(node.start,node.end)});
  if (node.type === 'VariableDeclaration') for(const d of node.declarations) {
    // Keep destructuring together, so dependent constants retain original initialization.
    const ids=[]; const walk=n=>{if(!n)return;if(n.type==='Identifier')ids.push(n.name);else if(n.type==='ObjectPattern')n.properties.forEach(p=>walk(p.value));else if(n.type==='ArrayPattern')n.elements.forEach(walk);};walk(d.id);
    const entry={name:ids.join(','),start:d.start,end:d.end,text:node.kind+' '+source.slice(d.start,d.end)+';'};
    ids.forEach(id=>declarations.set(id,entry));
  }
}
function find(signature,type) {
  const matches=[...new Set(declarations.values())].filter(d=>d.text.includes(signature)&&(!type||d.text.startsWith(type)));
  if(matches.length!==1)throw Error(`Signature ${signature}: found ${matches.length}, review new upstream build`);
  return matches[0].name;
}
const exportsMap={
  monsters:find('name:"Gnawer",level:2'), equipment:find('itemId:110,slot:"weapon"'),
  items:'St', gear:'ge', item:'lo', encode:'_s', withRarity:'we', levelXp:'ht', level:'$o', maxLevel:'Hc',
  accuracy:find('Math.round(ox*ze(e,"warrior"))','function'), maxHit:find('s>1?Math.ceil(c*s):c','function'),
  evasion:find('return 10+$o(e.skills.defence)+zI(e)','function'), hitChance:'Is', magic:'Ms', style:'Zc',
  attackTicks:'Eb', maxHp:'Yt', equipmentSlots:'Si', masteries:'Qa', rooms:'et',
  foodBuff:'u1', cropDuration:'Uh', isCrop:'Jd', damageReduction:'R6', brewScale:'ze', combine:'$t',
  bosses:'Yu', bossStats:'I6', bossWeakMultiplier:'Nh', bossOtherMultiplier:'Wh', tickMs:'oo',
  strength:'jI', armour:'zI', magicDefenceScale:'sl', maxEnhancement:'Fu', potions:'Qd'
};
exportsMap.recipes=find(`id:220,name:"Gatherer's draught",skill:"herblore"`);
// Dictionary is upstream data, not a hand-maintained translation list.
exportsMap.translations=find('"Bronze blade":"青铜剑"','const');
exportsMap.worldTranslations=find('Gnawer:"啃噬者"','const');
exportsMap.uiTranslations=find('"Vein Colossus":"矿脉巨像"','const');
exportsMap.homeTranslations=find('"The mine":"矿井"','const');
exportsMap.houseBonus='mn';
exportsMap.houseDamageCap='Hx';
exportsMap.masteryRankLimit='CT';
exportsMap.combatTick='tM';
exportsMap.killMonster='JI';
exportsMap.baseItemId='xo';
exportsMap.itemTier='Jo';
exportsMap.coinItemId='bc';
exportsMap.hotSkill='tl';
exportsMap.masteryOfflineBaseHours='tu';
exportsMap.predict='mi';
exportsMap.offline='EC';
exportsMap.tick='OS';
exportsMap.world='R';
exportsMap.startFight='va';
exportsMap.resetActivity='it';
exportsMap.depositPack='SS';
exportsMap.homeBank='A1';
exportsMap.combatTargetTile='yM';
exportsMap.nearbyTile='Zt';
exportsMap.predictionStartTick='HC';
exportsMap.predictionChunkTicks='Q0';
exportsMap.allSkills='Be';
exportsMap.createContext='$0';
exportsMap.fullFoodLoad='ua';
exportsMap.perks=find('id:"pockets",name:"Deep pockets"');
exportsMap.hotXp='y9';exportsMap.hotRare='w9';
exportsMap.tools='jy';
exportsMap.tool='Lc';
exportsMap.mountSpeed='I9';
const selected=new Set(); const allowed=new Set(['WeakSet','WeakMap','Uint8Array','Uint16Array','Uint32Array','Int32Array','Float64Array','Math','Map','Set','Number','Object','Array','String','Error','Date','Boolean','Infinity','undefined','JSON','RegExp','parseInt','parseFloat']);
function collect(name){
 const d=declarations.get(name);if(!d)throw Error('Missing declaration '+name);if(selected.has(d))return;selected.add(d);
 const a=parse(d.text,{ecmaVersion:'latest',sourceType:'module',ranges:true});
 const refs=analyze(a,{ecmaVersion:2024,sourceType:'module'}).globalScope.through.map(r=>r.identifier.name);
 for(const dep of new Set(refs))if(declarations.has(dep))collect(dep);else if(!allowed.has(dep))throw Error(`Unexpected external dependency ${dep} in ${name}`);
}
Object.values(exportsMap).forEach(collect);
const ordered=[...selected].sort((a,b)=>a.start-b.start);
fs.mkdirSync('src',{recursive:true});
fs.writeFileSync('src/upstream.js','// GENERATED from vendor/game-original.js. Do not edit.\n'+ordered.map(d=>d.text).join('\n')+'\nexport { '+Object.entries(exportsMap).map(([alias,name])=>`${name} as ${alias}`).join(', ')+' };\n');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
fs.writeFileSync('vendor/manifest.json',JSON.stringify({sourceUrl:'https://deepveinidle.com/assets/index-CEociSeB.js',retrieved:'2026-10-04',changelogVersion:'0.0.1167',sha256:hash(source),exports:exportsMap,declarations:ordered.map(({name,start,end,text})=>({name,start,end,sha256:hash(text)}))},null,2));
console.log(`Extracted ${ordered.length} original declarations (${fs.statSync('src/upstream.js').size} bytes).`);
