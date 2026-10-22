import {readCharacterInventory} from './character-inventory.js';
import {craftingOrdersStorageKey,emptyWorkspace,normalizeWorkspace,createOrder,orderPlans,combinedPlans,setOrderCount,batchOrderCount,orderEstimate,orderMaterialBudget} from './crafting-orders.js';
import * as game from './upstream.js';
import {translatedName,translatedItemName} from './i18n.js';
import {masteryValue,masteryRank} from './model.js';
import {slotItems,gatheringGear} from './gathering-model.js';
import {getSnapshot,getSaveError,setPrice,subscribe} from './price-service.js';
import {valuationPrice,validPrice} from './item-prices.js';
import {registerCharacterUpdates,characterImportPanel,probeCharacter,importStatusText} from './import-controls.js';
import {worldBuffWarningText} from './world-buffs.js';
import {randomSimulationSeed} from './simulation-seed.js';
import {craftingStorageKey,craftingDefaults,craftingTiers,normalizeCrafting,craftingSkills,craftingToolSlots,craftingJobs,craftingPotions,craftingRooms,craftingMasteries,craftingPerks,planKey,validQuantity,craftingPlan,craftingMaterials,priceItems,craftingStats,importCrafting,calculateUpgrade} from './crafting-model.js';

let state=craftingDefaults(),language='zh',query='',group='',filledOnly=false,sort='levelReq',direction='desc',notice='',importStatus=null,importBusy=false,saveOK=true,active=false,probeStarted=false;
let worker=null,timer=null,renderTimer=null,generation=0,running=false,progress=null,workerError=null,clock=Date.now(),roundSeed=null;
let orders=[],currentOrderId=null,storageBlocked=false;
let inventory=null,inventoryBusy=false,inventoryError=null;
const currentOrder=()=>orders.find(order=>order.id===currentOrderId);
const selectedOrders=()=>orders.filter(order=>order.enabled);
const allOrderPlans=()=>orders.flatMap(orderPlans);
const simulationKey=plan=>`${plan.key}/${plan.count}`;
const selectedTiers=new Set([0]);
const rateCache=new Map(),cache=new Map(),details=new Map();
try{localStorage.removeItem(craftingStorageKey);const saved=localStorage.getItem(craftingOrdersStorageKey);if(saved){const workspace=normalizeWorkspace(JSON.parse(saved));state=workspace.build;orders=workspace.orders;currentOrderId=workspace.currentOrderId;inventory=workspace.inventory;}}catch{notice='savedInvalid';storageBlocked=true;saveOK=false;}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(zh,en)=>language==='zh'?zh:en;
const name=s=>translatedName(s,language);
const skillNames={cooking:'Cooking',smithing:'Smithing',fletching:'Fletching',herblore:'Herblore',crafting:'Crafting'};
const skillName=k=>name(skillNames[k]);
const rarities=()=>text(['普通','罕见','稀有','史诗','传说'],['Normal','Uncommon','Rare','Epic','Legendary']);
const format=(n,digits=0)=>n.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:digits});
const options=(values,current)=>values.map(([v,label])=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(label)}</option>`).join('');
const errors={inventoryOutdated:['游戏库存数据早于已保存库存，请重新捕获游戏角色。','Game inventory is older than the saved stock; recapture the game character.'],savedInvalid:['已保存的制造配置无法读取，当前使用默认配置。','Saved crafting settings could not be read; defaults are shown.'],invalidQuantity:['请输入非负安全整数。','Enter a nonnegative safe integer.'],quantityOverflow:['数量超出可可靠计算的范围，请减少制造次数。','Quantity exceeds the safe calculation range; reduce crafting counts.'],priceOverflow:['金额超出可可靠计算的范围，请检查次数和单价。','Amount exceeds the safe calculation range; check counts and prices.'],invalidPrice:['请输入有效的非负价格。','Enter a valid nonnegative price.'],timeLimit:['达到 30 游戏日计算上限，计划未完成。','Reached the 30 game day calculation limit; plan is incomplete.'],levelTooLow:['等级不足','Level too low'],noSites:['没有有效制造点','No valid crafting site'],invalidRoute:['无法建立制造路线','Could not start crafting route'],unreachable:['无法到达制造点或仓库','Unreachable crafting site or depot'],'routeStopped:noMaterials':['材料不足，路线停止','Materials depleted; route stopped'],'routeStopped:storageFull':['仓库已满，路线停止','Storage full; route stopped'],'routeStopped:unreachable':['路线不可达','Route unreachable'],routeStopped:['路线提前停止','Route stopped early'],priceSaveFailed:['价格保存失败，当前内存价格仍可用。','Prices could not be saved; in-memory prices remain usable.'],priceReadFailed:['已保存的价格无法读取。','Saved prices could not be read.'],invalidPriceStorage:['已保存的价格格式无效。','Saved price format is invalid.'],workerFailed:['制造计算失败，请检查浏览器是否支持 Worker。','Crafting computation failed; check browser Worker support.']};
const errorText=code=>(errors[code]??[code,code])[language==='zh'?0:1];
const warn=missing=>missing?.length?`<span title="${text('部分物品未设置价格，采用商人价格计算','Some items have no configured price; vendor prices are used')}" aria-label="${text('缺价','Unset price')}">⚠</span> `:'';
const itemLabel=id=>`${translatedItemName(id,language)} · ${rarities()[game.itemTier(id)]}`;
function save(){try{if(storageBlocked)throw Error('savedInvalid');localStorage.setItem(craftingOrdersStorageKey,JSON.stringify({version:1,build:{...state,plans:{},upgradeMigration:false},orders,currentOrderId,inventory}));saveOK=true;}catch{saveOK=false;}renderNotice();}
function renderNotice(){
 const el=document.getElementById('craft-notice');if(el)el.textContent=notice?(errors[notice]?errorText(notice):notice):'';
 const saveEl=document.getElementById('craft-save');if(saveEl)saveEl.textContent=saveOK?text('● 制造配置独立保存在此浏览器','● Crafting settings saved separately in this browser'):text('浏览器存储不可用，制造配置无法保存','Browser storage unavailable; crafting settings could not be saved');
 const priceEl=document.getElementById('craft-price-status');if(priceEl)priceEl.textContent=getSaveError()?errorText(getSaveError()):'';
}
function rememberDetails(root){root?.querySelectorAll('details[id]').forEach(el=>details.set(el.id,el.open));}
function restoreDetails(root){root.querySelectorAll('details[id]').forEach(el=>{if(details.has(el.id))el.open=details.get(el.id);el.ontoggle=()=>{if(el.isConnected)details.set(el.id,el.open);};});}
// Reuse the focused input node when result markup changes. Keystrokes, invalid
// intermediate text and focus survive Worker progress and price notifications.
function replaceResults(host,html){
 rememberDetails(host);const scrolls=[...host.querySelectorAll('.table-scroll')].map(el=>({left:el.scrollLeft,top:el.scrollTop}));const input=host.contains(document.activeElement)&&document.activeElement.matches('input,select')?document.activeElement:null;
 const fragment=document.createElement('template');fragment.innerHTML=html;
 if(input?.id){const replacement=[...fragment.content.querySelectorAll('[id]')].find(el=>el.id===input.id);if(replacement){replacement.replaceWith(input);}}
 host.replaceChildren(fragment.content);host.querySelectorAll('.table-scroll').forEach((el,i)=>{if(scrolls[i]){el.scrollLeft=scrolls[i].left;el.scrollTop=scrolls[i].top;}});restoreDetails(host);if(input?.isConnected)input.focus({preventScroll:true});
}
const detailLine=(label,value)=>`<div class="loot-line"><span>${label}</span><span>${value}</span></div>`;
function detail(id,summary,body){return `<details class="reward-detail" id="craft-${id}"><summary>${summary}</summary><div>${body}</div></details>`;}
function priceInput(id,prefix){const p=getSnapshot().getItem(id);return `<input id="craft-price-${prefix}-${id}" class="craft-price-input" type="number" min="0" max="${Number.MAX_SAFE_INTEGER}" step="any" data-craft-price="${id}" value="${p?.price??''}" placeholder="${format(valuationPrice(id,getSnapshot()).price,2)}" aria-label="${esc(itemLabel(id)+' '+text('价格','price'))}">`;}
function itemLines(items,{prices=false}={}){
 return Object.entries(items).map(([id,n])=>{const p=valuationPrice(Number(id),getSnapshot());return `<div class="gather-item"><span>${esc(itemLabel(Number(id)))}${prices&&!game.isPet(Number(id))?' '+warn(p.fallback?[id]:[])+format(p.price,2):''}</span><span>${format(n)}</span></div>`;}).join('')||text('无','None');
}
function visibleJobs(){return craftingJobs.filter(j=>j.skill===state.skill&&(!group||j.group===group)&&`${j.name} ${translatedName(j.name,'zh')}`.toLowerCase().includes(query.toLowerCase())).flatMap(job=>craftingTiers(job).map(tier=>({job,tier,key:planKey(job.id,tier),count:currentOrder()?.plans[planKey(job.id,tier)]??0}))).filter(p=>selectedTiers.has(p.tier)&&(!filledOnly||p.count>0));}
function rateFor(plan){const entry=rateCache.get(plan.key);return entry?.signature===signature({...plan,count:0})?entry:null;}
function methodNote(){return text('制造次数、耗时、移动、回仓、经验及材料消耗来自<strong class="simulation-caveat">原始模拟</strong>；普通制造产物按指定稀有度计算，烹饪产物与稀有掉落为基于本次模拟机会的<strong class="simulation-caveat">数学期望</strong>，活动礼盒仍按原始模拟统计；利润结合产物期望、实际材料消耗及物品价格推算，不扣药水成本与市场手续费。材料需求与购买预算按计划次数计算，即时装备升级直接计算。','Craft counts, elapsed time, movement, banking, XP and material consumption come from the <strong class="simulation-caveat">original simulation</strong>; ordinary products use the selected rarity, while cooking products and rare drops are <strong class="simulation-caveat">mathematical expectations</strong> based on opportunities in this run. Event boxes still use simulated counts. Profit uses expected products, actual material consumption and item prices, excluding potion costs and market fees. Material requirements and purchase budgets use planned counts; instant gear upgrades are calculated directly.');}
function rarityFilters(){return `<div class="presets craft-rarity-filters" role="group" aria-label="${text('稀有度筛选','Rarity filter')}">${rarities().map((r,tier)=>`<button type="button" data-craft-rarity="${tier}" aria-pressed="${selectedTiers.has(tier)}" class="${selectedTiers.has(tier)?'selected':''}">${r}</button>`).join('')}</div>`;}
function signature(plan){
 const skill=plan.job.skill;return JSON.stringify({count:plan.count,tier:plan.tier,level:state.levels[skill],tool:state.gear[craftingToolSlots[skill]],mount:state.gear.mount,brews:state.brews,house:craftingRooms.filter(r=>r.bonus.skill===skill).map(r=>[r.id,state.house[r.id]]),masteries:state.masteries,perks:{pockets:state.perks.pockets,quick:state.perks.quick,hands:skill==='cooking'?state.perks.hands:0},guildXp:state.guildXp,weeklyXp:state.weeklyXp,ironman:state.ironman,blessing:state.blessing,homeBank:state.homeBank,hotSetting:state.hotSetting,clock:state.hotSetting==='current'?clock:null});
}
function resultFor(plan){const c=cache.get(simulationKey(plan));return c?.signature===signature(plan)?c:null;}
function sortedJobs(){
 const metric=p=>{if(p.job.upgrade&&['completed','xp','profit'].includes(sort))return undefined;if(sort==='levelReq')return p.job.levelReq;try{const r=rateFor(p)?.result;return {xp:r?.xp,completed:r?.completed,materialValue:priceItems(craftingMaterials(p.job,p.tier,1),getSnapshot()).value,outputValue:priceItems({[game.withRarity(p.job.output.itemId,p.tier)]:p.job.output.qty},getSnapshot()).value,profit:r?priceItems(r.items,getSnapshot(),{expected:true}).value-priceItems(r.consumed,getSnapshot()).value:undefined}[sort];}catch{return undefined;}};
 return visibleJobs().sort((a,b)=>{const x=metric(a),y=metric(b);if(x===undefined)return y===undefined?String(a.job.id).localeCompare(String(b.job.id))||a.tier-b.tier:1;if(y===undefined)return -1;return (x-y)*(direction==='asc'?1:-1)||String(a.job.id).localeCompare(String(b.job.id))||a.tier-b.tier;});
}
function headers(){const period=state.period==='day'?text('天','day'):text('小时','hour');return [[text('配方','Recipe'),'levelReq'],[text('经验','XP')+'/'+period,'xp'],[text('利润','Profit')+'/'+period,'profit'],[text('制造次数','Crafts')+'/'+period,'completed'],[text('单次材料成本','Material cost / craft'),'materialValue'],[text('单次产物价值','Product value / craft'),'outputValue'],[text('订单制造次数','Order crafts'),null]].map(([label,key])=>`<th ${key?`aria-sort="${sort===key?(direction==='asc'?'ascending':'descending'):'none'}"`:''}>${key?`<button class="sort-header" data-craft-sort="${key}">${label} <span class="sort-arrow">${sort===key?(direction==='asc'?'↑':'↓'):'↕'}</span></button>`:label}</th>`).join('');}
function recipeRow(plan){
 const {job,tier,key,count}=plan,locked=state.levels[job.skill]<job.levelReq;
 const seed=job.upgrade?undefined:rateFor(plan)?.result?.seed??resultFor(plan)?.result?.seed;
 const recipeInfo=[[text('单次产量','Output per craft'),format(job.output.qty)],[text('基础经验 / 次','Base XP / craft'),format(job.xp)],...(job.burn?[[text('安全等级','No-burn level'),job.burn.safeAtLevel]]:[]),...(seed===undefined?[]:[[text('随机种子','Random seed'),seed]])].map(([label,value])=>detailLine(label,value)).join('');
 const lead=`<tr><td class="column-highlight">${detail(`${key}-recipe`,`<span class="enemy-name"><span><strong>${esc(name(job.name))} · ${rarities()[tier]}</strong><small>${text('所需等级','Level')} ${job.levelReq}</small></span></span>`,recipeInfo)}${locked?`<small class="death-note">${errorText('levelTooLow')}</small>`:''}</td>`;
 const input=`<td><input ${!currentOrder()?'disabled':''} id="craft-count-${job.id}-${tier}" class="craft-quantity" type="number" min="0" max="${Number.MAX_SAFE_INTEGER}" step="1" data-craft-count="${key}" value="${count}" aria-label="${esc(name(job.name)+' '+rarities()[tier]+' '+text('计划制造次数','planned crafts'))}"></td>`;
 try{
  const materials=craftingMaterials(job,tier,1),cost=priceItems(materials,getSnapshot()),products={[game.withRarity(job.output.itemId,tier)]:job.output.qty},value=priceItems(products,getSnapshot()),entry=rateFor(plan),r=entry?.result,factor=state.period==='day'?1:1/24;
  const unitValues=`<td>${detail(`${key}-cost`,warn(cost.missing)+format(cost.value,2),itemLines(materials,{prices:true}))}</td><td>${detail(`${key}-value`,warn(value.missing)+format(value.value,2),itemLines(products,{prices:true}))}</td>`;
  if(job.upgrade)return lead+`<td class="column-highlight">${detail(`${key}-xp`,format(job.xp)+' '+text('/次','/ upgrade'),detailLine(text('单次经验','XP per action'),format(job.xp)))}</td><td class="column-highlight">${warn([...cost.missing,...value.missing])+format(value.value-cost.value,2)} ${text('/次','/ upgrade')}</td><td>${text('即时升级','Instant upgrade')}</td>`+unitValues+input+'</tr>';
  const label=locked?errorText('levelTooLow'):entry?.error?errorText(entry.error):r?.error?errorText(r.error):text('计算中…','Calculating…');
  const output=r?priceItems(r.items,getSnapshot(),{expected:true}):null,consumed=r?priceItems(r.consumed,getSnapshot()):null;
  const profit=r?output.value-consumed.value:0,missing=r?[...output.missing,...consumed.missing]:[];
  return lead+`<td class="column-highlight">${r&&!r.error?detail(`${key}-xp`,format(r.xp*factor,2),detailLine(text('平均单次经验','Average XP per action'),r.completed>0?format(r.xp/r.completed,2):'—')):label}</td><td class="column-highlight">${r&&!r.error?warn(missing)+format(profit*factor,2):label}</td><td>${r&&!r.error?format(r.completed*factor):label}</td>`+unitValues+input+'</tr>';
 }catch(error){return lead+['column-highlight','column-highlight','hourly-muted','hourly-muted','hourly-muted'].map(style=>`<td class="${style}">${esc(errorText(error.message))}</td>`).join('')+input+'</tr>';}
}
function craftingProgress(){
 const message=workerError?errorText(workerError):text('正在计算','Calculating')+(progress?` · ${progress.completed}/${progress.total}`:'…');
 return `<div class="craft-progress${!running&&!workerError?' is-idle':''}" role="status" title="${esc(message)}">${esc(message)}</div>`;
}
function ensureCurrentOrder(){
 if(!orders.length){const order=createOrder(crypto.randomUUID(),text('订单 1','Order 1'));orders.push(order);currentOrderId=order.id;return true;}
 if(!currentOrder()){currentOrderId=orders[0].id;return true;}
 return false;
}
function updateOrders(){
 ensureCurrentOrder();notice='';save();renderResults();if(active&&!running)startSimulation();
}
function planStatus(plan){
 if(state.levels[plan.job.skill]<plan.job.levelReq)return errorText('levelTooLow');
 const entry=resultFor(plan),result=entry?.result;
 return entry?.error?errorText(entry.error):result?.error?errorText(result.error):result?.complete?'':result?errorText('timeLimit'):workerError?errorText(workerError):text('计算中…','Calculating…');
}
function orderLabel(order){return order.name||text('未命名订单','Untitled order');}
function estimate(order){return orderEstimate(order,getSnapshot(),resultFor,game.tickMs);}
function orderEditor(){
 const order=currentOrder();
 return `<div class="craft-order-detail-heading"><h3>${text('订单明细','Order details')}</h3></div>${storageBlocked?`<p class="death-note">${text('制造存档读取失败，当前修改不能保存。','Crafting storage could not be read; changes cannot be saved.')} <button id="craft-reset-storage" class="text-button">${text('重置制造存档','Reset crafting storage')}</button></p>`:''}${order?`<div class="craft-order-fields"><label>${text('订单名称','Order name')}<input id="craft-order-name" maxlength="120" value="${esc(order.name)}" aria-label="${text('订单名称','Order name')}"></label>${[['fixed',text('固定费（金币/订单）','Fixed fee (coins/order)')],['percent',text('比例费（材料成本 %）','Percentage fee (material cost %)')],['minute',text('时间费（金币/分钟）','Time fee (coins/minute)')]].map(([key,label])=>`<label>${label}<input id="craft-fee-${key}" type="number" min="0" max="${Number.MAX_SAFE_INTEGER}" step="any" placeholder="0" value="${order.fees[key]??''}" data-craft-fee="${key}" aria-label="${label}"></label>`).join('')}</div>`:''}`;
}
function orderPanel(){
 return `<section id="craft-orders-panel" class="panel enemies"><div class="enemies-heading craft-order-heading"><h2>${text('订单管理','Order management')}</h2><button id="craft-new-order" class="secondary">${text('新建订单','New order')}</button></div>${orderList()}<div class="craft-order-editor">${orderEditor()}${currentOrderTable()}</div></section>`;
}
function currentOrderTable(){
 const order=currentOrder();if(!order)return '';
 const plans=orderPlans(order);
 return `<div class="craft-order-lines-heading"><div class="toolbar"><label>${text('统一制造次数','Set all craft counts')} <input id="craft-batch-${esc(order.id)}" type="number" min="0" max="${Number.MAX_SAFE_INTEGER}" step="1" placeholder="0" aria-label="${text('统一制造次数','Set all craft counts')}"></label><button id="craft-batch" class="secondary" ${!plans.length?'disabled':''}>${text('应用到全部配方','Apply to all recipes')}</button></div></div><div class="table-scroll"><table class="gather-table craft-order-recipes"><thead><tr>${[text('技能','Skill'),text('配方','Recipe'),text('品质','Rarity'),text('制造次数','Crafts'),text('操作','Actions')].map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${plans.length?plans.map(p=>`<tr><td>${skillName(p.job.skill)}</td><td>${esc(name(p.job.name))}${state.levels[p.job.skill]<p.job.levelReq?`<small class="death-note">${errorText('levelTooLow')}</small>`:''}</td><td>${rarities()[p.tier]}</td><td><input id="craft-order-count-${p.job.id}-${p.tier}" type="number" class="craft-quantity" min="0" max="${Number.MAX_SAFE_INTEGER}" step="1" value="${p.count}" data-craft-count="${p.key}" aria-label="${esc(itemLabel(game.withRarity(p.job.output.itemId,p.tier))+' '+text('订单制造次数','order crafts'))}"></td><td><button class="text-button" data-craft-remove-recipe="${p.key}" aria-label="${esc(name(p.job.name)+' '+text('移除','remove'))}">${text('移除','Remove')}</button></td></tr>`).join(''):`<tr><td colspan="5">${text('尚未填写配方。','No recipes yet.')}</td></tr>`}</tbody></table></div>`;
}
function orderList(){
 return `<div class="table-scroll"><table class="gather-table craft-orders-table"><thead><tr>${[text('执行','Execute'),text('订单名称','Order name'),text('配方数','Recipes'),text('材料成本','Material cost'),text('预计耗时','Estimated time'),text('加工费','Processing fee'),text('操作','Actions')].map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${orders.length?orders.map(order=>{
  let cost='—',time='—',fee='—';try{const e=estimate(order);cost=warn(e.material.missing)+format(e.material.value,2);time=e.minutes===null?text('未完整计算','Incomplete')+'<small class="death-note">'+esc([...new Set(orderPlans(order).map(planStatus).filter(Boolean))].join(' · '))+'</small>':format(e.minutes,2)+' '+text('分钟','min');fee=e.fees.total===null?text('未完整计算','Incomplete'):warn((order.fees.percent??0)>0?e.material.missing:[])+format(e.fees.total,2);}catch(error){fee=esc(errorText(error.message));}
  return `<tr data-craft-order-row="${esc(order.id)}" tabindex="0" aria-current="${order.id===currentOrderId}" aria-label="${esc(text('编辑订单 ','Edit order ')+orderLabel(order))}"${order.id===currentOrderId?' class="craft-current-order"':''}><td><input type="checkbox" data-craft-order-enabled="${esc(order.id)}" ${order.enabled?'checked':''} aria-label="${esc(text('执行订单 ','Execute order ')+orderLabel(order))}"></td><td>${esc(orderLabel(order))}</td><td>${Object.keys(order.plans).length}</td><td>${cost}</td><td>${time}</td><td>${fee}</td><td class="craft-order-actions">${[['copy',text('复制','Copy')],['delete',text('删除','Delete')]].map(([action,label])=>`<button class="text-button" data-craft-order-action="${action}" data-order-id="${esc(order.id)}" aria-label="${esc(label+' '+orderLabel(order))}">${label}</button>`).join('')}</td></tr>`;
 }).join(''):`<tr><td colspan="7">${text('暂无订单。','No orders.')}</td></tr>`}</tbody></table></div>`;
}
function executionRecipes(){
 try{
  const plans=craftingPlan({plans:combinedPlans(selectedOrders())});
  return `<h3>${text('配方制造清单','Recipe execution list')}</h3><div class="table-scroll"><table class="gather-table craft-execution-table"><thead><tr>${[text('技能','Skill'),text('配方','Recipe'),text('品质','Rarity'),text('总制造次数','Total crafts')].map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${plans.length?plans.map(p=>`<tr><td>${skillName(p.job.skill)}</td><td>${detail('sources-'+p.key,esc(name(p.job.name)),selectedOrders().filter(o=>o.plans[p.key]).map(o=>detailLine(esc(orderLabel(o)),format(o.plans[p.key])+(planStatus({...p,count:o.plans[p.key]})?' · '+esc(planStatus({...p,count:o.plans[p.key]})):''))).join(''))}</td><td>${rarities()[p.tier]}</td><td>${format(p.count)}</td></tr>`).join(''):`<tr><td colspan="4">${text('尚未选择执行订单。','No orders selected for execution.')}</td></tr>`}</tbody></table></div>`;
 }catch(error){return `<p class="death-note">${esc(errorText(error.message))}</p>`;}
}
function bindOrders(){
 const choose=id=>{currentOrderId=id;save();renderResults();};
 document.getElementById('craft-new-order').onclick=()=>{const order=createOrder(crypto.randomUUID(),text('订单 ','Order ')+(orders.length+1));orders.push(order);choose(order.id);};
 document.querySelectorAll('[data-craft-order-row]').forEach(row=>{
  row.onmousedown=event=>{if(!event.target.closest('input,button,select,a,summary,details'))event.preventDefault();};
  row.onclick=event=>{if(event.target.closest('input,button,select,a,summary,details'))return;const id=row.dataset.craftOrderRow;document.activeElement?.blur();choose(id);};
  row.onkeydown=event=>{if(event.target!==row||!['Enter',' '].includes(event.key))return;event.preventDefault();const id=row.dataset.craftOrderRow;choose(id);document.querySelectorAll('[data-craft-order-row]').forEach(el=>{if(el.dataset.craftOrderRow===id)el.focus({preventScroll:true});});};
 });
 const reset=document.getElementById('craft-reset-storage');if(reset)reset.onclick=()=>{if(!confirm(text('删除制造存档并恢复默认配置？','Delete crafting storage and restore defaults?')))return;try{localStorage.removeItem(craftingOrdersStorageKey);localStorage.removeItem(craftingStorageKey);}catch{notice='savedInvalid';renderNotice();return;}const workspace=emptyWorkspace();state=workspace.build;orders=[];currentOrderId=null;inventory=null;inventoryError=null;storageBlocked=false;notice='';ensureCurrentOrder();save();schedule();renderCrafting(language,{isActive:active});};
 const order=currentOrder(),nameInput=document.getElementById('craft-order-name');if(nameInput)nameInput.onchange=e=>{order.name=e.target.value;updateOrders();};
 document.querySelectorAll('[data-craft-fee]').forEach(el=>el.onchange=()=>{const value=el.value===''?null:el.valueAsNumber;if(el.validity.badInput||!el.checkValidity()||value!==null&&!validPrice(value)){el.setAttribute('aria-invalid','true');notice='invalidPrice';renderNotice();return;}el.removeAttribute('aria-invalid');order.fees[el.dataset.craftFee]=value;updateOrders();});
 const batch=document.getElementById('craft-batch');if(batch)batch.onclick=()=>{const input=document.getElementById('craft-batch-'+order.id);if(input.value===''){input.setAttribute('aria-invalid','true');notice='invalidQuantity';renderNotice();return;}const count=readCount(input);if(count===null)return;if(count===0&&!confirm(text('移除当前订单的全部配方？','Remove all recipes from this order?')))return;batchOrderCount(order,count);updateOrders();};
 document.querySelectorAll('[data-craft-remove-recipe]').forEach(el=>el.onclick=()=>{setOrderCount(order,el.dataset.craftRemoveRecipe,0);updateOrders();});
 document.querySelectorAll('[data-craft-order-enabled]').forEach(el=>el.onchange=()=>{orders.find(o=>o.id===el.dataset.craftOrderEnabled).enabled=el.checked;updateOrders();});
 const remove=ids=>{orders=orders.filter(o=>!ids.includes(o.id));if(!currentOrder())currentOrderId=orders[0]?.id??null;updateOrders();};
 document.querySelectorAll('[data-craft-order-action]').forEach(el=>el.onclick=()=>{const target=orders.find(o=>o.id===el.dataset.orderId),action=el.dataset.craftOrderAction;if(action==='copy'){const copy={...structuredClone(target),id:crypto.randomUUID(),name:(orderLabel(target)+text(' 副本',' copy')).slice(0,120),enabled:true};orders.push(copy);choose(copy.id);}else if(confirm(text('删除订单：','Delete order: ')+orderLabel(target)+'?'))remove([target.id]);});
}

function renderInventoryStatus(){
 const status=document.getElementById('craft-inventory-status');
 if(status){status.textContent=inventoryBusy?text('正在读取游戏库存…','Reading game inventory…'):inventoryError?(errors[inventoryError]?errorText(inventoryError):importStatusText(language,{error:inventoryError})):inventory?text('库存读取时间：','Inventory captured: ')+new Date(inventory.capturedAt).toLocaleString(language==='zh'?'zh-CN':'en'):text('尚未读取游戏库存，采购数量暂不可确定。','Game inventory has not been read; purchase quantities are unknown.');status.setAttribute('role',inventoryError?'alert':'status');}
 const button=document.getElementById('craft-refresh-inventory');if(button)button.disabled=inventoryBusy||importBusy||storageBlocked;
 renderImport();
}
function acceptInventory(snapshot){
 const next=readCharacterInventory(snapshot);
 if(inventory&&next.capturedAt<inventory.capturedAt)throw Error('inventoryOutdated');
 return next;
}
function refreshInventory(){return craftingUpdater.read({config:false,inventory:true});}
function renderResults(){
 const host=document.getElementById('craft-results');if(!host)return;
 if(ensureCurrentOrder())save();
 for(const plan of allOrderPlans().filter(p=>p.job.upgrade&&!resultFor(p))){
  try{cache.set(simulationKey(plan),{signature:signature(plan),result:calculateUpgrade(state,plan.job,plan.tier,plan.count)});}
  catch(error){cache.set(simulationKey(plan),{signature:signature(plan),error:String(error.message??error)});}
 }
 const stats=craftingStats(state),jobs=sortedJobs();
 let materialHtml;
 try{
  const budget=orderMaterialBudget(state,selectedOrders(),inventory,getSnapshot());
  materialHtml=`<div class="table-scroll"><table class="gather-table craft-material-table"><thead><tr>${[text('材料','Material'),text('品质','Rarity'),text('需要采购','To purchase'),text('库存 / 总需求','Stock / required'),text('单价','Unit price'),text('采购金额','Purchase cost')].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${budget.rows.length?budget.rows.map(r=>`<tr><td>${esc(translatedItemName(r.id,language))}</td><td>${rarities()[game.itemTier(r.id)]}</td><td>${r.purchase===null?'—':format(r.purchase)}</td><td class="craft-stock"><span data-craft-inventory="${r.id}">${r.owned===null?'—':format(r.owned)}</span> / <span>${format(r.required)}</span> · <span>${r.owned===null?'—':Math.min(100,Math.floor(r.owned/r.required*100))+'%'}</span></td><td>${warn(r.fallback?[r.id]:[])}${priceInput(r.id,'budget')}</td><td>${warn(r.purchase>0&&r.fallback?[r.id]:[])}${r.cost===null?'—':format(r.cost,2)}</td></tr>`).join(''):`<tr><td colspan="6" class="empty-results">${text('选择订单后显示材料需求','Select orders to see material requirements')}</td></tr>`}</tbody><tfoot><tr><td colspan="5">${text('采购金额合计','Total purchase cost')}</td><td class="column-highlight">${warn(budget.missing)}${budget.total===null?'—':format(budget.total,2)}</td></tr></tfoot></table></div>`;
 }catch(error){materialHtml=`<p class="table-note death-note">${esc(errorText(error.message))}</p>`;}
 const groups=[...new Set(craftingJobs.filter(j=>j.skill===state.skill).map(j=>j.group))];if(group&&!groups.includes(group))groups.push(group);
 replaceResults(host,`<div class="result-heading"><div><span class="eyebrow">CRAFTING OVERVIEW</span><h2>${text('制造属性','Crafting stats')}</h2></div><span class="style-badge">${skillName(state.skill)}</span></div><div class="stats gather-stats">${[[text('技能等级','Skill level'),format(stats.level)],[text('制造速度加成','Craft speed bonus'),format(stats.speedBonus*100,2)+'%'],[text('经验加成','XP bonus'),format(stats.xpBonus*100,2)+'%'],[text('移动速度','Movement speed'),format(stats.moveSpeed,2)+'×'],[text("背包格子",'Inventory slots'),format(stats.capacity)]].map(([label,v])=>`<div class="stat"><span>${label}</span><strong>${v}</strong></div>`).join('')}</div><section id="craft-recipes-panel" class="panel enemies"><div class="enemies-heading craft-recipe-heading"><div class="craft-recipe-title"><h2>${text('配方选择','Recipe selection')}</h2><span class="craft-editing-order" title="${esc(orderLabel(currentOrder()))}">${esc(orderLabel(currentOrder()))}</span></div>${craftingProgress()}</div><div class="toolbar craft-toolbar"><select id="craft-group" aria-label="${text('配方分类','Recipe group')}">${options([['',text('全部分类','All groups')],...groups.map(g=>[g,name(g)])],group)}</select><div class="search-wrap"><span>⌕</span><input id="craft-search" type="search" value="${esc(query)}" placeholder="${text('搜索配方名称（中 / 英）','Search recipes in English or Chinese')}" aria-label="${text('搜索制造配方','Search crafting recipes')}"></div>${rarityFilters()}<button id="craft-filled" type="button" class="craft-filter-button${filledOnly?' selected':''}" aria-pressed="${filledOnly}">${text('只看已填写','Filled only')}</button><button id="craft-rerun" class="secondary rerun-simulation">${text('重新模拟','Rerun simulation')}</button></div><p id="craft-notice" class="table-note" role="status"></p><div class="table-scroll"><table class="gather-table craft-table"><thead><tr>${headers()}</tr></thead><tbody>${jobs.length?jobs.map(recipeRow).join(''):`<tr><td colspan="7" class="empty-results">${text('没有匹配的配方','No matching recipes')}</td></tr>`}</tbody></table></div><p id="craft-method-note" class="table-note">${methodNote()}</p></section>${orderPanel()}<section class="panel enemies craft-materials"><div class="enemies-heading craft-material-heading"><h2>${text('执行计划','Execution plan')}</h2><button id="craft-refresh-inventory" class="secondary">${text('刷新库存','Refresh inventory')}</button></div><p id="craft-inventory-status" class="table-note" role="status"></p>${executionRecipes()}<h3>${text('材料需求','Material requirements')}</h3>${materialHtml}<p class="table-note">${text('汇总所选订单全部配方，不受搜索和筛选影响。库存来自游戏仓库与背包，共享材料合并后仅抵扣一次库存；比例加工费与制造利润按全部材料消耗价值计算。表内修改单价同步全局并自动锁定；商人价兜底仅用于估值，不代表市场实际购买价格。','Includes all recipes in selected orders, regardless of filters. Stock comes from the game warehouse and backpack and is deducted once; percentage fees and manufacturing profit value all consumed materials. Editing prices updates global prices and locks them. Vendor fallback is an estimate, not an executable market buy price.')}</p><p id="craft-price-status" class="table-note" role="status"></p></section>`);
 bindResults();renderNotice();renderInventoryStatus();
}
function readCount(el){const value=el.value===''?0:el.valueAsNumber;if(el.validity.badInput||!el.checkValidity()||!validQuantity(value)){el.setAttribute('aria-invalid','true');notice='invalidQuantity';renderNotice();return null;}el.removeAttribute('aria-invalid');notice='';return value;}
function bindResults(){
 document.getElementById('craft-search').oninput=e=>{query=e.target.value;renderResults();};
 document.getElementById('craft-group').onchange=e=>{group=e.target.value;renderResults();};
 document.querySelectorAll('[data-craft-rarity]').forEach(el=>el.onclick=()=>{const tier=Number(el.dataset.craftRarity);if(selectedTiers.has(tier))selectedTiers.delete(tier);else selectedTiers.add(tier);renderResults();});
 document.getElementById('craft-filled').onclick=()=>{filledOnly=!filledOnly;renderResults();};
 document.getElementById('craft-rerun').onclick=()=>{schedule();renderResults();};
 document.querySelectorAll('[data-craft-sort]').forEach(el=>el.onclick=()=>{const key=el.dataset.craftSort;direction=sort===key&&direction==='asc'?'desc':'asc';sort=key;renderResults();});
 document.querySelectorAll('[data-craft-count]').forEach(el=>el.onchange=()=>{const n=readCount(el),order=currentOrder();if(n===null||!order)return;setOrderCount(order,el.dataset.craftCount,n);updateOrders();});
 bindOrders();
 document.getElementById('craft-refresh-inventory').onclick=()=>void refreshInventory();
 document.querySelectorAll('[data-craft-price]').forEach(el=>el.oninput=()=>{const value=el.value===''?null:el.valueAsNumber;if(el.validity.badInput||value!==null&&!validPrice(value)){el.setAttribute('aria-invalid','true');notice='invalidPrice';renderNotice();return;}el.removeAttribute('aria-invalid');notice='';const id=Number(el.dataset.craftPrice);setPrice(id,value);});
}
function stopWorker(){clearTimeout(renderTimer);renderTimer=null;generation++;worker?.terminate();worker=null;running=false;progress=null;}
function schedule(){stopWorker();clearTimeout(timer);workerError=null;roundSeed=null;clock=Date.now();cache.clear();rateCache.clear();if(active)timer=setTimeout(startSimulation,180);}
function startSimulation(){
 if(workerError)return;
 clearTimeout(timer);const pendingPlans=[...allOrderPlans().filter(p=>!p.job.upgrade&&state.levels[p.job.skill]>=p.job.levelReq&&!resultFor(p)),...craftingJobs.filter(j=>!j.upgrade&&j.skill===state.skill&&state.levels[j.skill]>=j.levelReq).flatMap(job=>craftingTiers(job).map(tier=>({job,tier,key:planKey(job.id,tier),count:0,mode:'rate'}))).filter(p=>!rateFor(p))];
 const plans=[...new Map(pendingPlans.map(p=>[p.mode==='rate'?'rate:'+p.key:simulationKey(p),p])).values()];
 if(!plans.length){renderResults();return;}stopWorker();const token=generation,signatures=new Map(plans.map(p=>[`${p.mode??'plan'}:${p.mode==='rate'?p.key:simulationKey(p)}`,signature(p)]));running=true;workerError=null;
 try{
  if(plans.some(p=>!p.job.upgrade))roundSeed??=randomSimulationSeed();
  worker=new Worker(new URL('./crafting-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(token!==generation)return;
   if(data.result)(data.mode==='rate'?rateCache:cache).set(data.result.key,{signature:signatures.get(`${data.mode??'plan'}:${data.result.key}`),result:data.result});
   if(data.jobError)(data.jobError.mode==='rate'?rateCache:cache).set(data.jobError.key,{signature:signatures.get(`${data.jobError.mode??'plan'}:${data.jobError.key}`),error:data.jobError.message});
   if(data.progress)progress=data.progress;
   if(data.error)workerError=data.error;
   if(data.done||data.error){running=false;worker?.terminate();worker=null;}
   if(data.done||data.error){clearTimeout(renderTimer);renderTimer=null;renderResults();if(data.done&&active)startSimulation();}
   else if(!renderTimer)renderTimer=setTimeout(()=>{renderTimer=null;renderResults();},200);
  };
  worker.onerror=()=>{if(token!==generation)return;workerError='workerFailed';stopWorker();renderResults();};
  worker.postMessage({state,now:clock,seed:roundSeed??0,plans:plans.map(p=>({jobId:p.job.id,key:p.mode==='rate'?p.key:simulationKey(p),tier:p.tier,count:p.count,mode:p.mode}))});
 }catch(error){workerError=String(error.message??error);stopWorker();console.error(error);}
 renderResults();
}
const field=(path,label,value,min=0,max=Number.MAX_SAFE_INTEGER,step=1)=>`<label class="number-field"><span>${esc(label)}</span><input type="number" data-craft-field="${path}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(label)}"></label>`;
const select=(path,label,values,value)=>`<label class="potion"><span>${esc(label)}</span><select data-craft-field="${path}" aria-label="${esc(label)}">${options(values,value)}</select></label>`;
const section=(id,label,html)=>`<details class="config-detail" id="craft-${id}"><summary>${esc(label)}</summary>${html}</details>`;
const icons={cooking:'<path d="M3 10h13v5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Zm13 2h5M6 3v4m4-4v4m4-4v4"/>',smithing:'<path d="m5 3 9 3-3 7-9-3Zm5 9 8 9M15 4l5 2-3 7-5-2"/>',fletching:'<path d="m3 21 17-17M13 4h7v7M5 13v6h6M3 15h6v6"/>',herblore:'<path d="M9 3h6m-5 0v7L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-8V3M7 15h10"/>',crafting:'<path d="m5 21 13-17a2 2 0 0 1 3 2L7 22Zm11-13 3 2M4 5c7 0 2 7 7 7"/>'};
function gearRow(slot){const v=state.gear[slot],label=name({pan:'Pan',hammer:'Hammer',knife:'Knife',mortar:'Mortar',needle:'Needle',mount:'Mount'}[slot]),g=v.id?gatheringGear(slot,game.encode(game.withRarity(v.id,v.tier),v.plus)):null;return `<div class="gear-row"><label class="gear-name"><span>${esc(label)}</span><select data-craft-field="gear.${slot}.id" aria-label="${esc(label)}">${options([[0,text("无",'None')],...slotItems(slot).map(i=>[i.itemId,name(game.item(i.itemId).name)])],v.id)}</select></label><div class="gear-mods"><select data-craft-field="gear.${slot}.tier" aria-label="${esc(label+' '+text('稀有度','Rarity'))}" ${!v.id?'disabled':''}>${options(rarities().map((r,i)=>[i,r]),v.tier)}</select><label class="enhance"><span>+</span><input type="number" data-craft-field="gear.${slot}.plus" min="0" max="${game.maxEnhancement}" step="1" value="${v.plus}" aria-label="${esc(label+' '+text('强化','Enhance'))}" ${!v.id?'disabled':''}></label></div><small class="gear-stats">${g?text(slot==='mount'?'移动速度':'工具速度',slot==='mount'?'Movement speed':'Tool speed')+' +'+format(g.bonus*100,2)+'%':'—'}</small></div>`;}
function renderImport(){const worldWarnings=(importStatus?.warnings??[]).filter(w=>w==='worldBuffs.upgrade'||w==='weeklyXp.reset'),warnings=(importStatus?.warnings??[]).filter(w=>!worldWarnings.includes(w));const el=document.getElementById('craft-import-status');if(!el)return;const categories={skills:text('技能','Skills'),equipment:text('工具与装备','Tools & equipment'),brews:text('药水','Potions'),brewBuckets:text('药水','Potions'),brewTier:text('药水','Potions'),house:text('家园','Home'),masteries:text('精通','Masteries'),perks:text('特权','Perks'),guildBonus:text('公会经验','Guild XP'),guild:text('公会','Guild'),weeklyXp:text('世界增益经验','World buff XP'),homeBank:text('仓库','Depot'),blessing:text('祝福','Blessing'),ironman:text('铁人模式','Ironman')};el.textContent=importStatusText(language,importStatus,importBusy)+(warnings.length?'\n'+text('部分配置未导入，已保留原值：','Some settings could not be imported; previous values kept: ')+[...new Set(warnings.map(w=>categories[w.split('.')[0]]??text('角色配置','Character build')))].join(text('、',', ')):'')+worldWarnings.map(w=>'\n'+worldBuffWarningText(language,w,{rarity:false})).join('');document.getElementById('craft-import').disabled=importBusy||inventoryBusy;}
export function renderCrafting(lang,{isActive=false}={}){
 language=lang;active=isActive;const host=document.getElementById('craft-content');if(!host)return;
 rememberDetails(host);const rooms=craftingRooms.filter(r=>r.bonus.skill===state.skill);
 host.innerHTML=`<aside class="panel config gather-config"><div class="panel-heading"><h1>${text('角色配置','Character build')}</h1><button id="craft-reset" class="text-button">${text('清空配置','Reset settings')}</button></div><p class="muted intro">${text('创建多配方订单，选择执行范围，估算材料与加工费。','Build multi-recipe orders, select execution scope, and estimate materials and processing fees.')}</p>${characterImportPanel(language,{id:'craft-import-settings',statusId:'craft-import-status',buttons:[{id:'craft-import',label:text('导入配置','Import configuration')}]})}<div class="presets gather-skills">${craftingSkills.map(k=>`<button data-craft-skill="${k}" aria-pressed="${state.skill===k}" class="${state.skill===k?'selected':''}"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[k]}</svg></span>${skillName(k)}</button>`).join('')}</div>${section('skills',text('技能','Skills'),`<div class="skill-grid">${craftingSkills.map(k=>field(`levels.${k}`,skillName(k),state.levels[k],1,game.maxLevel)).join('')}</div>`)}${section('equipment',text('工具与装备','Tools & equipment'),[craftingToolSlots[state.skill],'mount'].map(gearRow).join(''))}${section('potions',text('药水','Potions'),craftingPotions.map(p=>select(`brews.${p.kind}`,name(game.item(p.itemId).name),[[-1,text('未启用','Inactive')],...rarities().map((r,i)=>[i,r])],state.brews[p.kind])+`<p class="micro">${p.kind==='elixir'?text('所有经验','All XP'):text('移动速度','Movement speed')}</p>`).join(''))}${section('home',text('家园','Home'),rooms.map(r=>field(`house.${r.id}`,name(r.name),state.house[r.id])+`<p class="micro">${text('制造速度 · 每级','Craft speed · per level')} +${format(game.houseBonus(r,1)*100,2)}% · ${text('当前','current')} +${format(game.houseBonus(r,state.house[r.id])*100,2)}%</p>`).join(''))}${section('masteries',text('精通','Masteries'),craftingMasteries.map(m=>field(`masteries.${m.id}`,name(m.name)+' (%)',masteryValue(m.id,state.masteries[m.id]),0,masteryValue(m.id,game.masteryRankLimit),.5)).join(''))}${section('perks',text('特权','Perks'),craftingPerks.filter(p=>p.id!=='hands'||state.skill==='cooking').map(p=>field(`perks.${p.id}`,name(p.name),state.perks[p.id],0,p.ranks)+`<p class="micro">${esc(name(p.each))}</p>`).join(''))}${section('other',text('其它','Other'),field('guildXp',text('公会经验 (%)','Guild XP (%)'),state.guildXp,0,1e7,.1)+field('weeklyXp',text('世界增益经验 (%)','World buff XP (%)'),state.weeklyXp,0,1e7,.1)+`<p class="micro">${text('导入捕获时生效的世界增益，整个模拟周期保持生效。','Imports world buffs active at capture; they remain active throughout the simulation.')}</p><label class="check"><span>${text('矿脉祝福','Vein Blessing')}</span><input type="checkbox" data-craft-field="blessing" ${state.blessing?'checked':''}></label><label class="check"><span>${text('铁人模式（不掉落坐骑）','Ironman (no mount drops)')}</span><input type="checkbox" data-craft-field="ironman" ${state.ironman?'checked':''}></label>`)}${section('settings',text('模拟配置','Simulation settings'),select('homeBank',text('初始仓库','Starting depot'),[[0,text('自动','Automatic')],...game.world.banks.map(b=>[b.id,`${text('仓库','Depot')} ${b.id}`])],state.homeBank)+`<label class="potion"><span>${text('利润周期','Reward period')}</span><select id="craft-period" aria-label="${text('利润周期','Reward period')}">${options([['hour',text('每小时','Per hour')],['day',text('每天','Per day')]],state.period)}</select></label>`+select('hotSetting',text('热门加成','Hot bonuses'),[['game',text('沿用游戏设置','Use game settings')],['current',text('按照当前时间','Use current time')],['off',text('不计入','Exclude')]],state.hotSetting)+`<p class="micro">${text('按原始距离规则选择最近制造点；各配方从相同初始配置独立模拟。','Uses the nearest crafting site by upstream distance rules; each recipe starts independently.')}</p>`)}<p id="craft-save" class="save-note"></p></aside><div class="results" id="craft-results"></div>`;
 restoreDetails(host);
 host.querySelectorAll('[data-craft-skill]').forEach(el=>el.onclick=()=>{state.skill=el.dataset.craftSkill;group='';save();renderCrafting(language,{isActive:active});});
 document.getElementById('craft-period').onchange=e=>{state.period=e.target.value;save();renderResults();};
 host.querySelectorAll('[data-craft-field]').forEach(el=>el.onchange=()=>{
  if(el.type==='number'&&(el.value===''||!(el.dataset.craftField==='weeklyXp'?Number.isFinite(el.valueAsNumber)&&el.valueAsNumber>=0&&el.valueAsNumber<=1e7:el.checkValidity()))){el.setAttribute('aria-invalid','true');el.reportValidity();return;}
  const keys=el.dataset.craftField.split('.'),last=keys.pop(),target=keys.reduce((o,k)=>o[k],state);target[last]=el.type==='checkbox'?el.checked:el.dataset.craftField==='hotSetting'?el.value:keys[0]==='masteries'?masteryRank(last,Number(el.value)):Number(el.value);
  state=normalizeCrafting(state);clock=Date.now();save();schedule();renderCrafting(language,{isActive:active});
 });
 document.getElementById('craft-reset').onclick=()=>{state=craftingDefaults();importStatus=null;save();schedule();renderCrafting(language,{isActive:active});};
 document.getElementById('craft-import').onclick=()=>craftingUpdater.read({config:true,inventory:true});
 if(active&&!probeStarted){probeStarted=true;probeCharacter().then(()=>{if(!importStatus)importStatus={ready:true};renderImport();}).catch(error=>{if(!importStatus)importStatus={error:error.message};renderImport();});}
 renderResults();renderImport();renderNotice();if(active&&!running)startSimulation();
}
subscribe(change=>{if(change.prices||change.storage)renderResults();});

const craftingUpdater=registerCharacterUpdates('craft',{
 inventory:true,busy:()=>importBusy||inventoryBusy||storageBlocked,revision:()=>JSON.stringify({state,orders,inventory}),
 onBusy:(value,flags)=>{if(flags.config)importBusy=value;if(flags.inventory)inventoryBusy=value;renderInventoryStatus();},
 apply:(snapshot,flags)=>{
  const imported=flags.config?importCrafting(state,snapshot):null,next=flags.inventory?acceptInventory(snapshot):inventory;
  if(imported){state=imported.state;importStatus=imported;clock=Date.now();}
  inventory=next;if(flags.inventory)inventoryError=null;save();
  if(imported){schedule();renderCrafting(language,{isActive:active});}else renderResults();
 },
 onError:(error,flags)=>{if(flags.config)importStatus={error:error.message};if(flags.inventory)inventoryError=error.message;renderInventoryStatus();},
});
