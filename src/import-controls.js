const pending=new Map();let counter=0;
document.addEventListener('dvi-character-response',event=>{
 if(typeof event.detail!=='string')return;
 let data;try{data=JSON.parse(event.detail);}catch{return;}
 if(data?.source!=='dvi-character-script')return;
 const entry=pending.get(data.id);if(!entry)return;
 if(data.version!=='2.0'){entry.outdated=true;return;}
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
export function importControls(language){
 const zh=language==='zh';
 return `<details class="config-detail character-import" id="character-import-settings"><summary>${zh?'导入游戏角色':'Import game character'}</summary><div class="import-body"><p class="micro">${zh?'更新脚本后刷新游戏，打开战斗预测列表以捕获完整快照。':'Update the script, refresh the game and open combat predictions to capture a complete snapshot.'}</p><a class="text-button" href="/src/character-import.user.js" target="_blank" rel="noopener">${zh?'安装 / 更新 userscript':'Install / update userscript'} ↗</a><div class="import-actions"><button id="import-character" class="secondary">${zh?'导入配置':'Import configuration'}</button><button id="import-snapshot" class="secondary">${zh?'导入快照':'Import snapshot'}</button></div><p class="micro" id="import-status" role="status"></p><p class="micro"><strong>${zh?'导入配置：':'Import configuration: '}</strong>${zh?'转换为手动配置，自动保存，可继续修改。模拟时技能级内经验从 0 开始，所选食物供应充足，手动启用的增益永久生效。':'Converts the character into an editable, automatically saved build. Simulation starts with zero within-level XP, plentiful selected food and permanent manually enabled buffs.'}</p><p class="micro"><strong>${zh?'导入快照：':'Import snapshot: '}</strong>${zh?'使用游戏内置预测的完整角色输入，保留精确经验、真实库存及增益期限。仅当前页面生效，刷新后丢失。下方是只读配置预览，并非完整快照；部分无法映射的显示值可能沿用原配置，实际计算仍使用完整快照。':'Uses the complete character input from the in-game predictor, preserving exact XP, actual inventories and buff expiry. Lasts only until refresh. Settings below are a read-only preview, not the full snapshot; unmapped display values may retain previous settings, while calculations use the complete snapshot.'}</p></div></details>`;
}
