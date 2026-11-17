import {createCharacterUpdater} from './character-auto-import.js';
const pending=new Map();let counter=0;
function receiveCharacter(event){
 if(typeof event.detail!=='string')return;
 let data;try{data=JSON.parse(event.detail);}catch{return;}
 if(data?.source!=='dvi-character-script')return;
 const entry=pending.get(data.id);if(!entry)return;
 if(data.version!=='2.4'){entry.outdated=true;return;}
 pending.delete(data.id);clearTimeout(entry.timeout);clearInterval(entry.retry);
 if(data.error)entry.reject(new Error('scriptReadFailed'));else entry.resolve(data);
}
document.addEventListener('dvi-character-response',receiveCharacter);
export function requestCharacter(action){return new Promise((resolve,reject)=>{
 const id=`${Date.now()}-${++counter}`,detail=JSON.stringify({source:'dvi-simulator',action,id});
 const send=()=>document.dispatchEvent(new CustomEvent('dvi-character-request',{detail}));
 const retry=setInterval(send,250);
 const entry={resolve,reject};
 const timeout=setTimeout(()=>{pending.delete(id);clearInterval(retry);reject(new Error(entry.outdated?'scriptOutdated':'scriptMissing'));},4000);
 Object.assign(entry,{timeout,retry});pending.set(id,entry);send();
});}
export function characterImportPanel(language,{id,statusId,buttons,extra=''}){
 const zh=language==='zh',page=panelPages[id];
 return `<details class="config-detail character-import" id="${id}" open><summary>${zh?'导入游戏角色':'Import game character'}</summary><div class="import-body"><div class="import-actions"><a class="secondary" href="/src/character-import.user.js" target="_blank" rel="noopener">${zh?'安装 / 更新 userscript':'Install / update userscript'} ↗</a></div><div class="import-actions">${buttons.map(button=>`<button id="${button.id}" class="secondary">${button.label}</button>`).join('')}</div>${extra}${page?characterUpdateOptions(page,language):''}<p class="micro import-status" id="${statusId}" role="status"></p></div></details>`;
}
export function importControls(language){
 const zh=language==='zh';
 return characterImportPanel(language,{id:'character-import-settings',statusId:'import-status',buttons:[{id:'import-character',label:zh?'导入配置':'Import configuration'}]});
}

const importErrors={savedGatheringInvalid:['已保存的采集配置无法读取，当前使用默认配置。','Saved gathering settings could not be read; defaults are shown.'],savedInvalid:['已保存的强化配置无法读取，当前使用默认配置。','Saved enhancement settings could not be read; defaults are shown.'],scriptOutdated:['请更新至 2.4 脚本并刷新游戏。','Update to script 2.4 and refresh the game.'],incompleteSnapshot:['角色数据不完整或缺少必要字段，请更新脚本、刷新游戏并重新读取。','Character data is incomplete or missing required fields. Update the script, refresh the game and recapture.'],scriptMissing:['未连接到脚本，请安装或更新至最新版本，确认此网址已启用脚本后刷新模拟器。','Script not connected. Install or update it, enable it on this URL, then refresh the simulator.'],scriptReadFailed:['脚本存储读取失败，请检查脚本管理器。','Script storage could not be read. Check your userscript manager.'],noSnapshot:['没有角色数据，请安装脚本后刷新游戏并等待“角色配置已读取”。','No character data. Refresh the game after installing the script and wait for “Character captured”.'],invalidSnapshot:['角色数据格式不兼容，已有配置保留。','Incompatible character data; existing configuration was kept.']};
let connectionProbe;
export function probeCharacter(){return connectionProbe??=requestCharacter('probe');}
export function importStatusText(language,status,busy=false){
 const zh=language==='zh';
 if(busy)return zh?'正在读取角色配置…':'Reading character configuration…';
 if(!status)return '';
 if(status.error)return (importErrors[status.error]??[status.error,status.error])[zh?0:1];
 if(status.ready)return zh?'脚本已连接；可读取最近游戏角色数据。':'Script connected; ready to read the latest game character.';
 const label=zh?'已导入 · 读取时间：':'Imported · Captured: ';
 return label+new Date(status.capturedAt).toLocaleString(zh?'zh-CN':'en');
}

const panelPages={'character-import-settings':'combat','gather-import-settings':'gather','craft-import-settings':'craft','enhance-import-settings':'enhance','mastery-import-settings':'mastery'};
const updaters=new Map(),drafts=new Set();let activeImportPage=null;
function settingsText(language,error){return error?(language==='zh'?(error==='load'?'自动更新设置无法读取，已停止自动更新。':'自动更新设置保存失败。'):(error==='load'?'Auto-update settings could not be read; automatic updates are disabled.':'Auto-update settings could not be saved.')):'';}
export function registerCharacterUpdates(page,adapter){
 const {hasDraft=()=>false,...callbacks}=adapter;
 const updater=createCharacterUpdater({
  storage:{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},
  page,read:()=>requestCharacter('read'),...callbacks,
  apply:async(snapshot,flags)=>{await callbacks.apply(snapshot,flags);if(flags.config)drafts.delete(page);},
  hasDraft:()=>drafts.has(page)||hasDraft()||Boolean(document.getElementById(`${page}-section`)?.querySelector('input:invalid,select:invalid,[aria-invalid=true]')),
  onSettings:()=>updateCharacterOptions(page),
 });
 updaters.set(page,updater);return updater;
}
export function setCharacterImportPage(page){
 activeImportPage=page;for(const [id,updater]of updaters)updater.setActive(id===page);
}
function characterUpdateOptions(page,language){
 const updater=updaters.get(page);if(!updater)return '';
 const flags=updater.options,kinds=['config'];
 const options=kinds.map(kind=>`<label class="check"><input type="checkbox" data-character-update="${kind}" data-character-page="${page}" ${flags[kind]?'checked':''}><span>${language==='zh'?'自动更新角色配置':'Automatically update character configuration'}</span></label>`).join('');
 return `<div class="character-update-options">${options}</div><p class="micro import-status" data-character-settings-status="${page}" data-language="${language}" role="status">${settingsText(language,updater.settingsError)}</p>`;
}
function updateCharacterOptions(page){
 const updater=updaters.get(page);
 document.querySelectorAll(`[data-character-settings-status="${page}"]`).forEach(el=>el.textContent=settingsText(el.dataset.language,updater.settingsError));
}
function belongsToImportPage(event){return event.composedPath().some(el=>el.id===`${activeImportPage}-section`);}
document.addEventListener('change',event=>{
 const el=event.target;if(el.dataset?.characterUpdate){const updater=updaters.get(el.dataset.characterPage);updater?.configure({[el.dataset.characterUpdate]:el.checked});return;}
 if(activeImportPage&&belongsToImportPage(event)){if(event.target.validity?.valid!==false)drafts.delete(activeImportPage);updaters.get(activeImportPage)?.invalidate();}
});
document.addEventListener('input',event=>{
 if(!activeImportPage||event.target.dataset?.characterUpdate)return;
 const section=document.getElementById(`${activeImportPage}-section`);
 if(section?.contains(event.target)){drafts.add(activeImportPage);updaters.get(activeImportPage)?.invalidate();}
});
globalThis.addEventListener?.('focus',()=>updaters.get(activeImportPage)?.trigger());

document.addEventListener('click',event=>{
 const id=event.target.closest?.('button')?.id??'';
 if(belongsToImportPage(event)&&/reset|zero-ranks|revert/.test(id)){drafts.delete(activeImportPage);updaters.get(activeImportPage)?.invalidate();}
});
