import {marketErrors} from './market-import.js';
import * as game from './upstream.js';
import {collectionDefaults,collectionStorageKey,validateCollection,importCollection,collectionInteger,collectionNumber,collectionPlayers,collectionRows,collectionSkills,priceCollection} from './collection-model.js';
import {craftingSkills,craftingRooms,craftingMasteries,craftingSlots} from './crafting-model.js';
import {gatheringSkills,gatheringRooms,gatheringMasteries,gatheringPerks,gatheringSlots,slotItems,gatheringPotions} from './gathering-model.js';
import {characterImportPanel,requestCharacter,importStatusText} from './import-controls.js';
import {getSnapshot,subscribe,getSaveError,refreshMarket} from './price-service.js';
import {translatedName,translatedItemName} from './i18n.js';
import {worldBuffWarningText} from './world-buffs.js';
import {collectionPlanStorageKey,collectionPlanDefaults,validateCollectionPlan,addCollectionPlan,addCollectionPlans,removeCollectionPlan,setCollectionPlanTarget} from './collection-plan.js';
import {renderCollectionPlan} from './collection-plan-controls.js';
import {encodeCollectionPlan,decodeCollectionPlan} from './collection-plan-transfer.js';
import {collectionAutoImportStorageKey,validateCollectionAutoImport,createCollectionAutoImporter} from './collection-auto-import.js';


let state,language='zh',status=null,marketStatus=null,marketBusy=false,busy=false,saveError=false,loadError=false,error=null,rows=[];
let query='',routeType='craft',skill='all',tier='all',sort='costPerPoint',page=1,filterError=null;
const planSort={selections:{key:null,direction:'asc'},materials:{key:null,direction:'asc'}};
let clipboardBusy=false,clipboardStatus=null,planAutoRemoveCompleted=true;
let calculationNow=Date.now(),active=false,plan=collectionPlanDefaults(),planLoadError=false,planSaveError=false,autoEnabled=false,autoLoadError=false,autoSaveError=false,autoImporter;

