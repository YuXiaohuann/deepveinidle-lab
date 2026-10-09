import {selectedEnemies} from './enemy-selection.js';
import {renderDebug} from './debug-controls.js';
import {renderEnhancement,applyEnhancementImport} from './enhancement-controls.js';
import {importSnapshot} from './character-snapshot.js';
import {combatHot,combatHotMarkup,rewardAmount} from './combat-hot.js';
import {renderForecast,updateForecast} from './forecast-controls.js';
import {importCharacter,importWarningText} from './character-import.js';
import {importControls,requestCharacter,probeCharacter,importStatusText} from './import-controls.js';
import {combatPotions,combatRooms,combatMasteries} from './combat-options.js';
import {manualControls} from './manual-controls.js';
import {dictionary,translatedName} from './i18n.js';
import {game,gearDetails,slots,skills,foods,potions,baseGear,defaults,normalize,calculate,preset,chooseLanguage,gearForStyle,selectStyle,sortEnemies,masteryValue,masteryRank} from './model.js';
const $=s=>document.querySelector(s),storageKey='dvi-simulator-v1';
let saved;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
let language=chooseLanguage(saved?.language,navigator.languages||[navigator.language]),state=normalize(saved?.state||preset('ranged')),query='',sort='level',sortDirection='desc',period='hour',activeSection=sectionForPath();
state=selectStyle(state,state.style);
let activeSnapshot=null,storedState=structuredClone(state);
let importBusy=false,importStatus=null;
const copy={zh:{title:'实验室',sub:'配好装备，看看每一场战斗。',beta:'测试版 0.11.5',config:'角色配置',presets:'快速配装',melee:'近战',ranged:'远程',magic:'魔法',defence:'防御',hitpoints:'生命',levels:'技能',equipment:'装备',weapon:'武器',shield:'副手',helmet:'头部',body:'胸部',legs:'腿部',ring:'戒指',amulet:'护符',mount:'坐骑',moveSpeed:'移动速度',empty:'空',unarmed:'空手',rarity:['普通','罕见','稀有','史诗','传说'],food:'食物',healing:'单次治疗',fed:'伤害食物增益生效 +25%',rooted:'作物减伤生效 −20%',consume:'应用所选食物的增益',consumeHelp:'选择食物用于查看效果；点击应用才启用其增益。可分别关闭下方增益。',duration:'持续',minutes:'分钟',noBuff:'无伤害增益',potions:'药水',warrior:'战士补剂',haste:'急速药剂',nourish:'滋养药剂',off:'未启用',home:'家园',masteries:'精通',depot:'模拟仓库',accuracy:'命中值',maxhit:'最大伤害',hp:'最大生命',post:'练武桩',target:'箭靶',altar:'祭坛',mastery:'精通等级',house:'家园设施等级（已放置）',meals:'丰盛餐食等级',reset:'清空配置',resetConfirm:'重置技能、装备与增益？',stats:'角色属性',evasion:'闪避',strength:'装备力量',speed:'攻击间隔',second:'秒',targets:'敌人',search:'搜索怪物名称（中 / 英）',all:'全部',normal:'普通怪物',level:'等级',chance:'我方命中',damage:'我方最大伤害',enemy:'敌人',health:'生命',enemyChance:'敌方命中',enemyDamage:'敌方最大伤害',count:'个目标',rounding:'手动及导入配置模拟未保留实际库存、队列、技能等级内的经验进度、家园升级进度、增益到期时间及账号随机种子等。',source:'代码快照',original:'原始代码',plan:'需求与设计',saved:'配置自动保存在此浏览器',saveFail:'浏览器存储不可用，配置无法保存',emptyResults:'没有匹配的敌人',warnings:'配装提示',levelIssue:'等级不足，本件未计入：需要',styleIssue:'流派不匹配，命中／力量按游戏规则扣减',twoHanded:'大剑占用双手，副手未计入',missing:'该品质不存在，本件未计入',presetHint:'85 级 · 稀有 +5',effective:'有效装备属性',acc:'命中',str:'力量',def:'防御',foodTime:'伤害增益',rootTime:'减伤增益',sourceNote:'基于 2026-10-08 公开资源 · 游戏版本 1.0.1181',noResults:'无结果',clear:'清除搜索'},en:{title:'Lab',sub:'Build your loadout. Know every matchup.',beta:'BETA 0.11.5',config:'Character build',presets:'Quick builds',melee:'Melee',ranged:'Ranged',magic:'Magic',defence:'Defence',hitpoints:'Hitpoints',levels:'Skills',equipment:'Equipment',weapon:'Weapon',shield:'Off-hand',helmet:'Head',body:'Body',legs:'Legs',ring:'Ring',amulet:'Amulet',mount:'Mount',moveSpeed:'Movement speed',empty:'None',unarmed:'Unarmed',rarity:['Normal','Uncommon','Rare','Epic','Legendary'],food:'Food',healing:'Healing per food',fed:'Food damage buff active +25%',rooted:'Crop protection active −20%',consume:'Apply selected food buffs',consumeHelp:'Selecting food previews its effects. Apply to enable its buffs; toggle them independently below.',duration:'Duration',minutes:'min',noBuff:'No damage buff',potions:'Potions',warrior:'Warrior tonic',haste:'Haste draught',nourish:'Nourishing draught',off:'Inactive',home:'Home',masteries:'Masteries',depot:'Simulated depot',accuracy:'Accuracy',maxhit:'Max hit',hp:'Max HP',post:'Sparring post',target:'Archery target',altar:'Altar',mastery:'Mastery ranks',house:'Placed home station levels',meals:'Hearty meals rank',reset:'Reset build',resetConfirm:'Reset all skills, equipment and buffs?',stats:'Character stats',evasion:'Evasion',strength:'Gear strength',speed:'Attack interval',second:'s',targets:'Enemies',search:'Search enemies in English or Chinese',all:'All',normal:'Monsters',level:'Level',chance:'Your hit chance',damage:'Your max hit',enemy:'Enemy',health:'HP',enemyChance:'Enemy hit chance',enemyDamage:'Enemy max hit',count:'targets',rounding:'Manual and imported build simulations do not preserve actual inventory, queued tasks, progress within skill levels, home upgrade progress, buff expiry times, or account random seeds.',source:'Source snapshot',original:'Original source',plan:'Requirements & design',saved:'Build saved automatically in this browser',saveFail:'Browser storage unavailable; build cannot be saved',emptyResults:'No matching enemies',warnings:'Loadout notes',levelIssue:'Excluded: requires',styleIssue:'Wrong style: accuracy / strength deducted by game rules',twoHanded:'Greatsword uses both hands; off-hand excluded',missing:'This rarity is unavailable; item excluded',presetHint:'Level 85 · Rare +5',effective:'Effective item stats',acc:'Accuracy',str:'Strength',def:'Defence',foodTime:'Damage buff',rootTime:'Protection buff',sourceNote:'Public source snapshot 2026-10-08 · Game version 1.0.1181',noResults:'No results',clear:'Clear search'}};
Object.assign(copy.zh,{projectAuthor:'项目作者（游戏昵称）',community:'交流 QQ 群',copyright:'Deep Vein Idle 的名称、标识、相关设计、游戏代码，以及美术素材、截图、角色、世界设定和其他可识别的游戏资源，其知识产权归原游戏作者或相应权利人所有，保留所有权利。其他商标归各自权利人所有。',projectNotice:'本项目为玩家制作的非官方模拟工具，仅用于信息展示与交流，不代表原游戏官方立场或认可，也不声称已获得官方授权。工具的内容与运行由本项目作者独立维护。'});
Object.assign(copy.en,{projectAuthor:'Project author (in-game name)',community:'QQ community',copyright:'The Deep Vein Idle name, logos, associated designs, game code, artwork, screenshots, characters, world settings and other recognizable game resources are the intellectual property of the original game creator or their respective rights holders. All rights reserved. All other trademarks belong to their respective owners.',projectNotice:'This is an unofficial, player-created simulator for information and community discussion. It does not represent the game’s official views or endorsement, and makes no claim of official authorization. The project author independently maintains the content and operation of this tool.'});
Object.assign(copy.zh,{combat:'战斗',enhance:'强化',forecast:'预报',sections:'主要板块'});
Object.assign(copy.en,{combat:'Combat',enhance:'Enhance',forecast:'Forecast',sections:'Main sections'});
const t=k=>copy[language][k]??k;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dict=dictionary;
const name=s=>translatedName(s,language);
const options=(arr,value)=>arr.map(([v,label])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
const tiers=v=>options(t('rarity').map((n,i)=>[i,n]),v);
const number=(path,label,value,max,min=0,step=1)=>`<label class="number-field"><span>${esc(label)}</span><input type="number" data-path="${path}" value="${value}" min="${min}" max="${max}" step="${step}" aria-label="${esc(label)}"></label>`;
let saveOK=true;
function save(){try{localStorage.setItem(storageKey,JSON.stringify({language,state:activeSnapshot?storedState:state}));saveOK=true;if(!activeSnapshot)storedState=structuredClone(state);}catch{saveOK=false;}}
function gearSummary(slot,g){return !g?'—':slot==='mount'?`${t('moveSpeed')} +${Number((g.bonus*100).toFixed(2))}%`:`${t('acc')} ${g.accuracy} · ${t('str')} ${g.strength} · ${t('def')} ${g.defence}`;}
function equipRow(slot){const v=state.gear[slot],g=v.id?gearDetails(slot,game.encode(game.withRarity(v.id,v.tier),v.plus)):null;return `<div class="gear-row"><label class="gear-name"><span>${t(slot)}</span><select data-path="gear.${slot}.id" aria-label="${t(slot)}">${options([...(slot==='weapon'&&state.style!=='melee'?[]:[[0,slot==='weapon'?t('unarmed'):t('empty')]]),...(state.manual.allGear?baseGear.filter(g=>g.slot===slot):gearForStyle(slot,state.style)).sort((a,b)=>a.levelReq-b.levelReq).map(x=>[x.itemId,`${name(game.item(x.itemId).name)}${slot==='mount'?'':` · ${x.levelReq}`}`])],v.id)}</select></label><div class="gear-mods"><select data-path="gear.${slot}.tier" aria-label="${t(slot)} ${language==='zh'?'稀有度':'rarity'}" ${!v.id?'disabled':''}>${tiers(v.tier)}</select><label class="enhance"><span>+</span><input type="number" min="0" max="${game.maxEnhancement}" step="1" data-path="gear.${slot}.plus" value="${v.plus}" aria-label="${t(slot)} ${language==='zh'?'强化':'enhancement'}" ${!v.id?'disabled':''}></label></div><small class="gear-stats">${gearSummary(slot,g)}</small></div>`;}
const nonCombatNote=()=>language==='zh'?' · 不影响本页静态战斗数值':' · no effect on these static combat stats';
function houseDescription(r){const labels=language==='zh'?{gatherSpeed:'采集速度',craftSpeed:'制作速度',combatXp:'战斗经验',skillXp:'技能经验',enhanceChance:'强化成功率',dmg:'伤害',rareChance:'稀有掉落概率',bankSlots:'仓库容量'}:{gatherSpeed:'Gather speed',craftSpeed:'Craft speed',combatXp:'Combat XP',skillXp:'Skill XP',enhanceChance:'Enhance odds',dmg:'Damage',rareChance:'Rare-find',bankSlots:'Storage slots'};return labels[r.bonus.kind]+(r.bonus.kind==='dmg'?(language==='zh'?' · 每级 +0.5%，上限 +50%':' · +0.5% per level, capped at +50%'):['combatXp','skillXp','rareChance'].includes(r.bonus.kind)?(language==='zh'?' · 参与小时收益':' · affects hourly rewards'):(language==='zh'?' · 原始效果为仓库容量；当前无限仓库，不影响模拟':' · native storage capacity; no effect with unlimited storage'));}
const enemyColumns=[['enemy',null],['level','level'],['killsHour','kills'],['xpHour','xp'],['coinsHour','coins'],['normalHour','normalValue'],['rareHour','rareValue'],['totalIncomeHour','totalIncome'],['foodHour','food']];
const simulationSortKeys=new Set(['homeBank','kills','xp','coins','normal','rare','normalValue','rareValue','totalIncome','food']);
const columnLabel=k=>k.endsWith('Hour')&&period!=='hour'?t(k).replace(' / 小时',period==='day'?' / 天':' / 总量').replace(' / h',period==='day'?' / day':' / total'):t(k);
function visibleEnemyColumns(){return enemyColumns.filter(([label])=>state.manual.vendorValues||label!=='totalIncomeHour').map(([label,key])=>[label,!state.manual.vendorValues&&key==='normalValue'?'normal':!state.manual.vendorValues&&key==='rareValue'?'rare':key]);}
function enemyHeaders(){return visibleEnemyColumns().map(([label,key])=>`<th ${key?`data-column="${key}" aria-sort="${key===sort?(sortDirection==='asc'?'ascending':'descending'):'none'}"`:''}>${key?`<button class="sort-header" data-sort="${key}">${columnLabel(label)} <span class="sort-arrow" aria-hidden="true">${key===sort?(sortDirection==='asc'?'↑':'↓'):'↕'}</span></button>`:columnLabel(label)}</th>`).join('');}
function updateSorting(){
 document.querySelectorAll('th[data-column]').forEach(th=>{const active=th.dataset.column===sort;th.setAttribute('aria-sort',active?(sortDirection==='asc'?'ascending':'descending'):'none');th.querySelector('.sort-arrow').textContent=active?(sortDirection==='asc'?'↑':'↓'):'↕';});
}
function sectionForPath(){const path=location.pathname.replace(/\/$/,'');return path==='/debug'?'debug':path==='/forecast'?'forecast':path==='/enhance'?'enhance':'combat';}
function showSection(section){
 activeSection=section;
 for(const id of ['combat','enhance','forecast','debug'])document.getElementById(`${id}-section`).hidden=id!==section;
 document.querySelectorAll('[data-section]').forEach(link=>{
  const selected=link.dataset.section===activeSection;
  if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');

 });
}
window.addEventListener('popstate',()=>showSection(sectionForPath()));
function periodOptions(){
 if(state.manual.simulationHours<24&&period==='day')period='hour';
 const choices=[['hour',language==='zh'?'每小时':'Per hour'],['total',language==='zh'?'总量':'Total']];
 if(state.manual.simulationHours>=24)choices.splice(1,0,['day',language==='zh'?'每天':'Per day']);
 return options(choices,period);
}
function render(){
 periodOptions();
 const controls=manualControls(state,{language,number,options,esc,name,tiers});
 const openDetails=new Map([...document.querySelectorAll('details[id]')].map(el=>[el.id,el.open]));
 document.documentElement.lang=language==='zh'?'zh-CN':'en';document.title=`Deep Vein Idle · ${t('title')}`;
 $('#app').innerHTML=`<header><a class="brand" href="/" aria-label="Deep Vein Idle"><span class="gem">◈</span><span>DEEP VEIN <em>IDLE</em><small>${t('title')}</small></span></a><nav class="section-nav" aria-label="${t('sections')}">${['combat','enhance','forecast'].map(id=>`<a id="${id}-nav" href="/${id}" data-section="${id}" aria-controls="${id}-section" ${activeSection===id?'aria-current="page"':''}>${t(id)}</a>`).join('')}</nav><div class="header-right"><span class="beta">${t('beta')}</span><select id="language" aria-label="Language / 语言"><option value="zh" ${language==='zh'?'selected':''}>简体中文</option><option value="en" ${language==='en'?'selected':''}>English</option></select></div></header><main id="combat-section" aria-labelledby="combat-nav" ${activeSection!=='combat'?'hidden':''}><aside class="panel config"><div class="panel-heading"><h1>${t('config')}</h1><button id="reset" class="text-button">${t('reset')}</button></div><p class="muted intro">${t('sub')}</p>${importControls(language)}<div class="presets">${['melee','ranged','magic'].map((k,i)=>`<button data-preset="${k}" aria-pressed="${state.style===k}" class="${state.style===k?'selected':''}"><span>${['⚔','➶','✧'][i]}</span>${t(k)}</button>`).join('')}</div><p class="micro">${language==='zh'?'战斗风格 · 仅显示对应装备，防御与生命通用':'Combat style · matching gear only; defence and HP are shared'}</p><details class="config-detail" id="skills-settings"><summary>${t('levels')}</summary><div class="skill-grid">${skills.map(k=>number(`levels.${k}`,t(k),state.levels[k],game.maxLevel,1)).join('')}</div></details><details class="config-detail" id="equipment-settings"><summary>${t('equipment')}</summary><label class="check"><input type="checkbox" data-path="manual.allGear" ${state.manual.allGear?'checked':''}>${language==='zh'?'显示全部装备（允许混穿）':'Show all gear (allow mixed styles)'}</label>${slots.map(equipRow).join('')}</details><details class="config-detail" id="food-settings"><summary>${t('food')}</summary><div class="food-controls"><select data-path="food.id" aria-label="${t('food')}">${options(foods.map(x=>[x.id,name(x.name)]),state.food.id)}</select></div><h3>${language==='zh'?'增益':'Buffs'}</h3><div id="food-summary" class="food-summary"></div><button id="apply-food" class="secondary">${t('consume')}</button><p class="micro">${t('consumeHelp')}</p><label class="check"><input type="checkbox" data-path="fed" ${state.fed?'checked':''}>${t('fed')}</label><label class="check"><input type="checkbox" data-path="rooted" ${state.rooted?'checked':''}>${t('rooted')}</label>${controls.food}</details><details class="config-detail" id="potion-settings"><summary>${t('potions')}</summary>${combatPotions.map(p=>{const k=p.kind;return `<label class="potion"><span>${esc(name(game.item(p.itemId).name))}</span><select data-path="brews.${k}">${options([[-1,t('off')],...t('rarity').map((v,i)=>[i,v])],state.brews[k])}</select></label><p class="micro">${language==='zh'?({gatherer:'采集经验',hunter:'稀有掉落概率',warrior:'命中与最大伤害',elixir:'所有经验',abyssal:'怪物金币',swift:'移动速度',nourish:'食物治疗',haste:'攻击速度'})[k]:esc(p.effect)}${['warrior','nourish','haste','hunter','elixir','abyssal','swift'].includes(k)?'':(language==='zh'?' · 不影响本页战斗数值':' · no effect on these combat stats')}</p>`;}).join('')}</details><details class="config-detail" id="home-settings"><summary>${t('home')}</summary><p class="micro">${t('house')}</p><div class="skill-grid">${combatRooms.map(r=>`<div>${number(`house.${r.id}`,name(r.name),state.house[r.id],Number.MAX_SAFE_INTEGER)}<p class="micro">${houseDescription(r)}</p></div>`).join('')}</div></details><details class="config-detail" id="mastery-settings"><summary>${t('masteries')}</summary><p class="micro">${language==='zh'?'精通实际加成（百分比步进 0.5%）':'Effective mastery bonuses (0.5% steps)'}</p><div class="skill-grid">${combatMasteries.map(m=>`<div>${number(`masteries.${m.id}`,name(m.name)+(m.unit==='percent'?' (%)':(language==='zh'?'（小时）':' (hours)')),masteryValue(m.id,state.masteries[m.id]),masteryValue(m.id,game.masteryRankLimit),0,m.unit==='percent'?0.5:masteryValue(m.id,1))}<p class="micro">${esc(name(m.blurb))}${['accuracy','maxhit','hp','xp','rare','move'].includes(m.id)?'':nonCombatNote()}</p></div>`).join('')}</div></details>${controls.other}${controls.simulation}${controls.sakura}<p class="save-note" id="save-note">● ${t(saveOK?'saved':'saveFail')}</p></aside><div class="results"><div class="result-heading"><div><span class="eyebrow">COMBAT OVERVIEW</span><h2>${t('stats')}</h2></div><span id="style-badge" class="style-badge"></span></div><div id="stats" class="stats"></div><div id="issues" aria-live="polite"></div><section class="panel enemies"><div class="enemies-heading"><div><h2>${t('targets')} <span id="count"></span></h2></div></div><div class="toolbar"><div class="search-wrap"><span>⌕</span><input id="search" type="search" placeholder="${t('search')}" aria-label="${t('search')}" value="${esc(query)}"></div><select id="period" aria-label="${language==='zh'?'收益周期':'Reward period'}">${periodOptions()}</select></div><p id="simulation-status" class="table-note" aria-live="polite"></p><div class="table-scroll"><table><thead><tr>${enemyHeaders()}</tr></thead><tbody id="rows"></tbody></table></div><p class="table-note">${t('rounding')} <strong class="simulation-caveat">${language==='zh'?'结果可能与游戏内的预测值和实际情况不同。':'Results may differ from in-game predictions and actual gameplay.'}</strong></p></section></div></main><section id="enhance-section" aria-labelledby="enhance-nav" ${activeSection!=='enhance'?'hidden':''}><div id="enhance-content"></div></section><section id="forecast-section" class="forecast-section" aria-labelledby="forecast-nav" ${activeSection!=='forecast'?'hidden':''}><div id="forecast-content"></div></section><section id="debug-section" class="forecast-section" aria-labelledby="debug-title" ${activeSection!=='debug'?'hidden':''}><div id="debug-content"></div></section><footer class="project-footer"><div class="footer-contact"><span>${t('projectAuthor')}：<strong>Alice</strong></span><span>${t('community')}：<strong>897891232</strong></span></div><div class="footer-source"><span>${t('sourceNote')}</span><nav aria-label="${language==='zh'?'项目与游戏链接':'Project and game links'}"><a href="https://deepveinidle.com/?ref=Alice" target="_blank" rel="noopener noreferrer">Deep Vein Idle ↗</a></nav></div><p>${t('copyright')}</p><p>${t('projectNotice')}</p></footer>`;
 document.querySelectorAll('[data-section]').forEach(link=>link.onclick=event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  if(location.pathname!==link.getAttribute('href'))history.pushState(null,'',link.getAttribute('href'));
  showSection(link.dataset.section);
 });
 for(const [id,open]of openDetails){const el=document.getElementById(id);if(el)el.open=open;}
 document.querySelectorAll('[data-path^="levels."]').forEach(el=>{const k=el.dataset.path.split('.')[1];el.closest('label').classList.toggle('active-skill',k===state.style);});
 $('#language').onchange=e=>{language=e.target.value;save();render();};$('#reset').onclick=()=>{if(confirm(t('resetConfirm'))){activeSnapshot=null;state=selectStyle(defaults(),'melee');save();render();}};
 document.querySelectorAll('[data-preset]').forEach(el=>el.onclick=()=>{state=selectStyle(state,el.dataset.preset);save();render();});
 document.querySelector('[data-simulation-mode]').onchange=e=>{state.manual.customSimulation=e.target.value==='custom';if(!state.manual.customSimulation)state.manual.simulationHours=Number(e.target.value);save();render();};
 document.querySelectorAll('[data-path]').forEach(el=>{
  const update=()=>{const keys=el.dataset.path.split('.');let obj=state;for(const key of keys.slice(0,-1))obj=obj[key];obj[keys.at(-1)]=keys[0]==='masteries'?masteryRank(keys[1],el.value):el.type==='checkbox'?el.checked:['manual.hotSetting','manual.enemySelection'].includes(el.dataset.path)?el.value:Number(el.value);state=normalize(state);save();};
  if(el.type==='number'){
   el.oninput=()=>{if(el.value===''||!Number.isFinite(el.valueAsNumber))return;update();renderResults();const slot=el.dataset.path.split('.')[1];if(el.dataset.path.startsWith('gear.')){const v=state.gear[slot],g=gearDetails(slot,game.encode(game.withRarity(v.id,v.tier),v.plus));el.closest('.gear-row').querySelector('.gear-stats').textContent=gearSummary(slot,g);}};
   el.onblur=()=>{update();el.value=el.dataset.path.startsWith('masteries.')?masteryValue(el.dataset.path.split('.')[1],state.masteries[el.dataset.path.split('.')[1]]):el.dataset.path.split('.').reduce((v,k)=>v[k],state);renderResults();};
  }else el.onchange=()=>{update();render();document.querySelector(`[data-path="${el.dataset.path}"]`)?.focus();};
 });
 renderDebug(language,{applyCombat:applyCharacterImport,applyEnhancement:applyEnhancementImport,refresh:render});
 $('#import-character').onclick=()=>runCharacterImport('config');updateImportStatus();
 $('#apply-food').onclick=()=>{const r=calculate(state);if(r.food.fedSeconds)state.fed=true;if(r.food.rootSeconds)state.rooted=true;save();render();};
 $('#period').onchange=e=>{period=e.target.value;render();};
 $('#search').oninput=e=>{query=e.target.value;renderResults();};
 $('thead').onclick=e=>{const button=e.target.closest('[data-sort]');if(!button)return;const key=button.dataset.sort;sortDirection=key===sort&&sortDirection==='asc'?'desc':'asc';sort=key;renderResults();};
 if(activeSnapshot){
  document.querySelectorAll('.config [data-path],.config [data-preset],#apply-food').forEach(el=>{if(!['manual.enemySelection','manual.simulationHours','manual.vendorValues'].includes(el.dataset.path))el.disabled=true;});
  $('#save-note').textContent=language==='zh'?'● 临时快照，刷新后丢失；角色配置仅供查看':'● Temporary snapshot; lost on refresh. Character settings are read-only.';
 }
 renderEnhancement(language);
 renderForecast(language,esc);
 renderResults();
 for(const [id,open]of openDetails){const el=document.getElementById(id);if(el)el.open=open;}
}
function renderResults(){const openLevels=new Set([...document.querySelectorAll('#rows details.level-detail[open]')].map(el=>el.closest('tr').dataset.enemy));$('#period').innerHTML=periodOptions();if(!state.manual.vendorValues&&sort==='totalIncome'){sort='level';sortDirection='desc';}if(sort==='normal'||sort==='normalValue')sort=state.manual.vendorValues?'normalValue':'normal';if(sort==='rare'||sort==='rareValue')sort=state.manual.vendorValues?'rareValue':'rare';$('thead tr').innerHTML=enemyHeaders();scheduleSimulation();const r=calculate(state,activeSnapshot?.player),stats=r.stats;
 $('#style-badge').textContent=t(stats.style);$('#stats').innerHTML=[['maxhit',stats.hit],['accuracy',stats.accuracy],['evasion',stats.evasion],['hp',stats.hp],['strength',stats.strength],['speed',`${stats.seconds.toFixed(2)} <small>${t('second')}</small>`]].map(([k,v])=>`<div class="stat ${k==='maxhit'?'primary':''}"><span>${t(k)}</span><strong>${v}</strong></div>`).join('');
 $('#food-summary').innerHTML=`<strong>${t('healing')} <b>${r.food.healing}</b></strong><span>${t('foodTime')}: ${r.food.fedSeconds?`${r.food.fedSeconds/60} ${t('minutes')}`:'—'} · ${t('rootTime')}: ${r.food.rootSeconds?`${r.food.rootSeconds/60} ${t('minutes')}`:'—'}</span>`;
 $('#issues').innerHTML=r.issues.length?`<div class="issue-box"><strong>${t('warnings')}</strong>${r.issues.map(i=>`<p>${t(i.slot)}: ${i.kind==='level'?`${t('levelIssue')} ${t(i.skill)} ${i.level}`:t(i.kind==='style'?'styleIssue':i.kind==='twoHanded'?'twoHanded':'missing')}</p>`).join('')}</div>`:'';
 const q=query.trim().toLocaleLowerCase();let rows=r.rows.filter(m=>(!q||`${m.name} ${dict[m.name]||''}`.toLocaleLowerCase().includes(q)));
 rows=sortEnemies(rows,sort,sortDirection,m=>simulationSortKeys.has(sort)?hourly.get(m.key)?.[sort]:m[sort]);updateSorting();$('#count').textContent=`${rows.length} ${t('count')}`;
 $('#rows').innerHTML=rows.length?rows.map(m=>`<tr data-enemy="${esc(m.key)}"><td class="column-highlight"><div class="enemy-name"><span class="enemy-icon">◇</span><div><strong>${esc(name(m.name))}</strong><small>${language==='zh'?m.name:dict[m.name]||''}</small></div></div></td><td>${levelCell(m,openLevels.has(m.key))}</td>${hourlyCells(m)}</tr>`).join(''):`<tr><td colspan="${visibleEnemyColumns().length}" class="empty-results">${t('emptyResults')}</td></tr>`;
}

