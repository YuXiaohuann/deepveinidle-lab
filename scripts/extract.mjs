import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-mrevWXcW.js',retrieved:'2026-10-30',changelogVersion:'1.0.1208',sha256:'654fd8927fcd1015d0a2ca09503340501862048ed8ed97ff02c4201fb8f4d746'};
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
  "houseLevelLimit": "DW",
  "questDay": "Vd",
  "questWeek": "E2",
  "monsters": "Xt",
  "equipment": "IJ",
  "items": "Js",
  "marketCategories": "Wn",
  "marketFamilies": "$W",
  "marketFamily": "IG",
  "gear": "We",
  "item": "Fo",
  "canSell": "ga",
  "vendorPrice": "he",
  "encode": "Ks",
  "withRarity": "xc",
  "levelXp": "at",
  "level": "Po",
  "maxLevel": "Xn",
  "accuracy": "ql",
  "maxHit": "Dd",
  "evasion": "$l",
  "hitChance": "Md",
  "magic": "ar",
  "style": "Ut",
  "attackTicks": "Zk",
  "maxHp": "ht",
  "equipmentSlots": "Td",
  "masteries": "wd",
  "rooms": "Xe",
  "foodBuff": "xG",
  "preferredBankFood": "Xu",
  "cropDuration": "dx",
  "isCrop": "lW",
  "damageReduction": "HT",
  "brewScale": "Ee",
  "combine": "Na",
  "bosses": "vG",
  "bossStats": "AU",
  "bossWeakMultiplier": "HU",
  "bossOtherMultiplier": "YU",
  "tickMs": "ho",
  "strength": "V9",
  "armour": "X9",
  "magicDefenceScale": "Qk",
  "maxEnhancement": "Dt",
  "potions": "YG",
  "recipes": "Wo",
  "translations": "nj",
  "worldTranslations": "CX",
  "uiTranslations": "YX",
  "homeTranslations": "JX",
  "houseBonus": "Nl",
  "houseDamageCap": "ZW",
  "masteryRankLimit": "ct",
  "masteryRankCost": "bs",
  "masteryTotalCost": "BU",
  "masteriesTotalCost": "yl",
  "masteryEarnedPoints": "yd",
  "collectionPoints": "PW",
  "collectionItems": "Ui",
  "combatTick": "nE",
  "killMonster": "aE",
  "combatRarityMultiplier": "eE",
  "rarityThresholds": "rd",
  "mountRarityThresholds": "hd",
  "mountChance": "_8",
  "baseAttackTicks": "Mh",
  "combatPetChance": "Sg",
  "combatPetItem": "Jj",
  "isPet": "it",
  "voidShardChance": "oE",
  "voidShardQuantity": "cE",
  "voidShardItemId": "Qn",
  "mountItemId": "Od",
  "abyssalGoldBonus": "v2",
  "baseItemId": "go",
  "itemTier": "Do",
  "coinItemId": "Ya",
  "hotSkill": "Ab",
  "masteryOfflineBaseHours": "Ou",
  "predict": "ou",
  "offline": "bV",
  "tick": "jN",
  "world": "q",
  "startFight": "Kr",
  "resetActivity": "Ia",
  "depositPack": "BP",
  "homeBank": "Ib",
  "combatTargetTile": "_E",
  "nearbyTile": "qt",
  "predictionStartTick": "Rv",
  "predictionChunkTicks": "h3",
  "allSkills": "te",
  "createContext": "EJ",
  "fullFoodLoad": "zl",
  "perks": "tO",
  "hotXp": "zj",
  "hotRare": "Fj",
  "tools": "MJ",
  "tool": "Ms",
  "toolLuck": "Kw",
  "equipmentLuck": "fr",
  "brewRarityMultiplier": "S4",
  "houseRarityMultiplier": "Cg",
  "masteryMultiplier": "Wa",
  "mountSpeed": "y4",
  "randomFloat": "pk",
  "canEnhance": "Ys",
  "enhanceChance": "N2",
  "enhanceCost": "Eu",
  "enhanceXp": "YE",
  "enhanceTicks": "Ts",
  "protectionMin": "Et",
  "startWork": "zs",
  "workChance": "sN",
  "workModifiers": "tN",
  "recipeInputs": "Be",
  "burnChance": "u7",
  "workXpMultiplier": "TG",
  "caughtChance": "aN",
  "packCapacity": "Ha",
  "lootBoxItemId": "gr",
  "nearestWorkSite": "d4",
  "armourMultiplier": "F2",
  "restock": "c8",
  "upgradeRecipes": "cn",
  "upgradeResult": "Rr",
  "upgradeMaterials": "Mb",
  "applyUpgrade": "jE",
  "recipeLevel": "AE",
  "windowModifiers": "Ll",
  "hotRarityMultiplier": "jw",
  "skillPet": "o2",
  "skillPetChance": "Ak",
  "itemSupportsRarity": "Sb",
  "bonusMinimumUncommon": "Vg",
  "addPack": "tt",
  "enhancementTargetLimit": "uG",
  "enhanceMasteryMultiplier": "t4",
  "enhanceMasteryBonusCap": "pP",
  "recipeRarity": "mG",
  "recipeOutput": "ur",
  "collectionExcluded": "NW"
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
