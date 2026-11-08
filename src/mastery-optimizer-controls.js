import {game,calculate} from './model.js';
import {gatheringJobs,gatheringSkills,gatheringStats} from './gathering-model.js';
import {translatedName} from './i18n.js';
import {getSnapshot,subscribe} from './price-service.js';
import {optimizerIncomeItems,optimizerPolicy,optimizerInput,checkOptimizerPrices,optimizerEfforts} from './mastery-optimizer.js';

import {optimizerContextKey,createMasteryResult} from './mastery-result-store.js';
import {renderSavedMasteryResults,saveAutomaticMasteryResult,saveManualMasteryResult,savedMasteryFeedback,clearSavedMasterySuccess} from './mastery-result-controls.js';

const optimizerJobs=[...gatheringJobs].sort((a,b)=>gatheringSkills.indexOf(a.skill)-gatheringSkills.indexOf(b.skill)||b.levelReq-a.levelReq);
const optimizerMonsters=[...game.monsters].sort((a,b)=>b.level-a.level);
let language='zh',mastery=null,getCombat=()=>null,getGathering=()=>null,objective='combatIncome',jobId=gatheringJobs[0].id,monsterId=7,effort='standard',allocationMode='reset';
let worker=null,generation=0,result=null,progress=null,notice=null,fingerprint=null,invalidatedFingerprint=null,pricesChanged=false;
let targetRanks=null,onApply=null,applying=false,resultRequest=null;
const text=(zh,en)=>language==='zh'?zh:en;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=s=>translatedName(s,language);
const format=n=>n.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:2});
const host=()=>document.getElementById('mastery-optimizer');
const signature=()=>optimizerContextKey({...mastery,objective,jobId,monsterId,effort,allocationMode,combat:getCombat(),gathering:getGathering()});
const allocationLabel=mode=>mode==='remaining'?text('分配剩余点数','Allocate remaining points'):text('重置后分配','Reallocate all points');
const draftNumber=value=>typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number(value):NaN;
export function setMasteryCombatSource(provider){getCombat=provider;}
export function setMasteryGatheringSource(provider){getGathering=provider;}
export function invalidateMasteryOptimizer(){
 if(!applying&&(worker||result)&&fingerprint!==signature()){clear('changed');paint();}
 else if(notice?.code==='changed'&&invalidatedFingerprint===signature()){notice=null;invalidatedFingerprint=null;paint();}
}
export function leaveMasteryOptimizer(){if(worker){clear('cancelled');paint();}}
function clear(code){invalidatedFingerprint=code==='changed'?fingerprint??invalidatedFingerprint:null;clearSavedMasterySuccess();generation++;worker?.terminate();worker=null;result=null;resultRequest=null;progress=null;notice=code?{code}:null;fingerprint=null;pricesChanged=false;}
subscribe(change=>{if(change.prices){if(!optimizerPolicy(objective).collection&&(worker||result))pricesChanged=true;paint();}});
const errors=()=>({
 invalidOptimizerPoints:text('请填写有效的非负整数总点数。','Enter valid nonnegative integer total points.'),
 invalidOptimizerRanks:text('请先修正当前精通等级。','Correct current mastery ranks first.'),
 invalidOptimizerMode:text('计算模式无效，请重新选择。','Invalid calculation mode. Select a mode again.'),
 optimizerCurrentOverBudget:text('当前精通已投入超过总点数，无法仅分配剩余点数；请修正总点数或当前等级。','Current mastery investment exceeds total points. Correct total points or current ranks before allocating remaining points.'),
 invalidOptimizerGathering:text('无法读取采集配置，请先在采集页配置角色。','Configure your character on the Gathering page first.'),
 invalidOptimizerJob:text('请选择有效采集任务。','Select a valid gathering task.'),
 levelTooLow:text('采集等级不足，无法执行所选任务。','Gathering level is too low for this task.'),
 invalidOptimizerScenario:text('无法读取战斗配置，请先在战斗页配置角色。','Configure your character on the Combat page first.'),
 missingOptimizerPrices:text('以下可能产出缺少有效价格，请在物品价格中设置后重算：','Set valid item prices for these possible rewards before running: '),
 noViableOptimizerPlan:text('本次搜索未找到完成整个时长且战斗无死亡的方案；请检查目标、配装或增加搜索次数。','No searched plan survived the full duration. Check the target and build, or try a deeper search.'),
 workerFailed:text('计算进程失败，请重试。','Calculation process failed. Please retry.'),
 changed:text('配置已变化，需重新计算','Settings changed; run again'),
 cancelled:text('计算已取消。','Calculation cancelled.'),
 applied:text('已应用','Applied'),
 applySaveFailed:text('方案已应用，但浏览器存储不可用，无法保存。','Plan applied, but browser storage is unavailable and it could not be saved.'),
 applyFailed:text('方案应用失败，原配置保留。','Could not apply this plan. Existing settings were preserved.'),
});
function message(){
 const messages=[];
 if(progress)messages.push(text(`${progress.phase==='review'?'独立种子复核':'搜索方案'} · 已筛查 ${progress.candidates}/${progress.maxCandidates} 个配置 · 已模拟 ${progress.simulations} 次`,`${progress.phase==='review'?'Reviewing with independent seeds':'Searching'} · ${progress.candidates}/${progress.maxCandidates} configurations · ${progress.simulations} simulations`));
 else if(notice)messages.push((errors()[notice.code]??text(`计算失败：${notice.code}`,`Calculation failed: ${notice.code}`))+(notice.itemIds?.length?' '+notice.itemIds.map(id=>name(game.item(id).name)).join('、'):'')+(notice.detail?' '+notice.detail:''));
 if(pricesChanged)messages.push(text('价格已变化，沿用计算时价格','Prices changed; using calculation-time prices'));
 const saved=savedMasteryFeedback();if(saved.message)messages.push(saved.message);
 return [...new Set(messages)].join(' · ');
}
function summary(){
 if(optimizerPolicy(objective).gathering){
  const state=getGathering();if(!state)return text('请先在采集页配置角色。','Configure your character on the Gathering page first.');
  const job=gatheringJobs.find(j=>j.id===jobId),stats=gatheringStats({...state,skill:job.skill});
  const current=Object.fromEntries(game.masteries.map(m=>[m.id,draftNumber(mastery?.current?.[m.id])]));
  const invested=Object.values(current).every(Number.isSafeInteger)?game.masteriesTotalCost(current):NaN;
  return `${name(job.name)} · ${text('等级','Level')} ${stats.level}\n${Object.values(state.gear).filter(v=>v.id).map(v=>name(game.item(v.id).name)+' +'+v.plus).join(' · ')}\n${text('总精通点','Total mastery points')} ${mastery?.totalPoints??'—'} · ${text('当前投入','Current investment')} ${Number.isFinite(invested)?format(invested):'—'} · ${text('本模式可分配点数','Points available in this mode')} ${Number.isFinite(invested)&&Number.isSafeInteger(draftNumber(mastery?.totalPoints))?format(draftNumber(mastery.totalPoints)-(allocationMode==='remaining'?invested:0)):'—'}`;
 }
 const combat=getCombat();if(!combat)return text('请先在战斗页配置角色。','Configure your character on the Combat page first.');
 const {state,issues}=calculate(combat);
 const styles={ranged:text('远程','Ranged'),melee:text('近战','Melee'),magic:text('魔法','Magic')};
 const tiers=language==='zh'?['普通','罕见','稀有','史诗','传说']:['Normal','Uncommon','Rare','Epic','Legendary'];
 const gear=Object.values(state.gear).filter(v=>v.id).map(v=>`${tiers[v.tier]} ${name(game.item(v.id).name)} +${v.plus}`).join(' · ');
 const ranks=Object.fromEntries(game.masteries.map(m=>[m.id,draftNumber(mastery?.current?.[m.id])])),total=draftNumber(mastery?.totalPoints);
 const invested=Object.values(ranks).every(n=>Number.isInteger(n)&&n>=0&&n<=game.masteryRankLimit)?game.masteriesTotalCost(ranks):null;
 const available=Number.isSafeInteger(total)&&total>=0&&(allocationMode==='reset'||invested!==null)?total-(allocationMode==='remaining'?invested:0):null;
 return `${styles[state.style]} · ${text('等级','Level')} ${state.levels[state.style]} · ${text('防御','Defence')} ${state.levels.defence} · ${text('生命','HP')} ${state.levels.hitpoints}\n${gear}\n${text('总精通点','Total mastery points')} ${mastery?.totalPoints??'—'} · ${text('当前投入','Current investment')} ${invested===null?'—':format(invested)} · ${text('本模式可分配点数','Points available in this mode')} ${available===null?'—':format(available)}${issues.length?'\n'+text(`配装提示 ${issues.length} 项，请在战斗页检查（等级不足／流派不匹配等仍按现有规则模拟）。`,`${issues.length} loadout warnings. Review the Combat page; existing simulation rules still apply.`):''}`;
}
function isApplied(plan){
 return game.masteries.every(m=>draftNumber(targetRanks?.[m.id])===plan.ranks[m.id]);
}
function planMarkup(plan,index){
 const delta=plan.paired?format(plan.paired.mean)+(Math.abs(plan.paired.mean)<=2*plan.paired.se?' · '+text('差异接近波动','Close to variability'):''):result.baseline.overBudget?text('原配置超预算，无法比较','Current plan exceeds budget; unavailable'):text('原配置未完成模拟，无法比较','Current plan did not finish; unavailable');
 const investment=format(plan.cost)+(result.allocationMode==='remaining'?' · '+text('新增','Added')+' '+format(plan.additionalCost):'');
 const applied=isApplied(plan);
 return `<article class="optimizer-plan"><div class="optimizer-plan-heading"><h4>${index===0?text('本次搜索最佳方案','Best plan found'):text(`备选 ${index}`,`Alternative ${index}`)}</h4><button class="secondary" data-optimizer-save="${index}">${text('保存','Save')}</button><button class="secondary" data-optimizer-apply="${index}" ${applied?'disabled':''}>${applied?text('已应用','Applied'):text('应用','Apply')}</button></div><dl class="optimizer-plan-metrics"><div><dt>${optimizerPolicy(result.objective).collection?text('精通产出评分','Mastery yield score'):text('收入','Income')}</dt><dd>${format(plan.stats.mean)}</dd></div><div><dt>${text('投入','Investment')}</dt><dd>${investment}</dd></div><div><dt>${text('差异（较原配置）','Difference vs original')}</dt><dd>${delta}</dd></div></dl></article>`;
}
function applyRecommendation(index){
 if(!result||!result.plans[index])return;
 if(fingerprint!==signature()){clear('changed');paint();return;}
 try{
  if(!onApply)throw Error('Application handler unavailable');
  applying=true;
  const response=onApply({allocationMode:result.allocationMode,ranks:{...result.plans[index].ranks}});
  fingerprint=signature();notice={code:response.saveOK?'applied':'applySaveFailed'};
 }catch(error){notice={code:'applyFailed',detail:String(error?.message??error)};}
 finally{applying=false;}
 paint();
}
function paintStatus(){
 const status=host()?.querySelector('#optimizer-status');if(!status)return;
 status.dataset.running=progress?'true':'false';
 status.textContent=message();status.dataset.kind=pricesChanged||savedMasteryFeedback().warning||notice&&!['applied','cancelled'].includes(notice.code)?'warning':'normal';
}
function paint(){
 renderSavedMasteryResults(language,{currentKey:signature,onApply,target:targetRanks,onStatus:paintStatus});
 const root=host();if(!root)return;
 paintStatus();
 root.querySelector('#optimizer-start').textContent=worker?text('取消计算','Cancel calculation'):text('开始计算','Start calculation');
 const output=root.querySelector('#optimizer-output');
 if(!result){output.innerHTML='';return;}
 output.innerHTML=result.plans.map(planMarkup).join('');
}
export function renderMasteryOptimizer(nextLanguage,nextMastery,options={}){
 language=nextLanguage;mastery=structuredClone(nextMastery);targetRanks=options.target;onApply=options.onApply;
 const root=host();if(!root)return;
 const explanationOpen=root.querySelector('#optimizer-explanation')?.open??false;
 root.innerHTML=`<summary>${text('计算最优分配方案','Calculate optimal allocation')}</summary><p class="micro"><span class="simulation-caveat">${text('计算结果仅针对当前装备和所选目标，应用于其他目标时效果可能更差。','Results apply only to the current equipment and selected target, and may perform worse for other targets.')}</span> ${text('结果仅供参考，请自行评估分配方案。','Use them as a reference and assess the allocation yourself.')}</p><div class="optimizer-fields"><label class="number-field"><span>${text('计算模式','Calculation mode')}</span><select id="optimizer-allocation-mode"><option value="reset" ${allocationMode==='reset'?'selected':''}>${allocationLabel('reset')}</option><option value="remaining" ${allocationMode==='remaining'?'selected':''}>${allocationLabel('remaining')}</option></select></label><label class="number-field"><span>${text('优化目标','Optimization goal')}</span><select id="optimizer-goal"><option value="combatIncome" ${objective==='combatIncome'?'selected':''}>${text('战斗收入最高','Highest combat income')}</option><option value="gatherIncome" ${objective==='gatherIncome'?'selected':''}>${text('采集收入最高','Highest gathering income')}</option><option value="combatCollection" ${objective==='combatCollection'?'selected':''}>${text('战斗精通点数最高','Highest combat mastery points')}</option><option value="gatherCollection" ${objective==='gatherCollection'?'selected':''}>${text('采集精通点数最高','Highest gathering mastery points')}</option><option disabled>${text('经验获取最多（暂未支持）','Most XP (not yet available)')}</option><option disabled>${text('强化成本最低（暂未支持）','Lowest enhancement cost (not yet available)')}</option></select></label>${optimizerPolicy(objective).gathering?`<label class="number-field"><span>${text('采集任务','Gathering task')}</span><select id="optimizer-job">${optimizerJobs.map(j=>`<option value="${j.id}" ${j.id===jobId?'selected':''}>${esc(name(j.name))} · ${j.levelReq}</option>`).join('')}</select></label>`:`<label class="number-field"><span>${text('目标怪物','Target monster')}</span><select id="optimizer-monster">${optimizerMonsters.map(m=>`<option value="${m.id}" ${m.id===monsterId?'selected':''}>${esc(name(m.name))} · ${m.level}</option>`).join('')}</select></label>`}<label class="number-field"><span>${text('搜索次数','Search allowance')}</span><select id="optimizer-effort">${Object.entries(optimizerEfforts).map(([id,max])=>`<option value="${id}" ${effort===id?'selected':''}>${text({fast:'快速',standard:'标准',deep:'深入',comprehensive:'全面'}[id],{fast:'Fast',standard:'Standard',deep:'Deep',comprehensive:'Comprehensive'}[id])}${text('：最多 ',': up to ')}${max}${text(' 个配置',' configurations')}</option>`).join('')}</select></label></div><p id="optimizer-scenario" class="micro"></p><details id="optimizer-explanation" class="optimizer-explanation" ${explanationOpen?'open':''}><summary>${text('计算说明','Calculation details')}</summary><p class="micro">${text('使用对应战斗／采集页当前配装，固定模拟 24 小时，开始时冻结价格、增益与配置。<br>收入为金币＋掉落估值，未扣食物药水；宠物估值为 0。<br>精通产出评分按各品质首档奖励比例 1／3／10／30／100 加权，金币和宠物不计，不依赖物品价格；不代表实际获得的精通点数。','Uses the current Combat or Gathering build with a fixed 24-hour simulation. Prices, buffs and settings are captured at start.<br>Income is coins + valued drops, before food and potion costs; pets are valued at zero.<br>Mastery yield score weights output qualities by 1/3/10/30/100, excluding coins and pets. It is price-independent and does not represent actual mastery points earned.')}</p></details><div class="optimizer-actions"><button id="optimizer-start" class="secondary">${text('开始计算','Start calculation')}</button><a id="optimizer-edit-combat" href="${optimizerPolicy(objective).gathering?'/gather':'/combat'}">${optimizerPolicy(objective).gathering?text('前往采集页编辑配装','Edit build on Gathering page'):text('前往战斗页编辑配装','Edit build on Combat page')}</a></div><p id="optimizer-status" role="status" aria-live="polite"></p><div id="optimizer-results"><div id="optimizer-output"></div><div id="mastery-saved-results" class="mastery-saved-results"></div></div>`;
 root.querySelector('#optimizer-scenario').textContent=summary();
 root.querySelector('#optimizer-start').onclick=()=>{if(worker){clear('cancelled');paint();}else start();};
 root.querySelector('#optimizer-output').onclick=async e=>{const button=e.target.closest('[data-optimizer-apply]');if(button&&!button.disabled)applyRecommendation(Number(button.dataset.optimizerApply));const save=e.target.closest('[data-optimizer-save]');if(save&&result&&resultRequest){await saveManualMasteryResult(createMasteryResult(resultRequest,result,Number(save.dataset.optimizerSave)));paint();}};
 root.querySelector('#optimizer-edit-combat').onclick=e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();document.getElementById(optimizerPolicy(objective).gathering?'gather-nav':'combat-nav').click();}};
 const monsterSelect=root.querySelector('#optimizer-monster');if(monsterSelect)monsterSelect.onchange=e=>{monsterId=Number(e.target.value);clear();paint();};
 const jobSelect=root.querySelector('#optimizer-job');if(jobSelect)jobSelect.onchange=e=>{jobId=Number(e.target.value);clear();root.querySelector('#optimizer-scenario').textContent=summary();paint();};
 root.querySelector('#optimizer-effort').onchange=e=>{effort=e.target.value;clear();paint();};
 root.querySelector('#optimizer-allocation-mode').onchange=e=>{allocationMode=e.target.value;clear('changed');renderMasteryOptimizer(language,mastery,{target:targetRanks,onApply});};
 root.querySelector('#optimizer-goal').onchange=e=>{objective=e.target.value;clear();renderMasteryOptimizer(language,mastery,{target:targetRanks,onApply});};

 invalidateMasteryOptimizer();paint();
}
function start(){
 clear();
 try{
  const totalPoints=draftNumber(mastery?.totalPoints);
  const current=Object.fromEntries(game.masteries.map(m=>[m.id,draftNumber(mastery?.current?.[m.id])]));
  const input=optimizerInput({objective,allocationMode,totalPoints,current,monsterId,jobId,effort,combat:getCombat(),gathering:getGathering(),now:Date.now()});
  const snapshot=getSnapshot(),prices=Object.fromEntries(optimizerIncomeItems(input).map(id=>[id,{price:game.isPet(id)?0:snapshot.getItem(id).price}]));
  checkOptimizerPrices(input,prices);const request={...input,prices};fingerprint=signature();
  worker=new Worker(new URL('./mastery-optimizer-worker.js',import.meta.url),{type:'module'});const task=generation,activeWorker=worker;
  progress={phase:'search',candidates:0,maxCandidates:optimizerEfforts[effort],simulations:0};
  worker.onmessage=async({data})=>{
   if(task!==generation||worker!==activeWorker)return;
   if(data.error){worker.terminate();worker=null;progress=null;notice={code:data.error,itemIds:data.itemIds};}
   else if(data.result){
    worker.terminate();worker=null;progress=null;
    try{
     const record=createMasteryResult(request,data.result);
     result=data.result;resultRequest=record.input;notice=null;paint();
     await saveAutomaticMasteryResult(record,()=>task===generation&&fingerprint===signature());
     if(task===generation&&fingerprint===signature())applyRecommendation(0);
    }catch(error){if(task===generation)clear(error.message);}
   }
   else if(data.progress)progress=data.progress;
   paint();
  };
  worker.onerror=()=>{if(task===generation&&worker===activeWorker){clear('workerFailed');paint();}};
  worker.postMessage(request);
 }catch(error){clear();notice={code:error.message,itemIds:error.itemIds};}
 paint();
}
