import {combatPerks} from './combat-options.js';
import {game} from './model.js';
export function manualControls(state,{language,number,options,esc,name}){
 const m=state.manual,zh=language==='zh',label=(a,b)=>zh?a:b;
 const n=(path,a,b,max=1e7,min=0,step=1)=>number('manual.'+path,label(a,b),path.split('.').reduce((v,k)=>v[k],m),max,min,step);
 const check=(path,a,b)=>`<label class="check"><span>${esc(label(a,b))}</span><input type="checkbox" data-path="manual.${path}" ${path.split('.').reduce((v,k)=>v[k],m)?'checked':''}></label>`;
 const select=(path,a,b,choices)=>`<label class="potion"><span>${label(a,b)}</span><select data-path="manual.${path}" aria-label="${label(a,b)}">${options(choices,m[path])}</select></label>`;
 const section=(id,a,b,html)=>`<details class="config-detail" id="${id}"><summary>${label(a,b)}</summary>${html}</details>`;
 const food=select('foodRule','自动食物策略','Food selection',[[0,label('优先所选食物','Prefer selected food')],[1,label('优先好食物','Best food first')],[2,label('优先差食物','Worst food first')],[3,label('仅泉水，不进食','Fountain only')]])+`<label class="potion"><span>${label('食物品质','Food rarity')}</span><select data-path="food.tier">${options(Array.from({length:5},(_,i)=>[i,[label('普通','Normal'),label('罕见','Uncommon'),label('稀有','Rare'),label('史诗','Epic'),label('传说','Legendary')][i]]),state.food.tier)}</select></label>`+select('foodMaxTier','自动进食品质上限','Maximum food rarity',Array.from({length:5},(_,i)=>[i,[label('普通','Normal'),label('罕见','Uncommon'),label('稀有','Rare'),label('史诗','Epic'),label('传说','Legendary')][i]]))+select('foodPerTrip','每趟携带','Food per trip',[[5,'5'],[10,'10'],[20,'20'],[-2,label('留一格','Leave one slot')],[-1,label('满包','Full inventory')]])+`<label class="potion"><span>${label('模拟自动进食阈值','Auto-eat threshold')}</span><select data-path="eatAt">${options([25,50,75].map(value=>[value,value+'%']),state.eatAt)}</select></label>`;
 const perks=section('perk-settings','天赋','Perks',combatPerks.map(p=>(p.id==='meals'?number('meals',name(p.name),state.meals,p.ranks):n('perks.'+p.id,name(p.name),name(p.name),p.ranks))+`<p class="micro">${esc(name(p.each))}</p>`).join(''));
 const guild=n('guildXp','公会经验 (%)','Guild XP (%)',1e7,0,.1)+n('weeklyXp','每周目标经验 (%)','Weekly goal XP (%)',1e7,0,1)+check('blessing','矿脉祝福','Vein blessing')+`<p class="micro">${label('经验 +5% · 稀有 +10% · 无限仓库','XP +5% · Rarity +10% · Unlimited storage')}</p>`;
 const hot=`<label class="potion"><span>${label('热门加成','Hot bonuses')}</span><select data-path="manual.hotForecast" aria-label="${label('热门加成','Hot bonuses')}">${options([[0,label('不计算','Disabled')],[1,label('按当前时间计算','Calculate from now')]],m.hotForecast?1:0)}</select></label><div id="combat-hot-schedule"></div>`;
 const supply=`<label class="potion"><span>${label('模拟初始仓库位置','Starting depot location')}</span><select data-path="homeBank">${options([[0,label('自动','Automatic')],...game.world.banks.map(b=>[b.id,`${label('仓库','Depot')} ${b.id} (${b.x}, ${b.y})`])],state.homeBank)}</select></label>`+check('ironman','铁人模式（不掉落坐骑）','Ironman (no mount drops)');
 const other=perks+section('other-settings','其它','Other',guild+hot+supply);

 return {food,other};
}
