import {tickMs} from './upstream.js';

// Observe the state consumed by the upstream tick, without changing simulation.
export function recordActivityTime(result,player,tick){
 const times=result.activityTicks??={working:0,walking:0,banking:0,recovery:0,stunned:0,transitions:0,waiting:0};
 const activity=player.activity;
 const key=activity==='walking'?'walking':activity==='drinking'?'recovery':activity==='banking'?'banking':activity==='working'?(tick<player.stunUntil?'stunned':'working'):player.route?'transitions':'waiting';
 times[key]++;
 result.extraTicks=(result.extraTicks??0)+(key==='working'?0:1);
}
export function timingDetails(result,language,workLabel){
 const zh=language==='zh',times=result.activityTicks??{},total=result.elapsedTicks;
 const number=n=>n.toLocaleString(zh?'zh-CN':'en',{maximumFractionDigits:2});
 const duration=t=>{
  const seconds=t*tickMs/1000;
  const [divisor,unit]=seconds>=3600?[3600,zh?'小时':'h']:seconds>=60?[60,zh?'分钟':'min']:[1,zh?'秒':'s'];
  return (seconds>0&&seconds<0.01?'&lt;0.01':number(seconds/divisor))+unit;
 };
 const line=(label,t,ratio=true)=>`<div class="loot-line"><span>${label}</span><span>${duration(t)}${ratio&&total>0?' · '+number(t/total*100)+'%':''}</span></div>`;
 const breakdown=[['walking','行走','Walking'],['banking','仓库操作','Depot operations'],['recovery','补给与恢复','Recovery'],['stunned','被抓停顿','Caught pauses'],['transitions','流程切换','Transitions'],['waiting','其他等待','Other waiting']].filter(([key])=>times[key]>0).map(([key,cn,en])=>line(zh?cn:en,times[key])).join('');
 return '<div class="activity-timing">'+line(zh?'实际模拟':'Simulated',total,false)+line(workLabel,times.working??0)+line(zh?'额外耗时':'Extra time',result.extraTicks??0)+(breakdown?'<div class="activity-timing-breakdown">'+breakdown+'</div>':'')+'</div>';
}
