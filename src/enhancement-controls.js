import {getSnapshot,subscribe} from './price-service.js';
import {searchSelectMarkup,bindSearchSelect} from './search-select.js';
import * as game from './upstream.js';
import {translatedName} from './i18n.js';
import {requestCharacter,characterImportPanel,probeCharacter,importStatusText} from './import-controls.js';
import {enhancementStorageKey,enhancementDefaults,enhanceableItems,validateEnhancement,calculateEnhancement,importEnhancement,resolveEnhancementPrices} from './enhancement.js';

let probeStarted=false;
let state=enhancementDefaults(),candidates=[],language='zh',busy=false,status=null,saveOK=true;
try{const saved=localStorage.getItem(enhancementStorageKey);if(saved)state=validateEnhancement(JSON.parse(saved),{allowUnsupportedTarget:true});}catch{status={error:'savedInvalid'};}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(zh,en)=>language==='zh'?zh:en;
const name=s=>translatedName(s,language);
const rarities=()=>language==='zh'?['普通','罕见','稀有','史诗','传说']:['Normal','Uncommon','Rare','Epic','Legendary'];
const options=(arr,value)=>arr.map(([v,label])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
const errors={
 targetAboveLimit:['新强化目标最高为 +20；已有高强化装备仅可保留当前值。请调整目标。','New enhancement targets are capped at +20. Existing higher items can only keep their current level. Adjust the target.'],
 invalidConfiguration:['请输入范围内的整数配置。','Enter integer settings within the allowed ranges.'],invalidItem:['请选择可强化的装备及有效稀有度。','Select an enhanceable item and valid rarity.'],invalidPrice:['价格必须为空或非负有限数值。','Prices must be blank or finite nonnegative numbers.'],targetBelowCurrent:['目标强化值不能低于当前值。','Target enhancement cannot be below the current value.'],unreliableCalculation:['无法可靠计算此配置的期望成本。','Expected costs could not be calculated reliably.']};
const errorMessage=code=>(errors[code]??[code,code])[language==='zh'?0:1];
const format=v=>v>=1e12?v.toExponential(4):v.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:2});
const field=(key,label,min,max,step=1,value=state[key])=>`<label class="number-field"><span>${label}</span><input data-enhance-field="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value??''}"></label>`;
function resetBaseOverride(){const id=game.encode(game.withRarity(state.itemId,state.tier),state.current);if(state.basePriceItem!==null&&state.basePriceItem!==id){state.priceModes.basePrice='global';state.basePrice=null;state.basePriceItem=null;}}
function previewPrices(){try{return resolveEnhancementPrices(state,getSnapshot());}catch{return {shardPrice:null,scrollPrice:null,basePrice:null};}}
function save(){try{localStorage.setItem(enhancementStorageKey,JSON.stringify(validateEnhancement(state)));saveOK=true;}catch(error){saveOK=false;}}
function renderStatus(){const el=document.getElementById('enhance-import-status');if(!el)return;
 el.textContent=importStatusText(language,status,busy);
 document.getElementById('enhance-import').disabled=busy;
}
function renderResults(){const host=document.getElementById('enhance-results');if(!host)return;
 const note=document.getElementById('enhance-save-note');note.textContent=saveOK?text('● 强化配置独立保存在此浏览器','● Enhancement settings saved separately in this browser'):text('配置未保存：请检查输入或浏览器存储。','Settings were not saved. Check inputs or browser storage.');
 let result,priced;try{priced=resolveEnhancementPrices(state,getSnapshot());result=calculateEnhancement(priced);}catch(error){host.innerHTML=`<div class="issue-box" role="alert">${esc(errorMessage(error.message))}</div>`;return;}
 const {totals,steps,purchaseTotal,taxedGold}=result;
 const incomplete=text('未完整定价','Incomplete pricing');
 const money=value=>value===null?incomplete:format(value);
 const shardCost=totals.shards===0?0:priced.shardPrice===null?null:totals.shards*priced.shardPrice;
 const scrollCost=totals.scrolls===0?0:priced.scrollPrice===null?null:totals.scrolls*priced.scrollPrice;
 const materialCost=(quantity,price,cost)=>`${format(quantity)} × ${price===null?text('未填写','Not entered'):format(price)} = ${money(cost)}`;
 const valuationSteps=[
  [text('强化金币','Enhancement gold'),format(totals.gold)],
  [text('碎片费用','Shard cost'),materialCost(totals.shards,priced.shardPrice,shardCost)],
  [text('保护卷轴费用','Protection scroll cost'),materialCost(totals.scrolls,priced.scrollPrice,scrollCost)],
  [text('底装购置费','Base item purchase'),money(priced.basePrice)],
  [text('基础投入合计','Base investment subtotal'),`${format(totals.gold)} + ${money(shardCost)} + ${money(scrollCost)} + ${money(priced.basePrice)} = ${money(purchaseTotal)}`],
  [text('3%预算预留','3% budget reserve'),`${money(purchaseTotal)} × 3% = ${money(purchaseTotal===null?null:purchaseTotal*0.03)}`],
  [text('含预留总投入','Total including reserve'),`${money(purchaseTotal)} × 1.03 = ${money(taxedGold)}`]
 ];
 const duration=totals.seconds>=3600?`${format(totals.seconds/3600)} ${text('小时','h')}`:totals.seconds>=60?`${format(totals.seconds/60)} ${text('分钟','min')}`:`${format(totals.seconds)} ${text('秒','s')}`;
 host.innerHTML=`<section class="panel enemies"><h3>${text('逐级成功率与单次费用','Step chances and per-attempt costs')}</h3><p class="micro">${text('低于当前 +值的行是失败后可能需要重做的步骤。保护阈值按尝试前 +值判断。','Rows below your current enhancement may be revisited after failure. Protection checks the enhancement before the attempt.')}</p><div class="table-scroll"><table class="enhance-table"><thead><tr>${[text('步骤','Step'),text('成功率','Success chance'),text('金币','Coins'),text('碎片','Shards'),text('失败后','On failure')].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${steps.length?steps.map(x=>`<tr class="${x.from<state.current?'enhance-rebuild':''}"><td>+${x.from} → +${x.to}${x.from<state.current?` <small>${text('重做','Rebuild')}</small>`:''}</td><td>${format(x.chance*100)}%</td><td>${format(x.gold)}</td><td>${format(x.shards)}</td><td>+${x.failTo}${x.protected?` · ${text('消耗 1 卷轴','1 scroll spent')}`:''}</td></tr>`).join(''):`<tr><td colspan="5">${text('已达到目标，无需强化。','Target already reached; no enhancement needed.')}</td></tr>`}</tbody></table></div></section>
 <div class="result-heading"><div><span class="eyebrow">ENHANCEMENT ESTIMATE</span><h2>${text('期望强化成本','Expected enhancement costs')}</h2></div><span class="style-badge">+${state.current} → +${state.target}</span></div>
 <p class="table-note">${text('固定强化技能等级估算 · 失败回退与重做已计入 · 期望不是保底预算。','Fixed enhancing level estimate · Includes failed attempts and rebuilding · Expectations are not guaranteed budgets.')}</p>
 <div class="stats enhance-stats">${[[text('金币','Coins'),format(totals.gold)],[text('碎片','Shards'),format(totals.shards)],[text('保护卷轴','Protection scrolls'),format(totals.scrolls)],[text('金币（含3%预算预留）','Coins (incl. 3% budget reserve)'),taxedGold===null?text('未完整定价','Incomplete pricing'):format(taxedGold)],[text('强化次数','Enhancement attempts'),format(totals.attempts)],[text('强化耗时','Enhancing time'),duration]].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
 <section class="panel enhance-costs"><h3>${text('金币估价','Coin valuation')}</h3><ol>${valuationSteps.map(([label,value])=>`<li><p>${label}：<strong>${value}</strong></p></li>`).join('')}</ol><p class="micro">${text('额外 3% 为预算预留。游戏市场税由卖家成交时支付；强化及材料购买不另征此税。','The extra 3% is a budget reserve. In-game market tax is paid by sellers on a sale; enhancing and material purchases do not incur this tax.')}</p></section>

`;
}
export function applyEnhancementImport(snapshot){
 const result=importEnhancement(state,snapshot);
 state=result.state;candidates=result.candidates;status={capturedAt:result.capturedAt};save();
 return {...status,saveOK};
}
export function renderEnhancement(nextLanguage){
 const openDetails=new Map([...document.querySelectorAll('#enhance-section details[id]')].map(el=>[el.id,el.open]));
 language=nextLanguage;const host=document.getElementById('enhance-content');if(!host)return;
 const candidateLabel=x=>`${name(game.item(x.itemId).name)} · ${rarities()[x.tier]} +${x.current}`;
 host.innerHTML=`<aside class="panel config enhance-config"><div class="panel-heading"><h1>${text('角色配置','Character build')}</h1><button id="enhance-reset" class="text-button">${text('清空配置','Reset settings')}</button></div><p class="muted intro">${text('配置角色的强化技能与成功率加成。','Configure enhancing skill and success chance bonuses.')}</p>
 ${characterImportPanel(language,{id:'enhance-import-settings',statusId:'enhance-import-status',buttons:[{id:'enhance-import',label:text('导入配置','Import configuration')}]})}
 <details class="config-detail" id="enhance-skill-settings"><summary>${text('技能','Skills')}</summary><div class="skill-grid">${field('level',text('强化技能等级','Enhancing skill level'),1,game.maxLevel)}</div><p class="micro">${text('强化技能每比 1 级高一级，成功率倍率增加 0.2%。','Each enhancing level above level 1 adds 0.2% to the success chance multiplier.')}</p></details>
 <details class="config-detail" id="enhance-mastery-settings"><summary>${text('精通','Masteries')}</summary><label class="number-field"><span>${text('强化精通实际加成 (%)','Effective enhance mastery bonus (%)')}</span><input data-enhance-field="mastery" type="number" min="0" max="${game.enhanceMasteryBonusCap*100}" step="0.25" value="${state.mastery===null?'':Math.min(game.enhanceMasteryBonusCap*100,state.mastery*0.25)}"></label></details>
 <p class="save-note" id="enhance-save-note"></p></aside><div class="results enhance-workspace"><section class="panel enhance-equipment"><div class="panel-heading"><h2>${text('强化配置','Enhancement settings')}</h2><button id="enhance-equipment-reset" class="text-button">${text('清空配置','Reset settings')}</button></div><p class="muted">${text('选择装备和目标，计算成功率与失败后的完整期望成本。','Choose an item and target to estimate success chances and costs including failures.')}</p>
 ${candidates.length?`<label class="enhance-select"><span>${text('快捷选择角色物品','Quick select character item')}</span><select id="enhance-candidate">${options([['',text('选择一件角色物品','Select a character item')],...candidates.map(x=>[x.id,candidateLabel(x)])],'')}</select></label>`:''}
 <div class="enhance-item-row">${searchSelectMarkup('enhance-item-search',text('装备 / 工具','Equipment / tool'))}
 <label class="enhance-select"><span>${text("稀有度",'Rarity')}</span><select data-enhance-field="tier">${options(rarities().map((x,i)=>[i,x]),state.tier)}</select></label></div>
 <div class="skill-grid">${field('current',text('当前强化值','Current enhancement'),0,game.maxEnhancement)}${field('target',text('目标强化值','Target enhancement'),0,Math.max(game.enhancementTargetLimit,state.current??0))}</div>
 <div class="enhance-item-row enhance-protection-row"><label class="number-field"><span>${text('使用保护卷轴','Use protection scrolls')}</span><select data-enhance-field="protect">${options([['true',text('使用','Use')],['false',text('不使用','Do not use')]],state.protect)}</select></label>${field('protectFrom',text('保护卷轴起始等级','Protection scroll starting level'),game.protectionMin,game.maxEnhancement)}</div>
 <section class="config-detail" id="enhance-price-settings"><h3>${text('材料与底装估价','Material and base item prices')}</h3><div class="enhance-item-row">${field('shardPrice',text('虚空碎片','Voidshard'),0,Number.MAX_SAFE_INTEGER,'any',previewPrices().shardPrice)}${field('scrollPrice',text('保护卷轴','Protection scroll'),0,Number.MAX_SAFE_INTEGER,'any',previewPrices().scrollPrice)}</div>${field('basePrice',text('底装购置费','Base item purchase'),0,Number.MAX_SAFE_INTEGER,'any',previewPrices().basePrice)}</section></section><div id="enhance-results" aria-live="polite"></div></div>`;

 host.querySelectorAll('[data-enhance-field]').forEach(el=>{
  const update=()=>{const key=el.dataset.enhanceField;state[key]=key==='protect'?el.value==='true':el.value===''?null:Number(el.value)/(key==='mastery'?0.25:1);if(key==='mastery'&&Number(el.value)>game.enhanceMasteryBonusCap*100)state.mastery=NaN;if(Object.hasOwn(state.priceModes,key)){state.priceModes[key]='manual';if(key==='basePrice')state.basePriceItem=game.encode(game.withRarity(state.itemId,state.tier),state.current);}if(['current','tier'].includes(key))resetBaseOverride();save();if(['current','tier'].includes(key)&&Number.isInteger(state.current)&&state.current>=0&&state.current<=game.maxEnhancement)renderEnhancement(language);else renderResults();};
  if(el.type==='number'&&el.dataset.enhanceField!=='current')el.oninput=update;else el.onchange=update;
 });
 const itemOptions=()=>enhanceableItems.map(x=>({value:x.id,label:name(x.name),search:`${x.name} ${translatedName(x.name,'zh')}`}));
 bindSearchSelect({id:'enhance-item-search',options:itemOptions(),value:state.itemId,selectedLabel:id=>name(game.item(id).name),onSelect:id=>{state.itemId=id;resetBaseOverride();save();renderEnhancement(language);},emptyText:text('没有匹配的装备或工具','No matching equipment or tools'),countText:count=>text(`${count} 件匹配物品`,`${count} matching items`)});
 document.getElementById('enhance-reset').onclick=()=>{const {guild,level,mastery}=enhancementDefaults();state={...state,guild,level,mastery};status=null;save();renderEnhancement(language);};
 document.getElementById('enhance-equipment-reset').onclick=()=>{const {guild,level,mastery}=state;state={...enhancementDefaults(),guild,level,mastery};candidates=[];save();renderEnhancement(language);};
 document.getElementById('enhance-candidate')?.addEventListener('change',event=>{const selected=candidates.find(x=>x.id===Number(event.target.value));if(!selected||event.target.value==='')return;state=validateEnhancement({...state,itemId:selected.itemId,tier:selected.tier,current:selected.current,target:Math.max(state.target??0,selected.current)},{allowUnsupportedTarget:true});save();renderEnhancement(language);});
 document.getElementById('enhance-import').onclick=async()=>{
  if(busy)return;busy=true;renderStatus();
  try{const response=await requestCharacter('read');if(!response.snapshot)throw Error('noSnapshot');applyEnhancementImport(response.snapshot);}
  catch(error){status={error:error.message};}finally{busy=false;renderEnhancement(language);}
 };
 if(!probeStarted){probeStarted=true;probeCharacter().then(()=>{if(!status&&!busy){status={ready:true};renderStatus();}}).catch(error=>{if(!status&&!busy){status={error:error.message};renderStatus();}});}
 renderStatus();renderResults();for(const [id,open]of openDetails){const el=document.getElementById(id);if(el)el.open=open;}
}

subscribe(change=>{
 if(!change.prices)return;
 const host=document.getElementById('enhance-content');if(!host)return;
 const priced=previewPrices();
 for(const key of ['shardPrice','scrollPrice','basePrice'])if(state.priceModes[key]==='global'){const el=host.querySelector(`[data-enhance-field="${key}"]`);if(el)el.value=priced[key]??'';}
 renderResults();
});
