import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-CIBqYo8K.js',retrieved:'2026-10-28',changelogVersion:'1.0.1204',sha256:'37840e4f3fd11aeb8ff7671fb24232e6b4020076bde0e6bbae426aa1938662af'};
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
  "questDay": "xd",
  "questWeek": "M0",
  "monsters": "qt",
  "equipment": "uY",
  "items": "ps",
  "marketFamilies": "UI",
  "marketFamily": "BO",
  "gear": "je",
  "item": "Jo",
  "canSell": "na",
  "vendorPrice": "fe",
  "encode": "ys",
  "withRarity": "xc",
  "levelXp": "Xa",
  "level": "Io",
  "maxLevel": "Fn",
  "accuracy": "gl",
  "maxHit": "kd",
  "evasion": "bl",
  "hitChance": "ud",
  "magic": "Ki",
  "style": "It",
  "attackTicks": "US",
  "maxHp": "tt",
  "equipmentSlots": "Hd",
  "masteries": "cl",
  "rooms": "Be",
  "foodBuff": "jO",
  "preferredBankFood": "vu",
  "cropDuration": "PY",
  "isCrop": "uI",
  "damageReduction": "i6",
  "brewScale": "$e",
  "combine": "Ma",
  "bosses": "AO",
  "bossStats": "iB",
  "bossWeakMultiplier": "rB",
  "bossOtherMultiplier": "hB",
  "tickMs": "ho",
  "strength": "xT",
  "armour": "RT",
  "magicDefenceScale": "BS",
  "maxEnhancement": "Ft",
  "potions": "IO",
  "potionDurationTicks": "Tm",
  "recipes": "Fo",
  "translations": "Vj",
  "worldTranslations": "m7",
  "uiTranslations": "Z8",
  "homeTranslations": "o7",
  "houseBonus": "ml",
  "houseDamageCap": "cW",
  "masteryRankLimit": "AB",
  "masteryRankCost": "Qn",
  "masteryTotalCost": "HB",
  "masteriesTotalCost": "bi",
  "masteryEarnedPoints": "dl",
  "collectionThresholds": "oh",
  "collectionPoints": "$I",
  "collectionItems": "Oi",
  "combatTick": "qT",
  "killMonster": "jT",
  "combatRarityMultiplier": "WT",
  "rarityThresholds": "Ln",
  "mountRarityThresholds": "En",
  "mountChance": "x9",
  "baseAttackTicks": "ah",
  "combatPetChance": "Nm",
  "combatPetItem": "KF",
  "isPet": "et",
  "voidShardChance": "FT",
  "voidShardQuantity": "IT",
  "voidShardItemId": "jn",
  "mountItemId": "ad",
  "abyssalGoldBonus": "a0",
  "baseItemId": "go",
  "itemTier": "qo",
  "coinItemId": "ya",
  "hotSkill": "Ng",
  "masteryOfflineBaseHours": "Ch",
  "predict": "yh",
  "offline": "EE",
  "tick": "jj",
  "world": "N",
  "startFight": "ar",
  "resetActivity": "Ca",
  "depositPack": "TW",
  "homeBank": "Ug",
  "combatTargetTile": "KL",
  "nearbyTile": "Rt",
  "predictionStartTick": "$b",
  "predictionChunkTicks": "NJ",
  "allSkills": "te",
  "createContext": "AY",
  "fullFoodLoad": "ll",
  "perks": "iw",
  "hotXp": "WF",
  "hotRare": "jF",
  "tools": "iY",
  "tool": "Cs",
  "toolLuck": "Wp",
  "equipmentLuck": "qi",
  "brewRarityMultiplier": "gk",
  "houseRarityMultiplier": "tg",
  "masteryMultiplier": "Ra",
  "mountSpeed": "mk",
  "randomFloat": "uS",
  "canEnhance": "vs",
  "enhanceChance": "k0",
  "enhanceCost": "mu",
  "enhanceXp": "dL",
  "enhanceTicks": "Fs",
  "protectionMin": "Pt",
  "startWork": "Ss",
  "workChance": "dj",
  "workModifiers": "nj",
  "recipeInputs": "Pe",
  "burnChance": "B9",
  "workXpMultiplier": "aG",
  "caughtChance": "sj",
  "packCapacity": "Oa",
  "lootBoxItemId": "$i",
  "nearestWorkSite": "ZS",
  "armourMultiplier": "w0",
  "restock": "IL",
  "upgradeRecipes": "Bs",
  "upgradeResult": "gu",
  "upgradeMaterials": "QO",
  "applyUpgrade": "bL",
  "recipeLevel": "sL",
  "windowModifiers": "Gl",
  "hotRarityMultiplier": "Cp",
  "skillPet": "CA",
  "skillPetChance": "wS",
  "itemSupportsRarity": "jg",
  "bonusMinimumUncommon": "hg",
  "addPack": "_a",
  "enhancementTargetLimit": "OO",
  "enhanceMasteryMultiplier": "XS",
  "enhanceMasteryBonusCap": "GW",
  "recipeRarity": "yO",
  "recipeOutput": "Ni",
  "collectionExcluded": "DI"
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
