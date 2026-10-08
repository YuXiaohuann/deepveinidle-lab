import {requestCharacter,importStatusText} from './import-controls.js';
import {importCharacter} from './character-import.js';
import {preset} from './model.js';
import {importSnapshot} from './character-snapshot.js';

let selectedFile=null,status=null,busy=false,statusPanel='import';
export function renderDebug(language,{applyCombat,applyEnhancement,refresh}){
 const host=document.getElementById('debug-content'),zh=language==='zh';
 const text=(cn,en)=>zh?cn:en;
 host.innerHTML=`<h1 id="debug-title">${text('调试','Debug')}</h1><section class="panel config" aria-labelledby="debug-export-title"><h2 id="debug-export-title">${text('导出','Export')}</h2><a class="text-button" href="/src/debug-capture.user.js" target="_blank" rel="noopener">${text('安装 / 更新调试 userscript','Install / update debug userscript')} ↗</a><p class="micro">${text('安装或更新调试脚本后刷新游戏和调试页。角色配置导出使用普通角色脚本，无需打开战斗预测；导出完整快照前，请先在游戏打开战斗预测列表。','After installing or updating the debug script, refresh the game and debug page. Configuration export uses the regular character script and does not require combat predictions. Open combat predictions in the game before exporting a complete snapshot.')}</p><div class="import-actions"><button id="debug-export-config" class="secondary">${text('导出角色配置','Export character configuration')}</button><button id="debug-export" class="secondary">${text('导出角色快照','Export character snapshot')}</button></div><p id="debug-export-status" role="status" class="micro import-status"></p></section><section class="panel config" aria-labelledby="debug-import-title"><h2 id="debug-import-title">${text('导入快照文件','Import snapshot file')}</h2><label>${text('选择 JSON 文件','Choose JSON file')} <input id="debug-file" type="file" accept=".json,application/json"></label><p id="debug-filename" class="micro"></p><div class="import-actions">${[['config',text('导入战斗配置','Import combat configuration')],['snapshot',text('导入战斗快照','Import combat snapshot')],['enhance',text('导入强化配置','Import enhancement configuration')]].map(([id,label])=>`<button class="secondary" data-debug-import="${id}">${label}</button>`).join('')}</div><p class="micro">${text('配置导入自动保存；战斗快照仅当前页面有效，刷新后丢失。','Configuration imports are saved automatically; combat snapshots last only until refresh.')}</p><p id="debug-status" role="status" class="micro import-status"></p></section>`;
 host.querySelector('#debug-filename').textContent=selectedFile?.name??'';
 host.querySelector(statusPanel==='export'?'#debug-export-status':'#debug-status').textContent=busy?text('正在处理…','Processing…'):status?.exported?(status.exported==='config'?text('角色配置文件已生成并开始下载。','Character configuration file generated; download started.'):text('快照文件已生成并开始下载。','Snapshot file generated; download started.')):importStatusText(language,status)+(status?.warnings?.length?text(' · 保留或无法读取：',' · Retained or unreadable: ')+status.warnings.join('；'):'')+(status?.saveOK===false?text(' · 浏览器存储不可用，配置无法保存',' · Browser storage unavailable; configuration could not be saved'):'');
 host.querySelector('#debug-file').disabled=busy;
 host.querySelector('#debug-export').disabled=busy;
 host.querySelector('#debug-export-config').disabled=busy;
 host.querySelectorAll('[data-debug-import]').forEach(button=>button.disabled=busy||!selectedFile);
 host.querySelector('#debug-file').onchange=event=>{selectedFile=event.target.files[0]??null;status=null;renderDebug(language,{applyCombat,applyEnhancement,refresh});};
 const run=async (panel,operation)=>{
  if(busy)return;statusPanel=panel;busy=true;renderDebug(language,{applyCombat,applyEnhancement,refresh});
  try{await operation();}catch(error){status={error:error.message};}finally{busy=false;refresh();}
 };
 const exportCharacter=mode=>run('export',async()=>{
  const response=await requestCharacter('read',mode==='snapshot');
  if(response.version!==(mode==='snapshot'?'1.0':'2.3'))throw Error(mode==='snapshot'?'debugScriptOutdated':'scriptOutdated');
  if(!response.snapshot)throw Error(mode==='snapshot'?'debugNoSnapshot':'noSnapshot');
  let data=response.snapshot;
  if(mode==='snapshot')importSnapshot(data);
  else{importCharacter(preset('ranged'),data);const {prediction,...configuration}=data;data=configuration;}
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=mode==='config'?`dvi-character-config-${data.capturedAt}.json`:`dvi-character-${data.capturedAt}.json`;document.body.append(link);
  try{link.click();status={exported:mode};}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 });
 host.querySelector('#debug-export').onclick=()=>exportCharacter('snapshot');
 host.querySelector('#debug-export-config').onclick=()=>exportCharacter('config');
 host.querySelectorAll('[data-debug-import]').forEach(button=>button.onclick=()=>run('import',async()=>{
  let snapshot;try{snapshot=JSON.parse(await selectedFile.text());}catch(error){if(error instanceof SyntaxError)throw Error('invalidSnapshot');throw error;}
  status=button.dataset.debugImport==='enhance'?applyEnhancement(snapshot):applyCombat(button.dataset.debugImport,snapshot);
 }));
}
