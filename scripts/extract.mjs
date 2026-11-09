import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={"sourceUrl":"https://deepveinidle.com/assets/index-B2g2JEXj.js","retrieved":"2026-11-09","changelogVersion":"1.0.1214","sha256":"cb67b9c88201f9768b3ec90ffdbeb0ccf7d33b897649c019f13b95c6f0785dc5"};
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
  "features": "Wc",
  "skillOutfits": "Wh",
  "outfitXpBonus": "t8",
  "skillOffhandBonus": "p4",
  "houseLevelLimit": "i2",
  "questDay": "yr",
  "questWeek": "PF",
  "monsters": "ps",
  "equipment": "C$",
  "items": "Ws",
  "marketCategories": "Dd",
  "marketFamilies": "eK",
  "marketFamily": "O4",
  "gear": "ga",
  "item": "Do",
  "canSell": "bw",
  "vendorPrice": "Xe",
  "encode": "Ts",
  "withRarity": "Jc",
  "levelXp": "ht",
  "level": "Xo",
  "maxLevel": "Zi",
  "accuracy": "$h",
  "maxHit": "mr",
  "evasion": "Uh",
  "hitChance": "ar",
  "magic": "kf",
  "style": "Ps",
  "attackTicks": "j2",
  "maxHp": "Gs",
  "equipmentSlots": "gr",
  "masteries": "Wl",
  "rooms": "Ca",
  "foodBuff": "W4",
  "preferredBankFood": "Yw",
  "cropDuration": "uU",
  "isCrop": "pV",
  "damageReduction": "Jgo",
  "brewScale": "ja",
  "combine": "Qa",
  "bosses": "CO",
  "bossStats": "v8",
  "bossWeakMultiplier": "qmo",
  "bossOtherMultiplier": "Cmo",
  "tickMs": "uo",
  "strength": "$po",
  "armour": "Upo",
  "magicDefenceScale": "cM",
  "maxEnhancement": "Fs",
  "potions": "vw",
  "recipes": "Qo",
  "translations": "z7",
  "worldTranslations": "O2o",
  "uiTranslations": "a2o",
  "homeTranslations": "t2o",
  "houseBonus": "ur",
  "houseDamageCap": "fQ",
  "masteryRankLimit": "ls",
  "masteryRankCost": "En",
  "masteryTotalCost": "Nbo",
  "masteriesTotalCost": "sh",
  "masteryEarnedPoints": "Nl",
  "collectionPoints": "ZV",
  "collectionItems": "ef",
  "combatTick": "_po",
  "killMonster": "Vpo",
  "combatRarityMultiplier": "Epo",
  "rarityThresholds": "yl",
  "mountRarityThresholds": "Sl",
  "mountChance": "Lko",
  "baseAttackTicks": "qb",
  "combatPetChance": "v1",
  "combatPetItem": "W8",
  "isPet": "es",
  "voidShardChance": "Tpo",
  "voidShardQuantity": "Lpo",
  "voidShardItemId": "ud",
  "mountItemId": "$l",
  "abyssalGoldBonus": "FK",
  "baseItemId": "no",
  "itemTier": "_o",
  "coinItemId": "mt",
  "hotSkill": "KO",
  "masteryOfflineBaseHours": "Fg",
  "predict": "tg",
  "offline": "oA",
  "tick": "yZ",
  "world": "U",
  "startFight": "um",
  "resetActivity": "ma",
  "depositPack": "NF",
  "homeBank": "Jw",
  "combatTargetTile": "COo",
  "nearbyTile": "Ht",
  "predictionStartTick": "Pb",
  "predictionChunkTicks": "UN",
  "allSkills": "Ie",
  "createContext": "Q$",
  "fullFoodLoad": "Hh",
  "perks": "z2",
  "hotXp": "U8",
  "hotRare": "N8",
  "tools": "J$",
  "tool": "zt",
  "toolLuck": "JO",
  "equipmentLuck": "Rg",
  "brewRarityMultiplier": "B_",
  "houseRarityMultiplier": "T4",
  "masteryMultiplier": "za",
  "mountSpeed": "IM",
  "randomFloat": "bJ",
  "canEnhance": "wn",
  "enhanceChance": "Ug",
  "enhanceCost": "im",
  "enhanceXp": "pvo",
  "enhanceTicks": "un",
  "protectionMin": "Xa",
  "startWork": "On",
  "workChance": "T_",
  "workModifiers": "fH",
  "recipeInputs": "wa",
  "burnChance": "myo",
  "workXpMultiplier": "fm",
  "caughtChance": "D_",
  "packCapacity": "Sa",
  "lootBoxItemId": "Ih",
  "nearestWorkSite": "tr",
  "armourMultiplier": "tF",
  "restock": "WOo",
  "upgradeRecipes": "vs",
  "upgradeResult": "kr",
  "upgradeMaterials": "lm",
  "recipeLevel": "KQ",
  "windowModifiers": "ai",
  "hotRarityMultiplier": "pK",
  "skillPet": "bK",
  "skillPetChance": "RJ",
  "itemSupportsRarity": "Xh",
  "bonusMinimumUncommon": "cO",
  "addPack": "ut",
  "enhancementTargetLimit": "HO",
  "enhanceMasteryMultiplier": "PQ",
  "enhanceMasteryBonusCap": "lF",
  "recipeRarity": "uw",
  "recipeOutput": "Kh",
  "collectionExcluded": "cQ",
  "startUpgrade": "t_",
  "upgradeSiteJob": "qF",
  "upgradeWorkTicks": "EO"
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
