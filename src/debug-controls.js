import {requestCharacter,importStatusText} from './import-controls.js';
import {importCharacter,importWarningText} from './character-import.js';
import {preset} from './model.js';

let selectedFile=null,status=null,busy=false,statusPanel='import';
export function renderDebug(language,{applyCombat,applyEnhancement,refresh}){
 const host=document.getElementById('debug-content'),zh=language==='zh';
 const text=(cn,en)=>zh?cn:en;
 const modes=[['config',text('导入战斗配置','Import combat configuration')],['enhance',text('导入强化配置','Import enhancement configuration')]];
 host.innerHTML=`<h1 id="debug-title">${text('调试','Debug')}</h1>
 <section class="panel config" aria-labelledby="debug-export-title"><h2 id="debug-export-title">${text('导出为文件','Export to file')}</h2><p class="micro">${text('角色配置导出使用普通角色脚本，无需打开战斗预测。','Configuration export uses the regular character script and does not require combat predictions.')}</p><div class="import-actions"><a class="secondary" href="/src/character-import.user.js" target="_blank" rel="noopener">${text('安装 / 更新 userscript','Install / update userscript')} ↗</a><button id="debug-export-config" class="secondary">${text('导出角色配置','Export character configuration')}</button></div><p id="debug-export-status" role="status" class="micro import-status"></p></section>
 <section class="panel config" aria-labelledby="debug-import-title"><h2 id="debug-import-title">${text('从文件导入','Import from file')}</h2><label>${text('选择 JSON 文件','Choose JSON file')} <input id="debug-file" type="file" accept=".json,application/json"></label><p id="debug-filename" class="micro"></p><div class="import-actions">${modes.map(([id,label])=>`<button class="secondary" data-debug-import="${id}">${label}</button>`).join('')}</div><p class="micro">${text('配置导入自动保存。','Configuration imports are saved automatically.')}</p><p id="debug-status" role="status" class="micro import-status"></p></section>`;
 host.querySelector('#debug-filename').textContent=selectedFile?.name??'';
 host.querySelector(statusPanel==='export'?'#debug-export-status':'#debug-status').textContent=busy?text('正在处理…','Processing…'):status?.exported?text('角色配置文件已生成并开始下载。','Character configuration file generated; download started.'):importStatusText(language,status)+(status?.warnings?.length?'\n'+importWarningText(language,status.warnings):'')+(status?.saveOK===false?text(' · 浏览器存储不可用，配置无法保存',' · Browser storage unavailable; configuration could not be saved'):'');
 host.querySelector('#debug-file').disabled=busy;
 host.querySelector('#debug-export-config').disabled=busy;
 host.querySelectorAll('[data-debug-import]').forEach(button=>button.disabled=busy||!selectedFile);
 host.querySelector('#debug-file').onchange=event=>{selectedFile=event.target.files[0]??null;status=null;renderDebug(language,{applyCombat,applyEnhancement,refresh});};
 const run=async (panel,operation)=>{
  if(busy)return;statusPanel=panel;busy=true;renderDebug(language,{applyCombat,applyEnhancement,refresh});
  try{await operation();}catch(error){status={error:error.message};}finally{busy=false;refresh();}
 };
 host.querySelector('#debug-export-config').onclick=()=>run('export',async()=>{
  const response=await requestCharacter('read');
  if(response.version!=='2.4')throw Error('scriptOutdated');
  if(!response.snapshot)throw Error('noSnapshot');
  const data=response.snapshot;
  importCharacter(preset('ranged'),data);
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`dvi-character-config-${data.capturedAt}.json`;document.body.append(link);
  try{link.click();status={exported:true};}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 });
 host.querySelectorAll('[data-debug-import]').forEach(button=>button.onclick=()=>run('import',async()=>{
  let configuration;try{configuration=JSON.parse(await selectedFile.text());}catch(error){if(error instanceof SyntaxError)throw Error('invalidSnapshot');throw error;}
  status=button.dataset.debugImport==='enhance'?applyEnhancement(configuration):applyCombat(configuration);
 }));
}
