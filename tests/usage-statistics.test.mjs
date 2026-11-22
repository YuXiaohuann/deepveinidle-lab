import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/api/usage.js';

const sessionId='00000000-0000-4000-8000-000000000001';
const hex=value=>Buffer.from(String(value)).toString('hex');
const encoded=(id,name)=>JSON.stringify({id:hex(id),name:hex(name)});
function post(body,session=sessionId){
 return new Request('https://dvi-lab.pages.dev/api/usage',{
  method:'POST',headers:{'Content-Type':'application/json','X-Session-Id':session},body,
 });
}

test('usage requests only count a session once, including concurrent and next-day retries',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 const migration=readFileSync(new URL('../migrations/0001_usage_sessions.sql',import.meta.url),'utf8');
 db.exec(migration);
 const env={USAGE_DB:{
  prepare(sql){
   const statement=db.prepare(sql);
   return {bind(...values){
    return {async run(){
     statement.run(...values);
     return {success:true};
    }};
   }};
  },
 }};
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-22T23:59:59Z')});
 const request=(id,name,session)=>onRequest({request:post(encoded(id,name),session),env});
 const responses=await Promise.all([request(123456,'Alice'),request(123456,'Alice')]);
 assert.deepEqual(responses.map(response=>response.status),[204,204]);
 assert.equal(await responses[0].text(),'');
 for(const [id,name,suffix] of [[123456,'Alice','2'],[123456,'Alice-II','3'],[123457,'Alice','4']]){
  assert.equal((await request(id,name,sessionId.slice(0,-1)+suffix)).status,204);
 }
 t.mock.timers.tick(2000);
 assert.equal((await request(123457,'Changed')).status,204);
 const first=db.prepare('SELECT utc_date, id, name FROM usage_sessions WHERE session_id = ?').get(sessionId);
 assert.deepEqual({...first},{utc_date:'2026-11-22',id:123456,name:'Alice'});
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM usage_sessions').get().n,4);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM (SELECT DISTINCT id, name FROM usage_sessions)').get().n,3);
});

test('usage route rejects malformed inputs and reports a missing D1 binding',async t=>{
 const errorLog=t.mock.method(console,'error',()=>{});
 for(const request of [
  post(encoded(123456,'Alice'),'invalid'),post(''),post('"abc"'),post('['),
  post(JSON.stringify({id:'1',name:hex('Alice')})),post(JSON.stringify({id:hex(1),name:'4A'})),
  post(JSON.stringify({id:hex(1),name:'4\n'})),post(encoded('1\n','Alice')),
  post(encoded(Number.MAX_SAFE_INTEGER+1,'Alice')),post(encoded(1,' Alice')),
  post(encoded(1,'Alice')+' '.repeat(256)),post('{"id":"31","name":"416c696365","extra":0}'),
 ])assert.equal((await onRequest({request,env:{}})).status,400);
 assert.equal(errorLog.mock.callCount(),0);
 const method=await onRequest({request:new Request('https://dvi-lab.pages.dev/api/usage'),env:{}});
 assert.equal(method.status,405);
 assert.equal(method.headers.get('Allow'),'POST');
 assert.equal((await onRequest({request:post(encoded(123456,'Alice')),env:{}})).status,503);
 assert.equal(errorLog.mock.callCount(),1);
});

test('the page reporter shares one session across retries and starts a new one on reload',async t=>{
 const originalLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
 t.after(()=>{
  if(originalLocation)Object.defineProperty(globalThis,'location',originalLocation);
  else delete globalThis.location;
 });
 Object.defineProperty(globalThis,'location',{configurable:true,value:{origin:'https://preview.dvi-lab.pages.dev'}});
 let settle;
 const requests=t.mock.method(globalThis,'fetch',()=>new Promise(resolve=>{settle=resolve;}));
 const player={id:123456,name:'Alice'};
 const preview=await import('../src/usage-statistics.js?preview');
 await preview.reportUsage(player);
 assert.equal(requests.mock.callCount(),0);

 Object.defineProperty(globalThis,'location',{configurable:true,value:{origin:'https://dvi-lab.pages.dev'}});
 const page=await import('../src/usage-statistics.js?page');
 await page.reportUsage({id:player.id});
 const first=page.reportUsage(player);
 await page.reportUsage(player);
 assert.equal(requests.mock.callCount(),1);
 settle({status:503});await first;
 const retry=page.reportUsage(player);
 settle({status:204});await retry;
 await page.reportUsage({id:123457,name:'Another'});
 assert.equal(requests.mock.callCount(),2);
 const reload=await import('../src/usage-statistics.js?reload');
 const next=reload.reportUsage(player);
 settle({status:204});await next;
 const [initial,repeat,fresh]=requests.mock.calls.map(call=>call.arguments);
 assert.equal(initial[0],'/api/usage');
 assert.equal(initial[1].body,encoded(player.id,player.name));
 assert.equal(initial[1].headers['Content-Type'],'application/json');
 assert.equal(initial[1].headers['X-Session-Id'],repeat[1].headers['X-Session-Id']);
 assert.notEqual(initial[1].headers['X-Session-Id'],fresh[1].headers['X-Session-Id']);
});
