import {game} from './model.js';
import {epoch,tickTime} from './hot-forecast.js';
export const DAY_TICKS=24*3600000/game.tickMs;
export function combatHot(now){
 if(!Number.isFinite(now)||now<epoch)throw Error('invalidTime');
 const start=Math.floor((now-epoch)/game.tickMs),end=start+DAY_TICKS,entries=[];
 for(let tick=start;tick<end;){
  const hot=game.hotSkill(tick),until=Math.min(end,hot.until);
  if(hot.skill==='combat')entries.push({...hot,from:tick,until});
  tick=until;
 }
 return {start,end,entries};
}
export function combatHotWindows(schedule,start=game.predictionStartTick){
 return schedule.entries.map(hot=>({
  fromTick:start+(hot.from===schedule.start?0:hot.from-schedule.start+1),
  toTick:start+hot.until-schedule.start,
  xpMult:hot.kind==='xp'?hot.mult:1,rarityMult:hot.kind==='rarity'?hot.mult:1,
 }));
}
export function combatHotMarkup(schedule,language,esc){
 const zh=language==='zh',format=tick=>{
  const d=new Date(tickTime(tick)),pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
 };
 const window=(from,until)=>`${format(from)} – ${format(until)}`;
 return `<p class="micro">${zh?'模拟区间':'Simulation window'}：${window(schedule.start,schedule.end)}<br>${zh?'本地时区':'Local time zone'}：${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p>`+
 (schedule.entries.length?schedule.entries.map(hot=>`<p class="micro">${window(hot.from,hot.until)}<br>${zh?'战斗':'Combat'} · ${hot.kind==='xp'?(zh?'经验':'XP'):(zh?'稀有':'Rarity')} +${Math.round((hot.mult-1)*100)}%</p>`).join(''):`<p class="micro">${zh?'此模拟区间内无战斗热门加成。':'No combat hot bonuses in this simulation window.'}</p>`);
}
export const rewardAmount=(total,period)=>period==='day'?total:total/24;
