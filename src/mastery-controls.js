import {requestCharacter,characterImportPanel,probeCharacter,importStatusText} from './import-controls.js';
import {masteryValue} from './model.js';
import {translatedName} from './i18n.js';
import {masteryTracks,masteryLimit,masteryDefaults,validateMastery,calculateMastery,highestAffordableMastery,readMasterySettings,writeMasterySettings,importMastery} from './mastery.js';
let state=masteryDefaults(),language='zh',saveOK=true,loadFailed=false,status=null,busy=false,probeStarted=false;
try{state=readMasterySettings(localStorage);}catch{loadFailed=true;}
const text=(zh,en)=>language==='zh'?zh:en;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=s=>translatedName(s,language);
const format=n=>n.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:2});
const bonus=(m,rank)=>`+${format(masteryValue(m.id,rank))}${m.unit==='hours'?text(' 小时',' h'):'%'}`;
const errorText=code=>({invalidInteger:text(`等级须为 0–${format(masteryLimit)} 的整数；总点数须为非负安全整数，不能留空。`,`Ranks must be integers from 0 to ${format(masteryLimit)}; total points must be a nonnegative safe integer. Fields cannot be blank.`),targetBelowCurrent:text('目标等级不能低于当前等级。','Target ranks cannot be below current ranks.'),invalidConfiguration:text('配置无效，请清空后重新填写。','Invalid settings. Reset and enter your plan again.')}[code]??code);
function save(){try{writeMasterySettings(localStorage,state);saveOK=true;loadFailed=false;}catch{saveOK=false;}}
function renderImportStatus(){
 const host=document.getElementById('mastery-content');if(!host)return;
 host.querySelector('#mastery-import-status').textContent=importStatusText(language,status,busy);
 host.querySelector('#mastery-import').disabled=busy;
}
export function applyMasteryImport(snapshot){
 const result=importMastery(state,snapshot);state=result.state;status={capturedAt:result.capturedAt};save();return {...status,saveOK};
}
function updateResults(){
 const host=document.getElementById('mastery-content');if(!host)return;
 const limited=state.mode==='limited';
 host.querySelectorAll('[data-mastery-action="max"]').forEach(el=>el.hidden=!limited);
 host.querySelector('#mastery-save-note').textContent=loadFailed?text('已保存的精通配置无法读取，已恢复默认；请检查浏览器存储。','Saved mastery settings could not be read. Defaults restored; check browser storage.'):saveOK?text('● 精通方案独立保存在此浏览器','● Mastery plan saved separately in this browser'):text('浏览器存储不可用，精通方案无法保存。','Browser storage unavailable; mastery plan cannot be saved.');
 let r;try{r=calculateMastery(state);}catch(error){
  host.querySelector('#mastery-summary').innerHTML='';host.querySelector('#mastery-issue').textContent=errorText(error.message);
  host.querySelectorAll('[data-mastery-value]').forEach(el=>el.textContent='—');host.querySelectorAll('[data-mastery-status]').forEach(el=>el.textContent='');host.querySelectorAll('[data-mastery-row]').forEach(el=>el.dataset.pending='false');host.querySelectorAll('[data-mastery-action]').forEach(el=>el.disabled=true);return;
 }
 host.querySelector('#mastery-issue').textContent=r.budget<0?text(`当前已分配等级超出总点数，缺少 ${format(-r.budget)} 点。`,`Current ranks exceed total points by ${format(-r.budget)} points.`):limited&&r.remaining<0?text(`超出预算，缺少 ${format(-r.remaining)} 点。`,`Over budget by ${format(-r.remaining)} points.`):'';
 const cards=limited?[[text('本次可用点数','Available points'),r.budget],[text('本次已分配点数','Points allocated for this upgrade'),r.spent],[text('剩余点数','Remaining points'),r.remaining]]:[[text('本次所需点数','Upgrade points needed'),r.spent],[text('当前已投入','Current investment'),r.currentCost],[text('目标总投入（从零）','Target investment (from zero)'),r.targetCost]];
 host.querySelector('#mastery-summary').innerHTML=cards.map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${format(Number(value))}</strong></div>`).join('');
 for(const row of r.rows){const m=masteryTracks.find(m=>m.id===row.id),tr=host.querySelector(`[data-mastery-row="${row.id}"]`);
  for(const [key,value]of Object.entries({current:bonus(m,row.current),target:bonus(m,row.target),cost:format(row.cost),next:row.nextCost===null?text('已满级','Maximum rank'):text(`再升一级：${format(row.nextCost)} 点`,`Next rank: ${format(row.nextCost)} points`)}))tr.querySelector(`[data-mastery-value="${key}"]`).textContent=value;
  tr.dataset.pending=String(row.target>row.current);
  tr.querySelector('[data-mastery-status]').textContent=row.nextCost===null?text('已达到等级上限。','Maximum rank reached.'):limited&&r.remaining<0&&row.cost>0?text('当前方案超出预算，请减少目标等级。','This plan exceeds the budget. Reduce target ranks.'):limited&&r.remaining>=0&&r.remaining<row.nextCost?text(`再升一级还缺 ${format(row.nextCost-r.remaining)} 点。`,`Another rank needs ${format(row.nextCost-r.remaining)} more points.`):'';
  tr.querySelector('[data-mastery-action="minus"]').disabled=row.target<=row.current;
  tr.querySelector('[data-mastery-action="plus"]').disabled=row.nextCost===null||(limited&&r.remaining<row.nextCost);
  const max=tr.querySelector('[data-mastery-action="max"]');max.hidden=!limited;
  max.disabled=!limited||safelyAffordable(row.id)<=row.target;
  tr.querySelector('[data-mastery-field="target"]').min=row.current;
 }
}
function safelyAffordable(id){try{return highestAffordableMastery(state,id);}catch(error){if(error.message==='otherTracksOverBudget')return -1;throw error;}}
export function renderMastery(nextLanguage){
 language=nextLanguage;const host=document.getElementById('mastery-content');if(!host)return;
 const openDetails=new Map([...host.querySelectorAll('details[id]')].map(el=>[el.id,el.open]));
 const field=(kind,id,value)=>`<input type="number" min="0" max="${masteryLimit}" step="1" data-mastery-field="${kind}" data-mastery-id="${id}" value="${esc(value)}" aria-label="${esc(name(masteryTracks.find(m=>m.id===id).name)+' '+text(kind==='current'?'当前等级':'目标等级',kind==='current'?'current rank':'target rank'))}">`;
 host.innerHTML=`<aside class="panel config mastery-settings"><div class="panel-heading"><h1>${text('角色配置','Character build')}</h1><button id="mastery-reset" class="text-button">${text('清空配置','Reset settings')}</button></div><p class="muted intro">${text('导入或填写已有精通，规划升级点数。','Import or enter current masteries to plan upgrades.')}</p>${characterImportPanel(language,{id:'mastery-import-settings',statusId:'mastery-import-status',buttons:[{id:'mastery-import',label:text('导入配置','Import configuration')}]})}<div class="mastery-toolbar"><label class="number-field"><span>${text('模式','Mode')}</span><select id="mastery-mode" aria-label="${text('模式','Mode')}"><option value="limited" ${state.mode==='limited'?'selected':''}>${text('限定精通点','Limited points')}</option><option value="unlimited" ${state.mode==='unlimited'?'selected':''}>${text('不限制精通点','Unlimited points')}</option></select></label><label class="number-field" id="mastery-total-field"><span>${text('总点数','Total points')}</span><input id="mastery-total" type="number" min="0" max="${Number.MAX_SAFE_INTEGER}" step="1" value="${esc(state.totalPoints)}"></label><button id="mastery-zero-ranks" class="secondary">${text('所有等级归零','Reset all ranks to zero')}</button><button id="mastery-revert" class="secondary">${text('撤回本次分配','Undo allocation')}</button></div><p id="mastery-save-note" class="save-note"></p></aside>
 <div class="results mastery-results"><div class="result-heading"><div><span class="eyebrow">MASTERY PLANNER</span><h2>${text('精通模拟','Mastery planner')}</h2></div></div><div id="mastery-summary" class="stats mastery-stats" aria-live="polite"></div><p id="mastery-issue" class="mastery-issue" role="alert"></p>
 <div class="mastery-cards">${masteryTracks.map(m=>`<article class="panel mastery-card" data-mastery-row="${m.id}" aria-labelledby="mastery-title-${m.id}"><div class="mastery-card-heading"><div><h3 id="mastery-title-${m.id}">${esc(name(m.name))}</h3><p class="micro">${esc(name(m.blurb))}</p></div><div class="mastery-card-cost"><span>${text('本次所需点数','Upgrade points')}</span><strong data-mastery-value="cost"></strong></div></div><div class="mastery-current"><label class="number-field"><span>${text('当前等级','Current rank')}</span>${field('current',m.id,state.current[m.id])}</label><div class="mastery-bonus"><span>${text('当前加成','Current bonus')}</span><strong data-mastery-value="current"></strong></div></div><div class="mastery-target"><p class="mastery-label">${text('目标等级','Target rank')}</p><div class="mastery-rank-controls">${field('target',m.id,state.target[m.id])}<button data-mastery-action="plus" aria-label="${esc(name(m.name)+' '+text('增加目标一级','increase target rank'))}">+1</button><button data-mastery-action="minus" aria-label="${esc(name(m.name)+' '+text('降低目标一级','decrease target rank'))}">−1</button><button data-mastery-action="max" aria-label="${esc(name(m.name)+' '+text('升到可负担最高等级','highest affordable rank'))}" title="${text('升到可负担最高等级','Highest affordable rank')}">MAX</button></div></div><div class="mastery-card-footer"><span>${text('目标加成','Target bonus')} <strong data-mastery-value="target"></strong></span><span data-mastery-value="next"></span></div><p class="mastery-card-note" data-mastery-status role="status"></p></article>`).join('')}</div>
 <p class="table-note">${text('依据 2026-10-08 已核验游戏源码：升到第 n 级消耗 38 + 2n 点，每项上限 20,000 级。此页仅规划点数与加成，不评选最优方案或应用到其他页面。','Based on the verified game source from 2026-10-08: rank n costs 38 + 2n points, with a 20,000-rank limit per mastery. This page plans points and bonuses; it does not optimize or apply changes to other pages.')}</p></div>`;
 host.oninput=e=>{
  const el=e.target;if(el.id==='mastery-total')state.totalPoints=el.value;else if(el.dataset.masteryField){const {masteryField:kind,masteryId:id}=el.dataset;state[kind][id]=el.value;
   const rank=Number(el.value);if(kind==='current'&&el.value.trim()!==''&&Number.isInteger(rank)&&rank>=0&&rank<=masteryLimit&&Number(state.target[id])<rank){state.target[id]=rank;host.querySelector(`[data-mastery-row="${id}"] [data-mastery-field="target"]`).value=rank;}
  }else return;
  try{validateMastery(state);save();}catch{}updateResults();
 };
 host.querySelector('#mastery-mode').onchange=e=>{state.mode=e.target.value;try{validateMastery(state);save();}catch{}updateResults();};
 host.onclick=e=>{
  if(e.target.closest('#mastery-zero-ranks')){const defaults=masteryDefaults();state.current=defaults.current;state.target=defaults.target;try{validateMastery(state);save();}catch{}renderMastery(language);return;}
  if(e.target.closest('#mastery-reset')){state=masteryDefaults();status=null;save();renderMastery(language);return;}
  if(e.target.closest('#mastery-revert')){state.target={...state.current};try{validateMastery(state);save();}catch{}renderMastery(language);return;}
  const button=e.target.closest('[data-mastery-action]');if(!button||button.disabled)return;
  const id=button.closest('[data-mastery-row]').dataset.masteryRow;state.target[id]=button.dataset.masteryAction==='max'?highestAffordableMastery(state,id):Number(state.target[id])+(button.dataset.masteryAction==='plus'?1:-1);
  host.querySelector(`[data-mastery-row="${id}"] [data-mastery-field="target"]`).value=state.target[id];save();updateResults();
 };
 host.querySelector('#mastery-import').onclick=async()=>{
  if(busy)return;busy=true;renderImportStatus();
  try{const response=await requestCharacter('read');if(!response.snapshot)throw Error('noSnapshot');applyMasteryImport(response.snapshot);}
  catch(error){status={error:error.message};}finally{busy=false;renderMastery(language);}
 };
 if(!probeStarted){probeStarted=true;probeCharacter().then(()=>{if(!status&&!busy){status={ready:true};renderImportStatus();}}).catch(error=>{if(!status&&!busy){status={error:error.message};renderImportStatus();}});}
 renderImportStatus();updateResults();for(const [id,open]of openDetails){const el=host.querySelector(`#${id}`);if(el)el.open=open;}
}