Object.assign(copy.zh,{killsHour:'击杀 / 小时',xpHour:'经验 / 小时',coinsHour:'金币 / 小时',normalHour:'普通掉落 / 小时',rareHour:'稀有掉落 / 小时',totalIncomeHour:'总收入 / 小时',foodHour:'食物 / 小时',simulating:'正在逐刻模拟',simulationError:'战斗模拟失败，请刷新重试',deathTrials:'死亡试验'});
Object.assign(copy.en,{killsHour:'Kills / h',xpHour:'XP / h',coinsHour:'Coins / h',normalHour:'Normal drops / h',rareHour:'Rare drops / h',totalIncomeHour:'Total income / h',foodHour:'Food / h',simulating:'Simulating combat ticks',simulationError:'Combat simulation failed; refresh to retry',deathTrials:'Trials ending in death'});
let simulationSignature='',simulationWorker=null,simulationTimer=null,simulationError=false,hourly=new Map(),simulationNow=null;
function scheduleSimulation(){
 const monsters=selectedEnemies(state.manual.enemySelection).monsters;
 const signature=JSON.stringify(activeSnapshot?{format:'snapshot',snapshot:activeSnapshot,enemySelection:state.manual.enemySelection,simulationHours:state.manual.simulationHours}:{...state,manual:{...state.manual,vendorValues:undefined}});
 if(signature!==simulationSignature){
  simulationSignature=signature;simulationWorker?.terminate();clearTimeout(simulationTimer);hourly=new Map();simulationError=false;
  const snapshot=JSON.parse(signature);simulationNow=Date.now();
  if(monsters.length)simulationTimer=setTimeout(()=>{
   try{simulationWorker=new Worker(new URL('./simulation-worker.js',import.meta.url),{type:'module'});
    simulationWorker.onmessage=({data})=>{if(signature!==simulationSignature)return;if(data.error)simulationError=data.error;if(data.result)hourly.set(data.result.key,data.result);if(data.done||data.error){simulationWorker?.terminate();simulationWorker=null;}renderResults();};
    simulationWorker.onerror=()=>{if(signature!==simulationSignature)return;simulationError=true;simulationWorker?.terminate();simulationWorker=null;renderResults();};
    simulationWorker.postMessage({state:snapshot,enemySelection:state.manual.enemySelection,now:simulationNow});
   }catch{simulationError=true;renderResults();}
  },180);
 }
 const hotPanel=$('#combat-hot-schedule');
 if(hotPanel){try{hotPanel.innerHTML=state.manual.hotSetting==='current'?combatHotMarkup(combatHot(simulationNow,state.manual.simulationHours),language,esc):state.manual.hotSetting==='game'?'<p class="micro">'+(language==='zh'?'沿用游戏内置预测的热门加成规则。':'Uses the hot bonus rules of the in-game predictor.')+'</p>':'';}catch(error){hotPanel.textContent=(language==='zh'?'预测失败：':'Forecast failed: ')+(error.message==='invalidTime'?(language==='zh'?'设备时间无效或早于游戏时间纪元。':'Invalid device time or time before the game epoch.'):String(error.message||error));}}
 const status=$('#simulation-status');
 if(status){
  status.hidden=!simulationError&&hourly.size===monsters.length;
  status.textContent=status.hidden?'':simulationError?t('simulationError')+' · '+simulationError:t('simulating')+' · '+hourly.size+'/'+monsters.length+' · '+state.manual.simulationHours+'h · '+(language==='zh'?activeSnapshot?'完整角色快照':'按设置选择仓库 · 食物充足':activeSnapshot?'Complete character snapshot':'Configured depot · plentiful food')+' · '+(state.manual.hotSetting==='current'?(language==='zh'?'按当前时间':'Current-time hot bonuses'):state.manual.hotSetting==='game'?(language==='zh'?'沿用游戏设置':'Game hot settings'):(language==='zh'?'不计入热门':'Hot bonuses excluded'));
 }

}
const formatAmount=n=>n.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:2});
const formatRate=(n,metric='count')=>{const digits=['xp','coins'].includes(metric)?0:1;return rewardAmount(n,period,state.manual.simulationHours).toLocaleString(language==='zh'?'zh-CN':'en',{minimumFractionDigits:digits,maximumFractionDigits:digits});};
function lootDetails(items){return Object.entries(items).sort((a,b)=>b[1]-a[1]).map(([id,qty])=>{const tier=game.itemTier(Number(id)),base=game.item(game.baseItemId(Number(id)));return '<div class="loot-line"><span>'+esc(name(base.name))+(tier?' · '+t('rarity')[tier]:'')+'</span><span>'+formatRate(qty)+'</span></div>';}).join('');}

