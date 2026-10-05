import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-Bwib9zgA.js',retrieved:'2026-10-06',changelogVersion:'1.0.1173',sha256:'d5dede7a94f87782efe0f6c01205d03ad39b276be0b54236f0f82eda4981af66'};
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
function find(signature,type) {
  const matches=[...new Set(declarations.values())].filter(d=>d.text.includes(signature)&&(!type||d.text.startsWith(type)));
  if(matches.length!==1)throw Error(`Signature ${signature}: found ${matches.length}, review new upstream build`);
  return matches[0].name;
}
const exportsMap={
  monsters:find('name:"Gnawer",level:2'), equipment:find('itemId:110,slot:"weapon"'),
  items:'wt', gear:'we', item:'uo', encode:'rs', withRarity:'ve', levelXp:'pt', level:'So', maxLevel:'jc',
  accuracy:find('Math.round(_x*Ze(e,"warrior"))','function'), maxHit:find('s>1?Math.ceil(c*s):c','function'),
  evasion:find('return 10+So(e.skills.defence)+PI(e)','function'), hitChance:'Bs', magic:'Rs', style:'ds',
  attackTicks:'dp', maxHp:'oc', equipmentSlots:'_i', masteries:'ni', rooms:'st',
  foodBuff:'F1', cropDuration:'fu', isCrop:'bl', damageReduction:'CA', brewScale:'Ze', combine:'qt',
  bosses:'ff', bossStats:'xA', bossWeakMultiplier:'iu', bossOtherMultiplier:'ru', tickMs:'co',
  strength:'GI', armour:'PI', magicDefenceScale:'kl', maxEnhancement:'nf', potions:'ml'
};
exportsMap.recipes=find(`id:220,name:"Gatherer's draught",skill:"herblore"`);
// Dictionary is upstream data, not a hand-maintained translation list.
exportsMap.translations=find('"Bronze blade":"青铜剑"','const');
exportsMap.worldTranslations=find('Gnawer:"啃噬者"','const');
exportsMap.uiTranslations=find('"Vein Colossus":"矿脉巨像"','const');
exportsMap.homeTranslations=find('"The mine":"矿井"','const');
exportsMap.houseBonus='ka';
exportsMap.houseDamageCap='mS';
exportsMap.masteryRankLimit='x6';
exportsMap.combatTick='VI';
exportsMap.killMonster='zI';
exportsMap.baseItemId='fo';
exportsMap.itemTier='Eo';
exportsMap.coinItemId='Ac';
exportsMap.hotSkill='yl';
exportsMap.masteryOfflineBaseHours='vu';
exportsMap.predict='$i';
exportsMap.offline='T9';
exportsMap.tick='w3';
exportsMap.world='P';
exportsMap.startFight='Hn';
exportsMap.resetActivity='ht';
exportsMap.depositPack='c3';
exportsMap.homeBank='sg';
exportsMap.combatTargetTile='hq';
exportsMap.nearbyTile='sc';
exportsMap.predictionStartTick='I9';
exportsMap.predictionChunkTicks='Mw';
exportsMap.allSkills='Be';
exportsMap.createContext='J0';
exportsMap.fullFoodLoad='xn';
exportsMap.perks=find('id:"pockets",name:"Deep pockets"');
exportsMap.hotXp='hM';exportsMap.hotRare='uM';
exportsMap.tools='v0';
exportsMap.tool='zc';
exportsMap.mountSpeed='wM';
exportsMap.randomFloat=find('return af(ne(e,o,t))/4294967296','function');
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
fs.writeFileSync('src/upstream.js','// GENERATED from vendor/game-original.js. Do not edit.\n'+ordered.map(d=>d.text).join('\n')+'\nexport { '+Object.entries(exportsMap).map(([alias,name])=>`${name} as ${alias}`).join(', ')+' };\n');
fs.writeFileSync('vendor/manifest.json',JSON.stringify({...sourceInfo,exports:exportsMap,declarations:ordered.map(({name,start,end,text})=>({name,start,end,sha256:hash(text)}))},null,2));
console.log(`Extracted ${ordered.length} original declarations (${fs.statSync('src/upstream.js').size} bytes).`);
