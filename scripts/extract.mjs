import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={"sourceUrl":"https://deepveinidle.com/assets/index-szBaIgSm.js","retrieved":"2026-11-21","changelogVersion":"1.0.1221","sha256":"7fdb0dbe3a5aa0bda15768e45c55a5f064508b5259e1b6f44c0cb5e271b3272c"};
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
  "features": "Io",
  "skillOutfits": "Fd",
  "outfitXpBonus": "$_",
  "skillOffhandBonus": "sA",
  "houseLevelLimit": "zG",
  "questDay": "zd",
  "questWeek": "LB",
  "monsters": "Pn",
  "equipment": "ZE",
  "items": "li",
  "marketCategories": "lh",
  "marketFamilies": "eW",
  "marketFamily": "hA",
  "gear": "Ha",
  "item": "Xe",
  "canSell": "Pp",
  "vendorPrice": "na",
  "encode": "gi",
  "withRarity": "$o",
  "levelXp": "ca",
  "level": "Je",
  "maxLevel": "Sl",
  "accuracy": "gu",
  "maxHit": "Rd",
  "evasion": "bu",
  "hitChance": "Dd",
  "magic": "tp",
  "style": "Wn",
  "attackTicks": "YS",
  "maxHp": "jn",
  "equipmentSlots": "Ml",
  "masteries": "dd",
  "rooms": "Xt",
  "foodBuff": "SA",
  "preferredBankFood": "iw",
  "cropDuration": "qI",
  "isCrop": "Nz",
  "damageReduction": "upe",
  "brewScale": "_a",
  "warriorAccuracyBonus": "Lz",
  "warriorMaxHitBonus": "FW",
  "nourishHealingBonus": "MW",
  "hasteAttackSpeedBonus": "CW",
  "combine": "Za",
  "bosses": "Xb",
  "bossStats": "O_",
  "bossWeakMultiplier": "iue",
  "bossOtherMultiplier": "rue",
  "tickMs": "ue",
  "strength": "Dge",
  "armour": "Mge",
  "magicDefenceScale": "L4",
  "maxEnhancement": "vr",
  "potions": "Qb",
  "recipes": "Ve",
  "translations": "t_",
  "worldTranslations": "w3e",
  "uiTranslations": "e3e",
  "homeTranslations": "o3e",
  "houseBonus": "Bd",
  "houseDamageCap": "LV",
  "masteryRankLimit": "Sn",
  "masteryRankCost": "mr",
  "masteryTotalCost": "xfe",
  "masteriesTotalCost": "Wc",
  "masteryEarnedPoints": "Af",
  "collectionPoints": "AV",
  "collectionItems": "Tf",
  "combatTick": "Ege",
  "killMonster": "Bge",
  "combatRarityMultiplier": "Wge",
  "rarityThresholds": "Vh",
  "mountRarityThresholds": "zl",
  "mountChance": "$0e",
  "baseAttackTicks": "fg",
  "combatPetChance": "ak",
  "combatPetItem": "cz",
  "isPet": "kn",
  "voidShardChance": "Tge",
  "voidShardQuantity": "qge",
  "voidShardItemId": "Wr",
  "mountItemId": "md",
  "abyssalGoldBonus": "TW",
  "baseItemId": "re",
  "itemTier": "eo",
  "coinItemId": "Da",
  "hotSkill": "yv",
  "masteryOfflineBaseHours": "fb",
  "predict": "Eg",
  "offline": "IS",
  "tick": "nee",
  "world": "P",
  "startFight": "Vp",
  "resetActivity": "ta",
  "depositPack": "XB",
  "homeBank": "rw",
  "combatTargetTile": "fye",
  "nearbyTile": "xs",
  "predictionStartTick": "wg",
  "predictionChunkTicks": "l8",
  "allSkills": "Bt",
  "createContext": "wI",
  "fullFoodLoad": "eu",
  "perks": "wS",
  "hotXp": "mz",
  "hotRare": "gz",
  "tools": "XE",
  "tool": "Os",
  "toolLuck": "uu",
  "equipmentLuck": "gp",
  "brewRarityMultiplier": "VB",
  "houseRarityMultiplier": "Av",
  "masteryMultiplier": "Ma",
  "mountSpeed": "WS",
  "randomFloat": "J$",
  "canEnhance": "hi",
  "enhanceChance": "yb",
  "enhanceCost": "Op",
  "enhanceXp": "sbe",
  "enhanceTicks": "qi",
  "protectionMin": "rs",
  "startWork": "Bn",
  "workChance": "CJ",
  "workModifiers": "a3",
  "recipeInputs": "ba",
  "burnChance": "DJ",
  "workXpMultiplier": "Jp",
  "caughtChance": "MJ",
  "packCapacity": "ma",
  "lootBoxItemId": "mu",
  "nearestWorkSite": "xl",
  "armourMultiplier": "oB",
  "restock": "bye",
  "upgradeRecipes": "Un",
  "upgradeResult": "_d",
  "upgradeMaterials": "Xp",
  "recipeLevel": "dQ",
  "windowModifiers": "Ir",
  "hotRarityMultiplier": "mA",
  "skillPet": "fW",
  "skillPetChance": "g4",
  "itemSupportsRarity": "Nd",
  "bonusMinimumUncommon": "Cb",
  "addPack": "Ys",
  "enhancementTargetLimit": "Dr",
  "enhanceMasteryMultiplier": "fQ",
  "enhanceMasteryBonusCap": "iB",
  "recipeRarity": "Ep",
  "recipeOutput": "du",
  "collectionExcluded": "MV",
  "startUpgrade": "LZ",
  "upgradeSiteJob": "FB",
  "upgradeWorkTicks": "Tv"
};
// Skilling bosses and work-time use this same declaration closure and snapshot.
const bossFeedRules={
  rawBosses:'ke', rooms:'J_', makePlayer:'Uye', pointsBase:'tk', markMultiplier:'lb',
  outfitContribution:'Rce', chestThreshold:'Sh', feedXp:'rZ', feedRecipe:'Up',
  feedUsesFarmingSpeed:'Xue', productionXp:'oke', equippedSkillTool:'BS',
  materialSavingSkill:'E0e', swiftSpeedBonus:'DW',
  item:exportsMap.item, itemList:exportsMap.items, gear:exportsMap.gear, tool:exportsMap.tool,
  decodeBase:exportsMap.baseItemId, tier:exportsMap.itemTier, withRarity:exportsMap.withRarity,
  encode:exportsMap.encode, level:exportsMap.level, levelXp:exportsMap.levelXp,
  workSpeed:exportsMap.workModifiers, inventoryCapacity:exportsMap.packCapacity,
  mountStride:exportsMap.mountSpeed, brewStrength:exportsMap.brewScale,
  masteryMultiplier:exportsMap.masteryMultiplier, sideSkillBonus:exportsMap.skillOffhandBonus,
  workXpMultiplier:exportsMap.workXpMultiplier, perkList:exportsMap.perks, maxLevel:exportsMap.maxLevel,
  maxEnhancement:exportsMap.maxEnhancement, masteryRankLimit:exportsMap.masteryRankLimit,
  houseLevelLimit:exportsMap.houseLevelLimit, canEnhance:exportsMap.canEnhance,
};
const bossWorkTimeGame={
  tickMs:exportsMap.tickMs, recipes:exportsMap.recipes, upgradeRecipes:exportsMap.upgradeRecipes,
  items:exportsMap.items, item:exportsMap.item, recipeInputs:exportsMap.recipeInputs,
  recipeOutput:exportsMap.recipeOutput, itemSupportsRarity:exportsMap.itemSupportsRarity,
  rarityThresholds:exportsMap.rarityThresholds, hotRarityMultiplier:exportsMap.hotRarityMultiplier,
  world:exportsMap.world, siteEntrance:exportsMap.nearbyTile, walkPath:'ik',
  withRarity:exportsMap.withRarity, baseItemId:exportsMap.baseItemId, itemTier:exportsMap.itemTier,
  upgradeMaterials:exportsMap.upgradeMaterials, upgradeResult:exportsMap.upgradeResult,
  levelSpeedCoefficient:'_le', upgradeBaseTicks:'$B', bonusMinimumUncommon:exportsMap.bonusMinimumUncommon,
  bosses:bossFeedRules.rawBosses, bossUnlockLevel:'Br', bossFeedRecipe:bossFeedRules.feedRecipe,
  bossFeedParts:'hz', bossUsesFarmingSpeed:bossFeedRules.feedUsesFarmingSpeed,
  bossHeartLayout:'ct', bossKrakenLayout:'Ra', bossColonyLayout:'rr', bossBlightLayout:'Xa', bossSiegeLayout:'sn',
};
const exportGroups={bossFeedRules,bossWorkTimeGame};
const selected=new Set(); const allowed=new Set(['WeakSet','WeakMap','Uint8Array','Uint16Array','Uint32Array','Int16Array','Int32Array','Float64Array','Math','Map','Set','Number','Object','Array','String','Error','Date','Boolean','Infinity','undefined','JSON','RegExp','parseInt','parseFloat']);
function collect(name){
 const d=declarations.get(name);if(!d)throw Error('Missing declaration '+name);if(selected.has(d))return;selected.add(d);
 const a=parse(d.text,{ecmaVersion:'latest',sourceType:'module',ranges:true});
 const refs=analyze(a,{ecmaVersion:2024,sourceType:'module'}).globalScope.through.map(r=>r.identifier.name);
 for(const dep of new Set(refs))if(declarations.has(dep))collect(dep);else if(!allowed.has(dep))throw Error(`Unexpected external dependency ${dep} in ${name}`);
}
Object.values(exportsMap).forEach(collect);
for(const group of Object.values(exportGroups))Object.values(group).forEach(collect);
const ordered=[...selected].sort((a,b)=>a.start-b.start);
const workTimeSource={sourceVersion:sourceInfo.changelogVersion,sourceUrl:sourceInfo.sourceUrl,sha256:sourceInfo.sha256};
const groupedCode=Object.entries(exportGroups).map(([name,group])=>{
 const members=Object.entries(group).map(([key,symbol])=>`  ${key}: ${symbol}`);
 if(name==='bossWorkTimeGame')members.push(`  source: Object.freeze(${JSON.stringify(workTimeSource)})`);
 return `export const ${name} = Object.freeze({\n${members.join(',\n')}\n});\n`;
}).join('');
fs.mkdirSync('src',{recursive:true});
fs.writeFileSync('src/upstream.js','// GENERATED from reviewed vendor snapshots. Do not edit.\n'+ordered.map(d=>d.text).join('\n')+'\nexport { '+Object.entries(exportsMap).map(([alias,name])=>`${name} as ${alias}`).join(', ')+' };\n'+groupedCode);
fs.writeFileSync('vendor/manifest.json',JSON.stringify({...sourceInfo,exports:exportsMap,exportGroups,declarations:ordered.map(({name,start,end,text})=>({name,start,end,sha256:hash(text)})),overrides:[]},null,2));
console.log(`Extracted ${ordered.length} original declarations (${fs.statSync('src/upstream.js').size} bytes).`);
