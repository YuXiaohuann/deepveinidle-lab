import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-B2257EY9.js',retrieved:'2026-10-13',changelogVersion:'1.0.1187',sha256:'36604ce12e1e9ab34998974f7b7354238e5e8b09e4a3ae579333f1959edbef24'};
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
  "monsters": "Bt",
  "equipment": "N2",
  "items": "wt",
  "marketFamilies": "QG",
  "marketFamily": "mb",
  "gear": "$a",
  "item": "yo",
  "canSell": "re",
  "vendorPrice": "Ba",
  "encode": "Oc",
  "withRarity": "Wa",
  "levelXp": "bt",
  "level": "Io",
  "maxLevel": "Xc",
  "accuracy": "yn",
  "maxHit": "Rs",
  "evasion": "kn",
  "hitChance": "ks",
  "magic": "wi",
  "style": "Tt",
  "attackTicks": "jw",
  "maxHp": "it",
  "equipmentSlots": "Sn",
  "masteries": "ii",
  "rooms": "ve",
  "foodBuff": "m0",
  "preferredBankFood": "ud",
  "cropDuration": "jm",
  "isCrop": "db",
  "damageReduction": "_B",
  "brewScale": "we",
  "combine": "_e",
  "bosses": "cb",
  "bossStats": "MB",
  "bossWeakMultiplier": "KB",
  "bossOtherMultiplier": "RB",
  "tickMs": "io",
  "strength": "nI",
  "armour": "iI",
  "magicDefenceScale": "zw",
  "maxEnhancement": "xp",
  "potions": "rb",
  "recipes": "Ho",
  "translations": "a9",
  "worldTranslations": "b9",
  "uiTranslations": "e9",
  "homeTranslations": "t9",
  "houseBonus": "wn",
  "houseDamageCap": "h4",
  "masteryRankLimit": "hW",
  "masteryRankCost": "Fr",
  "masteryTotalCost": "uW",
  "masteriesTotalCost": "vl",
  "masteryEarnedPoints": "Gw",
  "combatTick": "gI",
  "killMonster": "fI",
  "combatRarityMultiplier": "mI",
  "rarityThresholds": "ts",
  "mountRarityThresholds": "cs",
  "mountChance": "QW",
  "baseAttackTicks": "kr",
  "combatPetChance": "ch",
  "combatPetItem": "gG",
  "isPet": "nt",
  "voidShardChance": "hI",
  "voidShardQuantity": "uI",
  "voidShardItemId": "gn",
  "mountItemId": "us",
  "abyssalGoldBonus": "d0",
  "baseItemId": "bo",
  "itemTier": "Po",
  "coinItemId": "kt",
  "hotSkill": "Eh",
  "masteryOfflineBaseHours": "zr",
  "predict": "Lr",
  "offline": "cF",
  "tick": "W$",
  "world": "X",
  "startFight": "qi",
  "resetActivity": "De",
  "depositPack": "u$",
  "homeBank": "x0",
  "combatTargetTile": "BI",
  "nearbyTile": "Mt",
  "predictionStartTick": "iF",
  "predictionChunkTicks": "jS",
  "allSkills": "Na",
  "createContext": "kS",
  "fullFoodLoad": "ln",
  "perks": "ef",
  "hotXp": "m4",
  "hotRare": "f4",
  "tools": "L2",
  "tool": "vc",
  "toolLuck": "iw",
  "equipmentLuck": "Ai",
  "brewRarityMultiplier": "Ew",
  "houseRarityMultiplier": "gh",
  "masteryMultiplier": "Re",
  "mountSpeed": "Dw",
  "randomFloat": "cw",
  "canEnhance": "cc",
  "enhanceChance": "M$",
  "enhanceCost": "vb",
  "enhanceXp": "zP",
  "enhanceTicks": "_c",
  "protectionMin": "ic",
  "startWork": "zc",
  "workChance": "B4",
  "workModifiers": "T4",
  "recipeInputs": "gt",
  "burnChance": "Sq",
  "workXpMultiplier": "yb",
  "caughtChance": "R4",
  "packCapacity": "Ee",
  "lootBoxItemId": "Gi",
  "nearestWorkSite": "Z4",
  "armourMultiplier": "T0",
  "restock": "PI",
  "upgradeRecipes": "Ti",
  "upgradeResult": "xb",
  "upgradeMaterials": "O0",
  "applyUpgrade": "tF",
  "recipeLevel": "OP",
  "windowModifiers": "An",
  "hotRarityMultiplier": "uf",
  "skillPet": "yG",
  "skillPetChance": "uw",
  "itemSupportsRarity": "Fh",
  "bonusMinimumUncommon": "kf",
  "addPack": "yt"
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
fs.writeFileSync('src/upstream.js','// GENERATED from reviewed vendor snapshots. Do not edit.\n'+ordered.map(d=>d.text).join('\n')+'\nexport { '+Object.entries(exportsMap).map(([alias,name])=>`${name} as ${alias}`).join(', ')+' };\n');
fs.writeFileSync('vendor/manifest.json',JSON.stringify({...sourceInfo,exports:exportsMap,declarations:ordered.map(({name,start,end,text})=>({name,start,end,sha256:hash(text)})),overrides:[]},null,2));
console.log(`Extracted ${ordered.length} original declarations (${fs.statSync('src/upstream.js').size} bytes).`);
