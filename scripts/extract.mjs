import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-CZTesadh.js',retrieved:'2026-11-04',changelogVersion:'1.0.1211',sha256:'5b1234190b980ab6ad057b60429ea2c9cfde570e3d7f447ddbfe06dbf1a0f830'};
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
  "houseLevelLimit": "vP",
  "questDay": "rl",
  "questWeek": "XH",
  "monsters": "ns",
  "equipment": "Vx",
  "items": "cs",
  "marketCategories": "En",
  "marketFamilies": "mP",
  "marketFamily": "b1",
  "gear": "De",
  "item": "Fo",
  "canSell": "lv",
  "vendorPrice": "pe",
  "encode": "Wt",
  "withRarity": "Ac",
  "levelXp": "ht",
  "level": "Po",
  "maxLevel": "nd",
  "accuracy": "di",
  "maxHit": "el",
  "evasion": "li",
  "hitChance": "Td",
  "magic": "Gr",
  "style": "es",
  "attackTicks": "U2",
  "maxHp": "pt",
  "equipmentSlots": "tl",
  "masteries": "Md",
  "rooms": "ca",
  "foodBuff": "r1",
  "preferredBankFood": "bf",
  "cropDuration": "A3",
  "isCrop": "xq",
  "damageReduction": "N9",
  "brewScale": "Ze",
  "combine": "Ka",
  "bosses": "_O",
  "bossStats": "RL",
  "bossWeakMultiplier": "ML",
  "bossOtherMultiplier": "KL",
  "tickMs": "ho",
  "strength": "r7",
  "armour": "h7",
  "magicDefenceScale": "D2",
  "maxEnhancement": "Ft",
  "potions": "rf",
  "recipes": "jo",
  "translations": "Yj",
  "worldTranslations": "OZ",
  "uiTranslations": "nZ",
  "homeTranslations": "dZ",
  "houseBonus": "ni",
  "houseDamageCap": "HP",
  "masteryRankLimit": "dt",
  "masteryRankCost": "Ss",
  "masteryTotalCost": "VL",
  "masteriesTotalCost": "Il",
  "masteryEarnedPoints": "Fd",
  "collectionPoints": "rP",
  "collectionItems": "hr",
  "combatTick": "O7",
  "killMonster": "p7",
  "combatRarityMultiplier": "v7",
  "rarityThresholds": "yd",
  "mountRarityThresholds": "kd",
  "mountChance": "AX",
  "baseAttackTicks": "Qh",
  "combatPetChance": "cb",
  "combatPetItem": "Vj",
  "isPet": "bt",
  "voidShardChance": "g7",
  "voidShardQuantity": "b7",
  "voidShardItemId": "ld",
  "mountItemId": "Kd",
  "abyssalGoldBonus": "wH",
  "baseItemId": "fo",
  "itemTier": "Uo",
  "coinItemId": "za",
  "hotSkill": "cv",
  "masteryOfflineBaseHours": "ju",
  "predict": "wu",
  "offline": "TQ",
  "tick": "v$",
  "world": "$",
  "startFight": "Lr",
  "resetActivity": "Ca",
  "depositPack": "SI",
  "homeBank": "gv",
  "combatTargetTile": "OV",
  "nearbyTile": "zt",
  "predictionStartTick": "lp",
  "predictionChunkTicks": "MR",
  "allSkills": "re",
  "createContext": "l3",
  "fullFoodLoad": "_l",
  "perks": "WG",
  "hotXp": "Zj",
  "hotRare": "oq",
  "tools": "Tx",
  "tool": "js",
  "toolLuck": "lG",
  "equipmentLuck": "Kr",
  "brewRarityMultiplier": "m4",
  "houseRarityMultiplier": "Gb",
  "masteryMultiplier": "Da",
  "mountSpeed": "f4",
  "randomFloat": "l2",
  "canEnhance": "os",
  "enhanceChance": "O1",
  "enhanceCost": "mf",
  "enhanceXp": "C7",
  "enhanceTicks": "an",
  "protectionMin": "ot",
  "startWork": "qs",
  "workChance": "II",
  "workModifiers": "cY",
  "recipeInputs": "Ne",
  "burnChance": "IX",
  "workXpMultiplier": "x1",
  "caughtChance": "PI",
  "packCapacity": "Ma",
  "lootBoxItemId": "si",
  "nearestWorkSite": "Ab",
  "armourMultiplier": "jH",
  "restock": "AV",
  "upgradeRecipes": "$s",
  "upgradeResult": "il",
  "upgradeMaterials": "Tr",
  "recipeLevel": "I7",
  "windowModifiers": "mi",
  "hotRarityMultiplier": "fG",
  "skillPet": "cH",
  "skillPetChance": "b2",
  "itemSupportsRarity": "fi",
  "bonusMinimumUncommon": "Jb",
  "addPack": "ft",
  "enhancementTargetLimit": "LO",
  "enhanceMasteryMultiplier": "X2",
  "enhanceMasteryBonusCap": "UP",
  "recipeRarity": "Zb",
  "recipeOutput": "ai",
  "collectionExcluded": "hP",
  "startUpgrade": "sI",
  "upgradeSiteJob": "aI"
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
