import * as game from './upstream.js';
import {translatedName} from './i18n.js';
import {marketFamilies,validItemId,itemFamily,setItemPrice,lockItemPrices,clearUnlockedPrices,importItemPrices,validateMarketSnapshot} from './item-prices.js';
import {priceState,priceSaveError,updatePrices,subscribePrices} from './item-price-store.js';
import {requestMarket} from './market-import.js';

let editing=false;
let language='zh',dialog,selected=new Set(),busy=false,status=null,marketError=null,query='',family='all',tier='all',plus=0,filter='all';
const labels={ore:'矿石',bars:'金属锭',fish:'鱼',wood:'木材',food:'食物',crops:'作物',potions:'药水',weapons:'武器',armour:'护甲',jewellery:'饰品',tools:'工具',mounts:'坐骑',materials:'材料',valuables:'贵重品',gems:'宝石'};
const text=(zh,en)=>language==='zh'?zh:en;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rarity=()=>text(['普通','罕见','稀有','史诗','传说'],['Normal','Uncommon','Rare','Epic','Legendary']);
const familyName=f=>text(labels[f.key],f.label);
const opts=(arr,value)=>arr.map(([v,label])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
const number=v=>v.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:6});
const date=v=>new Date(v).toLocaleString(language==='zh'?'zh-CN':'en');
const errors={marketNetworkFailed:['官方行情请求失败，请检查网络后重试；已有价格保留。','Could not reach the official market API. Check your connection and retry; existing prices were kept.'],marketTimeout:['官方行情请求超时，请重试；已有价格保留。','The official market request timed out. Retry; existing prices were kept.'],marketHttpFailed:['官方行情接口返回错误，请稍后重试；已有价格保留。','The official market API returned an error. Retry later; existing prices were kept.'],marketStale:['官方行情早于当前缓存，已有报价与价格保留。','Official quotes are older than the current cache; existing quotes and prices were kept.'],invalidMarketData:['官方行情数据格式异常，已有价格保留。','Invalid official market data; existing prices were kept.'],noMarketData:['官方接口暂无物品报价，请稍后重试；已有价格保留。','The official API has no item quotes. Retry later; existing prices were kept.'],invalidPrice:['单价必须为空或范围内的非负数值。','Unit prices must be blank or finite nonnegative numbers within range.'],invalidPriceStorage:['已保存价格格式无效，当前使用空价格表；未自动覆盖原存档。','Saved prices are invalid. An empty table is shown; the saved data has not been overwritten.'],priceReadFailed:['价格存储读取失败，当前设置未恢复。','Could not read saved prices.'],priceSaveFailed:['价格未保存：浏览器存储不可用，当前内存设置仍有效。','Prices were not saved. Browser storage is unavailable; current in-memory settings still apply.']};
const errorText=key=>(errors[key]??[key,key])[language==='zh'?0:1];
const statusError=()=>!busy&&(marketError||status?.error);
function message(){
 if(busy)return text('正在读取官方行情…','Reading official market prices…');
 if(statusError())return errorText(statusError());
 if(status?.stats){
  const s=status.stats,parts=[text(`已更新 ${s.updated} 项价格`,`Updated ${s.updated} prices`),text(`商人价 ${s.vendor}`,`Vendor price ${s.vendor}`),text(`锁定跳过 ${s.locked}`,`Locked ${s.locked}`),text(`缺报价 ${s.missing}`,`Missing ${s.missing}`)];
  for(const [key,zh,en]of [['unavailable','无法兜底','No fallback'],['stale','过旧','Stale'],['invalid','异常','Invalid']])if(s[key])parts.push(text(zh,en)+' '+s[key]);
  return parts.join(' · ');
 }
 if(status?.cleared!==undefined)return text(`已清空 ${status.cleared} 件未锁定物品的价格`,`Cleared prices for ${status.cleared} unlocked items`);
 if(status?.changed!==undefined)return text(`已${status.locked?'锁定':'解锁'} ${status.changed} 件物品`,`${status.locked?'Locked':'Unlocked'} ${status.changed} items`);
 const quotes=priceState().quotes,times=Object.values(quotes).flatMap(q=>Object.values(q).map(side=>side.capturedAt));
 if(!times.length)return '';
 const latest=Math.max(...times),count=Object.keys(quotes).length,age=Math.max(0,Math.floor((Date.now()-latest)/60000));
 return text(`已读取 ${count} 个物品变体 · 行情更新于 ${date(latest)} · 距今 ${age} 分钟`,`Read ${count} item variants · Quotes updated: ${date(latest)} · Age ${age} min`);
}
function refreshStatus(){
 const el=dialog.querySelector('#price-status');el.textContent=message();el.className='micro import-status'+(statusError()?' price-market-warning':'');el.setAttribute('role',statusError()?'alert':'status');
}
function hasFilters(){return family!=='all'||query.trim()!==''||tier!=='all'||plus>0||filter!=='all';}
function candidates(){
 if(!hasFilters())return [];
 const s=priceState(),ids=new Set(game.items.filter(i=>i.id===game.baseItemId(i.id)&&itemFamily(i.id)&&game.canSell(i.id)).map(i=>i.id));
 for(const key of [...Object.keys(s.prices),...Object.keys(s.quotes)])ids.add(Number(key));
 for(const id of [...ids]){
  const base=game.baseItemId(id);for(const t of tier==='all'?[0,1,2,3,4]:[Number(tier)]){
   const encoded=game.encode(game.withRarity(base,t),plus);if(validItemId(encoded)&&(!plus||game.canEnhance(encoded)))ids.add(encoded);
  }
 }
 return [...ids].filter(id=>{
  const base=game.item(game.baseItemId(id)),p=s.prices[id],q=query.trim().toLowerCase();
  return (family==='all'||itemFamily(id)===family)&&(tier==='all'||game.itemTier(id)===Number(tier))&&(!plus||Math.floor(id/game.encode(0,1))===plus)&&(!q||`${base.name} ${translatedName(base.name,'zh')} ${id}`.toLowerCase().includes(q))&&(filter==='all'||filter==='priced'&&p?.price!==null&&p?.price!==undefined||filter==='locked'&&p?.locked);
 }).sort((a,b)=>game.baseItemId(a)-game.baseItemId(b)||a-b);
}
const quoteText=q=>!q?text('未读取','Not read'):`${q.invalid?text('异常','Invalid'):q.value===null?text('无报价','No quote'):number(q.value)}`;
function row(id){const s=priceState(),p=s.prices[id],q=s.quotes[id],base=game.item(game.baseItemId(id)),name=translatedName(base.name,language),t=game.itemTier(id),enhance=Math.floor(id/game.encode(0,1));
 const source={manual:text('手动','Manual'),ask:text('卖单','Ask'),bid:text('买单','Bid'),vendor:text('商人价','Vendor price')}[p?.source];
 return `<tr><td><input type="checkbox" data-price-select="${id}" aria-label="${esc(text('选择 ','Select ')+name+' · '+rarity()[t]+' +'+enhance)}" ${selected.has(id)?'checked':''}></td><td><strong>${esc(name)}·${rarity()[t]}${enhance?' +'+enhance:''}</strong><small>${id}</small></td><td><input type="number" min="0" max="${Number.MAX_SAFE_INTEGER}" step="any" data-price-value="${id}" aria-label="${esc(name+' '+text('单价','unit price'))}" value="${p?.price??''}" placeholder="${text('未定价','Unpriced')}"><small>${source??'—'}</small></td><td><input type="checkbox" data-price-lock="${id}" aria-label="${esc(text('锁定 ','Lock ')+name)}" ${p?.locked?'checked':''}></td><td>${quoteText(q?.ask)}</td><td>${quoteText(q?.bid)}</td></tr>`;
}
function render(){if(!dialog?.open||editing)return;
 const scroll=dialog.querySelector('.price-list')?.scrollTop??0,s=priceState(),rows=candidates();selected=new Set([...selected].filter(id=>rows.includes(id)));
 const saved=priceSaveError();
 dialog.innerHTML=`<div class="price-heading"><h2 id="item-prices-title">${text('物品价格','Item prices')}</h2><button id="price-close" class="secondary">${text('关闭','Close')}</button></div>
 <p class="micro">${text('全页面共用 · 单价为税前参考 · 空值为未定价 · 手动修改自动锁定 · 锁定价格将阻止导入覆盖。','Shared across pages · Prices are before-tax references · Blank means unpriced · Manual edits lock prices automatically · Locked prices prevent import overwrites.')}</p>
 <details class="price-import config-detail character-import" id="price-import-settings" ${render.importOpen?'open':''}><summary>${text('市场价格导入','Import market prices')}</summary>
 <div class="import-body">
 <div class="price-categories"><table><thead><tr><th>${text('分类','Category')}</th><th>${text('报价物品数','Quoted items')}</th><th>${text('价格选项','Price source')}</th></tr></thead><tbody>${marketFamilies.map(f=>{const count=Object.keys(s.quotes).filter(id=>itemFamily(Number(id))===f.key).length;return `<tr><td>${familyName(f)}</td><td>${count}</td><td><div class="price-options" role="radiogroup" aria-label="${esc(familyName(f)+' '+text('价格选项','price source'))}">${[['ask',text('卖单价','Ask')],['bid',text('买单价','Bid')],['bidVendor',text('买单价（商人价兜底）','Bid (vendor floor)')],['vendor',text('商人价','Vendor price')],['off',text('不导入','Skip')]].map(([value,label])=>`<label class="check"><input type="radio" name="price-category-${f.key}" data-price-category="${f.key}" value="${value}" ${s.preferences.categories[f.key]===value?'checked':''}>${label}</label>`).join('')}</div></td></tr>`;}).join('')}</tbody></table></div>

 </div></details>

${saved?`<p class="issue-box" role="alert">${esc((errors[saved]??[saved,saved])[language==='zh'?0:1])}</p>`:''}
 <div class="price-filters"><label>${text('分类','Category')}<select id="price-family">${opts([['all',text('全部','All')],...marketFamilies.map(f=>[f.key,familyName(f)])],family)}</select></label><label>${text('搜索','Search')}<input id="price-search" type="search" value="${esc(query)}" placeholder="${text('名称或物品编号','Name or item ID')}"></label><label>${text("稀有度",'Rarity')}<select id="price-tier">${opts([['all',text('全部','All')],...rarity().map((v,i)=>[i,v])],tier)}</select></label><label>${text('强化（0 为全部）','Enhancement (0 = all)')}<input id="price-plus" type="number" min="0" max="${game.maxEnhancement}" step="1" value="${plus}"></label><label>${text('状态','Status')}<select id="price-filter">${opts([['all',text('全部','All')],['priced',text('已定价','Priced')],['locked',text('已锁定','Locked')]],filter)}</select></label></div>
 <div class="price-actions"><label class="check"><input id="price-select-all" type="checkbox" ${!rows.length?'disabled':''} ${rows.length&&rows.every(id=>selected.has(id))?'checked':''}>${text('全选当前筛选结果','Select all filtered items')} (${rows.length})</label><span>${text('已选','Selected')} ${selected.size}</span><button id="price-bulk-lock" class="secondary" ${!selected.size?'disabled':''}>${text('批量锁定','Lock selected')}</button><button id="price-bulk-unlock" class="secondary" ${!selected.size?'disabled':''}>${text('批量解锁','Unlock selected')}</button><button id="price-clear" class="secondary" ${busy||!Object.values(s.prices).some(p=>!p.locked&&p.price!==null)?'disabled':''}>${text('清空价格','Clear prices')}</button><button id="price-import" class="secondary" ${busy||!Object.values(s.preferences.categories).some(v=>v!=='off')?'disabled':''}>${text('一键导入价格','Import prices')}</button><span id="price-status" class="micro import-status${statusError()?' price-market-warning':''}" role="${statusError()?'alert':'status'}">${esc(message())}</span></div>
 <div class="price-list table-scroll"><table><thead><tr>${['',text('物品','Item'),text('有效单价','Effective unit price'),text('锁定','Locked'),text('最低卖单价','Lowest ask'),text('最高买单价','Highest bid')].map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row).join(''):`<tr><td colspan="6" class="${hasFilters()?'':'price-filter-prompt'}">${hasFilters()?text('没有匹配物品','No matching items'):text('物品数量较多，请先设置筛选条件','Many items to display; set a filter first')}</td></tr>`}</tbody></table></div>`;
 dialog.querySelector('#price-close').onclick=()=>dialog.close();
 dialog.querySelector('#price-import-settings').ontoggle=e=>{render.importOpen=e.target.open;};
 dialog.querySelector('#price-import').onclick=()=>importPrices();
 for(const el of dialog.querySelectorAll('[data-price-category]'))el.onchange=()=>{if(!el.checked)return;const preferences=structuredClone(priceState().preferences);preferences.categories[el.dataset.priceCategory]=el.value;updatePrices({...priceState(),preferences});dialog.querySelector(`[data-price-category="${el.dataset.priceCategory}"]:checked`)?.focus();};
 const filters=[['price-family',v=>family=v],['price-search',v=>query=v],['price-tier',v=>tier=v],['price-plus',v=>plus=Math.min(game.maxEnhancement,Math.max(0,Math.floor(Number(v)||0)))],['price-filter',v=>filter=v]];
 for(const [id,assign]of filters){const el=dialog.querySelector('#'+id);el.onchange=()=>{assign(el.value);selected.clear();render();dialog.querySelector('#'+id)?.focus();};}
 for(const el of dialog.querySelectorAll('[data-price-select]'))el.onchange=()=>{const id=Number(el.dataset.priceSelect);el.checked?selected.add(id):selected.delete(id);render();};
 dialog.querySelector('#price-select-all').onchange=e=>{selected=e.target.checked?new Set(rows):new Set();render();};
 const lock=(ids,locked)=>{const result=lockItemPrices(priceState(),ids,locked);status={changed:result.changed,locked};updatePrices(result.state);};
 dialog.querySelector('#price-bulk-lock').onclick=()=>lock([...selected],true);dialog.querySelector('#price-bulk-unlock').onclick=()=>lock([...selected],false);
 dialog.querySelector('#price-clear').onclick=()=>{
  if(busy||!confirm(text('确定清空所有未锁定物品的价格吗？此操作不限当前筛选，已锁定价格将保留。','Clear prices for all unlocked items? This applies beyond the current filter. Locked prices will be kept.')))return;
  const result=clearUnlockedPrices(priceState());status={cleared:result.cleared};selected.clear();updatePrices(result.state);
 };
 for(const el of dialog.querySelectorAll('[data-price-lock]'))el.onchange=()=>lock([Number(el.dataset.priceLock)],el.checked);
 for(const el of dialog.querySelectorAll('[data-price-value]')){
  const edit=()=>{try{const value=el.value===''?null:el.valueAsNumber;if(el.validity.badInput)throw Error('invalidPrice');status=null;editing=true;const id=Number(el.dataset.priceValue);updatePrices(lockItemPrices(setItemPrice(priceState(),id,value),[id],true).state);dialog.querySelector(`[data-price-lock="${id}"]`).checked=true;el.removeAttribute('aria-invalid');el.nextElementSibling.textContent=text('手动','Manual');status=priceSaveError()?{error:priceSaveError()}:null;refreshStatus();}catch(error){el.setAttribute('aria-invalid','true');status={error:error.message};refreshStatus();}finally{editing=false;}};
  el.oninput=edit;el.onchange=edit;
 }
 dialog.querySelector('.price-list').scrollTop=scroll;
}
render.importOpen=true;
async function importPrices(){if(busy)return;const preferences=structuredClone(priceState().preferences);busy=true;render();
 try{const response=await requestMarket();if(!response.snapshot)throw Error('noMarketData');const parsed=validateMarketSnapshot(response.snapshot);if(!Object.keys(parsed.quotes).length){if(parsed.invalid)throw Error('invalidMarketData');throw Error('noMarketData');}
  const latest=Math.max(0,...Object.values(priceState().quotes).flatMap(q=>Object.values(q).map(side=>side.capturedAt)));
  const incoming=Math.max(...Object.values(parsed.quotes).flatMap(q=>Object.values(q).map(side=>side.capturedAt)));
  if(incoming<latest)throw Error('marketStale');
  marketError=null;
  const result=importItemPrices(priceState(),response.snapshot,preferences);status={stats:result.stats};updatePrices({...result.state,quotes:parsed.quotes});
 }catch(error){marketError=error.message;status=null;}finally{busy=false;render();}
}
export function mountItemPrices(nextLanguage){language=nextLanguage;
 if(!dialog){dialog=document.createElement('dialog');dialog.id='item-prices-dialog';dialog.className='item-prices-dialog';dialog.setAttribute('aria-labelledby','item-prices-title');document.body.append(dialog);dialog.addEventListener('close',()=>{document.getElementById('item-prices-open')?.focus();});
  let outsidePointer=false;
  const outside=event=>{const rect=dialog.getBoundingClientRect();return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;};
  dialog.addEventListener('pointerdown',event=>{outsidePointer=event.target===dialog&&outside(event);});
  dialog.addEventListener('click',event=>{if(outsidePointer&&event.target===dialog&&outside(event))dialog.close();outsidePointer=false;});
  subscribePrices(render);}
 const button=document.getElementById('item-prices-open');if(button)button.onclick=()=>{dialog.showModal();render();};render();
}
