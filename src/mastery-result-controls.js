import {game} from './model.js';
import {translatedName} from './i18n.js';
import {craftingJobs} from './crafting-model.js';
import {gatheringJobs} from './gathering-model.js';
import {masteryResultStorageKey,emptyMasteryResults,readMasteryResults,writeMasteryResults,validateComputedMasteryResult,validateSavedMasteryPlan,masteryResultHistory} from './mastery-result-store.js';
import {masteryPlanMetrics,masteryPlanHistoryNote} from './mastery-plan-view.js';

let slots=emptyMasteryResults(),loaded=false,blocked=false,blockedRaw,notice=null,language='zh',totalPoints=0,onApply=null,targetRanks=null,onStatus=()=>{},queue=Promise.resolve();
const text=(zh,en)=>language==='zh'?zh:en;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=s=>translatedName(s,language);
const format=n=>n.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:2});
const time=n=>{const date=new Date(n),pad=v=>String(v).padStart(2,'0');return `${date.getFullYear()===new Date().getFullYear()?'':date.getFullYear()+'-'}${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;};
export function savedMasteryFeedback(){return {message:message(),warning:!!notice&&!['saved','cleared','applied'].includes(notice)};}
export function clearSavedMasterySuccess(){if(['saved','cleared','applied'].includes(notice))notice=null;}
function load(){
 try{blockedRaw=localStorage.getItem(masteryResultStorageKey);slots=readMasteryResults(localStorage);blocked=false;notice=null;}
 catch(error){blocked=true;notice=error.message==='savedMasteryVersion'?'version':'load';}
 loaded=true;
}
function message(){return {
 load:text('保存结果无法读取，原存档已保留。请重新读取，或清除损坏存档后再保存。','Saved results could not be read. Original data was preserved. Reload, or clear the damaged data before saving.'),
 version:text('保存结果版本不兼容，原存档已保留。','Saved results are incompatible. Original data was preserved.'),
 failed:text('结果未保存，浏览器存储不可用；刷新后可能丢失。原存档已保留。','Result was not saved: browser storage is unavailable. It may be lost on refresh. Original saved data was preserved.'),
 conflict:text('其他标签已更新保存结果，请重新读取后再操作。','Saved results changed in another tab. Reload saved results before continuing.'),
 saved:text('已保存','Saved'),
 cleared:text('已删除','Deleted'),
 applied:text('已应用','Applied'),
 applyFailed:text('方案等级无效，无法填入目标。','Invalid allocation ranks; targets were not changed.'),
 applyInvalidSettings:text('目标已填入，请填写有效总点数后保存。','Targets filled. Enter valid total points to save.'),
 applySaveFailed:text('方案已应用，但目标等级无法保存。','Plan applied, but target ranks could not be saved.'),
 }[notice]??'';}
function transact(change,{guard=()=>true,recover=false,success='saved'}={}){
 const operation=async()=>{
  if(!loaded)load();
  if(!guard())return false;
  if(blocked&&!recover){paint();return false;}
  try{
   if(recover){if(localStorage.getItem(masteryResultStorageKey)!==blockedRaw)throw Error('savedMasteryConflict');localStorage.removeItem(masteryResultStorageKey);slots=emptyMasteryResults();blocked=false;}
   else slots=writeMasteryResults(localStorage,slots,change(structuredClone(slots)));
   notice=success;paint();return true;
  }catch(error){notice=error.message==='savedMasteryConflict'?'conflict':'failed';paint();return false;}
 };
 const run=()=>globalThis.navigator?.locks?.request?navigator.locks.request(masteryResultStorageKey,operation):operation();
 const pending=queue.then(run).catch(()=>{notice='failed';paint();return false;});queue=pending;return pending;
}
export function saveAutomaticMasteryResult(record,guard){
 validateComputedMasteryResult(record);
 return transact(s=>({...s,auto:record}),{guard});
}
export function saveManualMasteryResult(record){
 validateSavedMasteryPlan(record);
 return transact(s=>({...s,manual:record}));
}
function recordMarkup(record,slot){
 const plan=record.plan,history=masteryResultHistory(record),input=history.available?history.input:null,policy=history.available?history.policy:null;
 const source=input?(policy.crafting?input.crafting:policy.gathering?input.gathering:input.combat):null;
 const task=input?(policy.crafting?craftingJobs.find(j=>j.id===input.recipeId):policy.gathering?gatheringJobs.find(j=>j.id===input.jobId):game.monsters.find(m=>m.id===input.monsterId)):null;
 const objective=input?{combatXp:text('战斗经验','Combat XP'),gatherXp:text('采集经验','Gathering XP'),craftXp:text('制造经验','Crafting XP'),combatIncome:text('战斗收入','Combat income'),gatherIncome:text('采集收入','Gathering income'),combatCollection:text('战斗精通点数','Combat mastery points'),gatherCollection:text('采集精通点数','Gathering mastery points')}[input.objective]:'';
 const tiers=language==='zh'?['普通','罕见','稀有','史诗','传说']:['Normal','Uncommon','Rare','Epic','Legendary'];
 const gear=Object.values(source?.gear??{}).filter(v=>v?.id).map(v=>{try{return `${tiers[v.tier]??''} ${name(game.item(v.id).name)} +${v.plus}`;}catch{return text('未知装备 #','Unknown equipment #')+v.id;}}).join(' · ')||text('无装备记录','No equipment recorded');
 const levelNames={melee:text('近战','Melee'),ranged:text('远程','Ranged'),magic:text('魔法','Magic'),defence:text('防御','Defence'),hitpoints:text('生命','Hitpoints'),mining:text('采矿','Mining'),fishing:text('钓鱼','Fishing'),woodcutting:text('伐木','Woodcutting'),thieving:text('偷窃','Thieving'),cooking:text('烹饪','Cooking'),smithing:text('锻造','Smithing'),fletching:text('制箭','Fletching'),herblore:text('炼金','Herblore'),crafting:text('制作','Crafting')};
 const levels=source?((policy.gathering||policy.crafting)?[task?.skill]:[source.style,'defence','hitpoints']).filter(Boolean).map(k=>`${esc(levelNames[k]??k)} ${Number.isFinite(source.levels?.[k])?format(source.levels[k]):'—'}`).join(' · '):'';
 const applied=game.masteries.every(m=>String(targetRanks?.[m.id]??'').trim()!==''&&Number(targetRanks[m.id])===plan.ranks[m.id]);
 const context=input?`<div class="saved-plan-context"><p class="micro saved-calculation">${esc(objective)} · ${esc(task?name(task.name):text('历史任务','Historical task'))}${policy.crafting?' · '+esc(tiers[input.tier]??''):''} · ${input.allocationMode==='remaining'?text('剩余点数','Remaining points'):text('重置','Reset')} · ${format(input.totalPoints)} ${text('点（当时）','points at calculation')}<br><span class="saved-character-levels">${levels}</span><br><span class="saved-equipment">${esc(gear)}</span></p></div>`:'';
 return `<div class="optimizer-plan-heading"><div class="optimizer-plan-title"><h4>${slot==='manual'?text('已保存方案','Saved plan'):text('最近一次最优方案','Most recent best plan')}</h4>${input?`<time class="micro saved-calculation-time" datetime="${new Date(input.now).toISOString()}">${text('计算于','Calculated')} ${esc(time(input.now))}</time>`:''}</div><button class="secondary" data-saved-action="clear" aria-label="${slot==='manual'?text('删除已保存方案','Delete saved plan'):text('删除最近一次最优方案','Delete most recent best plan')}">${text('删除','Delete')}</button><button class="secondary" data-saved-action="apply" ${applied?'disabled':''}>${applied?text('已应用','Applied'):text('应用','Apply')}</button></div>${masteryPlanMetrics(record,totalPoints,language)}${context}${masteryPlanHistoryNote(record,language)}`;
}

function paint(){
 const root=document.getElementById('mastery-saved-results');if(!root)return;
 root.innerHTML=`${blocked?`<div class="optimizer-actions"><button class="secondary" data-saved-action="reload">${text('重新读取保存结果','Reload saved results')}</button><button class="text-button" data-saved-action="recover">${text('清除损坏／不兼容存档','Clear damaged / incompatible data')}</button></div>`:['auto','manual'].map(slot=>`<article class="saved-result-card" data-saved-slot="${slot}">${slots[slot]?recordMarkup(slots[slot],slot):`<div class="optimizer-plan-heading"><h4>${slot==='manual'?text('已保存方案','Saved plan'):text('最近一次最优方案','Most recent best plan')}</h4></div><p class="micro">${slot==='manual'?text('尚未保存方案','No saved plan yet'):text('完成计算后自动保存最优方案','The best plan is saved here after a successful calculation')}</p>`}</article>`).join('')}${notice==='conflict'?`<button class="secondary" data-saved-action="reload">${text('重新读取保存结果','Reload saved results')}</button>`:''}`;
 root.onclick=async event=>{
  const action=event.target.closest('[data-saved-action]')?.dataset.savedAction;if(!action)return;
  if(action==='reload'){await queue;load();paint();return;}
  if(action==='recover'){await transact(s=>s,{recover:true,success:'cleared'});return;}
  const slot=event.target.closest('[data-saved-slot]')?.dataset.savedSlot,record=slots[slot];
  if(!record)return;
  if(action==='clear'){await transact(s=>({...s,[slot]:null}),{success:'cleared'});return;}
  if(action==='apply'){
   try{if(!onApply)throw Error('handlerUnavailable');const response=onApply({ranks:structuredClone(record.plan.ranks)});notice=response.invalidSettings?'applyInvalidSettings':response.saveOK?'applied':'applySaveFailed';}
   catch{notice='applyFailed';}paint();
  }
 };
 onStatus();
}
export function renderSavedMasteryResults(nextLanguage,options){
 language=nextLanguage;totalPoints=options.totalPoints;onApply=options.onApply;targetRanks=options.target;onStatus=options.onStatus??(()=>{});if(!loaded)load();paint();
}
if(globalThis.addEventListener)globalThis.addEventListener('storage',event=>{if(event.key===masteryResultStorageKey||event.key===null){notice='conflict';paint();}});
