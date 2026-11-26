// Keep scroll containers outside each page's replaceable result markup.
const pages=['combat','gather','craft','boss-feed','enhance','mastery'];
const positions=new Map();
const columns=new Map();
export function rememberScrollLayout(){
 for(const [key,element]of columns)if(element.isConnected&&!element.closest('[hidden]'))positions.set(key,element.scrollTop);
}
export function mountScrollLayout(){
 const app=document.getElementById('app');
 const footer=app.querySelector('.project-footer');

 const sync=()=>{
  for(const [key,element]of columns)if(!element.isConnected){columns.delete(key);}
  const active=pages.find(id=>!document.getElementById(`${id}-section`).hidden);
  app.classList.toggle('split-scroll',Boolean(active));
  for(const id of pages){
   const section=document.getElementById(`${id}-section`);
   const grid=id==='combat'?section:document.getElementById(`${id}-content`);
   if(grid.children.length<2)continue;
   let right=grid.querySelector(':scope > .scroll-information');
   if(!right){
    right=document.createElement('div');right.className='scroll-information';
    grid.children[1].before(right);right.append(grid.children[2]);
   }
   const left=grid.children[0];
   for(const [side,element]of [['config',left],['information',right]]){
    if(element.dataset.scrollColumn)continue;
    const key=`${id}-${side}`;element.dataset.scrollColumn=key;
    element.tabIndex=0;
    columns.set(key,element);
    element.addEventListener('scroll',()=>{if(element.isConnected&&!element.closest('[hidden]'))positions.set(key,element.scrollTop);});
    element.dataset.restoreScroll=String(positions.get(key)??0);
   }
   if(id===active){
    if(footer.parentElement!==right)right.append(footer);
    for(const element of [left,right]){
     if(element.dataset.restoreScroll!==undefined){element.scrollTop=Number(element.dataset.restoreScroll);delete element.dataset.restoreScroll;}
    }
   }
  }
  if(!active&&footer.parentElement!==app)app.append(footer);
 };
 sync();
 const observer=new MutationObserver(sync);
 observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 return ()=>{
  rememberScrollLayout();
  observer.disconnect();
 };
}
