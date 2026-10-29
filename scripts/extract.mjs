import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-CXncQ7hL.js',retrieved:'2026-10-28',changelogVersion:'1.0.1205',sha256:'6a2edd98093a204d24f41ef2f26e1ee2260fd027931213287471b1b131d84282'};
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
  "questDay": "Id",
  "questWeek": "a2",
  "monsters": "Bt",
  "equipment": "PY",
  "items": "Ss",
  "marketCategories": "Yn",
  "marketFamilies": "YW",
  "marketFamily": "lG",
  "gear": "We",
  "item": "Ko",
  "canSell": "la",
  "vendorPrice": "me",
  "encode": "Hs",
  "withRarity": "Kc",
  "levelXp": "Qa",
  "level": "jo",
  "maxLevel": "qn",
  "accuracy": "yl",
  "maxHit": "Rd",
  "evasion": "Sl",
  "hitChance": "vd",
  "magic": "Ni",
  "style": "Nt",
  "attackTicks": "mk",
  "maxHp": "nt",
  "equipmentSlots": "Md",
  "masteries": "ll",
  "rooms": "Le",
  "foodBuff": "cG",
  "preferredBankFood": "Ju",
  "cropDuration": "rJ",
  "isCrop": "EI",
  "damageReduction": "XB",
  "brewScale": "Be",
  "combine": "Fa",
  "bosses": "DO",
  "bossStats": "X6",
  "bossWeakMultiplier": "_6",
  "bossOtherMultiplier": "Q6",
  "tickMs": "fo",
  "strength": "bL",
  "armour": "vL",
  "magicDefenceScale": "fk",
  "maxEnhancement": "Pt",
  "potions": "ZO",
  "recipes": "Wo",
  "translations": "UF",
  "worldTranslations": "nV",
  "uiTranslations": "U7",
  "homeTranslations": "T7",
  "houseBonus": "Gl",
  "houseDamageCap": "jW",
  "masteryRankLimit": "uB",
  "masteryRankCost": "ad",
  "masteryTotalCost": "fB",
  "masteriesTotalCost": "Si",
  "masteryEarnedPoints": "ml",
  "collectionPoints": "kW",
  "collectionItems": "Yi",
  "combatTick": "YL",
  "killMonster": "kL",
  "combatRarityMultiplier": "SL",
  "rarityThresholds": "Qn",
  "mountRarityThresholds": "Zn",
  "mountChance": "gE",
  "baseAttackTicks": "uh",
  "combatPetChance": "og",
  "combatPetItem": "fI",
  "isPet": "tt",
  "voidShardChance": "GL",
  "voidShardQuantity": "yL",
  "voidShardItemId": "Cn",
  "mountItemId": "ld",
  "abyssalGoldBonus": "Y0",
  "baseItemId": "bo",
  "itemTier": "Co",
  "coinItemId": "Sa",
  "hotSkill": "ob",
  "masteryOfflineBaseHours": "Zh",
  "predict": "zh",
  "offline": "F8",
  "tick": "OP",
  "world": "N",
  "startFight": "ur",
  "resetActivity": "Da",
  "depositPack": "Jj",
  "homeBank": "db",
  "combatTargetTile": "p9",
  "nearbyTile": "Ft",
  "predictionStartTick": "tv",
  "predictionChunkTicks": "u3",
  "allSkills": "se",
  "createContext": "_Y",
  "fullFoodLoad": "gl",
  "perks": "Yw",
  "hotXp": "pI",
  "hotRare": "wI",
  "tools": "IY",
  "tool": "Es",
  "toolLuck": "ow",
  "equipmentLuck": "Ei",
  "brewRarityMultiplier": "Pk",
  "houseRarityMultiplier": "wg",
  "masteryMultiplier": "Ma",
  "mountSpeed": "jk",
  "randomFloat": "IS",
  "canEnhance": "ys",
  "enhanceChance": "E0",
  "enhanceCost": "Hu",
  "enhanceXp": "EL",
  "enhanceTicks": "$s",
  "protectionMin": "Ct",
  "startWork": "Ys",
  "workChance": "Bj",
  "workModifiers": "Dj",
  "recipeInputs": "qe",
  "burnChance": "RE",
  "workXpMultiplier": "GG",
  "caughtChance": "Cj",
  "packCapacity": "Ga",
  "lootBoxItemId": "Xi",
  "nearestWorkSite": "yk",
  "armourMultiplier": "D0",
  "restock": "y9",
  "upgradeRecipes": "_s",
  "upgradeResult": "hr",
  "upgradeMaterials": "sb",
  "applyUpgrade": "a9",
  "recipeLevel": "TL",
  "windowModifiers": "Jl",
  "hotRarityMultiplier": "sw",
  "skillPet": "h0",
  "skillPetChance": "CS",
  "itemSupportsRarity": "Qg",
  "bonusMinimumUncommon": "Hg",
  "addPack": "Za",
  "enhancementTargetLimit": "PO",
  "enhanceMasteryMultiplier": "wk",
  "enhanceMasteryBonusCap": "aj",
  "recipeRarity": "qO",
  "recipeOutput": "Li",
  "collectionExcluded": "AW"
};
const selected=new Set(); const allowed=new Set(['WeakSet','WeakMap','Uint8Array','Uint16Array','Uint32Array','Int16Array','Int32Array','Float64Array','Math','Map','Set','Number','Object','Array','String','Error','Date','Boolean','Infinity','undefined','JSON','RegExp','parseInt','parseFloat']);
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
