const pending=new Map();let counter=0;
document.addEventListener('dvi-character-response',event=>{
 if(typeof event.detail!=='string')return;
 let data;try{data=JSON.parse(event.detail);}catch{return;}
 if(data?.source!=='dvi-character-script')return;
 const entry=pending.get(data.id);if(!entry)return;
 if(data.version!=='2.2'){entry.outdated=true;return;}
 pending.delete(data.id);clearTimeout(entry.timeout);clearInterval(entry.retry);
 if(data.error)entry.reject(new Error('scriptReadFailed'));else entry.resolve(data);
});
export function requestCharacter(action){return new Promise((resolve,reject)=>{
 const id=`${Date.now()}-${++counter}`,detail=JSON.stringify({source:'dvi-simulator',action,id});
 const send=()=>document.dispatchEvent(new CustomEvent('dvi-character-request',{detail}));
 const retry=setInterval(send,250);
 const entry={resolve,reject};
 const timeout=setTimeout(()=>{pending.delete(id);clearInterval(retry);reject(new Error(entry.outdated?'scriptOutdated':'scriptMissing'));},4000);
 Object.assign(entry,{timeout,retry});pending.set(id,entry);send();
});}
function characterImportHint(language){return language==='zh'?'更新脚本后刷新游戏，等待读取角色数据后导入配置。':'Update the script, refresh the game and wait for character data before importing configuration.';}
export function characterImportPanel(language,{id,statusId,buttons,description=''}){
 const zh=language==='zh';
 return `<details class="config-detail character-import" id="${id}"><summary>${zh?'导入游戏角色':'Import game character'}</summary><div class="import-body"><p class="micro">${characterImportHint(language)}</p><a class="text-button" href="/src/character-import.user.js" target="_blank" rel="noopener">${zh?'安装 / 更新 userscript':'Install / update userscript'} ↗</a><div class="import-actions">${buttons.map(button=>`<button id="${button.id}" class="secondary">${button.label}</button>`).join('')}</div><p class="micro import-status" id="${statusId}" role="status"></p>${description}</div></details>`;
}
export function importControls(language){
 const zh=language==='zh';
 return characterImportPanel(language,{id:'character-import-settings',statusId:'import-status',buttons:[{id:'import-character',label:zh?'导入配置':'Import configuration'},{id:'import-snapshot',label:zh?'导入快照':'Import snapshot'}],description:`<p class="micro"><strong>${zh?'导入配置：':'Import configuration: '}</strong>${zh?'转换为手动配置，自动保存，可继续修改。模拟时技能级内经验从 0 开始，所选食物供应充足，手动启用的增益永久生效。':'Converts the character into an editable, automatically saved build. Simulation starts with zero within-level XP, plentiful selected food and permanent manually enabled buffs.'}</p><p class="micro"><strong>${zh?'导入快照：':'Import snapshot: '}</strong>${zh?'先在游戏打开战斗预测列表以捕获完整快照。使用游戏内置预测的完整角色输入，保留精确经验、真实库存及增益期限。仅当前页面生效，刷新后丢失。下方是只读配置预览，并非完整快照；部分无法映射的显示值可能沿用原配置，实际计算仍使用完整快照。':'Open the game combat predictions first to capture a complete snapshot. Uses the complete character input from the in-game predictor, preserving exact XP, actual inventories and buff expiry. Lasts only until refresh. Settings below are a read-only preview, not the full snapshot; unmapped display values may retain previous settings, while calculations use the complete snapshot.'}</p>`});
}

const importErrors={savedInvalid:['已保存的强化配置无法读取，当前使用默认配置。','Saved enhancement settings could not be read; defaults are shown.'],incompatibleClient:['未适配游戏版本，请更新导入脚本和模拟器后刷新游戏。','Unsupported game version. Update the import script and simulator, then refresh the game.'],scriptOutdated:['请更新至 2.2 脚本并刷新游戏。','Update to script 2.2 and refresh the game.'],predictionMissing:['尚未捕获内置预测输入，请打开游戏战斗预测列表后重试。','No predictor input captured. Open the game combat predictions and retry.'],incompleteSnapshot:['角色数据不完整或缺少必要字段，请更新脚本、刷新游戏并重新读取。','Character data is incomplete or missing required fields. Update the script, refresh the game and recapture.'],scriptMissing:['未连接到脚本，请安装或更新至最新版本，确认此网址已启用脚本后刷新模拟器。','Script not connected. Install or update it, enable it on this URL, then refresh the simulator.'],scriptReadFailed:['脚本存储读取失败，请检查脚本管理器。','Script storage could not be read. Check your userscript manager.'],noSnapshot:['没有角色数据，请安装脚本后刷新游戏并等待“角色配置已读取”。','No character data. Refresh the game after installing the script and wait for “Character captured”.'],invalidSnapshot:['角色数据格式不兼容，已有配置保留。','Incompatible character data; existing configuration was kept.']};
let connectionProbe;
export function probeCharacter(){return connectionProbe??=requestCharacter('probe');}
export function importStatusText(language,status,busy=false){
 const zh=language==='zh';
 if(busy)return zh?'正在读取角色配置…':'Reading character configuration…';
 if(!status)return '';
 if(status.error)return (importErrors[status.error]??[status.error,status.error])[zh?0:1];
 if(status.ready)return zh?'脚本已连接；可读取最近游戏角色数据。':'Script connected; ready to read the latest game character.';
 const label=status.snapshot?(zh?'临时快照，刷新后丢失 · 捕获时间：':'Temporary snapshot; lost on refresh · Captured: '):(zh?'已导入 · 读取时间：':'Imported · Captured: ');
 return label+new Date(status.capturedAt).toLocaleString(zh?'zh-CN':'en');
}
