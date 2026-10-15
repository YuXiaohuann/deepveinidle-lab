let dialog,copyRequest;
const copyURL='https://cdn.jsdelivr.net/gh/vikiboss/v50@main/static/v50.json';

function cancelCopyRequest(){copyRequest?.abort();copyRequest=null;}

async function loadCopy(){
 cancelCopyRequest();
 const output=dialog.querySelector('.appreciation-copy');
 output.textContent='';output.hidden=true;
 const controller=new AbortController();copyRequest=controller;
 const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(copyURL,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)return;
  const data=await response.json();
  if(!Array.isArray(data))return;
  const choices=data.filter(value=>typeof value==='string'&&value.trim());
  if(!choices.length||controller.signal.aborted||copyRequest!==controller||!dialog.open||!output.isConnected)return;
  output.textContent=choices[Math.floor(Math.random()*choices.length)].trim();
  output.hidden=false;
 }catch{
  // Optional external copy stays hidden on network, timeout or JSON failure.
 }finally{
  clearTimeout(timeout);
  if(copyRequest===controller)copyRequest=null;
 }
}

export function mountAppreciation(language){
 cancelCopyRequest();
 const text=(zh,en)=>language==='zh'?zh:en;
 if(!dialog){
  dialog=document.createElement('dialog');
  dialog.id='appreciation-dialog';
  dialog.className='item-prices-dialog appreciation-dialog';
  dialog.setAttribute('aria-labelledby','appreciation-title');
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{cancelCopyRequest();document.getElementById('appreciation-open')?.focus();});
  let outsidePointer=false;
  const outside=event=>{const rect=dialog.getBoundingClientRect();return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;};
  dialog.addEventListener('pointerdown',event=>{outsidePointer=event.target===dialog&&outside(event);});
  dialog.addEventListener('click',event=>{if(outsidePointer&&event.target===dialog&&outside(event))dialog.close();outsidePointer=false;});
 }
 dialog.innerHTML=`<div class="price-heading"><h2 id="appreciation-title">${text('打赏一下','Support')}</h2><button id="appreciation-close" class="secondary">${text('关闭','Close')}</button></div><p class="appreciation-prompt">${text('觉得好用？<strong>微信扫一扫</strong>打赏一下～','Finding it useful? <strong>Scan with WeChat</strong> to leave a tip.')}</p><img class="appreciation-image" src="/src/assets/appreciation.jpg" alt="${text('微信赞赏码','WeChat support code')}"><p class="appreciation-copy" aria-live="polite" hidden></p><p id="appreciation-error" class="muted" role="alert" hidden>${text('赞赏图片加载失败，请关闭后重试。','Could not load the support image. Close and try again.')}</p>`;
 dialog.querySelector('#appreciation-close').onclick=()=>dialog.close();
 dialog.querySelector('img').onerror=event=>{event.target.hidden=true;dialog.querySelector('#appreciation-error').hidden=false;};
 document.getElementById('appreciation-open').onclick=()=>{
  const image=dialog.querySelector('img');
  if(image.hidden){image.hidden=false;dialog.querySelector('#appreciation-error').hidden=true;image.src='/src/assets/appreciation.jpg';}
  dialog.showModal();
  void loadCopy();
 };
}
