import {forecast,hotSkills,tickTime} from './hot-forecast.js';
import {forecastStorageKey,hotKinds,parseForecastFilters,toggleSelection} from './forecast-filters.js';
import {translatedName} from './i18n.js';
const copy={zh:{title:'热门加成',current:'当前热门',next:'距下次切换',skill:'技能',kind:'加成',all:'全部',xp:'经验',rarity:"稀有度",time:'发生时间段',empty:'所选技能没有匹配的热门加成，请调整筛选。',loadFailed:'无法读取已保存的预报筛选，已恢复全部。',saveFailed:'预报筛选保存失败，仅当前页面生效。',timezone:'本地时区',error:'预报失败：',invalidTime:'设备时间早于游戏时间纪元或无效。',invalidFilter:'筛选条件无效。',forecastIncomplete:'一年内未找到 10 次匹配加成，请核验游戏规则。'},en:{title:'Hot bonuses',current:'Current bonus',next:'Next change in',skill:'Skill',kind:'Bonus',all:'All',xp:'XP',rarity:'Rarity',time:'Time window',empty:'No hot bonuses match the selected skills. Adjust your filters.',loadFailed:'Could not read saved forecast filters. Reset to All.',saveFailed:'Could not save forecast filters. Changes apply only to this page.',timezone:'Local time zone',error:'Forecast failed: ',invalidTime:'The device time is invalid or before the game epoch.',invalidFilter:'Invalid filters.',forecastIncomplete:'Could not find 10 matches within a year. Check the game rules.'}};
let filters={skills:[],kinds:[]},loaded=false,storageIssue='',language='zh',expiry=0;
function loadFilters(){
 if(loaded)return;
 loaded=true;
 try{const raw=localStorage.getItem(forecastStorageKey);if(raw!==null)filters=parseForecastFilters(JSON.parse(raw));}
 catch{filters={skills:[],kinds:[]};storageIssue='loadFailed';}
}
function saveFilters(){
 try{localStorage.setItem(forecastStorageKey,JSON.stringify({version:1,...filters}));storageIssue='';}
 catch{storageIssue='saveFailed';}
}
const skillName=id=>translatedName(id[0].toUpperCase()+id.slice(1),language);
const text=key=>copy[language][key];
const bonus=hot=>`${text(hot.kind)} +${Math.round((hot.mult-1)*100)}%`;
const pad=value=>String(value).padStart(2,'0');
const day=date=>`${pad(date.getMonth()+1)}/${pad(date.getDate())}`;
const clock=date=>`${pad(date.getHours())}:${pad(date.getMinutes())}`;
const windowText=hot=>{
 const from=new Date(tickTime(hot.from)),until=new Date(tickTime(hot.until));
 const sameDay=from.getFullYear()===until.getFullYear()&&from.getMonth()===until.getMonth()&&from.getDate()===until.getDate();
 return `${day(from)} ${clock(from)}-${sameDay?'':day(until)+' '}${clock(until)}`;
};
const countdown=now=>{const seconds=Math.max(0,Math.ceil((expiry-now)/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
export function renderForecast(nextLanguage,esc){
 language=nextLanguage;loadFilters();
 const panel=document.querySelector('#forecast-content');
 const group=(id,label,values,current)=>`<fieldset><legend>${label}</legend><div class="forecast-options">${values.map(([value,label])=>`<button type="button" data-forecast-filter="${id}" data-value="${value}"${id==='skill'&&value!=='all'?` data-skill="${esc(value)}"`:''} aria-pressed="${value==='all'?!current.length:current.includes(value)}">${esc(label)}</button>`).join('')}</div></fieldset>`;
 const filterControls=`<div class="forecast-filters">${group('skill',text('skill'),[['all',text('all')],...hotSkills.map(id=>[id,skillName(id)])],filters.skills)}${group('kind',text('kind'),['all','xp','rarity'].map(id=>[id,text(id)]),filters.kinds)}</div>`;
 try{
  const now=Date.now(),result=forecast(now,filters.skills,filters.kinds);expiry=tickTime(result.current.until);
  panel.innerHTML=`<div class="forecast-heading"><h1>${text('title')}</h1><p class="muted">${text('timezone')}：${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p></div><section class="panel forecast-panel forecast-schedule"><div class="hot-current"><div><span class="eyebrow">${text('current')}</span><h2>${skillName(result.current.skill)} <span>${bonus(result.current)}</span></h2><p class="muted">${windowText(result.current)}</p></div><div class="hot-countdown"><span>${text('next')}</span><strong id="forecast-countdown">${countdown(now)}</strong></div></div>${filterControls}${result.impossible?`<p class="forecast-empty">${text('empty')}</p>`:`<div class="table-scroll"><table><thead><tr><th>${text('time')}</th><th>${text('skill')}</th><th>${text('kind')}</th></tr></thead><tbody>${result.entries.map(hot=>`<tr data-skill="${esc(hot.skill)}"><td>${windowText(hot)}</td><td>${skillName(hot.skill)}</td><td>${bonus(hot)}</td></tr>`).join('')}</tbody></table></div>`}</section>`;
 }catch(error){expiry=0;panel.innerHTML=`<div class="forecast-heading"><h1>${text('title')}</h1></div><section class="panel forecast-panel forecast-schedule">${filterControls}<p role="alert" class="forecast-empty">${esc(text('error')+(copy[language][error.message]??error.message))}</p></section>`;}
 if(storageIssue)panel.querySelector('.forecast-panel').insertAdjacentHTML('afterbegin',`<p class="forecast-empty forecast-storage" role="alert">${text(storageIssue)}</p>`);
 panel.querySelectorAll('[data-forecast-filter]').forEach(button=>button.onclick=()=>{
  const {forecastFilter,value}=button.dataset;
  const key=forecastFilter==='skill'?'skills':'kinds';
  filters[key]=toggleSelection(filters[key],value,key==='skills'?hotSkills:hotKinds);
  saveFilters();
  renderForecast(language,esc);
  panel.querySelector(`[data-forecast-filter="${forecastFilter}"][data-value="${value}"]`).focus();
 });
}
export function updateForecast(esc){
 if(!document.querySelector('#forecast-content'))return;
 const now=Date.now();
 if(expiry&&(now>=expiry||now<expiry-1800000)){renderForecast(language,esc);return;}
 const counter=document.querySelector('#forecast-countdown');if(counter)counter.textContent=countdown(now);
}
