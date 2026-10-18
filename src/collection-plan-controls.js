import * as game from './upstream.js';
import {translatedItemName} from './i18n.js';
import {calculateCollectionPlan} from './collection-plan.js';

export function renderCollectionPlan(host,{state,plan,prices,language,now,loadError,saveError,statusText,sort,onSort,onClear,onTarget,onRemove}){
 if(!host)return;
 const text=(zh,en)=>language==='zh'?zh:en;
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=(value,maximumFractionDigits=3)=>value===null?'—':Number(value).toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits});
 const tiers=text(['普通','罕见','稀有','史诗','传说'],['Normal','Uncommon','Rare','Epic','Legendary']);
 const name=id=>`${translatedItemName(id,language)} · ${tiers[game.itemTier(id)]}`;
 const headers=(table,columns)=>columns.map(([zh,en,key])=>{
  const current=sort[table],active=current.key===key;
  return `<th scope="col"${key?` aria-sort="${active?(current.direction==='asc'?'ascending':'descending'):'none'}"`:''}>${key?`<button class="sort-header" data-plan-sort="${key}" data-plan-table="${table}">${text(zh,en)} <span class="sort-arrow" aria-hidden="true">${active?(current.direction==='asc'?'↑':'↓'):'↕'}</span></button>`:text(zh,en)}</th>`;
 }).join('');
 const sorted=(rows,table)=>{
  const {key,direction}=sort[table];
  if(!key)return rows;
  const value=row=>key==='item'?translatedItemName(row.itemId,language):key==='tier'?game.itemTier(row.itemId):row[key];
  return [...rows].sort((a,b)=>{
   const av=value(a),bv=value(b);
   if(av==null||bv==null)return av==null?(bv==null?a.itemId-b.itemId:1):-1;
   const comparison=key==='item'?av.localeCompare(bv,language==='zh'?'zh-CN':'en'):av-bv;
   return (direction==='asc'?comparison:-comparison)||a.itemId-b.itemId;
  });
 };
 const progress=entry=>{
  if(!state.initialized)return '—';
  const current=state.counts[entry.itemId]??0,percent=Math.floor(Math.min(1,current/entry.target)*1000)/10;
  return `${number(current)} / ${number(entry.target)} · ${current>=entry.target?text('已完成','Completed'):number(percent)+'%'}`;
 };
 const actions=entry=>{
  const thresholds=game.collectionThresholds(game.baseItemId(entry.itemId)),index=thresholds.indexOf(entry.target);
  return [['increase',1,text('增加','Increase')],['decrease',-1,text('减少','Decrease')]].map(([action,step,label])=>{
   const goal=thresholds[index+step];
   return `<span class="collection-plan-control" role="button" tabindex="${goal===undefined?'-1':'0'}" aria-disabled="${goal===undefined}" data-plan-${action}="${entry.itemId}" data-plan-goal="${goal??''}" aria-label="${esc(name(entry.itemId)+' '+label)}">${label}</span>`;
  }).join('')+`<span class="collection-plan-control" role="button" tabindex="0" data-plan-remove="${entry.itemId}" aria-label="${esc(name(entry.itemId)+' '+text('移除','Remove'))}">${text('移除','Remove')}</span>`;
 };
 let result;
 try{result=calculateCollectionPlan(state,plan,prices,{now});}catch(error){host.innerHTML=`<p role="alert">${esc(statusText(error.message))}</p>`;return;}
 host.innerHTML=`<div class="panel-heading"><h2>${text('执行计划','Execution plan')}</h2><button class="text-button" data-plan-clear ${!plan.selections.length&&!loadError?'disabled':''}>${text('清空计划','Clear plan')}</button></div>
 ${loadError?`<p role="alert">${text('计划存档无法读取，原数据未覆盖。请清空计划后重新选择。','The saved plan could not be read and has not been overwritten. Clear the plan before selecting again.')}</p>`:''}
 ${saveError?`<p role="alert">${text('计划保存失败，当前内存计算仍有效。','Plan could not be saved; calculations remain available in memory.')}</p>`:''}
 ${!plan.selections.length?`<p class="micro">${text('在目标行加入计划后，按最高目标档汇总材料需求。','Add targets from the results to combine material requirements at the highest selected milestone.')}</p>`:`
 <p class="micro" role="status" id="collection-plan-summary">${text('已选方案','Selected routes')} ${plan.selections.length} · ${text('已完成','Completed')} ${result.completedCount} · ${text('所选目标奖励','Selected target rewards')} ${number(result.points)} · ${text('期望材料成本','Expected material cost')} ${number(result.cost)}</p>
 ${!result.complete?`<p role="status" class="micro">${text('未完整计算','Incomplete calculation')}${result.missingInventory?' · '+text('仓库数据未知，请重新导入角色','Warehouse quantities are unknown; import the character again'):''}${result.blockedCount?' · '+text('不可计算方案','Unavailable routes')+' '+result.blockedCount:''}${result.missingPrices?' · '+text('材料缺价','Missing material prices')+' '+result.missingPrices:''}${result.quantityOverflow?' · '+text('数量超出计算范围','Quantity exceeds supported range'):''}${result.amountOverflow?' · '+text('金额超出计算范围','Amount exceeds supported range'):''} · ${text('有效部分已知价格小计','Known subtotal for the valid portion')} ${number(result.knownCost)}</p>`:''}
 <div class="collection-plan-table-wrap" tabindex="0" role="region" aria-label="${text('计划方案','Plan routes')}"><table class="collection-plan-table collection-plan-selections"><thead><tr>${headers('selections',[['物品','Item','item'],['稀有度','Rarity','tier'],['数量','Quantity','target'],['完成进度','Progress'],['操作','Actions']])}</tr></thead><tbody>${sorted(result.entries,'selections').map(entry=>`<tr data-plan-item="${entry.itemId}"><td>${esc(translatedItemName(entry.itemId,language))}</td><td>${tiers[game.itemTier(entry.itemId)]}</td><td>${number(entry.target)}</td><td data-plan-progress>${progress(entry)}</td><td><div class="collection-plan-actions">${actions(entry)}</div></td></tr>`).join('')}</tbody></table></div>
 <h3>${text('预计材料需求（期望）','Expected material requirements')}</h3>
 <p class="micro">${text('同方案仅计算最高目标；需求包含烧焦的期望消耗，不是保底备料。仓库库存按合并后的材料抵扣，不抵扣其他方案产物，不包含药剂。','Only the highest milestone per route is counted. Quantities include expected burns, not guaranteed supplies. Warehouse stock is deducted after combining requirements; other planned outputs and potions are excluded.')}</p>
 ${result.materials.length?`<div class="collection-plan-table-wrap" tabindex="0" role="region" aria-label="${text('预计材料需求','Expected material requirements')}"><table class="collection-plan-table collection-plan-materials"><thead><tr>${headers('materials',[['物品','Item','item'],['稀有度','Rarity','tier'],['预计需求','Expected quantity','quantity'],['库存数量','In stock','inventory'],['需要采购','To purchase','purchase'],['单价','Unit price','price'],['总价','Total price','cost']])}</tr></thead><tbody>${sorted(result.materials,'materials').map(material=>`<tr data-plan-material="${material.itemId}"><td>${esc(translatedItemName(material.itemId,language))}</td><td>${tiers[game.itemTier(material.itemId)]}</td><td data-plan-quantity>${number(material.quantity,0)}</td><td data-plan-inventory>${number(material.inventory,0)}</td><td data-plan-purchase>${number(material.purchase,0)}</td><td>${number(material.price,0)}${material.purchase>0&&material.price===null?' · '+text('缺报价','Missing price'):''}</td><td data-plan-cost>${number(material.cost,0)}${material.overflow?' · '+text('金额超限','Amount overflow'):''}</td></tr>`).join('')}</tbody></table></div>`:`<p class="micro">${result.blockedCount?text('有效部分无材料需求；仍有不可计算方案。','The valid portion has no material inputs; unavailable routes remain.'):text('无配方材料需求。','No recipe materials required.')}</p>`}`}`;

 host.querySelectorAll('[data-plan-sort]').forEach(button=>button.onclick=()=>{
  const current=sort[button.dataset.planTable],key=button.dataset.planSort;
  current.direction=current.key===key&&current.direction==='asc'?'desc':'asc';current.key=key;
  onSort();
  host.querySelector(`[data-plan-table="${button.dataset.planTable}"][data-plan-sort="${key}"]`)?.focus({preventScroll:true});
 });
 host.querySelector('[data-plan-clear]')?.addEventListener('click',onClear);
 host.querySelectorAll('.collection-plan-control').forEach(control=>{
  const activate=()=>{
   if(control.getAttribute('aria-disabled')==='true')return;
   if(control.dataset.planRemove!==undefined)onRemove(Number(control.dataset.planRemove));
   else onTarget(Number(control.dataset.planIncrease??control.dataset.planDecrease),Number(control.dataset.planGoal));
  };
  control.onclick=activate;
  control.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}};
 });
}
