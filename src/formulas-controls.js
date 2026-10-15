let contentPromise=null;
let directoryOpen=null;

async function loadContent(){
 if(!contentPromise){
  contentPromise=Promise.all([
   import('./formulas-markdown.js'),
   fetch('/src/content/formulas/combat.zh.md',{signal:AbortSignal.timeout(15000)}).then(async response=>{
    if(!response.ok)throw new Error(`正文请求失败（HTTP ${response.status}）`);
    return response.text();
   })
  ]).then(([renderer,source])=>renderer.renderFormulaMarkdown(source)).catch(error=>{contentPromise=null;throw error;});
 }
 return contentPromise;
}

function alignChapter(root){
 if(root.closest('[hidden]')||!/^#formula-\d+(?:-\d+)?$/.test(location.hash))return;
 const heading=document.getElementById(location.hash.slice(1));
 if(heading&&root.contains(heading)){heading.scrollIntoView({block:'start'});heading.focus({preventScroll:true});}
}

export function renderFormulas({isActive=false}={}){
 if(!isActive)return;
 const root=document.getElementById('formulas-content');
 if(!root)return;
 if(root.dataset.ready){alignChapter(root);return;}
 if(root.dataset.loading)return;
 root.dataset.loading='true';
 root.innerHTML='<p class="formula-status" role="status">正在加载公式…</p>';
 loadContent().then(content=>{
  if(!root.isConnected||root.closest('[hidden]')){delete root.dataset.loading;return;}
  const open=directoryOpen??!matchMedia('(max-width:740px)').matches;
  root.innerHTML=`<div class="formula-layout"><nav class="formula-toc panel" aria-label="章节目录"><details id="formula-directory" ${open?'open':''}><summary>章节目录</summary><ol>${content.toc}</ol></details></nav><article class="formula-article panel">${content.html}</article></div>`;
  const directory=root.querySelector('#formula-directory');
  directory.ontoggle=()=>{if(directory.isConnected)directoryOpen=directory.open;};
  root.querySelectorAll('article table').forEach(table=>{
   const wrapper=document.createElement('div');wrapper.className='formula-table';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','公式参数表格');table.before(wrapper);wrapper.append(table);
  });
  root.querySelectorAll('pre').forEach(element=>{element.tabIndex=0;element.setAttribute('aria-label','公式');});
  root.onclick=event=>{
   const link=event.target.closest('.formula-toc a');
   if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();
   if(location.hash!==link.hash)history.pushState(null,'',link.hash);
   alignChapter(root);
  };
  root.dataset.ready='true';delete root.dataset.loading;
  alignChapter(root);
 }).catch(error=>{
  if(!root.isConnected)return;
  delete root.dataset.loading;
  root.innerHTML='<div class="formula-status" role="alert"><p>公式加载失败。</p><p class="formula-error"></p><button type="button">重新加载</button></div>';
  root.querySelector('.formula-error').textContent=error.message;
  root.querySelector('button').onclick=()=>renderFormulas({isActive:true});
 });
}
