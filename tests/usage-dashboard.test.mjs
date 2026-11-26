import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/api/usage-stats.js';

const token='dashboard-key';
function fixture(t){
 const db=new DatabaseSync(':memory:');
 t.after(()=>db.close());
 for(const file of ['0001_usage_sessions.sql','0002_usage_sessions_by_name.sql']){
  db.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
 }
 const statement=db.prepare('INSERT INTO usage_sessions (session_id, utc_date, id, name) VALUES (?, ?, ?, ?)');
 let session=0;
 const insert=(date,id,name)=>statement.run(String(++session),date,id,name);
 const USAGE_DB={prepare(sql){
  const statement=db.prepare(sql);
  return {bind(...values){
   return {first:async()=>statement.get(...values),all:async()=>({results:statement.all(...values)})};
  }};
 }};
 return {db,insert,env:{USAGE_DB,USAGE_READ_TOKEN:token}};
}
function request(params={},options={}){
 const url=new URL('https://dvi-lab.pages.dev/api/usage-stats');
 url.search=new URLSearchParams(params);
 return new Request(url,{headers:{Authorization:`Bearer ${token}`},...options});
}

test('overview uses inclusive UTC windows and counts each exact role once per window',async t=>{
 const {insert,env}=fixture(t);
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-25T00:00:00Z')});
 const get=async()=>{
  const response=await onRequest({env,request:request()});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  return response.json();
 };
 assert.deepEqual(await get(),{date:'2026-11-25',today_users:0,today_sessions:0,week_users:0,week_sessions:0,month_users:0,month_sessions:0});
 for(const [date,id,name] of [
  ['2026-11-26',8,'Future'],['2026-11-25',1,'Alice'],['2026-11-25',1,'Alice'],['2026-11-25',1,'alice'],
  ['2026-11-19',1,'Alice'],['2026-11-19',2,'Alice'],['2026-11-18',3,'Alice'],['2026-10-27',4,'Old'],['2026-10-26',5,'Older'],
 ])insert(date,id,name);
 assert.deepEqual(await get(),{date:'2026-11-25',today_users:2,today_sessions:3,week_users:3,week_sessions:5,month_users:5,month_sessions:7});
});

test('history matches full names in ASCII and paginates by UTC day',async t=>{
 const {db,insert,env}=fixture(t);
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-25T00:00:00Z')});
 for(let day=1;day<=31;day++)insert(`2026-10-${String(day).padStart(2,'0')}`,1,'Anne-Marie');
 insert('2026-10-31',2,'anne-marie');insert('2026-10-31',3,'Anne');
 const get=async params=>(await onRequest({env,request:request(params)})).json();
 const history=await get({name:'ANNE-MARIE'});
 assert.equal(history.rows.length,30);
 assert.deepEqual(history.rows[0],{date:'2026-10-31',sessions:2});
 assert.equal(history.next,'2026-10-02');
 assert.deepEqual(await get({name:'Anne-Marie',before:history.next}),{rows:[{date:'2026-10-01',sessions:1}],next:null});
 assert.deepEqual(await get({name:'An'}),{rows:[],next:null});
 const plan=db.prepare('EXPLAIN QUERY PLAN SELECT utc_date FROM usage_sessions WHERE name = ? COLLATE NOCASE AND utc_date < ? ORDER BY utc_date DESC').all('Anne-Marie','2026-11-01');
 assert.ok(plan.some(step=>step.detail.includes('usage_sessions_by_name')));
});

test('queries require authorization and reject invalid parameters before opening D1',async()=>{
 const USAGE_DB={prepare(){assert.fail('D1 must not be queried');}};
 const env={USAGE_DB,USAGE_READ_TOKEN:token};
 for(const headers of [{},{Authorization:'Bearer wrong'}]){
  const result=await onRequest({env,request:request({},{headers})});
  assert.equal(result.status,401);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.equal(await result.text(),'');
 }
 for(const params of [{name:''},{name:'%Alice%'},{name:'Alice',before:'2026-02-30'},{before:'2026-10-05'}]){
  assert.equal((await onRequest({env,request:request(params)})).status,400);
 }
 assert.equal((await onRequest({env:{USAGE_DB},request:request()})).status,503);
 assert.equal((await onRequest({env,request:request({},{method:'POST'})})).status,405);
});
