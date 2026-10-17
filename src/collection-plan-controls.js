import * as game from './upstream.js';
import {translatedItemName} from './i18n.js';
import {calculateCollectionPlan} from './collection-plan.js';

export function renderCollectionPlan(host,{state,plan,prices,language,now,loadError,saveError,statusText,onClear,onRemove,onTarget,onError}){
 if(!host)return;
 const text=(zh,en)=>language==='zh'?zh:en;
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=value=>value===null?'—':Number(value).toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:3});
 const tiers=text(['普通','罕见','稀有','史诗','传说'],['Normal','Uncommon','Rare','Epic','Legendary']);
 const name=id=>`${translatedItemName(id,language)} · ${tiers[game.itemTier(id)]}`;
 let result;
 try{result=calculateCollectionPlan(state,plan,prices,{now});}catch(error){host.innerHTML=`<p role="alert">${esc(statusText(error.message))}</p>`;return;}
 host.innerHTML=`<div class="panel-heading"><h2>${text('执行计划与材料需求','Execution plan & materials')}</h2><button class="text-button" data-plan-clear ${!plan.selections.length&&!loadError?'disabled':''}>${text('清空计划','Clear plan')}</button></div>
 ${loadError?`<p role="alert">${text('计划存档无法读取，原数据未覆盖。请清空计划后重新选择。','The saved plan could not be read and has not been overwritten. Clear the plan before selecting again.')}</p>`:''}
 ${saveError?`<p role="alert">${text('计划保存失败，当前内存计算仍有效。','Plan could not be saved; calculations remain available in memory.')}</p>`:''}
 ${!plan.selections.length?`<p class="micro">${text('在目标行加入计划后，按最高目标档汇总材料需求。','Add targets from the results to combine material requirements at the highest selected milestone.')}</p>`:`
 <p class="micro" role="status" id="collection-plan-summary">${text('已选方案','Selected routes')} ${plan.selections.length} · ${text('已完成','Completed')} ${result.completedCount} · ${text('所选目标奖励','Selected target rewards')} ${number(result.points)} · ${text('期望材料成本','Expected material cost')} ${number(result.cost)}</p>
 ${!result.complete?`<p role="status" class="micro">${text('未完整计算','Incomplete calculation')}${result.blockedCount?' · '+text('不可计算方案','Unavailable routes')+' '+result.blockedCount:''}${result.missingPrices?' · '+text('材料缺价','Missing material prices')+' '+result.missingPrices:''}${result.quantityOverflow?' · '+text('数量超出计算范围','Quantity exceeds supported range'):''}${result.amountOverflow?' · '+text('金额超出计算范围','Amount exceeds supported range'):''} · ${text('有效部分已知价格小计','Known subtotal for the valid portion')} ${number(result.knownCost)}</p>`:''}
 <ul class="collection-plan-selections">${result.entries.map(entry=>`<li data-plan-item="${entry.itemId}"><strong>${esc(name(entry.itemId))}</strong><label>${text('目标','Target')}<select data-plan-target="${entry.itemId}" aria-label="${esc(name(entry.itemId)+' '+text('目标','target'))}">${game.collectionThresholds(game.baseItemId(entry.itemId)).map(target=>`<option value="${target}" ${target===entry.target?'selected':''}>${number(target)}</option>`).join('')}</select></label>${entry.status!=='ok'?`<span>${esc(statusText(entry.status))}</span>`:''}<button class="text-button" data-plan-remove="${entry.itemId}">${text('移除','Remove')}</button></li>`).join('')}</ul>
 <h3>${text('预计材料需求（期望）','Expected material requirements')}</h3>
 <p class="micro">${text('同方案仅计算最高目标；需求包含烧焦的期望消耗，不是保底备料。不抵扣库存或其他方案产物，不包含药剂。','Only the highest milestone per route is counted. Quantities include expected burns, not guaranteed supplies. Stock, other planned outputs and potions are excluded.')}</p>
 <div class="collection-plan-materials">${result.materials.length?result.materials.map(material=>`<article data-plan-material="${material.itemId}"><strong>${esc(name(material.itemId))}</strong><dl><div><dt>${text('预计需求','Expected quantity')}</dt><dd data-plan-quantity>${number(material.quantity)}</dd></div><div><dt>${text('采购单价','Purchase price')}</dt><dd>${number(material.price)}${material.price===null?' · '+text('缺报价','Missing price'):''}</dd></div><div><dt>${text('期望材料成本','Expected material cost')}</dt><dd>${number(material.cost)}${material.overflow?' · '+text('金额超限','Amount overflow'):''}</dd></div></dl><details><summary>${text('贡献方案','Contributing routes')} ${material.contributors.length}</summary><ul>${material.contributors.map(entry=>`<li>${esc(name(entry.itemId))} → ${number(entry.target)} · ${number(entry.quantity)}</li>`).join('')}</ul></details></article>`).join(''):`<p class="micro">${result.blockedCount?text('有效部分无材料需求；仍有不可计算方案。','The valid portion has no material inputs; unavailable routes remain.'):text('无配方材料需求。','No recipe materials required.')}</p>`}</div>`}`;
 host.querySelector('[data-plan-clear]')?.addEventListener('click',onClear);
 host.querySelectorAll('[data-plan-remove]').forEach(button=>button.onclick=()=>onRemove(Number(button.dataset.planRemove)));
 host.querySelectorAll('[data-plan-target]').forEach(select=>select.onchange=()=>{try{onTarget(Number(select.dataset.planTarget),Number(select.value));}catch(error){onError(error);}});
}
