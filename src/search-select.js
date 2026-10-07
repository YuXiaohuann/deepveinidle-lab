const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function filterSearchOptions(options,query){const term=query.trim().toLocaleLowerCase();return options.filter(option=>(option.search??option.label).toLocaleLowerCase().includes(term));}
export function searchSelectMarkup(id,label){return `<div class="search-select"><label for="${id}">${escapeHtml(label)}</label><input id="${id}" type="text" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list"><div id="${id}-list" class="search-select-list" role="listbox" aria-label="${escapeHtml(label)}" hidden></div><span id="${id}-status" class="micro" role="status"></span></div>`;}
export function bindSearchSelect({id,options,value,onSelect,emptyText,countText,selectedLabel:labelForValue}){
 const input=document.getElementById(id),list=document.getElementById(`${id}-list`),status=document.getElementById(`${id}-status`);
 let matches=[],active=-1,opened=false;
 const selectedLabel=()=>labelForValue?labelForValue(value):options.find(x=>x.value===value)?.label??'';
 const close=()=>{opened=false;list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');input.value=selectedLabel();status.textContent='';};
 const paint=()=>{list.innerHTML=matches.map((x,i)=>`<div id="${id}-option-${i}" role="option" aria-selected="${i===active}" data-search-index="${i}" class="search-select-option${i===active?' active':''}">${escapeHtml(x.label)}</div>`).join('');status.textContent=matches.length?countText(matches.length):emptyText;if(active>=0){input.setAttribute('aria-activedescendant',`${id}-option-${active}`);document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');};
 const open=query=>{opened=true;matches=filterSearchOptions(options,query);active=-1;list.hidden=false;input.setAttribute('aria-expanded','true');paint();};
 const choose=index=>{const option=matches[index];if(!option)return;value=option.value;close();onSelect(value);};
 input.value=selectedLabel();input.onfocus=()=>{input.value='';open('');};input.onclick=()=>{if(!opened){input.value='';open('');}};input.oninput=()=>open(input.value);
 input.onkeydown=event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!opened)open('');if(matches.length){active=active<0?(event.key==='ArrowDown'?0:matches.length-1):(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;paint();}}else if(event.key==='Enter'&&opened){event.preventDefault();if(active>=0)choose(active);else if(matches.length===1)choose(0);}else if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab')close();};
 input.onblur=close;list.onmousedown=event=>event.preventDefault();list.onclick=event=>{const row=event.target.closest('[data-search-index]');if(row)choose(Number(row.dataset.searchIndex));};
 return {setOptions(next){options=next;close();},setValue(next){value=next;close();}};
}