function depotCell(monster){
 const result=hourly.get(monster.key);
 return result?(result.homeBank===null?'—':(language==='zh'?'仓库 ':'Depot ')+result.homeBank):(simulationError?'!':'…');
}
function levelCell(monster,open=false){
 const fields=[['health',monster.hp],['damage',monster.max],['chance',(monster.chance*100).toFixed(2)+'%'],['enemyDamage',monster.enemyMax??'—'],['enemyChance',monster.enemyChance===null?'—':(monster.enemyChance*100).toFixed(2)+'%']];
 return `<details id="enemy-level-${esc(monster.key)}" class="reward-detail level-detail"${open?' open':''}><summary>${monster.level}</summary><div>${fields.map(([label,value])=>`<div class="loot-line"><span>${esc(t(label))}</span><span>${esc(value)}</span></div>`).join('')}</div></details>`;
}
function hourlyCells(monster){
 const r=hourly.get(monster.key);if(!r)return Array.from({length:state.manual.vendorValues?7:6},(_,i)=>'<td class="hourly-muted'+((i===1||i===2||(state.manual.vendorValues&&i===5))?' column-highlight':'')+'">'+(i===0?'<details class="reward-detail"><summary>'+(simulationError?'!':'…')+'</summary><div>'+esc(t('depot')+': '+depotCell(monster))+'</div></details>':(simulationError?'!':'…'))+'</td>').join('');
 const detail=(value,body,metric='count')=>'<details class="reward-detail"><summary>'+formatRate(value,metric)+'</summary><div>'+body+'</div></details>';
 const runNote=[
  (language==='zh'?'模拟 ':'Run ')+formatAmount(r.elapsedTicks*game.tickMs/60000)+(language==='zh'?' 分钟':' min'),
  (language==='zh'?'移动 ':'Moving ')+formatAmount(r.movingTicks*game.tickMs/60000)+(language==='zh'?' 分钟':' min'),
  (language==='zh'?'移动占比 ':'Moving share ')+formatAmount(r.elapsedTicks?r.movingTicks/r.elapsedTicks*100:0)+'%',
  (language==='zh'?'取食 ':'Food loads ')+r.restocks+(language==='zh'?' 次':''),
  t('depot')+': '+depotCell(monster),
 ].map(esc).join('<br>');

 const xp=Object.entries(r.bySkill).map(([skill,value])=>t(skill)+': '+formatRate(value,'xp')).join('<br>');
 const stopNote=r.deaths?(language==='zh'?'阵亡，已停止':'Died; stopped'):r.endedEarly?(language==='zh'?'路线提前结束':'Route ended early'):'';
 return '<td>'+detail(r.kills,runNote)+(stopNote?'<small class="death-note">'+stopNote+'</small>':'')+'</td><td class="column-highlight">'+detail(r.xp,xp||'0','xp')+'</td><td class="column-highlight">'+formatRate(r.coins,'coins')+'</td><td>'+detail(state.manual.vendorValues?r.normalValue:r.normal,lootDetails(r.normalItems)||'0.0',state.manual.vendorValues?'coins':'count')+'</td><td>'+detail(state.manual.vendorValues?r.rareValue:r.rare,lootDetails(r.rareItems)||'0.0',state.manual.vendorValues?'coins':'count')+'</td>'+(state.manual.vendorValues?'<td class="column-highlight">'+formatRate(r.totalIncome,'coins')+'</td>':'')+'<td>'+formatRate(r.food)+'</td>';
}
function updateImportStatus(){
 const button=$('#import-character'),status=$('#import-status');if(!button||!status)return;
 button.disabled=importBusy;
 status.textContent=importStatusText(language,importStatus,importBusy);
 if(importBusy||!importStatus||importStatus.error||importStatus.ready||importStatus.snapshot)return;
 const warnings=importStatus.warnings??[];
 if(warnings.length){const warning=document.createElement('span');warning.className='import-warning';warning.textContent=importWarningText(language,warnings);status.append(warning);}
 if(!saveOK)status.append(document.createTextNode(' · '+t('saveFail')));
}
function applyCharacterImport(mode,snapshot){
  if(mode==='snapshot'){
   const input=importSnapshot(snapshot);
   const preview=importCharacter(storedState,{...snapshot,player:input.player,capturedAt:input.capturedAt},{preview:true});
   state=preview.state;state.manual.simulationHours=24;state.manual.customSimulation=false;state.manual.hotSetting='game';
   activeSnapshot=input;importStatus={snapshot:true,capturedAt:input.capturedAt};
  }else{
   const result=importCharacter(activeSnapshot?storedState:state,snapshot);
   activeSnapshot=null;state=result.state;save();importStatus={...result,capturedAt:snapshot.capturedAt};
  }
 return {...importStatus,saveOK:activeSnapshot?true:saveOK};
}
async function runCharacterImport(mode){
 if(importBusy)return;
 importBusy=true;updateImportStatus();
 try{
  const response=await requestCharacter('read');
  if(response.version!=='2.4')throw new Error('scriptOutdated');
  const {snapshot}=response;if(!snapshot)throw new Error('noSnapshot');
  applyCharacterImport(mode,snapshot);
 }catch(error){importStatus={error:error.message};}
 finally{importBusy=false;render();}
}
render();
setInterval(()=>updateForecast(esc),1000);
probeCharacter().then(()=>{if(!importStatus){importStatus={ready:true};updateImportStatus();}}).catch(error=>{if(!importStatus){importStatus={error:error.message};updateImportStatus();}});
