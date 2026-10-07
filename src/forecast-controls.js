import {forecast,hotSkills,tickTime} from './hot-forecast.js';
import {translatedName} from './i18n.js';
const copy={zh:{title:'热门加成',current:'当前热门',next:'距下次切换',skill:'技能',kind:'加成',all:'全部',xp:'经验',rarity:'稀有',time:'发生时间段',empty:'该技能没有稀有热门加成，请调整筛选。',timezone:'本地时区',error:'预报失败：',invalidTime:'设备时间早于游戏时间纪元或无效。',invalidFilter:'筛选条件无效。',forecastIncomplete:'一年内未找到 10 次匹配加成，请核验游戏规则。'},en:{title:'Hot bonuses',current:'Current bonus',next:'Next change in',skill:'Skill',kind:'Bonus',all:'All',xp:'XP',rarity:'Rarity',time:'Time window',empty:'This skill has no rarity hot bonus. Adjust your filters.',timezone:'Local time zone',error:'Forecast failed: ',invalidTime:'The device time is invalid or before the game epoch.',invalidFilter:'Invalid filters.',forecastIncomplete:'Could not find 10 matches within a year. Check the game rules.'}};
let skill='all',kind='all',language='zh',expiry=0;
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
 language=nextLanguage;
 const panel=document.querySelector('#forecast-content');
 const group=(id,label,values,current)=>`<fieldset><legend>${label}</legend><div class="forecast-options">${values.map(([value,label])=>`<button type="button" data-forecast-filter="${id}" data-value="${value}" aria-pressed="${value===current}">${esc(label)}</button>`).join('')}</div></fieldset>`;
 const filters=`<div class="forecast-filters">${group('skill',text('skill'),[['all',text('all')],...hotSkills.map(id=>[id,skillName(id)])],skill)}${group('kind',text('kind'),['all','xp','rarity'].map(id=>[id,text(id)]),kind)}</div>`;
 try{
  const now=Date.now(),result=forecast(now,skill,kind);expiry=tickTime(result.current.until);
  panel.innerHTML=`<div class="forecast-heading"><h1>${text('title')}</h1><p class="muted">${text('timezone')}：${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p></div><div class="panel hot-current"><div><span class="eyebrow">${text('current')}</span><h2><strong class="hot-skill">${skillName(result.current.skill)}</strong> <span>${bonus(result.current)}</span></h2><p class="muted">${windowText(result.current)}</p></div><div class="hot-countdown"><span>${text('next')}</span><strong id="forecast-countdown">${countdown(now)}</strong></div></div><section class="panel forecast-schedule">${filters}${result.impossible?`<p class="forecast-empty">${text('empty')}</p>`:`<div class="table-scroll"><table><thead><tr><th>${text('time')}</th><th>${text('skill')}</th><th>${text('kind')}</th></tr></thead><tbody>${result.entries.map(hot=>`<tr><td>${windowText(hot)}</td><td class="hot-skill">${skillName(hot.skill)}</td><td>${bonus(hot)}</td></tr>`).join('')}</tbody></table></div>`}</section>`;
 }catch(error){expiry=0;panel.innerHTML=`<h1>${text('title')}</h1>${filters}<p role="alert" class="forecast-empty">${esc(text('error')+(copy[language][error.message]??error.message))}</p>`;}
 panel.querySelectorAll('[data-forecast-filter]').forEach(button=>button.onclick=()=>{
  const {forecastFilter,value}=button.dataset;
  if(forecastFilter==='skill')skill=value;else kind=value;
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
