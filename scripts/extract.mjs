import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-YnNRJ6iz.js',retrieved:'2026-10-18',changelogVersion:'1.0.1194',sha256:'57d413ec5e27336ba1925db7f7bf1a988524df7985535bbd58d5680559f50158'};
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
  "questDay": "Tn",
  "questWeek": "HF",
  "monsters": "Ot",
  "equipment": "_2",
  "items": "Ut",
  "marketFamilies": "Wz",
  "marketFamily": "G1",
  "gear": "Jc",
  "item": "Ho",
  "canSell": "Da",
  "vendorPrice": "Zc",
  "encode": "ls",
  "withRarity": "Wc",
  "levelXp": "ct",
  "level": "Do",
  "maxLevel": "Qs",
  "accuracy": "Kn",
  "maxHit": "jd",
  "evasion": "Cn",
  "hitChance": "Rd",
  "magic": "Ui",
  "style": "vt",
  "attackTicks": "mO",
  "maxHp": "je",
  "equipmentSlots": "Id",
  "masteries": "bn",
  "rooms": "Ta",
  "foodBuff": "p1",
  "preferredBankFood": "nh",
  "cropDuration": "O0",
  "isCrop": "iz",
  "damageReduction": "J$",
  "brewScale": "xa",
  "combine": "pe",
  "bosses": "U4",
  "bossStats": "VP",
  "bossWeakMultiplier": "XP",
  "bossOtherMultiplier": "_P",
  "tickMs": "ro",
  "strength": "lq",
  "armour": "rq",
  "magicDefenceScale": "uO",
  "maxEnhancement": "wt",
  "potions": "b1",
  "potionDurationTicks": "nS",
  "recipes": "zo",
  "translations": "uB",
  "worldTranslations": "AB",
  "uiTranslations": "mB",
  "homeTranslations": "fB",
  "houseBonus": "Fn",
  "houseDamageCap": "Nz",
  "masteryRankLimit": "d$",
  "masteryRankCost": "gd",
  "masteryTotalCost": "n$",
  "masteriesTotalCost": "zi",
  "masteryEarnedPoints": "Gn",
  "collectionThresholds": "tr",
  "collectionPoints": "Kz",
  "collectionItems": "Zl",
  "combatTick": "yq",
  "killMonster": "pq",
  "combatRarityMultiplier": "gq",
  "rarityThresholds": "ud",
  "mountRarityThresholds": "md",
  "mountChance": "cI",
  "baseAttackTicks": "dr",
  "combatPetChance": "Om",
  "combatPetItem": "XY",
  "isPet": "$e",
  "voidShardChance": "fq",
  "voidShardQuantity": "bq",
  "voidShardItemId": "$d",
  "mountItemId": "Od",
  "abyssalGoldBonus": "rS",
  "baseItemId": "bo",
  "itemTier": "jo",
  "coinItemId": "Re",
  "hotSkill": "hf",
  "masteryOfflineBaseHours": "Wr",
  "predict": "Sr",
  "offline": "l7",
  "tick": "uK",
  "world": "D",
  "startFight": "hl",
  "resetActivity": "ce",
  "depositPack": "DF",
  "homeBank": "TS",
  "combatTargetTile": "s9",
  "nearbyTile": "bt",
  "predictionStartTick": "u7",
  "predictionChunkTicks": "vH",
  "allSkills": "Bc",
  "createContext": "r0",
  "fullFoodLoad": "Sn",
  "perks": "cp",
  "hotXp": "RY",
  "hotRare": "MY",
  "tools": "J2",
  "tool": "rs",
  "toolLuck": "Wy",
  "equipmentLuck": "Xi",
  "brewRarityMultiplier": "$O",
  "houseRarityMultiplier": "Cm",
  "masteryMultiplier": "be",
  "mountSpeed": "PO",
  "randomFloat": "Fy",
  "canEnhance": "Bt",
  "enhanceChance": "uF",
  "enhanceCost": "pf",
  "enhanceXp": "Pq",
  "enhanceTicks": "Ns",
  "protectionMin": "Nt",
  "startWork": "od",
  "workChance": "XF",
  "workModifiers": "VF",
  "recipeInputs": "za",
  "burnChance": "fI",
  "workXpMultiplier": "K1",
  "caughtChance": "JF",
  "packCapacity": "fe",
  "lootBoxItemId": "Qi",
  "nearestWorkSite": "GF",
  "armourMultiplier": "SS",
  "restock": "l9",
  "upgradeRecipes": "Ud",
  "upgradeResult": "sh",
  "upgradeMaterials": "M1",
  "applyUpgrade": "Nq",
  "recipeLevel": "Wq",
  "windowModifiers": "Pn",
  "hotRarityMultiplier": "Cg",
  "skillPet": "QY",
  "skillPetChance": "Ey",
  "itemSupportsRarity": "lf",
  "bonusMinimumUncommon": "gp",
  "addPack": "De",
  "enhancementTargetLimit": "e1",
  "enhanceMasteryMultiplier": "wO",
  "enhanceMasteryBonusCap": "mF"
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
