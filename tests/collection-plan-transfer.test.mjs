import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {collectionIds,collectionRoutes} from '../src/collection-model.js';
import {encodeCollectionPlan,decodeCollectionPlan} from '../src/collection-plan-transfer.js';
import {validateCollectionPlan} from '../src/collection-plan.js';
import * as game from '../src/upstream.js';
const plan=count=>validateCollectionPlan({version:1,selections:collectionIds.filter(id=>collectionRoutes(id).length).slice(0,count).map(itemId=>({itemId,jobId:collectionRoutes(itemId)[0].id,target:game.collectionThresholds(game.baseItemId(itemId))[0]}))});
test('empty and short plans use compact JSON; larger plans use smaller gzip+base64 with exact roundtrip',async()=>{
 for(const count of [0,1,5,20,100]){
  const original=plan(count),json=JSON.stringify(original),encoded=await encodeCollectionPlan(original);
  assert.ok(encoded.length<=json.length);assert.deepEqual(await decodeCollectionPlan(encoded),original);
  assert.deepEqual(await decodeCollectionPlan(' \n'+JSON.stringify(original,null,2)+' \n'),original);
  if(count<=1)assert.equal(encoded,json);else assert.ok(encoded.startsWith('DVILAB-PLAN:'));
 }
});
test('malformed JSON, compression, versions and targets reject explicitly',async()=>{
 for(const raw of ['','bad-json','DVILAB-PLAN:bad!','DVILAB-PLAN:YWJj',JSON.stringify({version:2,selections:[]}),JSON.stringify({version:1,selections:[{itemId:40,jobId:41,target:99}]})])await assert.rejects(decodeCollectionPlan(raw));
});
test('unsupported compression exports JSON and unsupported decompression fails explicitly',async()=>{
 const original=plan(20),encoded=await encodeCollectionPlan(original),compress=globalThis.CompressionStream,decompress=globalThis.DecompressionStream;
 try{
  globalThis.CompressionStream=undefined;assert.equal(await encodeCollectionPlan(original),JSON.stringify(original));
  globalThis.DecompressionStream=undefined;await assert.rejects(decodeCollectionPlan(encoded),/decompressionUnavailable/);
  assert.deepEqual(await decodeCollectionPlan(JSON.stringify(original)),original);
 }finally{globalThis.CompressionStream=compress;globalThis.DecompressionStream=decompress;}
});

test('compressed payload carries and validates the JSON version without an outer format version',async()=>{
 const original=plan(20),encoded=await encodeCollectionPlan(original);
 assert.match(encoded,/^DVILAB-PLAN:[A-Za-z0-9+/]+=*$/);
 const stream=new Blob([Buffer.from(encoded.slice('DVILAB-PLAN:'.length),'base64')]).stream().pipeThrough(new DecompressionStream('gzip'));
 assert.equal(JSON.parse(await new Response(stream).text()).version,1);
 const invalid='DVILAB-PLAN:'+gzipSync(JSON.stringify({...original,version:2})).toString('base64');
 await assert.rejects(decodeCollectionPlan(invalid),/invalidPlan/);
});
