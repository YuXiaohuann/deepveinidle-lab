import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {game,defaults,normalize,calculate} from '../src/model.js';
import {selectedEnemies,monsterKey} from '../src/enemy-selection.js';
import {manualControls} from '../src/manual-controls.js';
import {importCharacter} from '../src/character-import.js';

test('enemy scopes limit static rows and normalize old or invalid selections',()=>{
 assert.equal(defaults().manual.enemySelection,'all');
 for(const value of [undefined,null,'missing',1,'normal','boss',...game.bosses.map(b=>`boss-${b.name}`)])assert.equal(normalize({manual:{enemySelection:value}}).manual.enemySelection,'all');
 for(const [selection,count] of [['all',20],[monsterKey(game.monsters[0]),1]]){
  const state=defaults();state.manual.enemySelection=selection;
  assert.equal(calculate(state).rows.length,count);
  assert.equal(normalize(JSON.parse(JSON.stringify(state))).manual.enemySelection,selection);
 }
});

test('worker simulates only selected monsters, including snapshot requests',()=>{
 const source=readFileSync(new URL('../src/simulation-worker.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 for(const selection of ['all','normal',monsterKey(game.monsters[2])]){
  for(const snapshot of [false,true]){
   const calls=[],messages=[],self={postMessage:value=>messages.push(value)};
   vm.runInNewContext(source,{self,selectedEnemies,simulateMonster:(state,monster)=>{calls.push(monster.id);return {key:monsterKey(monster)};}});
   self.onmessage({data:{state:snapshot?{format:'snapshot'}:defaults(),enemySelection:selection,now:0}});
   assert.deepEqual(calls,selectedEnemies(selection).monsters.map(m=>m.id));
   assert.equal(messages.at(-1).done,true);
  }
 }
});

test('character import preserves enemy choice and controls offer translated scopes and individual targets',()=>{
 const state=defaults();state.manual.enemySelection=monsterKey(game.monsters[0]);
 const imported=importCharacter(state,{version:2,capturedAt:Date.now(),player:{lastTick:1}});
 assert.equal(imported.state.manual.enemySelection,state.manual.enemySelection);
 for(const language of ['zh','en']){
  const html=manualControls(state,{language,number:()=>'',esc:v=>v,name:v=>v,options:choices=>choices.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}).simulation;
  assert.ok(!html.includes('boss'));
  assert.ok(html.includes('data-path="manual.enemySelection"'));
  assert.ok(!html.includes('value="normal"'));
  assert.ok(html.includes(language==='zh'?'全部':'All'));
  for(const key of game.monsters.map(monsterKey))assert.ok(html.includes(`value="${key}"`));
 }
});
