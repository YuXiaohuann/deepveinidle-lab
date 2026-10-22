import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-CX4ETV_k.js',retrieved:'2026-10-22',changelogVersion:'1.0.1198',sha256:'1254dd60c7ad5eabd246b401fb0953da31dd493bec72ac9bcdd44519c26936cc'};
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
  "questDay": "en",
  "questWeek": "p2",
  "monsters": "At",
  "equipment": "CH",
  "items": "cs",
  "marketFamilies": "XK",
  "marketFamily": "EO",
  "gear": "ke",
  "item": "Ho",
  "canSell": "De",
  "vendorPrice": "ce",
  "encode": "as",
  "withRarity": "xc",
  "levelXp": "tt",
  "level": "$o",
  "maxLevel": "nd",
  "accuracy": "Tn",
  "maxHit": "_d",
  "evasion": "qn",
  "hitChance": "Cd",
  "magic": "ei",
  "style": "St",
  "attackTicks": "Ty",
  "maxHp": "La",
  "equipmentSlots": "Zd",
  "masteries": "An",
  "rooms": "_e",
  "foodBuff": "qO",
  "preferredBankFood": "xh",
  "cropDuration": "nY",
  "isCrop": "yK",
  "damageReduction": "IT",
  "brewScale": "ze",
  "combine": "ga",
  "bosses": "Ak",
  "bossStats": "Ij",
  "bossWeakMultiplier": "Nj",
  "bossOtherMultiplier": "Bj",
  "tickMs": "uo",
  "strength": "nI",
  "armour": "lI",
  "magicDefenceScale": "jy",
  "maxEnhancement": "yt",
  "potions": "jO",
  "potionDurationTicks": "af",
  "recipes": "xo",
  "translations": "fL",
  "worldTranslations": "ML",
  "uiTranslations": "bL",
  "homeTranslations": "gL",
  "houseBonus": "gi",
  "houseDamageCap": "dW",
  "masteryRankLimit": "oT",
  "masteryRankCost": "Yd",
  "masteryTotalCost": "cT",
  "masteriesTotalCost": "Tl",
  "masteryEarnedPoints": "Wn",
  "collectionThresholds": "Rr",
  "collectionPoints": "VK",
  "collectionItems": "Nl",
  "combatTick": "vI",
  "killMonster": "bI",
  "combatRarityMultiplier": "fI",
  "rarityThresholds": "yd",
  "mountRarityThresholds": "Sd",
  "mountChance": "oB",
  "baseAttackTicks": "zr",
  "combatPetChance": "of",
  "combatPetItem": "rK",
  "isPet": "Na",
  "voidShardChance": "uI",
  "voidShardQuantity": "mI",
  "voidShardItemId": "id",
  "mountItemId": "Fd",
  "abyssalGoldBonus": "Lk",
  "baseItemId": "fo",
  "itemTier": "jo",
  "coinItemId": "pa",
  "hotSkill": "_f",
  "masteryOfflineBaseHours": "nh",
  "predict": "Vr",
  "offline": "m7",
  "tick": "MP",
  "world": "j",
  "startFight": "Fi",
  "resetActivity": "Da",
  "depositPack": "JW",
  "homeBank": "lG",
  "combatTargetTile": "sN",
  "nearbyTile": "pt",
  "predictionStartTick": "Xb",
  "predictionChunkTicks": "sA",
  "allSkills": "Vc",
  "createContext": "XH",
  "fullFoodLoad": "Pn",
  "perks": "uv",
  "hotXp": "Tx",
  "hotRare": "qx",
  "tools": "WH",
  "tool": "Os",
  "toolLuck": "ry",
  "equipmentLuck": "ui",
  "brewRarityMultiplier": "hS",
  "houseRarityMultiplier": "bf",
  "masteryMultiplier": "fa",
  "mountSpeed": "rS",
  "randomFloat": "ly",
  "canEnhance": "os",
  "enhanceChance": "i2",
  "enhanceCost": "Mh",
  "enhanceXp": "$I",
  "enhanceTicks": "od",
  "protectionMin": "Ht",
  "startWork": "Gs",
  "workChance": "lP",
  "workModifiers": "nP",
  "recipeInputs": "He",
  "burnChance": "mB",
  "workXpMultiplier": "iG",
  "caughtChance": "dP",
  "packCapacity": "ma",
  "lootBoxItemId": "bi",
  "nearestWorkSite": "WW",
  "armourMultiplier": "s2",
  "restock": "iN",
  "upgradeRecipes": "hd",
  "upgradeResult": "zh",
  "upgradeMaterials": "aG",
  "applyUpgrade": "BI",
  "recipeLevel": "WI",
  "windowModifiers": "Bn",
  "hotRarityMultiplier": "Np",
  "skillPet": "uK",
  "skillPetChance": "yy",
  "itemSupportsRarity": "Ef",
  "bonusMinimumUncommon": "kf",
  "addPack": "ja",
  "enhancementTargetLimit": "YO",
  "enhanceMasteryMultiplier": "Vy",
  "enhanceMasteryBonusCap": "HW",
  "recipeRarity": "RO",
  "recipeOutput": "hi",
  "collectionExcluded": "JK"
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
