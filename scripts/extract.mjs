import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-DAY9oe71.js',retrieved:'2026-10-16',changelogVersion:'1.0.1190',sha256:'c61c0f23060ecb43ebc22d6e2e1742b16c265383a1dc1b2860357b341047aeb5'};
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
  "questDay": "Bi",
  "questWeek": "eT",
  "monsters": "pc",
  "equipment": "yx",
  "items": "Ut",
  "marketFamilies": "x$",
  "marketFamily": "Mg",
  "gear": "_a",
  "item": "Ao",
  "canSell": "Re",
  "vendorPrice": "za",
  "encode": "is",
  "withRarity": "Pa",
  "levelXp": "Xt",
  "level": "Io",
  "maxLevel": "Cs",
  "accuracy": "Ai",
  "maxHit": "Rn",
  "evasion": "Hi",
  "hitChance": "Sn",
  "magic": "$r",
  "style": "fc",
  "attackTicks": "uk",
  "maxHp": "Wt",
  "equipmentSlots": "Gi",
  "masteries": "ni",
  "rooms": "Ie",
  "foodBuff": "X2",
  "preferredBankFood": "Nl",
  "cropDuration": "tp",
  "isCrop": "vg",
  "damageReduction": "tF",
  "brewScale": "Ye",
  "combine": "mt",
  "bosses": "hg",
  "bossStats": "rI",
  "bossWeakMultiplier": "dI",
  "bossOtherMultiplier": "lI",
  "tickMs": "lo",
  "strength": "h8",
  "armour": "u8",
  "magicDefenceScale": "hk",
  "maxEnhancement": "Lw",
  "potions": "Sg",
  "potionDurationTicks": "D2",
  "recipes": "$o",
  "translations": "oD",
  "worldTranslations": "fD",
  "uiTranslations": "aD",
  "homeTranslations": "eD",
  "houseBonus": "xi",
  "houseDamageCap": "q$",
  "masteryRankLimit": "yI",
  "masteryRankCost": "sn",
  "masteryTotalCost": "kI",
  "masteriesTotalCost": "wr",
  "masteryEarnedPoints": "ku",
  "collectionThresholds": "Fd",
  "collectionPoints": "S$",
  "collectionItems": "Rd",
  "combatTick": "v8",
  "killMonster": "y8",
  "combatRarityMultiplier": "w8",
  "rarityThresholds": "on",
  "mountRarityThresholds": "an",
  "mountChance": "WP",
  "baseAttackTicks": "Cd",
  "combatPetChance": "Xu",
  "combatPetItem": "N5",
  "isPet": "Rt",
  "voidShardChance": "p8",
  "voidShardQuantity": "g8",
  "voidShardItemId": "Tn",
  "mountItemId": "un",
  "abyssalGoldBonus": "_2",
  "baseItemId": "bo",
  "itemTier": "Eo",
  "coinItemId": "Kt",
  "hotSkill": "Gm",
  "masteryOfflineBaseHours": "pl",
  "predict": "cl",
  "offline": "cC",
  "tick": "jT",
  "world": "F",
  "startFight": "Xr",
  "resetActivity": "Ze",
  "depositPack": "mT",
  "homeBank": "dS",
  "combatTargetTile": "C8",
  "nearbyTile": "rc",
  "predictionStartTick": "iC",
  "predictionChunkTicks": "BA",
  "allSkills": "Ya",
  "createContext": "Bx",
  "fullFoodLoad": "mi",
  "perks": "lp",
  "hotXp": "k5",
  "hotRare": "S5",
  "tools": "px",
  "tool": "rs",
  "toolLuck": "By",
  "equipmentLuck": "qr",
  "brewRarityMultiplier": "Fk",
  "houseRarityMultiplier": "cm",
  "masteryMultiplier": "ct",
  "mountSpeed": "$k",
  "randomFloat": "Ty",
  "canEnhance": "Cc",
  "enhanceChance": "GT",
  "enhanceCost": "Wm",
  "enhanceXp": "XP",
  "enhanceTicks": "qs",
  "protectionMin": "Lc",
  "startWork": "Ls",
  "workChance": "FT",
  "workModifiers": "IT",
  "recipeInputs": "tt",
  "burnChance": "p7",
  "workXpMultiplier": "Fg",
  "caughtChance": "qT",
  "packCapacity": "ht",
  "lootBoxItemId": "Fr",
  "nearestWorkSite": "Z$",
  "armourMultiplier": "aS",
  "restock": "_8",
  "upgradeRecipes": "Ki",
  "upgradeResult": "Xl",
  "upgradeMaterials": "qg",
  "applyUpgrade": "a7",
  "recipeLevel": "YP",
  "windowModifiers": "Ri",
  "hotRarityMultiplier": "Yb",
  "skillPet": "O5",
  "skillPetChance": "Yy",
  "itemSupportsRarity": "Am",
  "bonusMinimumUncommon": "Ap",
  "addPack": "Jt"
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
