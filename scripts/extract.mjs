import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-DwK7yQ7O.js',retrieved:'2026-10-07',changelogVersion:'1.0.1173',sha256:'e7901d9a9bdf0cb98882830c518c7bc9fc205384a237caf07c940572c8ac8ea8'};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const source = fs.readFileSync('vendor/game-original.js','utf8');
if(hash(source)!==sourceInfo.sha256)throw Error('Unreviewed upstream snapshot: review source metadata, export mappings and signatures before extraction');
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
// Reviewed public build mappings; the source hash guards every symbol.
const exportsMap={
  "monsters": "mc",
  "equipment": "jy",
  "items": "kt",
  "gear": "ve",
  "item": "po",
  "encode": "bs",
  "withRarity": "Se",
  "levelXp": "pt",
  "level": "$o",
  "maxLevel": "Jc",
  "accuracy": "$n",
  "maxHit": "Mn",
  "evasion": "qn",
  "hitChance": "Os",
  "magic": "Vs",
  "style": "ps",
  "attackTicks": "xp",
  "maxHp": "cc",
  "equipmentSlots": "Ki",
  "masteries": "fi",
  "rooms": "st",
  "foodBuff": "c1",
  "cropDuration": "ku",
  "isCrop": "$l",
  "damageReduction": "mT",
  "brewScale": "Ze",
  "combine": "Gt",
  "bosses": "vm",
  "bossStats": "aT",
  "bossWeakMultiplier": "fu",
  "bossOtherMultiplier": "bu",
  "tickMs": "co",
  "strength": "qW",
  "armour": "MW",
  "magicDefenceScale": "Wl",
  "maxEnhancement": "If",
  "potions": "Al",
  "recipes": "bo",
  "translations": "Z9",
  "worldTranslations": "uH",
  "uiTranslations": "Q9",
  "homeTranslations": "oH",
  "houseBonus": "Ma",
  "houseDamageCap": "DS",
  "masteryRankLimit": "h5",
  "combatTick": "EW",
  "killMonster": "RW",
  "baseItemId": "lo",
  "itemTier": "Go",
  "coinItemId": "hc",
  "hotSkill": "Tl",
  "masteryOfflineBaseHours": "Au",
  "predict": "Hi",
  "offline": "f9",
  "tick": "X3",
  "world": "E",
  "startFight": "Fn",
  "resetActivity": "lt",
  "depositPack": "R3",
  "homeBank": "k1",
  "combatTargetTile": "o6",
  "nearbyTile": "rc",
  "predictionStartTick": "g9",
  "predictionChunkTicks": "z0",
  "allSkills": "Ie",
  "createContext": "k0",
  "fullFoodLoad": "Tn",
  "perks": "Dd",
  "hotXp": "oB",
  "hotRare": "eB",
  "tools": "Oy",
  "tool": "Xc",
  "mountSpeed": "rB",
  "randomFloat": "Jb",
  "canEnhance": "jc",
  "enhanceChance": "D3",
  "enhanceCost": "j1",
  "enhanceXp": "h9",
  "enhanceTicks": "Lm",
  "protectionMin": "Ta"
};
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
fs.writeFileSync('vendor/manifest.json',JSON.stringify({...sourceInfo,exports:exportsMap,declarations:ordered.map(({name,start,end,text})=>({name,start,end,sha256:hash(text)}))},null,2));
console.log(`Extracted ${ordered.length} original declarations (${fs.statSync('src/upstream.js').size} bytes).`);
