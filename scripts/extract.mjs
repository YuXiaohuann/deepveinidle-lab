import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-C6UxPVvd.js',retrieved:'2026-10-12',changelogVersion:'1.0.1186',sha256:'cfec2d6184f4d1b649c87731d06f8ed095655de6ad0da6689c9c67dc6f969b9b'};
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
  "monsters": "Kt",
  "equipment": "m2",
  "items": "ft",
  "marketFamilies": "r3",
  "marketFamily": "ab",
  "gear": "Ga",
  "item": "ko",
  "canSell": "re",
  "vendorPrice": "Ra",
  "encode": "vs",
  "withRarity": "Xa",
  "levelXp": "ut",
  "level": "Co",
  "maxLevel": "Lc",
  "accuracy": "pn",
  "maxHit": "wn",
  "evasion": "gn",
  "hitChance": "ps",
  "magic": "gs",
  "style": "pc",
  "attackTicks": "Rw",
  "maxHp": "yt",
  "equipmentSlots": "cd",
  "masteries": "ci",
  "rooms": "Se",
  "foodBuff": "_y",
  "preferredBankFood": "qh",
  "cropDuration": "Pm",
  "isCrop": "Jf",
  "damageReduction": "vT",
  "brewScale": "we",
  "combine": "Le",
  "bosses": "Of",
  "bossStats": "uT",
  "bossWeakMultiplier": "mT",
  "bossOtherMultiplier": "fT",
  "tickMs": "no",
  "strength": "X6",
  "armour": "O6",
  "magicDefenceScale": "dh",
  "maxEnhancement": "mp",
  "potions": "Uf",
  "recipes": "vo",
  "translations": "CI",
  "worldTranslations": "QI",
  "uiTranslations": "DI",
  "homeTranslations": "LI",
  "houseBonus": "bn",
  "houseDamageCap": "S3",
  "masteryRankLimit": "jB",
  "masteryRankCost": "Rr",
  "masteryTotalCost": "UB",
  "masteriesTotalCost": "fl",
  "masteryEarnedPoints": "dw",
  "combatTick": "eq",
  "killMonster": "Z6",
  "combatRarityMultiplier": "Q6",
  "rarityThresholds": "Zc",
  "mountRarityThresholds": "os",
  "mountChance": "FW",
  "baseAttackTicks": "ur",
  "combatPetChance": "Ql",
  "combatPetItem": "zG",
  "voidShardChance": "U6",
  "voidShardQuantity": "J6",
  "voidShardItemId": "mn",
  "mountItemId": "rs",
  "abyssalGoldBonus": "Dy",
  "baseItemId": "mo",
  "itemTier": "Eo",
  "coinItemId": "pt",
  "hotSkill": "Th",
  "masteryOfflineBaseHours": "Er",
  "predict": "Wr",
  "offline": "LP",
  "tick": "F4",
  "world": "Y",
  "startFight": "$i",
  "resetActivity": "Ie",
  "depositPack": "g4",
  "homeBank": "a0",
  "combatTargetTile": "gq",
  "nearbyTile": "At",
  "predictionStartTick": "NP",
  "predictionChunkTicks": "yS",
  "allSkills": "Ya",
  "createContext": "Y2",
  "fullFoodLoad": "sn",
  "perks": "_m",
  "hotXp": "H3",
  "hotRare": "A3",
  "tools": "l2",
  "tool": "bc",
  "toolLuck": "Xg",
  "equipmentLuck": "yi",
  "brewRarityMultiplier": "Hw",
  "houseRarityMultiplier": "rh",
  "masteryMultiplier": "Ee",
  "mountSpeed": "Sw",
  "randomFloat": "_g",
  "canEnhance": "Jt",
  "enhanceChance": "B4",
  "enhanceCost": "lb",
  "enhanceXp": "BP",
  "enhanceTicks": "Fc",
  "protectionMin": "Qt",
  "startWork": "_c",
  "workChance": "_3",
  "workModifiers": "E3",
  "recipeInputs": "Mt",
  "burnChance": "n6",
  "workXpMultiplier": "ib",
  "caughtChance": "L3",
  "packCapacity": "De",
  "lootBoxItemId": "Si",
  "nearestWorkSite": "t4"
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
