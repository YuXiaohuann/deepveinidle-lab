import * as game from './upstream.js';
import {translatedName} from './i18n.js';
import {marketFamilies,validItemId,itemFamily,setItemPrice,lockItemPrices,clearUnlockedPrices,importItemPrices,validateMarketSnapshot,mergeQuotes} from './item-prices.js';
import {priceState,priceSaveError,updatePrices,subscribePrices} from './item-price-store.js';
import {requestMarket} from './market-import.js';

let editing=false,openRead=0;
let language='zh',dialog,selected=new Set(),busy=false,status=null,marketError=null,query='',family='all',tier='all',plus=0,filter='all';
const labels={ore:'矿石',bars:'金属锭',fish:'鱼',wood:'木材',food:'食物',crops:'作物',potions:'药水',weapons:'武器',armour:'护甲',jewellery:'饰品',tools:'工具',mounts:'坐骑',materials:'材料',valuables:'贵重品',gems:'宝石'};
const text=(zh,en)=>language==='zh'?zh:en;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rarity=()=>text(['普通','罕见','稀有','史诗','传说'],['Normal','Uncommon','Rare','Epic','Legendary']);
const familyName=f=>text(labels[f.key],f.label);
const opts=(arr,value)=>arr.map(([v,label])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
const number=v=>v.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:6});
const date=v=>new Date(v).toLocaleString(language==='zh'?'zh-CN':'en');
const errors={marketMissing:['未连接市场脚本，请安装或更新至 2.5.0 后刷新游戏和实验室。','Market script not connected. Install / update to 2.5.0 and refresh the game and lab.'],marketOutdated:['市场脚本版本不兼容，请更新脚本并刷新。','Market script is outdated. Update and refresh.'],marketCaptureFailed:['市场数据读取失败，请检查脚本管理器。','Could not read market data. Check the userscript manager.'],marketSaveFailed:['市场报价保存失败，请检查脚本管理器。','Market quotes could not be saved. Check the userscript manager.'],invalidMarketData:['市场数据不兼容，已有价格保留。','Incompatible market data; existing prices were kept.'],noMarketData:['未读取市场报价，请在游戏中打开市场，再重新打开价格窗口。','Market quotes have not been captured. Open the market in the game, then reopen the price window.'],invalidPrice:['单价必须为空或范围内的非负数值。','Unit prices must be blank or finite nonnegative numbers within range.'],invalidPriceStorage:['已保存价格格式无效，当前使用空价格表；未自动覆盖原存档。','Saved prices are invalid. An empty table is shown; the saved data has not been overwritten.'],priceReadFailed:['价格存储读取失败，当前设置未恢复。','Could not read saved prices.'],priceSaveFailed:['价格未保存：浏览器存储不可用，当前内存设置仍有效。','Prices were not saved. Browser storage is unavailable; current in-memory settings still apply.']};
function message(){
 if(busy)return text('正在读取市场报价…','Reading market quotes…');
 if(status?.error)return (errors[status.error]??[status.error,status.error])[language==='zh'?0:1];
 if(status?.stats){const s=status.stats;return text(`更新 ${s.updated}（商人价 ${s.vendor}） · 锁定跳过 ${s.locked} · 缺报价 ${s.missing} · 无法兜底 ${s.unavailable} · 过旧 ${s.stale} · 异常 ${s.invalid}`,`Updated ${s.updated} (vendor price ${s.vendor}) · Locked ${s.locked} · Missing ${s.missing} · No fallback ${s.unavailable} · Stale ${s.stale} · Invalid ${s.invalid}`);}
 if(status?.cleared!==undefined)return text(`已清空 ${status.cleared} 件未锁定物品的价格`,`Cleared prices for ${status.cleared} unlocked items`);
 if(status?.changed!==undefined)return text(`已${status.locked?'锁定':'解锁'} ${status.changed} 件物品`,`${status.locked?'Locked':'Unlocked'} ${status.changed} items`);
 if(status?.loaded)return text(`报价已读取 · 异常或未适配条目 ${status.invalid}；未自动导入。`,`Quotes read · ${status.invalid} invalid or unsupported entries; prices have not been imported.`);
 return '';
}
function candidates(){
 const s=priceState(),ids=new Set(game.items.filter(i=>i.id===game.baseItemId(i.id)&&itemFamily(i.id)&&game.canSell(i.id)).map(i=>i.id));
 for(const key of [...Object.keys(s.prices),...Object.keys(s.quotes)])ids.add(Number(key));
 for(const id of [...ids]){
  const base=game.baseItemId(id);for(const t of tier==='all'?[0,1,2,3,4]:[Number(tier)]){
   const encoded=game.encode(game.withRarity(base,t),plus);if(validItemId(encoded)&&(!plus||game.canEnhance(encoded)))ids.add(encoded);
  }
 }
 return [...ids].filter(id=>{
  const base=game.item(game.baseItemId(id)),p=s.prices[id],q=query.trim().toLowerCase();
  return (family==='all'||itemFamily(id)===family)&&(tier==='all'||game.itemTier(id)===Number(tier))&&(!plus||Math.floor(id/game.encode(0,1))===plus)&&(!q||`${base.name} ${translatedName(base.name,'zh')} ${id}`.toLowerCase().includes(q))&&(filter==='all'||filter==='priced'&&p?.price!==null&&p?.price!==undefined||filter==='unpriced'&&p?.price==null||filter==='locked'&&p?.locked||filter==='unlocked'&&!p?.locked);
 }).sort((a,b)=>game.baseItemId(a)-game.baseItemId(b)||a-b);
}
const quoteText=q=>!q?text('未捕获','Not captured'):`${q.invalid?text('异常','Invalid'):q.value===null?text('无报价','No quote'):number(q.value)}`;
function row(id){const s=priceState(),p=s.prices[id],q=s.quotes[id],base=game.item(game.baseItemId(id)),name=translatedName(base.name,language),t=game.itemTier(id),enhance=Math.floor(id/game.encode(0,1));
 const source={manual:text('手动','Manual'),ask:text('卖单','Ask'),bid:text('买单','Bid'),vendor:text('商人价','Vendor price')}[p?.source];
 return `<tr><td><input type="checkbox" data-price-select="${id}" aria-label="${esc(text('选择 ','Select ')+name+' · '+rarity()[t]+' +'+enhance)}" ${selected.has(id)?'checked':''}></td><td><strong>${esc(name)}·${rarity()[t]}${enhance?' +'+enhance:''}</strong><small>${id}</small></td><td><input type="number" min="0" max="${Number.MAX_SAFE_INTEGER}" step="any" data-price-value="${id}" aria-label="${esc(name+' '+text('单价','unit price'))}" value="${p?.price??''}" placeholder="${text('未定价','Unpriced')}"><small>${source??'—'}</small></td><td><input type="checkbox" data-price-lock="${id}" aria-label="${esc(text('锁定 ','Lock ')+name)}" ${p?.locked?'checked':''}></td><td>${quoteText(q?.ask)}</td><td>${quoteText(q?.bid)}</td></tr>`;
}
function render(){if(!dialog?.open||editing)return;
 const scroll=dialog.querySelector('.price-list')?.scrollTop??0,s=priceState(),rows=candidates();selected=new Set([...selected].filter(id=>rows.includes(id)));
 const saved=priceSaveError(),times=Object.values(s.quotes).flatMap(q=>Object.values(q).map(side=>side.capturedAt)),latest=times.length?Math.max(...times):null;
 dialog.innerHTML=`<div class="price-heading"><h2 id="item-prices-title">${text('物品价格','Item prices')}</h2><button id="price-close" class="secondary">${text('关闭','Close')}</button></div>
 <p class="micro">${text('全页面共用 · 单价为税前参考 · 空值为未定价 · 手动修改自动锁定 · 锁定价格将阻止导入覆盖。','Shared across pages · Prices are before-tax references · Blank means unpriced · Manual edits lock prices automatically · Locked prices prevent import overwrites.')}</p>
 <details class="price-import config-detail character-import" id="price-import-settings" ${render.importOpen?'open':''}><summary>${text('市场价格导入','Import market prices')}</summary>
 <div class="import-body"><div class="price-actions import-actions"><a class="secondary" href="/src/character-import.user.js" target="_blank" rel="noopener">${text('安装 / 更新 userscript','Install / update userscript')} ↗</a><button id="price-import" class="secondary" ${busy||!Object.values(s.preferences.categories).some(v=>v!=='off')?'disabled':''}>${text('一键导入价格','Import prices')}</button></div>
 <p id="price-market-status" class="micro${marketError?' price-market-warning':''}" role="${marketError?'alert':'status'}">${busy?text('正在读取市场报价…','Reading market quotes…'):marketError?esc((errors[marketError]??[marketError,marketError])[language==='zh'?0:1]):`${text('已捕获','Captured')} ${Object.keys(s.quotes).length} ${text('个物品变体','item variants')}${latest?' · '+text('最近报价：','Latest quote: ')+date(latest)+' · '+text('距今 ','Age ')+Math.max(0,Math.floor((Date.now()-latest)/60000))+text(' 分钟',' min'):''}`}</p>
 <p id="price-status" class="micro import-status" role="status">${esc(message())}</p>
 <div class="price-categories"><table><thead><tr><th>${text('分类','Category')}</th><th>${text('捕获数量','Captured items')}</th><th>${text('价格选项','Price source')}</th></tr></thead><tbody>${marketFamilies.map(f=>{const count=Object.keys(s.quotes).filter(id=>itemFamily(Number(id))===f.key).length;return `<tr><td>${familyName(f)}</td><td>${count}</td><td><div class="price-options" role="radiogroup" aria-label="${esc(familyName(f)+' '+text('价格选项','price source'))}">${[['ask',text('卖单价','Ask')],['bid',text('买单价','Bid')],['bidVendor',text('买单价（商人价兜底）','Bid (vendor floor)')],['vendor',text('商人价','Vendor price')],['off',text('不导入','Skip')]].map(([value,label])=>`<label class="check"><input type="radio" name="price-category-${f.key}" data-price-category="${f.key}" value="${value}" ${s.preferences.categories[f.key]===value?'checked':''}>${label}</label>`).join('')}</div></td></tr>`;}).join('')}</tbody></table></div>

 </div></details>

${saved?`<p class="issue-box" role="alert">${esc((errors[saved]??[saved,saved])[language==='zh'?0:1])}</p>`:''}
 <div class="price-filters"><label>${text('分类','Category')}<select id="price-family">${opts([['all',text('全部','All')],...marketFamilies.map(f=>[f.key,familyName(f)])],family)}</select></label><label>${text('搜索','Search')}<input id="price-search" type="search" value="${esc(query)}" placeholder="${text('名称或物品编号','Name or item ID')}"></label><label>${text("稀有度",'Rarity')}<select id="price-tier">${opts([['all',text('全部','All')],...rarity().map((v,i)=>[i,v])],tier)}</select></label><label>${text('强化（0 为全部）','Enhancement (0 = all)')}<input id="price-plus" type="number" min="0" max="${game.maxEnhancement}" step="1" value="${plus}"></label><label>${text('状态','Status')}<select id="price-filter">${opts([['all',text('全部','All')],['priced',text('已定价','Priced')],['unpriced',text('未定价','Unpriced')],['locked',text('已锁定','Locked')],['unlocked',text('未锁定','Unlocked')]],filter)}</select></label></div>
 <div class="price-actions"><label class="check"><input id="price-select-all" type="checkbox" ${rows.length&&rows.every(id=>selected.has(id))?'checked':''}>${text('全选当前筛选结果','Select all filtered items')} (${rows.length})</label><span>${text('已选','Selected')} ${selected.size}</span><button id="price-bulk-lock" class="secondary" ${!selected.size?'disabled':''}>${text('批量锁定','Lock selected')}</button><button id="price-bulk-unlock" class="secondary" ${!selected.size?'disabled':''}>${text('批量解锁','Unlock selected')}</button><button id="price-clear" class="secondary" ${busy||!Object.values(s.prices).some(p=>!p.locked&&p.price!==null)?'disabled':''}>${text('清空价格','Clear prices')}</button></div>
 <div class="price-list table-scroll"><table><thead><tr>${['',text('物品','Item'),text('有效单价','Effective unit price'),text('锁定','Locked'),text('最低卖单价','Lowest ask'),text('最高买单价','Highest bid')].map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row).join(''):`<tr><td colspan="6">${text('没有匹配物品','No matching items')}</td></tr>`}</tbody></table></div>`;
 dialog.querySelector('#price-close').onclick=()=>dialog.close();
 dialog.querySelector('#price-import-settings').ontoggle=e=>{render.importOpen=e.target.open;};
 dialog.querySelector('#price-import').onclick=()=>read(true);
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
  const edit=()=>{try{const value=el.value===''?null:el.valueAsNumber;if(el.validity.badInput)throw Error('invalidPrice');status=null;editing=true;const id=Number(el.dataset.priceValue);updatePrices(lockItemPrices(setItemPrice(priceState(),id,value),[id],true).state);dialog.querySelector(`[data-price-lock="${id}"]`).checked=true;el.removeAttribute('aria-invalid');el.nextElementSibling.textContent=text('手动','Manual');dialog.querySelector('#price-status').textContent=priceSaveError()?(errors[priceSaveError()]??[priceSaveError(),priceSaveError()])[language==='zh'?0:1]:'';}catch(error){el.setAttribute('aria-invalid','true');dialog.querySelector('#price-status').textContent=(errors[error.message]??[error.message,error.message])[language==='zh'?0:1];}finally{editing=false;}};
  el.oninput=edit;el.onchange=edit;
 }
 dialog.querySelector('.price-list').scrollTop=scroll;
}
render.importOpen=true;
async function read(apply){if(busy)return;const preferences=structuredClone(priceState().preferences);busy=true;render();
 try{const response=await requestMarket('read');if(!response.snapshot)throw Error('noMarketData');const parsed=validateMarketSnapshot(response.snapshot);if(!Object.keys(parsed.quotes).length){if(parsed.invalid)throw Error('invalidMarketData');throw Error('noMarketData');}
  marketError=null;
  if(apply){const result=importItemPrices(priceState(),response.snapshot,preferences);status={stats:result.stats};updatePrices(result.state);}else{status={loaded:true,invalid:parsed.invalid};updatePrices({...priceState(),quotes:mergeQuotes(priceState().quotes,parsed.quotes)});}
 }catch(error){marketError=error.message;status=null;}finally{busy=false;render();}
}
export function mountItemPrices(nextLanguage){language=nextLanguage;
 if(!dialog){dialog=document.createElement('dialog');dialog.id='item-prices-dialog';dialog.className='item-prices-dialog';dialog.setAttribute('aria-labelledby','item-prices-title');document.body.append(dialog);dialog.addEventListener('close',()=>{openRead++;document.getElementById('item-prices-open')?.focus();});
  let outsidePointer=false;
  const outside=event=>{const rect=dialog.getBoundingClientRect();return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;};
  dialog.addEventListener('pointerdown',event=>{outsidePointer=event.target===dialog&&outside(event);});
  dialog.addEventListener('click',event=>{if(outsidePointer&&event.target===dialog&&outside(event))dialog.close();outsidePointer=false;});
  subscribePrices(render);}
 const button=document.getElementById('item-prices-open');if(button)button.onclick=()=>{dialog.showModal();render();const attempt=++openRead;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(dialog.open&&attempt===openRead)read(false);}));};render();
}
