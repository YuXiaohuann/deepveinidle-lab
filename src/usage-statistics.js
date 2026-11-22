const sessionId=globalThis.location?.origin==='https://dvi-lab.pages.dev'
 ? globalThis.crypto?.randomUUID?.()
 : null;
let pending=false,reported=false;

function hex(value){
 return Array.from(new TextEncoder().encode(value),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function reportUsage(player){
 if(!sessionId||pending||reported||!Number.isSafeInteger(player?.id)||player.id<1||
  typeof player.name!=='string'||!player.name)return;

 pending=true;
 try{
  const response=await fetch('/api/usage',{
   method:'POST',
   headers:{'Content-Type':'application/json','X-Session-Id':sessionId},
   body:JSON.stringify({id:hex(String(player.id)),name:hex(player.name)}),
   credentials:'omit',
   redirect:'error',
   signal:AbortSignal.timeout(10000),
  });
  reported=response.status===204;
 }catch{
  // The next successful import can retry with the same session ID.
 }finally{pending=false;}
}
