const maxBodyBytes=256;
const sessionPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const namePattern=/^[A-Za-z0-9][A-Za-z0-9 '\-]{0,23}$/;

async function readJson(request){
 const reader=request.body.getReader();
 const bytes=new Uint8Array(maxBodyBytes);
 let length=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(length+value.length>bytes.length){
    await reader.cancel();
    throw Error('Usage body too large');
   }
   bytes.set(value,length);
   length+=value.length;
  }
 }finally{reader.releaseLock();}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,length)));
}

function decodeHex(value,maxLength){
 if(typeof value!=='string'||!value.length||value.length>maxLength*2||value.length%2||/[^0-9a-f]/.test(value))return '';
 return value.match(/../g).map(pair=>String.fromCharCode(Number.parseInt(pair,16))).join('');
}

export async function onRequest({request,env}){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});

 const sessionId=request.headers.get('X-Session-Id');
 const contentType=request.headers.get('Content-Type')??'';
 if(!sessionId||!sessionPattern.test(sessionId)||!/^application\/json(?:\s*;|$)/i.test(contentType)||!request.body){
  return new Response(null,{status:400});
 }

 let data;
 try{data=await readJson(request);}
 catch{return new Response(null,{status:400});}
 if(!data||typeof data!=='object'||Object.keys(data).length!==2)return new Response(null,{status:400});

 const idText=decodeHex(data.id,16),name=decodeHex(data.name,24),id=Number(idText);
 if(!Number.isSafeInteger(id)||id<1||String(id)!==idText||!namePattern.test(name)||name!==name.trim()){
  return new Response(null,{status:400});
 }

 try{
  const date=new Date().toISOString().slice(0,10);
  const result=await env.USAGE_DB.prepare(`
   INSERT INTO usage_sessions (session_id, utc_date, id, name) VALUES (?, ?, ?, ?)
   ON CONFLICT (session_id) DO NOTHING
  `).bind(sessionId,date,id,name).run();
  if(!result.success)throw Error('Usage insert failed');
 }catch{
  console.error('Usage statistics could not write to D1');
  return new Response(null,{status:503});
 }
 return new Response(null,{status:204});
}
