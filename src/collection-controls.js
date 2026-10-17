import * as game from './upstream.js';
import {collectionDefaults,collectionStorageKey,validateCollection,importCollection,collectionInteger,collectionNumber,collectionPlayers,collectionRows,collectionSkills,priceCollection} from './collection-model.js';
import {craftingSkills,craftingRooms,craftingMasteries,craftingSlots} from './crafting-model.js';
import {gatheringSkills,gatheringRooms,gatheringMasteries,gatheringPerks,gatheringSlots,slotItems,gatheringPotions} from './gathering-model.js';
import {characterImportPanel,requestCharacter,importStatusText} from './import-controls.js';
import {priceState,subscribePrices,priceSaveError} from './item-price-store.js';
import {translatedName,translatedItemName} from './i18n.js';
import {worldBuffWarningText} from './world-buffs.js';
import {randomSimulationSeed} from './simulation-seed.js';

let state,language='zh',status=null,busy=false,saveError=false,loadError=false,error=null,rows=[],worker=null,run=0,simulationKey=null,simulationProgress=null;
let query='',routeType='craft',skill='all',tier='all',sort='costPerPoint',onlyLevelMet=true,includeComplete=false,limit=40,pointsMin='',pointsMax='',pointsFilterError=null;
let calculationNow=Date.now();
const union=(a,b,key)=>[...new Map([...a,...b].map(v=>[key?v[key]:v,v])).values()];
const skills=collectionSkills,rooms=union(gatheringRooms,craftingRooms,'id'),masteries=union(gatheringMasteries,craftingMasteries,'id'),perks=gatheringPerks,slots=union(gatheringSlots,craftingSlots),potions=gatheringPotions;
const recipesById=new Map(game.recipes.map(job=>[job.id,job]));
const opened=new Set(),simulations=new Map(),drafts=new Map();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(zh,en)=>language==='zh'?zh:en;
const name=s=>translatedName(s,language);
const itemName=id=>translatedItemName(id,language);
const number=n=>n===null||n===undefined?'—':Number(n).toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:3});
const skillName=k=>name(({mining:'Mining',fishing:'Fishing',woodcutting:'Woodcutting',thieving:'Thieving',cooking:'Cooking',smithing:'Smithing',fletching:'Fletching',herblore:'Herblore',crafting:'Crafting'})[k]??k);
const tierNames=()=>text(['普通','罕见','稀有','史诗','传说'],['Normal','Uncommon','Rare','Epic','Legendary']);
const labels={invalidNumber:['请输入范围内的有效非负数字','Enter a valid non-negative number in range'],invalidPointRange:['精通点范围无效：请输入非负整数，且最小值不得大于最大值','Invalid mastery point range: use non-negative integers, with minimum no greater than maximum'],uninitialized:['请先导入或开始手动场景','Import or start a manual scenario'],complete:['已完成','Completed'],levelTooLow:['等级不足','Level too low'],noSites:['无合法地点','No legal site'],unreachable:['当前概率为零','Currently zero probability'],ok:['纯动作估算','Action time estimate'],invalidInteger:['请输入范围内的非负整数','Enter a non-negative integer in range'],invalidConfiguration:['配置无效，已有有效数据保留','Invalid settings; valid data was kept'],quantityOverflow:['数量超出计算范围','Quantity exceeds the supported range']};
function message(code){return labels[code]?.[language==='zh'?0:1]??text('计算失败：','Calculation failed: ')+code;}
function overflowNote(row){const labels={cost:text('材料投入','Material investment'),value:text('产物回收','Product recovery'),potions:text('药剂投入','Potion investment'),investment:text('总投入','Total investment')};return row.overflowFields.length?text('金额超出计算范围：','Amount exceeds supported range: ')+row.overflowFields.map(k=>labels[k]).join(text('、',', ')):'';}
function key(row){return `${row.id}:${row.jobId??'none'}:${row.target??'complete'}`;}
function initialize(){
 if(state)return;
 try{const raw=localStorage.getItem(collectionStorageKey);state=raw?validateCollection(JSON.parse(raw)):collectionDefaults();}catch{state=collectionDefaults();loadError=true;}
 subscribePrices(()=>{if(document.getElementById('collection-results'))updateResults();});
}
function save(){try{localStorage.setItem(collectionStorageKey,JSON.stringify(validateCollection(state)));saveError=false;}catch{saveError=true;}}
function cancel(){run++;worker?.terminate();worker=null;simulationKey=null;simulationProgress=null;}
function changed(){calculationNow=Date.now();cancel();simulations.clear();error=null;save();compute();}
function compute(){try{rows=collectionRows(state,{now:calculationNow});}catch(e){rows=[];error=e.message;}updateResults();}
const options=(entries,value)=>entries.map(([v,label])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
const input=(path,label,value,max=Number.MAX_SAFE_INTEGER,min=0,step=1)=>`<label class="number-field"><span>${esc(label)}</span><input type="number" data-collection-path="${path}" value="${value}" min="${min}" max="${max}" step="${step}" aria-label="${esc(label)}"></label>`;
function rememberExpanded(host){for(const card of host.querySelectorAll('[data-collection-key]')){if(card.open)opened.add(card.dataset.collectionKey);else opened.delete(card.dataset.collectionKey);}}
function configuration(){
 const c=state.config,players=collectionPlayers(state,calculationNow),player=players.gather;
 return `<section>
 <details class="config-detail" id="collection-levels"><summary>${text('技能等级','Skill levels')}</summary>${skills.map(k=>input(`config.levels.${k}`,skillName(k),c.levels[k],game.maxLevel,1)+`<p class="micro">${text('当前工作速度加成','Current work speed bonus')} +${number((game.workModifiers(players[gatheringSkills.includes(k)?'gather':'craft'],k).combined-1)*100)}%</p>`).join('')}</details>
 <details class="config-detail" id="collection-tools"><summary>${text('工具与装备','Tools & equipment')}</summary>${slots.map(slot=>`<div class="collection-tool"><label>${esc(name(({pan:'Pan',hammer:'Hammer',knife:'Knife',mortar:'Mortar',needle:'Needle',pickaxe:'Pickaxe',rod:'Fishing rod',axe:'Axe',gloves:'Gloves',amulet:'Amulet',mount:'Mount'})[slot]))}<select data-collection-path="config.gear.${slot}.id" aria-label="${esc(slot)}">${options([[0,text('无','None')],...slotItems(slot).map(g=>[g.itemId,itemName(g.itemId)])],c.gear[slot].id)}</select></label><div class="collection-tool-mods"><label>${text('品质','Rarity')}<select data-collection-path="config.gear.${slot}.tier">${options(tierNames().map((n,i)=>[i,n]),c.gear[slot].tier)}</select></label>${input(`config.gear.${slot}.plus`,text('强化','Enhancement'),c.gear[slot].plus,game.maxEnhancement)}</div></div>`).join('')}</details>
 <details class="config-detail" id="collection-potions"><summary>${text('药水','Potions')}</summary>${potions.map(p=>`<label class="number-field"><span>${esc(itemName(p.itemId))}</span><select data-collection-path="config.brews.${p.kind}">${options([[-1,text('未启用','Inactive')],...tierNames().map((n,i)=>[i,n])],c.brews[p.kind])}</select></label><p class="micro">${({gatherer:text('采集经验；只影响含行程模拟成长','Gathering XP; affects growth in travel simulations'),hunter:text('稀有发现；影响采集品质概率','Rare finds; affects gathering rarity chances'),elixir:text('所有经验；只影响含行程模拟成长','All XP; affects growth in travel simulations'),swift:text('移动速度；只影响含行程模拟','Movement speed; affects travel simulations')})[p.kind]}</p>`).join('')}<label class="check"><input type="checkbox" data-collection-path="config.blessing" ${c.blessing?'checked':''}>${text('矿脉祝福','Vein Blessing')}</label><p class="micro">${text('祝福 +5% 经验、+10% 稀有发现；普通制造指定品质不受幸运影响。药剂按全程续用折算费用，制造不计采集专用药剂；祝福费用不计。','Blessing adds 5% XP and 10% rare finds; crafting uses a fixed rarity. Potion upkeep is charged throughout; crafting excludes gathering-only potions. Blessing acquisition cost is excluded.')}</p></details>
 <details class="config-detail" id="collection-home"><summary>${text('家园','Home')}</summary>${rooms.map(r=>input(`config.house.${r.id}`,name(r.name),c.house[r.id])+`<p class="micro">${r.bonus.kind==='rareChance'?text('稀有发现','Rare finds'):text('工作速度','Work speed')} · ${text('当前','Current')} +${number(game.houseBonus(r,c.house[r.id])*100)}%</p>`).join('')}</details>
 <details class="config-detail" id="collection-masteries"><summary>${text('精通等级','Mastery ranks')}</summary><section class="collection-mastery-group" aria-label="${text('精通','Masteries')}">${masteries.map(m=>input(`config.masteries.${m.id}`,name(m.name),c.masteries[m.id],game.masteryRankLimit)+`<p class="micro">${esc(name(m.blurb))} · ${text('当前','Current')} +${number((game.masteryMultiplier(c.masteries,m.id)-1)*100)}%</p>`).join('')}</section></details>
 <details class="config-detail" id="collection-perks"><summary>${text('天赋','Perks')}</summary>${perks.map(p=>input(`config.perks.${p.id}`,name(p.name),c.perks[p.id],p.ranks)+`<p class="micro">${esc(name(p.each))}</p>`).join('')}</details>
 <details class="config-detail" id="collection-bonuses"><summary>${text('公会、世界与热门加成','Guild, world & hot bonuses')}</summary>${input(`config.guildXp`,text('公会经验加成 (%)','Guild XP bonus (%)'),c.guildXp,1e7,0,'any')}${input(`config.weeklyXp`,text('世界增益经验 (%)','World buff XP (%)'),c.weeklyXp,1e7,0,'any')}${input('config.worldRarity',text('世界增益稀有发现 (%)','World buff rare finds (%)'),c.worldRarity,1e7,0,'any')}<label class="number-field"><span>${text('热门加成','Hot bonuses')}</span><select data-collection-path="config.hotSetting">${options([['game',text('沿用游戏设置','Use game settings')],['current',text('按照当前时间','Use current time')],['off',text('不计入','Exclude')]],c.hotSetting)}</select></label><p class="micro">${text('世界增益全程保持；动作估算冻结所选时刻的热门，行程模拟按区间变化。经验只影响模拟成长。','World buffs stay active throughout. Action estimates freeze the selected hot instant; travel simulations follow its schedule. XP affects simulation growth only.')}</p></details>
 <details class="config-detail" id="collection-other"><summary>${text('行程模拟配置','Travel simulation settings')}</summary><label>${text('初始仓库','Starting depot')}<select data-collection-path="config.homeBank">${options([[0,text('自动','Automatic')],...game.world.banks.map(b=>[b.id,name(b.name)])],c.homeBank)}</select></label><label class="check"><input type="checkbox" data-collection-path="config.ironman" ${c.ironman?'checked':''}>${text('铁人模式','Ironman')}</label><p class="micro">${text('背包容量','Pack capacity')} ${game.packCapacity(player)} · ${text('移动速度','Movement speed')} ${number(Math.round(game.mountSpeed(player)*(1+.2*game.brewScale(player,'swift'))*game.masteryMultiplier(player.masteries,'move'))/1000)} m/s · ${text('移动加成由坐骑、移动精通和疾行药剂提供。','Movement bonuses come from the mount, movement mastery and swift potion.')}</p></details></section>`;
}
export function renderCollection(lang,{isActive=false}={}){
 language=lang;const host=document.getElementById('collection-content');if(!host||!isActive)return;
 initialize();rememberExpanded(host);const openDetails=new Set([...host.querySelectorAll('.config-detail[open]')].map(d=>d.id));
 host.innerHTML=`<aside class="panel gather-config"><div class="panel-heading"><h1 id="collection-title">${text('收藏性价比','Collection efficiency')}</h1><button id="collection-reset" class="text-button">${text('清空配置','Reset')}</button></div>${characterImportPanel(language,{id:'collection-import-panel',statusId:'collection-import-status',buttons:[{id:'collection-import',label:text('导入收藏与角色','Import collection & build')}]})}<button id="collection-manual" class="secondary" ${state.initialized?'hidden':''}>${text('手动场景（从零开始）','Manual scenario (start from zero)')}</button><p id="collection-origin" class="micro"></p><p id="collection-buff-warning" class="micro" role="status"></p>${configuration()}<p class="micro">${text('动作估算固定当前属性；药剂与祝福全程有效，药剂另计费用，祝福购置费不计。不计设备购置、材料自采、交易等待及费用。','Fixed-stat action estimates; boosts stay active throughout. Potions are charged separately; blessing acquisition, equipment, self-sourcing, trading time and fees are excluded.')}</p><p id="collection-save" role="status" class="micro"></p></aside>
 <div class="collection-information"><section class="panel"><h2>${text('精通性价比','Mastery efficiency')}</h2><p class="micro">${text('奖励来自亲自产出的数量里程碑，买成品不增加进度。各行独立比较，产物可留存或卖出；副产物点数不计入。动作估算不含移动、回仓与升级，热门只取所选时刻。','Rewards require your own production milestones. Buying finished items adds no progress. Routes are independent; keep or sell products. Bonus-item points are excluded. Action estimates exclude travel, deposits and levelling; hot bonuses use the selected instant.')}</p>
 <div class="collection-filters"><div class="collection-filter-row"><label>${text('类型','Type')}<select id="collection-type">${options([['all',text('全部','All')],['gather',text('采集','Gathering')],['craft',text('制造','Crafting')]],routeType)}</select></label><label>${text('技能','Skill')}<select id="collection-skill">${options([['all',text('全部','All')],...collectionSkills.map(k=>[k,skillName(k)])],skill)}</select></label><label>${text('品质','Rarity')}<select id="collection-tier">${options([['all',text('全部','All')],...tierNames().map((n,i)=>[i,n])],tier)}</select></label><label>${text('搜索物品','Search items')}<input id="collection-search" type="search" value="${esc(query)}"></label><label>${text('材料成本价格','Material cost prices')}<select id="collection-buy">${options([['ask',text('市场卖单','Market sell orders')],['bid',text('市场买单','Market buy orders')],['vendor',text('商人价','Vendor prices')]],state.buyMode)}</select></label><label>${text('产物回收','Product recovery')}<select id="collection-sell">${options([['bid',text('市场买单','Market buy orders')],['vendor',text('商人出售','Vendor sale')]],state.sellMode)}</select></label></div><div class="collection-filter-row"><label>${text('排序','Sort')}<select id="collection-sort">${options([['secondsPerPoint',text('时间（升序）','Time (ascending)')],['costPerPoint',text('材料成本（升序）','Material cost (ascending)')],['profitPerPoint',text('利润（降序）','Profit (descending)')]],sort)}</select></label><label>${text('本次新增精通点最小值','Minimum mastery points gained')}<input id="collection-points-min" type="text" inputmode="numeric" value="${esc(pointsMin)}" placeholder="${text('不限','Any')}" aria-describedby="collection-points-help"></label><label>${text('本次新增精通点最大值','Maximum mastery points gained')}<input id="collection-points-max" type="text" inputmode="numeric" value="${esc(pointsMax)}" placeholder="${text('不限','Any')}" aria-describedby="collection-points-help"></label><label class="check"><input id="collection-level-met" type="checkbox" ${onlyLevelMet?'checked':''}>${text('仅显示等级达标','Meets level requirement')}</label><label class="check"><input id="collection-completed" type="checkbox" ${includeComplete?'checked':''}>${text('含已完成','Include completed')}</label></div></div><p id="collection-points-help" class="micro">${text('按当前目标本次新增精通点数筛选，留空不限；最小值与最大值相同可筛选指定点数。','Filter by mastery points gained from the current target. Leave blank for no limit; equal bounds select an exact reward.')}</p><p class="micro">${text('材料和产物均优先使用手动价；材料商人价仅用于估值，不代表可以买到。','Manual prices take priority for materials and products. Vendor material prices are valuations, not guaranteed purchase prices.')}</p><p id="collection-summary" class="micro" role="status"></p><p id="collection-error" role="alert"></p><div id="collection-results"></div><button id="collection-more" class="secondary" hidden>${text('再显示 40 条','Show 40 more')}</button></section></div>`;
 for(const id of openDetails){const el=document.getElementById(id);if(el)el.open=true;}
 host.querySelector('#collection-import').onclick=async()=>{
  busy=true;status=null;updateStatus();
  try{const response=await requestCharacter('read');if(!response.snapshot)throw Error('noSnapshot');const next=importCollection(state,response.snapshot);state=next;drafts.clear();loadError=false;status={capturedAt:state.capturedAt};changed();renderCollection(language,{isActive:true});}
  catch(e){status={error:e.message};}finally{busy=false;updateStatus();}
 };
 host.querySelector('#collection-manual').onclick=()=>{state.initialized=true;state.edited=true;changed();renderCollection(language,{isActive:true});};
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
 for(const [id,set]of [['collection-search',v=>query=v],['collection-type',v=>routeType=v],['collection-skill',v=>skill=v],['collection-tier',v=>tier=v],['collection-sort',v=>sort=v],['collection-points-min',v=>pointsMin=v],['collection-points-max',v=>pointsMax=v]])host.querySelector('#'+id)[id==='collection-search'||id.startsWith('collection-points-')?'oninput':'onchange']=e=>{set(e.target.value);limit=40;updateResults();};
 host.querySelector('#collection-level-met').onchange=e=>{onlyLevelMet=e.target.checked;limit=40;updateResults();};
 host.querySelector('#collection-completed').onchange=e=>{includeComplete=e.target.checked;limit=40;updateResults();};
 host.querySelector('#collection-buy').onchange=e=>{state.buyMode=e.target.value;save();updateResults();};
 host.querySelector('#collection-sell').onchange=e=>{state.sellMode=e.target.value;save();updateResults();};
 host.querySelector('#collection-more').onclick=()=>{limit+=40;updateResults();};
 compute();
}
function updateStatus(){
 const host=document.getElementById('collection-content');if(!host?.querySelector('#collection-save'))return;
 host.querySelector('#collection-import').disabled=busy;
 host.querySelector('#collection-buff-warning').textContent=state.importWarnings.map(w=>worldBuffWarningText(language,w)).join(' ')+(state.importWarnings.length?text(' 该提示针对导入时的数据；当前手动配置以表单为准。',' This warning concerns the imported capture; current manual settings are shown in the form.'):'');
 host.querySelector('#collection-import-status').textContent=importStatusText(language,status,busy);
 host.querySelector('#collection-origin').textContent=!state.initialized?message('uninitialized'):state.capturedAt?text('收藏捕获于：','Collection captured: ')+new Date(state.capturedAt).toLocaleString(language==='zh'?'zh-CN':'en')+(state.edited?text(' · 已手动修正',' · Manually adjusted'):''):text('手动场景；未填写的数量为 0。','Manual scenario; unspecified counts are zero.');
 host.querySelector('#collection-save').textContent=[loadError?text('存档无法读取，已恢复默认配置。','Saved settings could not be read; defaults restored.'):'',saveError?text('保存失败，当前内存计算仍可用。','Save failed; calculations remain available.'):'',!loadError&&!saveError?text('配置自动保存在此浏览器。','Settings are saved in this browser.'):''].filter(Boolean).join(' ');
 host.querySelector('#collection-error').textContent=pointsFilterError?message(pointsFilterError):error?message(error):priceSaveError()?text('全局价格存储异常，请打开物品价格查看。','Price storage error; open Item prices for details.'):'';
}
function updateResults(){
 const host=document.getElementById('collection-results');if(!host)return;
 rememberExpanded(host);
 let minimum,maximum;
 try{minimum=pointsMin.trim()===''?0:collectionInteger(pointsMin);maximum=pointsMax.trim()===''?Number.MAX_SAFE_INTEGER:collectionInteger(pointsMax);if(minimum>maximum)throw Error('invalidPointRange');pointsFilterError=null;}
 catch{pointsFilterError='invalidPointRange';updateStatus();host.innerHTML='';document.getElementById('collection-more').hidden=true;document.getElementById('collection-summary').textContent='';return;}
 updateStatus();
 if(!state.initialized){host.innerHTML=`<p class="empty-results">${message('uninitialized')}</p>`;return;}
 const prices=priceState(),q=query.trim().toLowerCase();let valued;
 const matching=rows.filter(r=>r.points>=minimum&&r.points<=maximum&&(includeComplete||!r.complete)&&(!onlyLevelMet||state.config.levels[r.skill]>=recipesById.get(r.jobId).levelReq)&&(routeType==='all'||(routeType==='gather'?gatheringSkills:craftingSkills).includes(r.skill))&&(skill==='all'||r.skill===skill)&&(tier==='all'||game.itemTier(r.id)===Number(tier))&&(!q||`${game.item(r.id).name} ${translatedItemName(r.id,'zh')} ${itemName(r.id)}`.toLowerCase().includes(q)));
 try{valued=matching.map(r=>priceCollection(r,prices,state.sellMode,state.buyMode));}catch(e){error=e.message;updateStatus();host.innerHTML='';return;}
 const unfinished=rows.filter(r=>!r.complete).length,missingPrices=valued.filter(r=>r.status==='ok'&&r.materialsPriced.some(i=>i.qty>0&&i.price===null)).length,overflows=valued.filter(r=>r.overflowFields.length>0).length,missingPotions=valued.filter(r=>r.potionsPriced.some(i=>i.qty>0&&i.price===null)).length;
 document.getElementById('collection-summary').textContent=text(`未完成目标 ${unfinished} · 匹配 ${matching.length} · 材料缺价 ${missingPrices}${missingPotions?` · 药剂缺价 ${missingPotions}`:''}${overflows?` · 金额超限 ${overflows}`:''}`,`Unfinished targets ${unfinished} · Matching ${matching.length} · Missing material prices ${missingPrices}${missingPotions?` · Missing potion prices ${missingPotions}`:''}${overflows?` · Amount overflow ${overflows}`:''}`);
 const sortValue=row=>row.status==='ok'?row[sort]:null;
 valued.sort((a,b)=>{const av=sortValue(a),bv=sortValue(b);return (av===null)-(bv===null)||(av===null?0:(sort==='profitPerPoint'?-1:1)*(av-bv))||a.id-b.id||(a.jobId??0)-(b.jobId??0)||(a.target??0)-(b.target??0);});
 document.getElementById('collection-more').hidden=valued.length<=limit;
 host.innerHTML=valued.length?valued.slice(0,limit).map(r=>`<details class="collection-card" data-collection-key="${key(r)}" ${opened.has(key(r))?'open':''}><summary><span><strong class="collection-item-heading"><span class="collection-item-name">${esc(itemName(r.id))}</span> · <span class="collection-item-tier">${tierNames()[game.itemTier(r.id)]}</span></strong><small>${esc(skillName(r.skill))}</small></span><span><small>${text('当前 → 目标','Current → target')}</small>${number(r.current)} → ${number(r.target)}</span><span class="collection-points"><small>${text('新增精通点','Points gained')}</small><strong>${number(r.points)}</strong></span><span class="collection-total-cost"><small>${text('总材料成本','Total material cost')}</small>${r.status==='ok'?number(r.cost):'—'}</span><span data-collection-metric="secondsPerPoint"><small>${text('秒／点','Seconds/point')}</small>${number(r.secondsPerPoint)}</span><span data-collection-metric="costPerPoint"><small>${text('材料金币／点','Material coins/point')}</small>${r.status==='ok'?number(r.costPerPoint):'—'}</span><span data-collection-metric="profitPerPoint"><small>${text('利润／点','Profit/point')}</small>${r.status==='ok'?number(r.profitPerPoint):'—'}<small>${message(r.status)}</small>${r.overflowFields.length?`<small class="collection-overflow">⚠ ${overflowNote(r)}</small>`:''}</span></summary><div class="collection-detail"></div></details>`).join(''):`<p class="empty-results">${text('没有匹配的收藏','No matching collections')}</p>`;
 host.querySelectorAll('[data-collection-key]').forEach(card=>{
  const row=valued.find(r=>key(r)===card.dataset.collectionKey);
  card.ontoggle=()=>{if(!card.isConnected)return;if(card.open){opened.add(key(row));detail(card,row);}else opened.delete(key(row));};
  if(card.open)detail(card,row);
 });
}
function detail(card,row){
 const container=card.querySelector('.collection-detail');
 const prices=priceState();
 const list=items=>items.length?items.map(i=>`<li>${esc(itemName(i.id))} (${tierNames()[game.itemTier(i.id)]}) × ${number(i.qty)} — ${number(i.price)} ${text('金币','coins')} <small>${({manual:text('手动','Manual'),ask:text('最低卖单','Lowest sell order'),bid:text('最高买单','Highest buy order'),vendor:text('商人','Vendor'),untradeable:text('不可出售','Untradeable')})[i.source]}${i.time?' · '+esc(new Date(i.time).toLocaleString(language==='zh'?'zh-CN':'en')):''}${i.price===null?' · '+text('缺报价','Missing price'):''}</small></li>`).join(''):`<li>${text('无','None')}</li>`;
 const sim=simulations.get(key(row));
 const simulated=sim?priceCollection(sim,prices,state.sellMode,state.buyMode):null;
 container.innerHTML=`<div class="collection-edit"><label>${text('当前累计数量','Current lifetime quantity')}<input type="number" min="0" step="1" value="${row.current}" data-collection-count="${row.id}"></label><span>${text('从当前直达目标档','Target milestone from current')} <strong>${number(row.target)}</strong></span></div>
 <p class="micro">${text('剩余数量','Remaining quantity')} ${number(row.missing)} · ${text('预计执行次数','Expected actions')} ${number(row.attempts)} · ${text('预计总秒数','Expected total seconds')} ${number(row.seconds)} · ${text('材料总投入','Material total')} ${row.status==='ok'?number(row.cost):'—'} · ${text('净投入','Net investment')} ${row.status==='ok'?number(row.net):'—'}</p>
 ${row.overflowFields.length?`<p class="micro collection-overflow" role="status">⚠ ${overflowNote(row)}${text('；该金额及其净投入暂不可计算，时间和其他有效金额保留。','; this amount and its dependent net investment are unavailable. Time and other valid amounts remain available.')}</p>`:''}
 <p class="micro">${text('固定属性的纯动作期望；包含所配置加成和所选时刻热门，不含行程与成长。净投入为材料加药剂费用，再扣除主产物（采集含各品质）与烧焦产物价值；不计随机副产物和祝福购置费。负值表示估算可回本，不保证成交。','Fixed-stat action expectation with configured bonuses and the selected hot instant; excludes travel and growth. Net investment adds materials and potion upkeep, less main products (all gathering qualities) and burnt products. Bonus drops and blessing acquisition costs are excluded. Negative net cost does not guarantee a trade.')}</p>
 ${row.status==='ok'?`<p class="micro">${text('单次动作期望秒数','Expected seconds per action')} ${number(row.actionSeconds)} · ${text('烧焦概率','Burn probability')} ${number(row.burn*100)}% · ${text('被捕概率','Catch probability')} ${number(row.caught*100)}% · ${text('目标品质概率','Target rarity probability')} ${number(row.quality*100)}%</p>`:''}
 ${row.potionsPriced.length?`<h3>${text('药剂持续消耗','Potion upkeep')}</h3><ul>${list(row.potionsPriced)}</ul><p class="micro">${text('药剂投入','Potion investment')} ${number(row.potionCost)} · ${text('材料与药剂总投入','Total material & potion investment')} ${number(row.investment)} · ${text('按原始每瓶一小时和目标耗时折算连续消耗，含小数。','Prorated continuous use at the original one-hour duration per bottle.')}</p>`:''}
 ${row.blessing?`<p class="micro">${text('矿脉祝福全程有效，未计其购置费用。','Vein Blessing stays active throughout; its acquisition cost is excluded.')}</p>`:''}
 <h3>${text('材料采购','Material purchases')}</h3><ul>${list(row.materialsPriced)}</ul><h3>${text('产物回收','Product recovery')}</h3><ul>${list(row.outputsPriced)}</ul><p class="micro">${text('通过页头“物品价格”导入最新行情或填写手动价格。缺价显示 —；明确零价仍计入。报价时间不代表成交保证。','Use Item prices in the header to import quotes or set manual prices. Missing prices show —; explicit zero prices are valid. Quote timestamps do not guarantee a trade.')}</p>
 ${row.status==='ok'?`<button class="secondary" data-collection-simulate>${text('运行含行程模拟','Simulate with travel')}</button>`:''}${simulationKey===key(row)?`<button class="secondary" data-collection-cancel>${text('取消','Cancel')}</button><p role="status" data-collection-progress>${text('正在模拟','Simulating')} · ${number(simulationProgress?.quantity??0)} / ${number(row.missing)}</p>`:''}
 ${simulated?`<p class="micro" role="status">${text('单次原始模拟样本','Single original-engine sample')} · ${text('种子','Seed')} ${sim.seed} · ${sim.complete?text('已完成','Completed'):text('未完成','Incomplete')} · ${text('产出','Produced')} ${number(sim.quantity)} · +${number(sim.points)} ${text('点','points')} · ${number(sim.seconds)} ${text('秒','seconds')}${sim.complete?` · ${number(sim.secondsPerPoint)} ${text('秒／点','seconds/point')} · ${number(simulated.costPerPoint)} ${text('材料金币／点','material coins/point')} · ${number(simulated.profitPerPoint)} ${text('利润／点','profit/point')}`:''}${simulated.potionsPriced.length?' · '+text('药剂投入','Potion investment')+' '+number(simulated.potionCost):''}${simulated.overflowFields.length?' · '+overflowNote(simulated):''}${sim.error?' · '+(sim.error==='timeLimit'?text('达到 30 日上限','Reached 30-day limit'):esc(sim.error)):''}</p>`:''}`;
 const count=container.querySelector('[data-collection-count]');count.oninput=()=>drafts.set('count.'+row.id,{value:count.value});
 if(drafts.has('count.'+row.id))count.value=drafts.get('count.'+row.id).value;
 count.onchange=()=>{try{state.counts[row.id]=collectionInteger(count.value);state.edited=true;drafts.delete('count.'+row.id);changed();}catch(e){error=e.message;count.setCustomValidity(message(e.message));updateStatus();}};
 container.querySelector('[data-collection-cancel]')?.addEventListener('click',()=>{cancel();updateResults();});
 container.querySelector('[data-collection-simulate]')?.addEventListener('click',()=>startSimulation(row));
}
function startSimulation(row){
 cancel();const token=run;simulationKey=key(row);error=null;
 try{
  const seed=randomSimulationSeed();worker=new Worker(new URL('./collection-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(data.run!==run)return;if(data.progress){simulationProgress=data.progress;const card=[...document.querySelectorAll('[data-collection-key]')].find(c=>c.dataset.collectionKey===key(row));const progress=card?.querySelector('[data-collection-progress]');if(progress)progress.textContent=text('正在模拟','Simulating')+' · '+number(data.progress.quantity)+' / '+number(row.missing);return;}
   if(data.result)simulations.set(key(row),data.result);if(data.error)error=data.error;worker?.terminate();worker=null;simulationKey=null;simulationProgress=null;updateResults();};
  worker.onerror=()=>{if(token!==run)return;cancel();error=text('模拟 Worker 失败','Simulation Worker failed');updateResults();};
  worker.postMessage({run:token,state,target:row.target,id:row.id,jobId:row.jobId,seed,now:calculationNow});
 }catch(e){cancel();error=e.message;}
 updateResults();
}
