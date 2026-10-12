const pending=new Map();let counter=0;
document.addEventListener('dvi-market-response',event=>{
 if(typeof event.detail!=='string')return;let data;try{data=JSON.parse(event.detail);}catch{return;}
 if(data?.source!=='dvi-market-script')return;const entry=pending.get(data.id);if(!entry)return;
 if(data.version!=='1.0'){entry.outdated=true;return;}
 pending.delete(data.id);clearTimeout(entry.timeout);clearInterval(entry.retry);
 if(data.error)entry.reject(Error(data.error==='marketSaveFailed'?'marketSaveFailed':'marketCaptureFailed'));else entry.resolve(data);
});
export function requestMarket(action){return new Promise((resolve,reject)=>{
 const id=`market-${Date.now()}-${++counter}`,entry={resolve,reject};
 const send=()=>document.dispatchEvent(new CustomEvent('dvi-market-request',{detail:JSON.stringify({source:'dvi-simulator',id,action})}));
 entry.retry=setInterval(send,250);entry.timeout=setTimeout(()=>{pending.delete(id);clearInterval(entry.retry);reject(Error(entry.outdated?'marketOutdated':'marketMissing'));},4000);
 pending.set(id,entry);send();
});}
