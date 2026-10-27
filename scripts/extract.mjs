import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-vJFGxo7G.js',retrieved:'2026-10-27',changelogVersion:'1.0.1203',sha256:'4fda6390ffba7e98bb7149f99cce4322a1f2e8338be70f34a28e405977a3caf1'};
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
  "questWeek": "M2",
  "monsters": "qt",
  "equipment": "uY",
  "items": "ps",
  "marketFamilies": "DI",
  "marketFamily": "BO",
  "gear": "Pe",
  "item": "Jo",
  "canSell": "na",
  "vendorPrice": "fe",
  "encode": "ys",
  "withRarity": "xc",
  "levelXp": "Xa",
  "level": "Io",
  "maxLevel": "zn",
  "accuracy": "gl",
  "maxHit": "kd",
  "evasion": "bl",
  "hitChance": "hd",
  "magic": "xi",
  "style": "It",
  "attackTicks": "US",
  "maxHp": "tt",
  "equipmentSlots": "Hd",
  "masteries": "cl",
  "rooms": "Ue",
  "foodBuff": "jO",
  "preferredBankFood": "gu",
  "cropDuration": "PY",
  "isCrop": "rI",
  "damageReduction": "t6",
  "brewScale": "De",
  "combine": "Ma",
  "bosses": "AO",
  "bossStats": "tB",
  "bossWeakMultiplier": "sB",
  "bossOtherMultiplier": "nB",
  "tickMs": "ro",
  "strength": "kT",
  "armour": "AT",
  "magicDefenceScale": "BS",
  "maxEnhancement": "Ft",
  "potions": "IO",
  "potionDurationTicks": "Um",
  "recipes": "Fo",
  "translations": "Lj",
  "worldTranslations": "i7",
  "uiTranslations": "E8",
  "homeTranslations": "V8",
  "houseBonus": "ml",
  "houseDamageCap": "ZI",
  "masteryRankLimit": "OB",
  "masteryRankCost": "_n",
  "masteryTotalCost": "GB",
  "masteriesTotalCost": "bi",
  "masteryEarnedPoints": "dl",
  "collectionThresholds": "Qr",
  "collectionPoints": "qI",
  "collectionItems": "Oi",
  "combatTick": "IT",
  "killMonster": "MT",
  "combatRarityMultiplier": "KT",
  "rarityThresholds": "Tn",
  "mountRarityThresholds": "Ln",
  "mountChance": "k9",
  "baseAttackTicks": "ch",
  "combatPetChance": "Pm",
  "combatPetItem": "xF",
  "isPet": "et",
  "voidShardChance": "xT",
  "voidShardQuantity": "RT",
  "voidShardItemId": "Wn",
  "mountItemId": "ed",
  "abyssalGoldBonus": "a2",
  "baseItemId": "go",
  "itemTier": "qo",
  "coinItemId": "ya",
  "hotSkill": "Pg",
  "masteryOfflineBaseHours": "Nh",
  "predict": "Oh",
  "offline": "DE",
  "tick": "Ij",
  "world": "N",
  "startFight": "cr",
  "resetActivity": "Ca",
  "depositPack": "BW",
  "homeBank": "Bg",
  "combatTargetTile": "HL",
  "nearbyTile": "Rt",
  "predictionStartTick": "Cb",
  "predictionChunkTicks": "NJ",
  "allSkills": "te",
  "createContext": "AY",
  "fullFoodLoad": "ll",
  "perks": "iw",
  "hotXp": "FF",
  "hotRare": "IF",
  "tools": "iY",
  "tool": "qs",
  "toolLuck": "Wp",
  "equipmentLuck": "Pi",
  "brewRarityMultiplier": "gk",
  "houseRarityMultiplier": "ag",
  "masteryMultiplier": "Ra",
  "mountSpeed": "mk",
  "randomFloat": "uS",
  "canEnhance": "vs",
  "enhanceChance": "k2",
  "enhanceCost": "uu",
  "enhanceXp": "eL",
  "enhanceTicks": "Fs",
  "protectionMin": "Pt",
  "startWork": "Ss",
  "workChance": "sj",
  "workModifiers": "tj",
  "recipeInputs": "Ne",
  "burnChance": "N9",
  "workXpMultiplier": "aG",
  "caughtChance": "aj",
  "packCapacity": "Oa",
  "lootBoxItemId": "qi",
  "nearestWorkSite": "ZS",
  "armourMultiplier": "w2",
  "restock": "RL",
  "upgradeRecipes": "Ds",
  "upgradeResult": "fu",
  "upgradeMaterials": "QO",
  "applyUpgrade": "hL",
  "recipeLevel": "oL",
  "windowModifiers": "Gl",
  "hotRarityMultiplier": "Cp",
  "skillPet": "CA",
  "skillPetChance": "wS",
  "itemSupportsRarity": "Wg",
  "bonusMinimumUncommon": "rg",
  "addPack": "_a",
  "enhancementTargetLimit": "OO",
  "enhanceMasteryMultiplier": "XS",
  "enhanceMasteryBonusCap": "wW",
  "recipeRarity": "yO",
  "recipeOutput": "ji",
  "collectionExcluded": "CI"
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
