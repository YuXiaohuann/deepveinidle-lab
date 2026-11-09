import {game} from './model.js';
import {masteryResultHistory} from './mastery-result-store.js';

const escapePlanText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function masteryPlanMetrics(record,totalPoints,language){
 const text=(zh,en)=>language==='zh'?zh:en,format=n=>n.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:2});
 const cost=game.masteriesTotalCost(record.plan.ranks),total=String(totalPoints??'').trim()!==''?Number(totalPoints):NaN;
 const remaining=Number.isSafeInteger(total)&&total>=0?total-cost:null,history=masteryResultHistory(record);
 const label=history.available?(history.policy.experience?text('计算时经验','XP at calculation'):history.policy.collection?text('计算时评分','Score at calculation'):text('计算时收入','Income at calculation')):text('计算时指标','Historical metric');
 return `<dl class="optimizer-plan-metrics"><div><dt>${text('方案总投入','Plan investment')}</dt><dd>${format(cost)}</dd></div><div><dt>${remaining!==null&&remaining<0?text('当前缺口','Current shortfall'):text('当前剩余','Current remaining')}</dt><dd ${remaining!==null&&remaining<0?'class="plan-budget-shortage"':''}>${remaining===null?'—':format(Math.abs(remaining))}</dd></div><div><dt>${label}</dt><dd>${history.available?format(history.plan.stats.mean):'—'}</dd></div></dl>${remaining!==null&&remaining<0?`<p class="saved-result-warning">${text(`方案超出当前点数，缺少 ${format(-remaining)} 点`,`Plan exceeds current points by ${format(-remaining)}`)}</p>`:''}`;
}
export function masteryPlanHistoryNote(record,language){
 const text=(zh,en)=>language==='zh'?zh:en,format=n=>n.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:2}),history=masteryResultHistory(record);
 if(!history.available)return `<p class="micro">${text('历史计算信息不可用，分配方案仍可使用','Historical calculation details unavailable; the allocation can still be used')}</p>`;
 const delta=history.plan.paired?format(history.plan.paired.mean)+(Math.abs(history.plan.paired.mean)<=2*history.plan.paired.se?' · '+text('差异接近波动','Close to variability'):''):history.baseline.overBudget?text('当时原方案超预算，无法比较','Original plan exceeded its budget'):text('当时原方案未完成模拟，无法比较','Original simulation did not finish');
 return `<p class="micro">${history.oldEngine?text('历史计算版本 · ','Historical calculation version · '):''}${text('较计算时原方案：','Vs original at calculation: ')}${escapePlanText(delta)}</p>`;
}
