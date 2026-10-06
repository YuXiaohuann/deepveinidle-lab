import {game} from './model.js';

export const epoch=Date.UTC(2026,0,1);
export const hotSkills=['mining','fishing','woodcutting','farming','thieving','cooking','smithing','fletching','herblore','crafting','enhancing','combat'];
const rareSkills=new Set(['mining','fishing','woodcutting','farming','combat']);
export const tickTime=tick=>epoch+tick*game.tickMs;
export function forecast(now,skill='all',kind='all'){
 if(!Number.isFinite(now)||now<epoch)throw Error('invalidTime');
 if(skill!=='all'&&!hotSkills.includes(skill)||!['all','xp','rarity'].includes(kind))throw Error('invalidFilter');
 const current=game.hotSkill(Math.floor((now-epoch)/game.tickMs));
 if(kind==='rarity'&&skill!=='all'&&!rareSkills.has(skill))return {current,entries:[],impossible:true};
 const filtered=skill!=='all'||kind!=='all',entries=[];
 let tick=current.until;
 for(let i=0;i<(filtered?366*48:48);i++){
  const hot=game.hotSkill(tick);
  if((skill==='all'||hot.skill===skill)&&(kind==='all'||hot.kind===kind))entries.push(hot);
  if(filtered&&entries.length===10)break;
  tick=hot.until;
 }
 if(filtered&&entries.length!==10)throw Error('forecastIncomplete');
 return {current,entries,impossible:false};
}