const union=(a,b,key)=>[...new Map([...a,...b].map(v=>[key?v[key]:v,v])).values()];
const skills=collectionSkills,rooms=union(gatheringRooms,craftingRooms,'id'),masteries=union(gatheringMasteries,craftingMasteries,'id'),perks=gatheringPerks,slots=union(gatheringSlots,craftingSlots),potions=gatheringPotions;
const metricFilters=[
 {key:'points',label:['新增精通点 ≥','Points gained ≥']},
 {key:'secondsPerPoint',label:['秒/点 ≤','Seconds/point ≤']},
 {key:'costPerPoint',label:['材料金币/点 ≤','Material coins/point ≤']},
 {key:'cost',label:['总材料成本 ≤','Total material cost ≤']},
 {key:'minutes',label:['总时间 ≤（分钟）','Total time ≤ (min)']},
];
const filterValues=Object.fromEntries(metricFilters.map(({key})=>[key,'']));
const filtersStorageKey='dvi-collection-filters-v2';
const filterDefaults=()=>({query:'',skill:'all',tier:'all',sort:'costPerPoint',filterValues:Object.fromEntries(metricFilters.map(({key})=>[key,'']))});
let filterProfiles={gather:filterDefaults(),craft:filterDefaults()};
const routeSkills=type=>type==='gather'?gatheringSkills:craftingSkills;
function restoreFilters(){({query,skill,tier,sort}=filterProfiles[routeType]);Object.assign(filterValues,filterProfiles[routeType].filterValues);}
let filtersLoadError=false,filtersSaveError=false;
const pageSize=10;
const recipesById=new Map(game.recipes.map(job=>[job.id,job]));
const opened=new Set(),drafts=new Map();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(zh,en)=>language==='zh'?zh:en;
const name=s=>translatedName(s,language);
const itemName=id=>translatedItemName(id,language);
const number=(n,maximumFractionDigits=3,minimumFractionDigits=0)=>n===null||n===undefined?'—':Number(n).toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits,minimumFractionDigits});
const duration=seconds=>seconds===null||seconds===undefined?'—':seconds>=3600?`${number(seconds/3600,1,1)} ${text('小时','h')}`:seconds>=60?`${number(seconds/60,1,1)} ${text('分钟','min')}`:`${number(seconds,1,1)} ${text('秒','s')}`;
const skillName=k=>name(({mining:'Mining',fishing:'Fishing',woodcutting:'Woodcutting',thieving:'Thieving',cooking:'Cooking',smithing:'Smithing',fletching:'Fletching',herblore:'Herblore',crafting:'Crafting'})[k]??k);
const tierNames=()=>text(['普通','罕见','稀有','史诗','传说'],['Normal','Uncommon','Rare','Epic','Legendary']);
const labels={invalidNumber:['请输入范围内的有效非负数字','Enter a valid non-negative number in range'],invalidFilter:['筛选数值无效：请输入范围内的非负数字','Invalid filter: enter a non-negative number within range'],uninitialized:['请先导入或开始手动场景','Import or start a manual scenario'],complete:['已完成','Completed'],levelTooLow:['等级不足','Level too low'],noSites:['无合法地点','No legal site'],unreachable:['当前概率为零','Currently zero probability'],ok:['',''],invalidInteger:['请输入范围内的非负整数','Enter a non-negative integer in range'],invalidConfiguration:['配置无效，已有有效数据保留','Invalid settings; valid data was kept'],quantityOverflow:['数量超出计算范围','Quantity exceeds the supported range'],invalidPlan:['计划无效，已有选择保留','Invalid plan; existing selections were kept']};
function message(code){return labels[code]?.[language==='zh'?0:1]??text('计算失败：','Calculation failed: ')+code;}
function overflowNote(row){return row.overflowFields.length?text('材料金额超出计算范围','Material amount exceeds supported range'):'';}
function key(row){return `${row.id}:${row.jobId??'none'}:${row.target??'complete'}`;}
function initialize(){
 if(state)return;
 try{const raw=localStorage.getItem(collectionStorageKey);state=raw?validateCollection(JSON.parse(raw)):collectionDefaults();}catch{state=collectionDefaults();loadError=true;}
 try{
  localStorage.removeItem('dvi-collection-filters-v1');
  const raw=localStorage.getItem(filtersStorageKey);
  if(raw){
   const saved=JSON.parse(raw);
   if(saved?.version!==2||!['gather','craft'].includes(saved.routeType))throw Error('invalidFilters');
   for(const type of ['gather','craft']){
    const profile=saved.profiles?.[type];
    if(!profile||!['all',...routeSkills(type)].includes(profile.skill)||!['all','0','1','2','3','4'].includes(profile.tier)||!['secondsPerPoint','costPerPoint'].includes(profile.sort)||typeof profile.query!=='string'||!metricFilters.every(({key})=>typeof profile.filterValues?.[key]==='string'))throw Error('invalidFilters');
   }
   routeType=saved.routeType;filterProfiles=saved.profiles;restoreFilters();
  }
 }catch{filtersLoadError=true;}
 try{const raw=localStorage.getItem(collectionPlanStorageKey);if(raw)plan=validateCollectionPlan(JSON.parse(raw));}catch{planLoadError=true;}
 try{const raw=localStorage.getItem(collectionAutoImportStorageKey);if(raw)autoEnabled=validateCollectionAutoImport(JSON.parse(raw)).enabled;}catch{autoLoadError=true;}
 autoImporter=createCollectionAutoImporter({run:isCurrent=>importBuild({automatic:true,isCurrent}),onError:e=>{status={error:e.message};updateStatus();},listenFocus:handler=>{window.addEventListener('focus',handler);return ()=>window.removeEventListener('focus',handler);}});
 subscribe(change=>{if(document.getElementById('collection-results')&&(change.storage||state.buyMode==='global'&&change.prices||['ask','bid'].includes(state.buyMode)&&change.market))updateResults();});
}
function saveFilters(){
 filterProfiles[routeType]={query,skill,tier,sort,filterValues:{...filterValues}};
 try{localStorage.removeItem('dvi-collection-filters-v1');localStorage.setItem(filtersStorageKey,JSON.stringify({version:2,routeType,profiles:filterProfiles}));filtersSaveError=false;filtersLoadError=false;}catch{filtersSaveError=true;}
}
function save(){try{localStorage.setItem(collectionStorageKey,JSON.stringify(validateCollection(state)));saveError=false;}catch{saveError=true;}}
function changed(){autoImporter?.invalidate();calculationNow=Date.now();error=null;save();compute();}
function compute(){try{rows=collectionRows(state,{now:calculationNow});}catch(e){rows=[];error=e.message;}updateResults();}
const options=(entries,value)=>entries.map(([v,label])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
const input=(path,label,value,max=Number.MAX_SAFE_INTEGER,min=0,step=1)=>`<label class="number-field"><span>${esc(label)}</span><input type="number" data-collection-path="${path}" value="${value}" min="${min}" max="${max}" step="${step}" aria-label="${esc(label)}"></label>`;
function rememberExpanded(host){for(const card of host.querySelectorAll('[data-collection-key]')){if(card.open)opened.add(card.dataset.collectionKey);else opened.delete(card.dataset.collectionKey);}}
function configuration(){
 const c=state.config,players=collectionPlayers(state,calculationNow),player=players.gather;
 return `<section>
 <details class="config-detail" id="collection-levels"><summary>${text('技能等级','Skill levels')}</summary>${skills.map(k=>input(`config.levels.${k}`,skillName(k),c.levels[k],game.maxLevel,1)+`<p class="micro">${text('当前工作速度加成','Current work speed bonus')} +${number((game.workModifiers(players[gatheringSkills.includes(k)?'gather':'craft'],k).combined-1)*100)}%</p>`).join('')}</details>
 <details class="config-detail" id="collection-tools"><summary>${text('工具与装备','Tools & equipment')}</summary>${slots.map(slot=>`<div class="collection-tool"><label>${esc(name(({pan:'Pan',hammer:'Hammer',knife:'Knife',mortar:'Mortar',needle:'Needle',pickaxe:'Pickaxe',rod:'Fishing rod',axe:'Axe',gloves:'Gloves',amulet:'Amulet',mount:'Mount'})[slot]))}<select data-collection-path="config.gear.${slot}.id" aria-label="${esc(slot)}">${options([[0,text('无','None')],...slotItems(slot).map(g=>[g.itemId,itemName(g.itemId)])],c.gear[slot].id)}</select></label><div class="collection-tool-mods"><label>${text('品质','Rarity')}<select data-collection-path="config.gear.${slot}.tier">${options(tierNames().map((n,i)=>[i,n]),c.gear[slot].tier)}</select></label>${input(`config.gear.${slot}.plus`,text('强化','Enhancement'),c.gear[slot].plus,game.maxEnhancement)}</div></div>`).join('')}</details>
 <details class="config-detail" id="collection-potions"><summary>${text('药水','Potions')}</summary>${potions.map(p=>`<label class="number-field"><span>${esc(itemName(p.itemId))}</span><select data-collection-path="config.brews.${p.kind}">${options([[-1,text('未启用','Inactive')],...tierNames().map((n,i)=>[i,n])],c.brews[p.kind])}</select></label><p class="micro">${({gatherer:text('采集经验；只影响含行程模拟成长','Gathering XP; affects growth in travel simulations'),hunter:text('稀有发现；影响采集品质概率','Rare finds; affects gathering rarity chances'),elixir:text('所有经验；只影响含行程模拟成长','All XP; affects growth in travel simulations'),swift:text('移动速度；只影响含行程模拟','Movement speed; affects travel simulations')})[p.kind]}</p>`).join('')}<label class="check"><input type="checkbox" data-collection-path="config.blessing" ${c.blessing?'checked':''}>${text('矿脉祝福','Vein Blessing')}</label><p class="micro">${text('祝福 +5% 经验、+10% 稀有发现；普通制造指定品质不受幸运影响。药剂与祝福假设全程有效，不计算消耗量或费用。','Blessing adds 5% XP and 10% rare finds; crafting uses a fixed rarity. Potions and blessing stay active throughout; their quantities and costs are excluded.')}</p></details>
 <details class="config-detail" id="collection-home"><summary>${text('家园','Home')}</summary>${rooms.map(r=>input(`config.house.${r.id}`,name(r.name),c.house[r.id])+`<p class="micro">${r.bonus.kind==='rareChance'?text('稀有发现','Rare finds'):text('工作速度','Work speed')} · ${text('当前','Current')} +${number(game.houseBonus(r,c.house[r.id])*100)}%</p>`).join('')}</details>
 <details class="config-detail" id="collection-masteries"><summary>${text('精通等级','Mastery ranks')}</summary><section class="collection-mastery-group" aria-label="${text('精通','Masteries')}">${masteries.map(m=>input(`config.masteries.${m.id}`,name(m.name),c.masteries[m.id],game.masteryRankLimit)+`<p class="micro">${esc(name(m.blurb))} · ${text('当前','Current')} +${number((game.masteryMultiplier(c.masteries,m.id)-1)*100)}%</p>`).join('')}</section></details>
 <details class="config-detail" id="collection-perks"><summary>${text('天赋','Perks')}</summary>${perks.map(p=>input(`config.perks.${p.id}`,name(p.name),c.perks[p.id],p.ranks)+`<p class="micro">${esc(name(p.each))}</p>`).join('')}</details>
 <details class="config-detail" id="collection-bonuses"><summary>${text('公会、世界与热门加成','Guild, world & hot bonuses')}</summary>${input(`config.guildXp`,text('公会经验加成 (%)','Guild XP bonus (%)'),c.guildXp,1e7,0,'any')}${input(`config.weeklyXp`,text('世界增益经验 (%)','World buff XP (%)'),c.weeklyXp,1e7,0,'any')}${input('config.worldRarity',text('世界增益稀有发现 (%)','World buff rare finds (%)'),c.worldRarity,1e7,0,'any')}<label class="number-field"><span>${text('热门加成','Hot bonuses')}</span><select data-collection-path="config.hotSetting">${options([['game',text('沿用游戏设置','Use game settings')],['current',text('按照当前时间','Use current time')],['off',text('不计入','Exclude')]],c.hotSetting)}</select></label><p class="micro">${text('世界增益全程保持；动作估算冻结所选时刻的热门，行程模拟按区间变化。经验只影响模拟成长。','World buffs stay active throughout. Action estimates freeze the selected hot instant; travel simulations follow its schedule. XP affects simulation growth only.')}</p></details>
 <details class="config-detail" id="collection-other"><summary>${text('行程模拟配置','Travel simulation settings')}</summary><label>${text('初始仓库','Starting depot')}<select data-collection-path="config.homeBank">${options([[0,text('自动','Automatic')],...game.world.banks.map(b=>[b.id,name(b.name)])],c.homeBank)}</select></label><label class="check"><input type="checkbox" data-collection-path="config.ironman" ${c.ironman?'checked':''}>${text('铁人模式','Ironman')}</label><p class="micro">${text('背包容量','Pack capacity')} ${game.packCapacity(player)} · ${text('移动速度','Movement speed')} ${number(Math.round(game.mountSpeed(player)*(1+.2*game.brewScale(player,'swift'))*game.masteryMultiplier(player.masteries,'move'))/1000)} m/s · ${text('移动加成由坐骑、移动精通和疾行药剂提供。','Movement bonuses come from the mount, movement mastery and swift potion.')}</p></details></section>`;
}
export function renderCollection(lang,{isActive=false}={}){
 language=lang;active=isActive;
 if(!isActive){autoImporter?.set({enabled:autoEnabled,active:false});return;}
 const host=document.getElementById('collection-content');if(!host)return;
 initialize();rememberExpanded(host);const openDetails=new Set([...host.querySelectorAll('.config-detail[open]')].map(d=>d.id));
 host.innerHTML=`<aside class="panel gather-config"><div class="panel-heading"><h1 id="collection-title">${text('角色配置','Character build')}</h1><button id="collection-reset" class="text-button" title="${text('保留执行计划与自动导入选项','Keeps the execution plan and auto-import setting')}">${text('清空配置','Reset')}</button></div>${characterImportPanel(language,{id:'collection-import-panel',statusId:'collection-import-status',buttons:[{id:'collection-import',label:text('导入收藏与角色','Import collection & build')}],extra:`<label class="check"><input type="checkbox" id="collection-auto-import" ${autoEnabled?'checked':''}>${text('自动导入（每次聚焦时）','Auto-import (on every focus)')}</label><p class="micro import-status" role="status" id="collection-auto-status"></p>`})}<button id="collection-manual" class="secondary" ${state.initialized?'hidden':''}>${text('手动场景（从零开始）','Manual scenario (start from zero)')}</button><p id="collection-origin" class="micro"></p><p id="collection-buff-warning" class="micro" role="status"></p>${configuration()}<p class="micro">${text('动作估算固定当前属性；药剂与祝福全程有效，不计药剂与祝福费用。不计设备购置、材料自采、交易等待及费用。','Fixed-stat action estimates; boosts stay active throughout. Potion and blessing costs, equipment, self-sourcing, trading time and fees are excluded.')}</p><p id="collection-save" role="status" class="micro"></p></aside>
 <div class="collection-information"><section class="panel"><h2>${text('精通性价比','Mastery efficiency')}</h2><p class="micro">${text('奖励来自亲自产出的数量里程碑，买成品不增加进度。各行独立比较，副产物点数不计入。动作估算不含移动、回仓与升级，热门只取所选时刻。','Rewards require your own production milestones. Buying finished items adds no progress. Routes are independent; bonus-item points are excluded. Action estimates exclude travel, deposits and levelling; hot bonuses use the selected instant.')}</p>
 <div class="collection-filters">
 <div class="collection-filter-row"><label>${text('类型','Type')}<select id="collection-type">${options([['gather',text('采集','Gathering')],['craft',text('制造','Crafting')]],routeType)}</select></label><label>${text('材料成本','Material cost')}<select id="collection-buy">${options([['global',text('全局物品价格','Global item prices')],['ask',text('市场卖单','Market sell orders')],['bid',text('市场买单','Market buy orders')],['vendor',text('商人价格','Vendor prices')]],state.buyMode)}</select></label></div>
 <div class="collection-filter-row"><label>${text('技能','Skill')}<select id="collection-skill">${options([['all',text('全部','All')],...routeSkills(routeType).map(k=>[k,skillName(k)])],skill)}</select></label><label>${text('品质','Rarity')}<select id="collection-tier">${options([['all',text('全部','All')],...tierNames().map((n,i)=>[i,n])],tier)}</select></label><label>${text('物品','Item')}<input id="collection-search" type="search" value="${esc(query)}"></label><label class="collection-sort-filter">${text('排序','Sort')}<select id="collection-sort">${options([['secondsPerPoint',text('时间（升序）','Time (ascending)')],['costPerPoint',text('材料成本（升序）','Material cost (ascending)')]],sort)}</select></label></div>
 <div class="collection-filter-row collection-metric-filters">${metricFilters.map(({key,label})=>`<label>${text(...label)}<input id="collection-filter-${key}" type="text" inputmode="decimal" value="${esc(filterValues[key])}" placeholder="${text('不限','Any')}"></label>`).join('')}</div></div>
 <p id="collection-summary" class="micro" role="status"></p><p id="collection-error" role="alert"></p><div class="collection-list-actions"><a id="collection-plan-link" href="#collection-plan"></a><button id="collection-add-filtered" class="text-button" disabled></button></div><div id="collection-results"></div><nav id="collection-pages-bottom" class="collection-pagination" hidden></nav></section><section class="panel" id="collection-plan" aria-label="${text('执行计划','Execution plan')}"></section></div>`;
 for(const id of openDetails){const el=document.getElementById(id);if(el)el.open=true;}
 host.querySelector('#collection-import').onclick=()=>importBuild();
 host.querySelector('#collection-auto-import').onchange=e=>{
  autoEnabled=e.target.checked;autoLoadError=false;
  try{localStorage.setItem(collectionAutoImportStorageKey,JSON.stringify({version:1,enabled:autoEnabled}));autoSaveError=false;}catch{autoSaveError=true;}
  autoImporter.set({enabled:autoEnabled,active});updateStatus();
 };
 host.querySelector('#collection-manual').onclick=()=>{state.initialized=true;state.bank={};state.pack={};state.edited=true;changed();renderCollection(language,{isActive:true});};
 host.querySelector('#collection-reset').onclick=()=>{state=collectionDefaults();drafts.clear();opened.clear();status=null;loadError=false;changed();renderCollection(language,{isActive:true});};
 host.querySelectorAll('[data-collection-path]').forEach(el=>{
  el.oninput=()=>drafts.set(el.dataset.collectionPath,{value:el.value,checked:el.checked});
  el.onchange=()=>{
   try{
    const path=el.dataset.collectionPath;
    const value=el.type==='checkbox'?el.checked:path.endsWith('.hotSetting')?el.value:path.includes('.brews.')?collectionNumber(el.value,-1,4):el.step==='any'?collectionNumber(el.value):collectionInteger(el.value,el.max?Number(el.max):Number.MAX_SAFE_INTEGER);
    if(path.includes('.brews.')&&!Number.isInteger(value))throw Error('invalidInteger');
    if(el.min&&value<Number(el.min))throw Error('invalidInteger');
    const next=structuredClone(state),parts=el.dataset.collectionPath.split('.');let o=next;for(const k of parts.slice(0,-1))o=o[k];o[parts.at(-1)]=value;
    state=validateCollection(next);drafts.delete(el.dataset.collectionPath);el.setCustomValidity('');changed();renderCollection(language,{isActive:true});
   }catch(e){error=e.message;el.setCustomValidity(message(e.message));updateStatus();}
  };
  const draft=drafts.get(el.dataset.collectionPath);if(draft){el.value=draft.value;el.checked=draft.checked;}
 });
 for(const [id,set]of [['collection-search',v=>query=v],['collection-skill',v=>skill=v],['collection-tier',v=>tier=v],['collection-sort',v=>sort=v]])host.querySelector('#'+id)[id==='collection-search'?'oninput':'onchange']=e=>{set(e.target.value);page=1;saveFilters();updateResults();};
 host.querySelector('#collection-type').onchange=e=>{
  filterProfiles[routeType]={query,skill,tier,sort,filterValues:{...filterValues}};
  routeType=e.target.value;restoreFilters();page=1;opened.clear();
  host.querySelectorAll('[data-collection-key]').forEach(card=>card.open=false);
  saveFilters();renderCollection(language,{isActive:true});host.querySelector('#collection-type').focus();
 };
 for(const {key}of metricFilters)host.querySelector('#collection-filter-'+key).oninput=e=>{filterValues[key]=e.target.value;page=1;saveFilters();updateResults();};
 host.querySelector('#collection-buy').onchange=e=>{state.buyMode=e.target.value;page=1;save();updateResults();};
 compute();
 autoImporter.set({enabled:autoEnabled,active});
}
function updateStatus(){
 const host=document.getElementById('collection-content');if(!host?.querySelector('#collection-save'))return;
 host.querySelector('#collection-import').disabled=busy;
 host.querySelector('#collection-auto-status').textContent=[autoLoadError?text('自动导入设置无法读取，当前关闭。','Auto-import settings could not be read; disabled.'):'',autoSaveError?text('自动导入设置保存失败。','Auto-import settings could not be saved.'):''].filter(Boolean).join(' ');
 host.querySelector('#collection-buff-warning').textContent=state.importWarnings.map(w=>w.startsWith('collections.invalid:')?text(`【收藏】存在错误记录，已跳过 ${w.split(':')[1]} 条，仅导入合法记录。`,`[Collection] Invalid records found: skipped ${w.split(':')[1]}; only valid records were imported.`):worldBuffWarningText(language,w)).join(' ')+(state.importWarnings.some(w=>!w.startsWith('collections.invalid:'))?text(' 该提示针对导入时的数据；当前手动配置以表单为准。',' This warning concerns the imported capture; current manual settings are shown in the form.'):'');
 host.querySelector('#collection-import-status').textContent=[importStatusText(language,status,busy&&!marketBusy),marketBusy?text('正在更新市场数据…','Updating market data…'):marketStatus?.error?text('市场更新失败：','Market update failed: ')+(marketErrors[marketStatus.error]?.[language==='zh'?0:1]??marketStatus.error):marketStatus?text('市场数据已更新。','Market data updated.'):''].filter(Boolean).join('\n');
 host.querySelector('#collection-origin').textContent=!state.initialized?message('uninitialized'):state.capturedAt?text('收藏捕获于：','Collection captured: ')+new Date(state.capturedAt).toLocaleString(language==='zh'?'zh-CN':'en')+(state.edited?text(' · 已手动修正',' · Manually adjusted'):''):text('手动场景；未填写的数量为 0。','Manual scenario; unspecified counts are zero.');
 host.querySelector('#collection-save').textContent=[filtersLoadError?text('筛选无法读取或旧存档无法删除，已使用默认筛选。','Filters could not be read or old filters could not be removed; defaults are in use.'):'',filtersSaveError?text('筛选保存失败或旧存档无法删除，当前内存筛选仍可用。','Filters could not be saved or old filters could not be removed; current filters remain usable.'):'',loadError?text('存档无法读取，已恢复默认配置。','Saved settings could not be read; defaults restored.'):'',saveError?text('保存失败，当前内存计算仍可用。','Save failed; calculations remain available.'):'',!loadError&&!saveError?text('配置自动保存在此浏览器。','Settings are saved in this browser.'):''].filter(Boolean).join(' ');
 host.querySelector('#collection-error').textContent=filterError?message(filterError):error?message(error):getSaveError()?text('全局价格存储异常，请打开物品价格查看。','Price storage error; open Item prices for details.'):'';
}
function updateResults(){
 const host=document.getElementById('collection-results');if(!host)return;
 rememberExpanded(host);
 updatePlan();
 updateCandidateActions([],false);
 let thresholds;
 try{thresholds=Object.fromEntries(metricFilters.map(({key})=>[key,filterValues[key].trim()===''?null:collectionNumber(filterValues[key],0,Number.MAX_SAFE_INTEGER)]));filterError=null;}
 catch{filterError='invalidFilter';updateStatus();host.innerHTML='';document.getElementById('collection-summary').textContent='';return;}
 updateStatus();
 if(!state.initialized){host.innerHTML=`<p class="empty-results">${message('uninitialized')}</p>`;return;}
 const prices=getSnapshot(),q=query.trim().toLowerCase();let valued;
 const matching=rows.filter(row=>
  !row.complete&&state.config.levels[row.skill]>=recipesById.get(row.jobId).levelReq&&
  routeSkills(routeType).includes(row.skill)&&
  (skill==='all'||row.skill===skill)&&(tier==='all'||game.itemTier(row.id)===Number(tier))&&
  (!q||`${game.item(row.id).name} ${translatedItemName(row.id,'zh')} ${itemName(row.id)}`.toLowerCase().includes(q))
 );
 try{valued=matching.map(r=>priceCollection(r,prices,state.buyMode)).filter(row=>metricFilters.every(({key})=>{
  const bound=thresholds[key];if(bound===null)return true;
  const value=key==='minutes'?(row.seconds===null?null:row.seconds/60):row[key];
  return Number.isFinite(value)&&(key==='points'?value>=bound:value<=bound);
 }));}catch(e){error=e.message;updateStatus();host.innerHTML='';return;}
 const unfinished=rows.filter(r=>!r.complete).length,missingPrices=valued.filter(r=>r.status==='ok'&&r.materialsPriced.some(i=>i.qty>0&&i.price===null)).length,overflows=valued.filter(r=>r.overflowFields.length>0).length;
 document.getElementById('collection-summary').textContent=text(`未完成目标 ${unfinished} · 匹配 ${valued.length} · 材料缺价 ${missingPrices}${overflows?` · 金额超限 ${overflows}`:''}`,`Unfinished targets ${unfinished} · Matching ${valued.length} · Missing material prices ${missingPrices}${overflows?` · Amount overflow ${overflows}`:''}`);
 const sortValue=row=>row.status==='ok'?row[sort]:null;
 valued.sort((a,b)=>{const av=sortValue(a),bv=sortValue(b);return (av===null)-(bv===null)||(av===null?0:av-bv)||a.id-b.id||(a.jobId??0)-(b.jobId??0)||(a.target??0)-(b.target??0);});
 updateCandidateActions(valued);
 host.innerHTML=valued.length?valued.slice((page-1)*pageSize,page*pageSize).map(r=>`<details class="collection-card" data-collection-key="${key(r)}" ${opened.has(key(r))?'open':''}><summary><span class="collection-item"><strong class="collection-item-heading"><span class="collection-item-name">${esc(itemName(r.id))}</span> · <span class="collection-item-tier">${tierNames()[game.itemTier(r.id)]}</span></strong><small>${esc(skillName(r.skill))}</small></span><span><small>${text('当前 → 目标','Current → target')}</small>${number(r.current)} → ${number(r.target)}</span><span class="collection-points"><small>${text('新增精通点','Points gained')}</small><strong>${number(r.points)}</strong></span><span class="collection-total-cost"><small>${text('总材料成本','Total material cost')}</small>${r.status==='ok'?number(r.cost,0):'—'}</span><span class="collection-total-time" data-collection-metric="seconds"><small>${text('总时间','Total time')}</small>${duration(r.seconds)}</span><span data-collection-metric="secondsPerPoint"><small>${text('秒／点','Seconds/point')}</small>${number(r.secondsPerPoint,1,1)}</span><span data-collection-metric="costPerPoint"><small>${text('材料金币／点','Material coins/point')}</small>${r.status==='ok'?number(r.costPerPoint,0):'—'}${r.status!=='ok'?`<small>${message(r.status)}</small>`:''}${r.overflowFields.length?`<small class="collection-overflow">⚠ ${overflowNote(r)}</small>`:''}</span><span class="collection-plan-action">${planButton(r)}</span></summary><div class="collection-detail"></div></details>`).join(''):`<p class="empty-results">${text('没有匹配的收藏','No matching collections')}</p>`;
 host.querySelectorAll('[data-collection-key]').forEach(card=>{
  const row=valued.find(r=>key(r)===card.dataset.collectionKey);
  card.querySelector('[data-collection-plan]')?.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const selected=plan.selections.find(s=>s.itemId===row.id&&s.jobId===row.jobId&&s.target===row.target);changePlan(()=>selected?removeCollectionPlan(plan,row.id):addCollectionPlan(plan,{itemId:row.id,jobId:row.jobId,target:row.target}));});
  card.ontoggle=()=>{if(!card.isConnected)return;if(card.open){opened.add(key(row));detail(card,row);}else opened.delete(key(row));};
  if(card.open)detail(card,row);
 });
}
function updateCandidateActions(valued,clamp=true){
 const pages=Math.max(1,Math.ceil(valued.length/pageSize));if(clamp)page=Math.min(page,pages);
 const nav=document.getElementById('collection-pages-bottom');nav.hidden=pages===1;
 nav.setAttribute('aria-label',text('候选方案翻页','Candidate routes pagination'));
 nav.innerHTML=`<button class="text-button" data-page-step="-1" ${page===1?'disabled':''}>${text('上一页','Previous')}</button><span>${text(`第 ${page} / ${pages} 页`,`Page ${page} / ${pages}`)}</span><button class="text-button" data-page-step="1" ${page===pages?'disabled':''}>${text('下一页','Next')}</button>`;
 nav.querySelectorAll('[data-page-step]').forEach(button=>button.onclick=()=>{
  page+=Number(button.dataset.pageStep);updateResults();
  document.getElementById('collection-results').scrollIntoView({block:'start'});
 });
 const eligible=valued.filter(row=>row.status==='ok'&&row.target!==null);
 const button=document.getElementById('collection-add-filtered');
 button.textContent=text(`将当前筛选的 ${eligible.length} 个方案加入计划`,`Add ${eligible.length} filtered routes to plan`);
 button.disabled=planLoadError||eligible.length===0;
 button.onclick=()=>changePlan(()=>addCollectionPlans(plan,eligible.map(row=>({itemId:row.id,jobId:row.jobId,target:row.target}))));
}
function detail(card,row){
 const list=items=>items.length?items.map(i=>`<li>${esc(itemName(i.id))} (${tierNames()[game.itemTier(i.id)]}) × ${number(i.qty)} — ${number(i.price)} ${text('金币','coins')} <small>${({global:text('全局物品价格','Global item prices'),ask:text('最低卖单','Lowest sell order'),bid:text('最高买单','Highest buy order'),vendor:text('商人估值','Vendor valuation')})[i.source]}${i.time?' · '+esc(new Date(i.time).toLocaleString(language==='zh'?'zh-CN':'en')):''}${i.price===null?' · '+text('缺报价','Missing price'):''}</small></li>`).join(''):`<li>${text('无','None')}</li>`;
 card.querySelector('.collection-detail').innerHTML=`<h3>${text('材料采购','Material purchases')}</h3><ul>${list(row.materialsPriced)}</ul>`;
}

