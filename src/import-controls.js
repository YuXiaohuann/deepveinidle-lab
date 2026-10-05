import {importTypes} from './character-import.js';
const pending=new Map();let counter=0;
document.addEventListener('dvi-character-response',event=>{
 if(typeof event.detail!=='string')return;
 let data;try{data=JSON.parse(event.detail);}catch{return;}
 if(data?.source!=='dvi-character-script')return;
 const entry=pending.get(data.id);if(!entry)return;
 pending.delete(data.id);clearTimeout(entry.timeout);clearInterval(entry.retry);
 if(data.error)entry.reject(new Error('scriptReadFailed'));else entry.resolve(data);
});
export function requestCharacter(action){return new Promise((resolve,reject)=>{
 const id=`${Date.now()}-${++counter}`,detail=JSON.stringify({source:'dvi-simulator',action,id});
 const send=()=>document.dispatchEvent(new CustomEvent('dvi-character-request',{detail}));
 const retry=setInterval(send,250);
 const timeout=setTimeout(()=>{pending.delete(id);clearInterval(retry);reject(new Error('scriptMissing'));},4000);
 pending.set(id,{resolve,reject,timeout,retry});send();
});}
export function importControls(selected,language,esc){
 const zh=language==='zh';
 return `<details class="config-detail character-import" id="character-import-settings"><summary>${zh?'导入游戏角色':'Import game character'}</summary><div class="import-body"><p class="micro">${zh?'安装脚本后刷新游戏，读取最近角色快照，再在此导入。只覆盖勾选类型，缺失字段保留原值。':'Install the script, refresh the game to capture a character snapshot, then import here. Only selected categories are updated; missing fields keep their current values.'}</p><a class="text-button" href="/src/character-import.user.js" target="_blank" rel="noopener">${zh?'安装 userscript':'Install userscript'} ↗</a><div class="import-types">${importTypes.map(([id,a,b])=>`<label class="check"><input type="checkbox" data-import-type="${id}" ${selected.includes(id)?'checked':''}>${esc(zh?a:b)}</label>`).join('')}</div><button id="import-character" class="secondary">${zh?'一键导入':'Import character'}</button><p class="micro" id="import-status" role="status"></p><p class="micro">${zh?'导入后仍按级内经验 0、食物充足、永久增益及固定随机参数模拟。':'Imported builds still use zero within-level XP, plentiful food, permanent buffs and fixed random parameters.'}</p></div></details>`;
}
