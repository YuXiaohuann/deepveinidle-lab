const pageSize=30;
const headers={'Cache-Control':'no-store'};
const encoder=new TextEncoder();

async function matchesToken(token,secret){
 const [actual,expected]=await Promise.all([token,secret].map(async value=>
  new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))
 ));
 let difference=0;
 for(let i=0;i<actual.length;i++)difference|=actual[i]^expected[i];
 return difference===0;
}

const utcDay=(now,offset=0)=>new Date(now+offset*86400000).toISOString().slice(0,10);

async function overview(db,now){
 const date=utcDay(now),week=utcDay(now,-6),month=utcDay(now,-29);
 const counts=await db.prepare(`
  WITH roles AS (
   SELECT SUM(utc_date = ?) AS today, SUM(utc_date >= ?) AS week, COUNT(*) AS month
   FROM usage_sessions WHERE utc_date BETWEEN ? AND ? GROUP BY id, name
  )
  SELECT COALESCE(SUM(today > 0),0) AS today_users, COALESCE(SUM(today),0) AS today_sessions,
         COALESCE(SUM(week > 0),0) AS week_users, COALESCE(SUM(week),0) AS week_sessions,
         COUNT(*) AS month_users, COALESCE(SUM(month),0) AS month_sessions
  FROM roles
 `).bind(date,week,month,date).first();
 return {date,...counts};
}

async function history(db,name,before){
 const {results}=await db.prepare(`
  SELECT utc_date AS date, COUNT(*) AS sessions
  FROM usage_sessions WHERE name = ? COLLATE NOCASE AND utc_date < ?
  GROUP BY utc_date ORDER BY utc_date DESC LIMIT ?
 `).bind(name,before,pageSize+1).all();
 const rows=results.slice(0,pageSize);
 return {rows,next:results.length>pageSize?rows.at(-1).date:null};
}

export async function onRequest({request,env}){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,256})$/i)?.[1];
 if(!token)return new Response(null,{status:401,headers});
 if(!env.USAGE_READ_TOKEN||!env.USAGE_DB)return new Response(null,{status:503,headers});
 if(!await matchesToken(token,env.USAGE_READ_TOKEN))return new Response(null,{status:401,headers});

 const params=new URL(request.url).searchParams;
 const now=Date.now(),tomorrow=utcDay(now,1);
 const name=params.get('name')?.trim();
 const before=params.get('before')??tomorrow;
 if((name!==undefined&&!/^[A-Za-z0-9][A-Za-z0-9 '-]{0,23}$/.test(name))||
  (params.has('before')&&!name)||!/^\d{4}-\d{2}-\d{2}$/.test(before)||
  before>tomorrow||new Date(before).toJSON()?.slice(0,10)!==before){
  return new Response(null,{status:400,headers});
 }
 try{
  const data=name?await history(env.USAGE_DB,name,before):await overview(env.USAGE_DB,now);
  return Response.json(data,{headers});
 }catch{
  console.error('Usage statistics could not read from D1');
  return new Response(null,{status:503,headers});
 }
}