async function importBuild({automatic=false,isCurrent=()=>true}={}){
 if(busy||(automatic&&drafts.size))return;
 const previous=state;busy=true;status=null;marketStatus=null;updateStatus();
 try{
  const response=await requestCharacter('read');
  if(automatic&&(!isCurrent()||state!==previous||drafts.size))return;
  if(!response.snapshot)throw Error('noSnapshot');
  state=importCollection(state,response.snapshot);drafts.clear();loadError=false;status={capturedAt:state.capturedAt};changed();renderCollection(language,{isActive:active});
  marketBusy=true;updateStatus();
  try{await refreshMarket();marketStatus={updated:true};}catch(e){marketStatus={error:e.message};}finally{marketBusy=false;}
 }catch(e){if(!automatic||isCurrent())status={error:e.message};}finally{busy=false;updateStatus();}
}
function changePlan(action){
 if(planLoadError)return;
 try{plan=validateCollectionPlan(action());savePlan();updateResults();}catch(e){error=e.message;updateStatus();}
}
function removeCompletedPlan(){
 if(!planAutoRemoveCompleted||planLoadError||!state.initialized)return false;
 const selections=plan.selections.filter(entry=>(state.counts[entry.itemId]??0)<entry.target);
 if(selections.length===plan.selections.length)return false;
 plan={...plan,selections};return true;
}
function savePlan(){
 removeCompletedPlan();
 try{localStorage.setItem(collectionPlanStorageKey,JSON.stringify(plan));planSaveError=false;}catch{planSaveError=true;}
}
function planButton(row){
 const entry=plan.selections.find(s=>s.itemId===row.id),same=entry?.jobId===row.jobId,selected=same&&entry.target===row.target,covered=same&&entry.target>row.target;
 return `<button class="text-button collection-plan-toggle" data-collection-plan="${key(row)}" aria-pressed="${selected}" ${planLoadError||covered||(!selected&&(row.status!=='ok'||row.target===null))?'disabled':''}>${selected?text('移出计划','Remove from plan'):covered?text('已含于目标 ','Included in target ')+number(entry.target):text('加入计划','Add to plan')}</button>`;
}
async function transferPlan(action){
 if(clipboardBusy||planLoadError)return;
 if(action==='import'&&!window.confirm(text('从剪贴板导入将替换当前计划，确定继续吗？','Importing from clipboard will replace the current plan. Continue?')))return;
 const original=plan;
 clipboardBusy=true;clipboardStatus=null;updatePlan();
 try{
  if(action==='export'){
   if(!navigator.clipboard?.writeText)throw Error('unavailable');
   await navigator.clipboard.writeText(await encodeCollectionPlan(plan));
  }else{
   if(!navigator.clipboard?.readText)throw Error('unavailable');
   const raw=await navigator.clipboard.readText();
   let incoming;
   try{incoming=await decodeCollectionPlan(raw);}catch(e){throw Error(e.message==='decompressionUnavailable'?e.message:'invalidPlan');}
   if(plan!==original||planLoadError)throw Error('changed');
   plan=incoming;savePlan();updateResults();
  }
  clipboardStatus={action,ok:true};
 }catch(e){clipboardStatus={action,error:e.message};}
 finally{clipboardBusy=false;updatePlan();}
}
function updatePlan(){
 if(removeCompletedPlan())savePlan();
 const link=document.getElementById('collection-plan-link');if(link)link.textContent=text('已选方案：','Selected routes: ')+plan.selections.length;
 renderCollectionPlan(document.getElementById('collection-plan'),{state,plan,prices:getSnapshot(),language,formatDuration:duration,now:calculationNow,loadError:planLoadError,saveError:planSaveError,statusText:message,sort:planSort,onSort:updatePlan,
  clipboardBusy,clipboardStatus,onExport:()=>transferPlan('export'),onImport:()=>transferPlan('import'),
  autoRemoveCompleted:planAutoRemoveCompleted,onAutoRemoveCompleted:value=>{planAutoRemoveCompleted=value;updateResults();},
  onClear:()=>{
   if(!window.confirm(text('确定清空全部执行计划吗？','Clear the entire execution plan?')))return;
   clipboardStatus=null;planLoadError=false;plan=collectionPlanDefaults();savePlan();updateResults();
  },
  onTarget:(itemId,target)=>changePlan(()=>setCollectionPlanTarget(plan,itemId,target)),
  onRemove:itemId=>changePlan(()=>removeCollectionPlan(plan,itemId))});
}
