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
 const zh=language==='zh';
 return `<details class="config-detail character-import" id="${id}" open><summary>${zh?'导入游戏角色':'Import game character'}</summary><div class="import-body"><div class="import-actions"><a class="secondary" href="/src/character-import.user.js" target="_blank" rel="noopener">${zh?'安装 / 更新 userscript':'Install / update userscript'} ↗</a></div><div class="import-actions">${buttons.map(button=>`<button id="${button.id}" class="secondary">${button.label}</button>`).join('')}</div>${extra}<p class="micro import-status" id="${statusId}" role="status"></p></div></details>`;
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
