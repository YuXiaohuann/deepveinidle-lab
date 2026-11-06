import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={"sourceUrl":"https://deepveinidle.com/assets/index-BqokRC4i.js","retrieved":"2026-11-06","changelogVersion":"1.0.1212","sha256":"13f144ed0a9a34f3f844e4f1c5b490a34590d37a57775522cceecf2c9716d932"};
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
  "features": "Fc",
  "skillOutfits": "xh",
  "outfitXpBonus": "QE",
  "skillOffhandBonus": "QA",
  "houseLevelLimit": "U0",
  "questDay": "vr",
  "questWeek": "TF",
  "monsters": "bs",
  "equipment": "KI",
  "items": "Fs",
  "marketCategories": "Ud",
  "marketFamilies": "mK",
  "marketFamily": "ZA",
  "gear": "ma",
  "item": "Bo",
  "canSell": "rw",
  "vendorPrice": "Ee",
  "encode": "js",
  "withRarity": "Yc",
  "levelXp": "rt",
  "level": "Qo",
  "maxLevel": "Qi",
  "accuracy": "Ch",
  "maxHit": "rr",
  "evasion": "qh",
  "hitChance": "or",
  "magic": "mf",
  "style": "zs",
  "attackTicks": "v2",
  "maxHp": "ps",
  "equipmentSlots": "ur",
  "masteries": "Fl",
  "rooms": "Ma",
  "foodBuff": "g4",
  "preferredBankFood": "yw",
  "cropDuration": "uU",
  "isCrop": "r8",
  "damageReduction": "lgo",
  "brewScale": "Pa",
  "combine": "Va",
  "bosses": "wO",
  "bossStats": "h7",
  "bossWeakMultiplier": "ffo",
  "bossOtherMultiplier": "mfo",
  "tickMs": "ho",
  "strength": "ywo",
  "armour": "kwo",
  "magicDefenceScale": "JJ",
  "maxEnhancement": "Ks",
  "potions": "mw",
  "recipes": "Vo",
  "translations": "AE",
  "worldTranslations": "TSo",
  "uiTranslations": "xSo",
  "homeTranslations": "RSo",
  "houseBonus": "ir",
  "houseDamageCap": "sV",
  "masteryRankLimit": "ds",
  "masteryRankCost": "Bn",
  "masteryTotalCost": "ymo",
  "masteriesTotalCost": "oh",
  "masteryEarnedPoints": "Ul",
  "collectionPoints": "B8",
  "collectionItems": "Lu",
  "combatTick": "qwo",
  "killMonster": "Jwo",
  "combatRarityMultiplier": "Rwo",
  "rarityThresholds": "Gl",
  "mountRarityThresholds": "Ol",
  "mountChance": "AOo",
  "baseAttackTicks": "Ag",
  "combatPetChance": "i1",
  "combatPetItem": "R7",
  "isPet": "os",
  "voidShardChance": "Ywo",
  "voidShardQuantity": "xwo",
  "voidShardItemId": "rd",
  "mountItemId": "Nl",
  "abyssalGoldBonus": "EK",
  "baseItemId": "to",
  "itemTier": "Xo",
  "coinItemId": "ft",
  "hotSkill": "vO",
  "masteryOfflineBaseHours": "xb",
  "predict": "Qg",
  "offline": "K2",
  "tick": "g_",
  "world": "U",
  "startFight": "tm",
  "resetActivity": "ya",
  "depositPack": "XF",
  "homeBank": "Sw",
  "combatTargetTile": "g1o",
  "nearbyTile": "Ht",
  "predictionStartTick": "Mg",
  "predictionChunkTicks": "I$",
  "allSkills": "$e",
  "createContext": "QI",
  "fullFoodLoad": "wh",
  "perks": "f2",
  "hotXp": "K7",
  "hotRare": "F7",
  "tools": "MI",
  "tool": "Kt",
  "toolLuck": "mO",
  "equipmentLuck": "Ob",
  "brewRarityMultiplier": "WX",
  "houseRarityMultiplier": "S4",
  "masteryMultiplier": "Ca",
  "mountSpeed": "mM",
  "randomFloat": "B3",
  "canEnhance": "mn",
  "enhanceChance": "Kb",
  "enhanceCost": "Zf",
  "enhanceXp": "Zwo",
  "enhanceTicks": "dn",
  "protectionMin": "Qa",
  "startWork": "ud",
  "workChance": "PX",
  "workModifiers": "D4",
  "recipeInputs": "ga",
  "burnChance": "TOo",
  "workXpMultiplier": "nm",
  "caughtChance": "zX",
  "packCapacity": "ka",
  "lootBoxItemId": "Mh",
  "nearestWorkSite": "cr",
  "armourMultiplier": "gF",
  "restock": "v1o",
  "upgradeRecipes": "ws",
  "upgradeResult": "pr",
  "upgradeMaterials": "om",
  "recipeLevel": "YV",
  "windowModifiers": "ci",
  "hotRarityMultiplier": "JK",
  "skillPet": "YK",
  "skillPetChance": "sJ",
  "itemSupportsRarity": "$h",
  "bonusMinimumUncommon": "N1",
  "addPack": "ht",
  "enhancementTargetLimit": "rO",
  "enhanceMasteryMultiplier": "JV",
  "enhanceMasteryBonusCap": "GF",
  "recipeRarity": "nw",
  "recipeOutput": "Hh",
  "collectionExcluded": "L8",
  "startUpgrade": "QQ",
  "upgradeSiteJob": "IF"
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
