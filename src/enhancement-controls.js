import {priceState,subscribePrices} from './item-price-store.js';
import {searchSelectMarkup,bindSearchSelect} from './search-select.js';
import * as game from './upstream.js';
import {translatedName} from './i18n.js';
import {requestCharacter,characterImportPanel,probeCharacter,importStatusText} from './import-controls.js';
import {enhancementStorageKey,enhancementDefaults,enhanceableItems,validateEnhancement,calculateEnhancement,importEnhancement,resolveEnhancementPrices} from './enhancement.js';

let probeStarted=false;
let state=enhancementDefaults(),candidates=[],language='zh',busy=false,status=null,saveOK=true;
try{const saved=localStorage.getItem(enhancementStorageKey);if(saved)state=validateEnhancement(JSON.parse(saved));}catch{status={error:'savedInvalid'};}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(zh,en)=>language==='zh'?zh:en;
const name=s=>translatedName(s,language);
const rarities=()=>language==='zh'?['普通','罕见','稀有','史诗','传说']:['Normal','Uncommon','Rare','Epic','Legendary'];
const options=(arr,value)=>arr.map(([v,label])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
const errors={
 invalidConfiguration:['请输入范围内的整数配置。','Enter integer settings within the allowed ranges.'],invalidItem:['请选择可强化的装备及有效稀有度。','Select an enhanceable item and valid rarity.'],invalidPrice:['价格必须为空或非负有限数值。','Prices must be blank or finite nonnegative numbers.'],targetBelowCurrent:['目标强化值不能低于当前值。','Target enhancement cannot be below the current value.'],unreliableCalculation:['无法可靠计算此配置的期望成本。','Expected costs could not be calculated reliably.']};
const errorMessage=code=>(errors[code]??[code,code])[language==='zh'?0:1];
const format=v=>v>=1e12?v.toExponential(4):v.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:2});
const field=(key,label,min,max,step=1)=>`<label class="number-field"><span>${label}</span><input data-enhance-field="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${state[key]??''}"></label>`;
function resetBaseOverride(){const id=game.encode(game.withRarity(state.itemId,state.tier),state.current);if(state.basePriceItem!==null&&state.basePriceItem!==id){state.priceModes.basePrice='global';state.basePrice=null;state.basePriceItem=null;}}
function previewPrices(){try{return resolveEnhancementPrices(state,priceState().prices);}catch{return {shardPrice:null,scrollPrice:null,basePrice:null};}}
function save(){try{localStorage.setItem(enhancementStorageKey,JSON.stringify(validateEnhancement(state)));saveOK=true;}catch(error){saveOK=false;}}
function renderStatus(){const el=document.getElementById('enhance-import-status');if(!el)return;
 el.textContent=importStatusText(language,status,busy);
 document.getElementById('enhance-import').disabled=busy;
}
function renderResults(){const host=document.getElementById('enhance-results');if(!host)return;
 const note=document.getElementById('enhance-save-note');note.textContent=saveOK?text('● 强化配置独立保存在此浏览器','● Enhancement settings saved separately in this browser'):text('配置未保存：请检查输入或浏览器存储。','Settings were not saved. Check inputs or browser storage.');
 let result,priced;try{priced=resolveEnhancementPrices(state,priceState().prices);result=calculateEnhancement(priced);}catch(error){host.innerHTML=`<div class="issue-box" role="alert">${esc(errorMessage(error.message))}</div>`;return;}
 const methodOpen=document.getElementById('enhance-methodology')?.open??false;
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
 <section class="panel enhance-costs"><p class="micro">${text('额外 3% 为预算预留。游戏市场税由卖家成交时支付；强化及材料购买不另征此税。','The extra 3% is a budget reserve. In-game market tax is paid by sellers on a sale; enhancing and material purchases do not incur this tax.')}</p><h3>${text('金币估价','Coin valuation')}</h3><ol>${valuationSteps.map(([label,value])=>`<li><p>${label}：<strong>${value}</strong></p></li>`).join('')}</ol></section>

 <details class="panel methodology" id="enhance-methodology"><summary>${text('计算依据与限制','Calculation and limitations')}</summary><p>${text('调用当前已核验游戏源码的成功率及费用函数。金币和碎片无论成败均消耗；不保护失败回 +0，保护生效失败降一级，仅失败扣卷轴。材料与卷轴供应充足，不使用巨像核心。','Uses success chances and fees from the verified game source. Coins and shards are spent on success and failure. Unprotected failures reset to +0; protected failures lose one level and spend one scroll. Materials and scrolls are plentiful. Colossus cores are excluded.')}</p><p>${text('强化技能等级在计算期间固定。真实强化成败均获得经验，可能升级并改变成功率，本版不模拟此过程。耗时按每次 2.4 秒计算，不含操作等待；不会执行游戏强化。','Enhancing skill level stays fixed. Actual attempts grant XP on success and failure and may raise your level and chances; this process is not simulated. Each attempt takes 2.4 seconds, excluding UI waiting. No game enhancements are executed.')}</p><p>${text('精通与符文书台倍率乘算。递推计算失败回退后的期望成本；高目标可能产生极大值，以科学计数法显示。','Mastery and rune lectern multipliers multiply. Recurrence equations include rebuilding after failures; very large costs use scientific notation.')}</p></details>`;
 document.getElementById('enhance-methodology').open=methodOpen;
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
 <details class="config-detail" id="enhance-home-settings"><summary>${text('家园','Home')}</summary><div class="skill-grid">${field('lectern',text('符文书台等级','Rune lectern level'),0,Number.MAX_SAFE_INTEGER)}</div><p class="micro">${text('符文书台只计已放置的等级，每级将成功率乘以额外 1%。','Only placed rune lectern levels apply; +1% of the chance per level.')}</p></details>
 <details class="config-detail" id="enhance-mastery-settings"><summary>${text('精通','Masteries')}</summary><label class="number-field"><span>${text('强化精通实际加成 (%)','Effective enhance mastery bonus (%)')}</span><input data-enhance-field="mastery" type="number" min="0" max="${game.masteryRankLimit*0.25}" step="0.25" value="${state.mastery===null?'':state.mastery*0.25}"></label></details>
 <p class="save-note" id="enhance-save-note"></p></aside><div class="results enhance-workspace"><section class="panel enhance-equipment"><div class="panel-heading"><h2>${text('强化装备','Enhancement item')}</h2></div><p class="muted">${text('选择装备和目标，计算成功率与失败后的完整期望成本。','Choose an item and target to estimate success chances and costs including failures.')}</p>
 ${candidates.length?`<label class="enhance-select"><span>${text('快捷选择角色物品','Quick select character item')}</span><select id="enhance-candidate">${options([['',text('选择一件角色物品','Select a character item')],...candidates.map(x=>[x.id,candidateLabel(x)])],'')}</select></label>`:''}
 <div class="enhance-item-row">${searchSelectMarkup('enhance-item-search',text('装备 / 工具','Equipment / tool'))}
 <label class="enhance-select"><span>${text("稀有度",'Rarity')}</span><select data-enhance-field="tier">${options(rarities().map((x,i)=>[i,x]),state.tier)}</select></label></div>
 <div class="skill-grid">${field('current',text('当前强化值','Current enhancement'),0,game.maxEnhancement)}${field('target',text('目标强化值','Target enhancement'),0,game.maxEnhancement)}</div>
 <div class="enhance-item-row enhance-protection-row"><label class="check"><input data-enhance-field="protect" type="checkbox" ${state.protect?'checked':''}>${text('使用保护卷轴','Use protection scrolls')}</label>${field('protectFrom',text('保护卷轴起始等级','Protection scroll starting level'),game.protectionMin,game.maxEnhancement)}</div><p class="micro">${text('从 +2 起可保护，失败仍降一级；低于设定阈值时失败回 +0。','Protection is available from +2. Failures still lose one level; below the threshold they reset to +0.')}</p>
 <details class="config-detail" id="enhance-price-settings"><summary>${text('材料与底装估价','Material and base item prices')}</summary><p class="micro">${text('全局价格在页头设置。本方案填写只影响当前强化；底装费用关联当前稀有度及起始强化。空值表示未定价。','Manage global prices in the header. Overrides affect only this plan; base costs belong to the selected rarity and starting enhancement. Blank means unpriced.')}</p>${['shardPrice','scrollPrice','basePrice'].map(key=>{const label={shardPrice:text('虚空碎片单价（金币）','Voidshard unit price (coins)'),scrollPrice:text('保护卷轴单价（金币）','Protection scroll unit price (coins)'),basePrice:text('底装购置费（金币）','Base item purchase (coins)')}[key],mode=state.priceModes[key],price=previewPrices()[key];return `<label class="potion"><span>${label}</span><select data-enhance-price-mode="${key}">${options([['global',text('全局价格','Global price')],['manual',text('本方案填写','Plan override')],...(key==='basePrice'?[['owned',text('已有底装（0）','Already owned (0)')]]:[])],mode)}</select></label>${mode==='manual'?field(key,label,0,Number.MAX_SAFE_INTEGER,'any'):`<p class="micro" data-enhance-price-preview="${key}">${text('有效价格：','Effective price: ')}${price===null?text('未定价','Unpriced'):format(price)}</p>`}`;}).join('')}</details></section><div id="enhance-results" aria-live="polite"></div></div>`;
 host.querySelectorAll('[data-enhance-field]').forEach(el=>{
  const update=()=>{const key=el.dataset.enhanceField;state[key]=el.type==='checkbox'?el.checked:el.value===''?null:Number(el.value)/(key==='mastery'?0.25:1);if(['current','tier'].includes(key))resetBaseOverride();save();if(['current','tier'].includes(key)&&Number.isInteger(state.current)&&state.current>=0&&state.current<=game.maxEnhancement)renderEnhancement(language);else renderResults();};
  if(el.type==='number'&&el.dataset.enhanceField!=='current')el.oninput=update;else el.onchange=update;
 });
 host.querySelectorAll('[data-enhance-price-mode]').forEach(el=>el.onchange=()=>{const key=el.dataset.enhancePriceMode;state.priceModes[key]=el.value;if(key==='basePrice')state.basePriceItem=el.value==='global'?null:game.encode(game.withRarity(state.itemId,state.tier),state.current);save();renderEnhancement(language);});
 const itemOptions=()=>enhanceableItems.map(x=>({value:x.id,label:name(x.name),search:`${x.name} ${translatedName(x.name,'zh')}`}));
 bindSearchSelect({id:'enhance-item-search',options:itemOptions(),value:state.itemId,selectedLabel:id=>name(game.item(id).name),onSelect:id=>{state.itemId=id;resetBaseOverride();save();renderEnhancement(language);},emptyText:text('没有匹配的装备或工具','No matching equipment or tools'),countText:count=>text(`${count} 件匹配物品`,`${count} matching items`)});
 document.getElementById('enhance-reset').onclick=()=>{state=enhancementDefaults();candidates=[];status=null;save();renderEnhancement(language);};
 document.getElementById('enhance-candidate')?.addEventListener('change',event=>{const selected=candidates.find(x=>x.id===Number(event.target.value));if(!selected||event.target.value==='')return;state=validateEnhancement({...state,itemId:selected.itemId,tier:selected.tier,current:selected.current,target:Math.max(state.target??0,selected.current)});save();renderEnhancement(language);});
 document.getElementById('enhance-import').onclick=async()=>{
  if(busy)return;busy=true;renderStatus();
  try{const response=await requestCharacter('read');if(!response.snapshot)throw Error('noSnapshot');applyEnhancementImport(response.snapshot);}
  catch(error){status={error:error.message};}finally{busy=false;renderEnhancement(language);}
 };
 if(!probeStarted){probeStarted=true;probeCharacter().then(()=>{if(!status&&!busy){status={ready:true};renderStatus();}}).catch(error=>{if(!status&&!busy){status={error:error.message};renderStatus();}});}
 renderStatus();renderResults();for(const [id,open]of openDetails){const el=document.getElementById(id);if(el)el.open=open;}
}

subscribePrices(()=>{
 const host=document.getElementById('enhance-content');if(!host)return;
 const priced=previewPrices();
 for(const el of host.querySelectorAll('[data-enhance-price-preview]')){const v=priced[el.dataset.enhancePricePreview];el.textContent=text('有效价格：','Effective price: ')+(v===null?text('未定价','Unpriced'):format(v));}
 renderResults();
});
