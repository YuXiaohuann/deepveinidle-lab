import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import {compactNumber,formatCount,formatUnitPrice} from '../src/number-format.js';
import {rewardAmount} from '../src/combat-hot.js';

function formatters(file,names,context){
 const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
 const nodes=parse(source,{ecmaVersion:'latest',sourceType:'module'}).body;
 const code=nodes.filter(n=>names.includes(n.id?.name)||n.declarations?.some(d=>names.includes(d.id.name))).map(n=>source.slice(n.start,n.end)).join('\n');
 const c=vm.createContext({compactNumber,rewardAmount,...context});
 vm.runInContext(code,c);
 return expression=>vm.runInContext(expression,c);
}

test('compact amounts retain two decimals and promote rounded unit boundaries',()=>{
 for(const [value,expected] of [[0,null],[999.99,null],[1000,'1.00K'],[12345,'12.35K'],[1.2e6,'1.20M'],[-3450,'-3.45K'],[1e9,'1.00B'],[1e12,'1.00T'],[999999,'1.00M']])assert.equal(compactNumber(value),expected);
});

test('read-only unit prices show integers below 1,000 and use compact formatting from 1,000',()=>{
 for(const language of ['zh','en']){
  for(const [price,expected] of [[0,'0'],[12,'12'],[999,'999'],[1000,'1.00K'],[1250,'1.25K']]){
   assert.equal(formatUnitPrice(price,language),expected);
  }
 }
});

test('volumes keep zero and small integers while abbreviating from 1,000',()=>{
 for(const language of ['zh','en']){
  assert.equal(formatCount(0,language),'0');assert.equal(formatCount(999,language),'999');assert.equal(formatCount(1000,language),'1.00K');
  assert.equal(formatCount(1234567,language),'1.23M');assert.equal(formatCount(null,language),'—');assert.equal(formatCount(undefined,language),'—');
 }
});
test('combat abbreviates daily XP and money while counts and quantities retain precision',()=>{
 for(const language of ['zh','en']){
  const run=formatters('../src/app.js',['formatRate','formatDropQuantity'],{language,state:{manual:{simulationHours:6}}});
  assert.equal(run("formatRate(3125,'xp')"),'12.50K');
  assert.equal(run("formatRate(-3125,'coins')"),'-12.50K');
  assert.equal(run("formatRate(3125,'attempts')"),'12,500');
  assert.equal(run('formatRate(3125)'),'12,500.0');
  assert.equal(run('formatDropQuantity(3125)'),'12,500');
  assert.equal(run("formatRate(null,'coins')"),language==='zh'?'未完整定价':'Incomplete pricing');
 }
});

test('gathering abbreviates daily XP and money regardless of legacy period while quantities stay complete',()=>{
 for(const language of ['zh','en'])for(const period of ['hour','day']){
  const run=formatters('../src/gathering-controls.js',['text','format','amount','expectedQuantity'],{language,period,state:{simulationHours:6}});
  // 3125 per six hours is 12500 per day; a legacy hourly selection is ignored.
  assert.equal(run("amount(3125,'xp')"),'12.50K');
  assert.equal(run("amount(3125000,'coins')"),'12.50M');
  assert.equal(run("amount(3125,'value')"),'12.50K');
  assert.equal(run('amount(3125)'),'12,500.0');
  assert.equal(run('expectedQuantity(12500)'),'12,500');
  assert.equal(run('expectedQuantity(0.000001)'),'1/1,000,000');
 }
});
