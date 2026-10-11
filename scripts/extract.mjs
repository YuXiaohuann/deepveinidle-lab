import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-C3S-5Yeu.js',retrieved:'2026-10-08',changelogVersion:'1.0.1181',sha256:'fd1ef0cfa8dc09cd68b357077674a9661585834c5b0563e134671ccdd895005e'};
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
  "monsters": "uc",
  "equipment": "h0",
  "items": "vt",
  "gear": "xe",
  "item": "go",
  "canSell": "Ne",
  "vendorPrice": "fe",
  "encode": "ms",
  "withRarity": "$e",
  "levelXp": "yt",
  "level": "Po",
  "maxLevel": "zc",
  "accuracy": "Hn",
  "maxHit": "Rn",
  "evasion": "In",
  "hitChance": "Es",
  "magic": "_s",
  "style": "Jc",
  "attackTicks": "Cp",
  "maxHp": "cc",
  "equipmentSlots": "Xi",
  "masteries": "vi",
  "rooms": "dt",
  "foodBuff": "K1",
  "preferredBankFood": "Ll",
  "cropDuration": "Mu",
  "isCrop": "Tl",
  "damageReduction": "pP",
  "brewScale": "tt",
  "combine": "xt",
  "bosses": "Im",
  "bossStats": "rP",
  "bossWeakMultiplier": "$u",
  "bossOtherMultiplier": "Ku",
  "tickMs": "to",
  "strength": "O5",
  "armour": "Y5",
  "magicDefenceScale": "Cl",
  "maxEnhancement": "Xf",
  "potions": "Ml",
  "recipes": "po",
  "translations": "y6",
  "worldTranslations": "H6",
  "uiTranslations": "k6",
  "homeTranslations": "v6",
  "houseBonus": "Ta",
  "houseDamageCap": "P3",
  "masteryRankLimit": "PM",
  "masteryRankCost": "nu",
  "masteryTotalCost": "MM",
  "masteriesTotalCost": "gd",
  "masteryEarnedPoints": "Sp",
  "combatTick": "tB",
  "killMonster": "Q5",
  "baseItemId": "lo",
  "itemTier": "Ho",
  "coinItemId": "hc",
  "hotSkill": "Il",
  "masteryOfflineBaseHours": "Iu",
  "predict": "Ei",
  "offline": "RH",
  "tick": "_$",
  "world": "_",
  "startFight": "_n",
  "resetActivity": "ft",
  "depositPack": "x$",
  "homeBank": "F1",
  "combatTargetTile": "wB",
  "nearbyTile": "rc",
  "predictionStartTick": "LH",
  "predictionChunkTicks": "bk",
  "allSkills": "Le",
  "createContext": "_0",
  "fullFoodLoad": "$a",
  "perks": "Qd",
  "hotXp": "wT",
  "hotRare": "yT",
  "tools": "r0",
  "tool": "Uc",
  "toolLuck": "fp",
  "equipmentLuck": "Mn",
  "brewRarityMultiplier": "Bp",
  "houseRarityMultiplier": "nl",
  "masteryMultiplier": "St",
  "mountSpeed": "AT",
  "randomFloat": "mp",
  "canEnhance": "Oc",
  "enhanceChance": "C$",
  "enhanceCost": "hw",
  "enhanceXp": "TH",
  "enhanceTicks": "Is",
  "protectionMin": "Ba",
  "startWork": "fs",
  "workChance": "U3",
  "workModifiers": "z3",
  "caughtChance": "j3",
  "packCapacity": "kt",
  "lootBoxItemId": "Xc",
  "nearestWorkSite": "mB"
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
