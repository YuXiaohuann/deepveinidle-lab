const periods=['today','week','month'];
const copy={
 zh:{title:'使用统计',today:'今天',week:'近 7 天',month:'近 30 天',users:'活跃人数',sessions:'会话数',date:'UTC 日期',
  token:'管理员访问密钥',unlock:'解锁',lock:'锁定',search:'查询',history:'角色历史',name:'角色全名',more:'加载更早记录',
  empty:'没有找到该角色的记录。',loading:'正在查询…',unauthorized:'访问密钥无效，请重新输入。',
  invalid:'请输入有效的角色全名。',unavailable:'暂时无法读取统计数据。'},
 en:{title:'Usage statistics',today:'Today',week:'Last 7 days',month:'Last 30 days',users:'Active characters',sessions:'Sessions',date:'UTC date',
  token:'Administrator access key',unlock:'Unlock',lock:'Lock',search:'Search',history:'Character history',name:'Full character name',more:'Load earlier records',
  empty:'No records for this character.',loading:'Loading…',unauthorized:'Invalid access key. Enter it again.',
  invalid:'Enter a valid full character name.',unavailable:'Usage data is temporarily unavailable.'},
};
let token='',summary=null,name='',rows=[],next=null,busy=false,message='',paint=()=>{};

function clear(){
 token='';summary=null;name='';rows=[];next=null;
}

async function query(parameters,access=token){
 const url=new URL('/api/usage-stats',location.origin);
 url.search=new URLSearchParams(parameters);
 const response=await fetch(url,{headers:{Authorization:`Bearer ${access}`},cache:'no-store',
  credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw response.status;
 return response.json();
}

async function run(action){
 if(busy)return;
 busy=true;message='loading';paint();
 try{await action();message='';}
 catch(status){
  if(status===401)clear();
  message=status===401?'unauthorized':status===400?'invalid':'unavailable';
 }finally{busy=false;paint();}
}

export function mountUsageDashboard(host,language){
 const text=copy[language==='zh'?'zh':'en'];
 const number=new Intl.NumberFormat(language==='zh'?'zh-CN':'en');
 host.innerHTML=`
  <div class="forecast-heading"><h1 id="usage-title">${text.title}</h1><button id="usage-lock" type="button">${text.lock}</button></div>
  <form id="usage-login" class="panel usage-form">
   <label for="usage-token">${text.token}</label>
   <div><input id="usage-token" type="password" autocomplete="off" required maxlength="256">
    <button>${text.unlock}</button></div>
  </form>
  <p id="usage-message" role="status" class="muted" hidden></p>
  <div id="usage-data" hidden>
   <p id="usage-date" class="muted"></p>
   <div class="usage-periods">${periods.map(period=>`
    <section class="panel usage-period"><h2>${text[period]}</h2><dl>
     <div><dt>${text.users}</dt><dd data-count="${period}_users"></dd></div>
     <div><dt>${text.sessions}</dt><dd data-count="${period}_sessions"></dd></div>
    </dl></section>`).join('')}</div>
   <section class="panel usage-history" aria-labelledby="usage-history-title">
    <h2 id="usage-history-title">${text.history}</h2>
    <form id="usage-search" class="usage-form">
     <label for="usage-name">${text.name}</label>
     <div><input id="usage-name" type="search" maxlength="24" required><button>${text.search}</button></div>
    </form>
    <p id="usage-empty" class="muted" hidden>${text.empty}</p>
    <table id="usage-table" hidden><caption></caption><thead><tr><th scope="col">${text.date}</th><th scope="col">${text.sessions}</th></tr></thead><tbody></tbody></table>
    <button id="usage-more" type="button" hidden>${text.more}</button>
   </section>
  </div>`;
 const find=selector=>host.querySelector(selector);
 const login=find('#usage-login'),key=find('#usage-token'),note=find('#usage-message'),lock=find('#usage-lock');
 const data=find('#usage-data'),date=find('#usage-date'),search=find('#usage-search'),input=find('#usage-name');
 const empty=find('#usage-empty'),table=find('#usage-table'),body=table.tBodies[0],more=find('#usage-more');
 const counts=host.querySelectorAll('[data-count]');
 input.value=name;
 paint=()=>{
  login.hidden=Boolean(summary);data.hidden=lock.hidden=!summary;
  note.hidden=!message;note.textContent=message?text[message]:'';
  for(const button of host.querySelectorAll('button'))button.disabled=busy;
  if(!summary)input.value='';
  date.textContent=summary?`${text.date} · ${summary.date}`:'';
  for(const count of counts)count.textContent=summary?number.format(summary[count.dataset.count]):'';
  table.hidden=rows.length===0;empty.hidden=!name||rows.length>0||busy||Boolean(message);more.hidden=!next;
  table.caption.textContent=name;
  body.replaceChildren(...rows.map(row=>{
   const tr=document.createElement('tr');
   tr.insertCell().textContent=row.date;
   tr.insertCell().textContent=number.format(row.sessions);
   return tr;
  }));
 };
 login.onsubmit=event=>{
  event.preventDefault();
  const access=key.value.trim();key.value='';
  if(!access)return;
  void run(async()=>{summary=await query({},access);token=access;});
 };
 lock.onclick=()=>{clear();message='';paint();key.focus();};
 search.onsubmit=event=>{
  event.preventDefault();
  const requested=input.value.trim();
  if(!requested)return;
  void run(async()=>{
   name='';rows=[];next=null;
   ({rows,next}=await query({name:requested}));name=requested;
  });
 };
 more.onclick=()=>void run(async()=>{
  const page=await query({name,before:next});
  rows.push(...page.rows);next=page.next;
 });
 paint();
}
