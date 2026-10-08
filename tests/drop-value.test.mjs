import test from 'node:test';
import assert from 'node:assert/strict';
import {game,preset} from '../src/model.js';
import {dropValue,simulateMonster} from '../src/simulation.js';

test('vendor valuation ignores rarity and enhancement and retains unsellable quantities',()=>{
 const id=game.equipment.find(i=>game.canSell(i.itemId)).itemId;
 const upgraded=game.encode(game.withRarity(id,4),10);
 assert.equal(game.vendorPrice(upgraded),game.vendorPrice(id));
 const items={[id]:2,[upgraded]:3,316:4};
 assert.equal(dropValue(items),game.vendorPrice(id)*5);
 assert.equal(items[316],4);
 assert.equal(dropValue({}),0);
 assert.throws(()=>dropValue({999999999:1}));
});

test('combat income adds coin rewards and both original vendor drop values',()=>{
 const state=preset('ranged');state.manual.hotSetting='off';
 const r=simulateMonster(state,game.monsters[0]);
 assert.equal(r.normalValue,dropValue(r.normalItems));
 assert.equal(r.rareValue,dropValue(r.rareItems));
 assert.equal(r.totalIncome,r.coins+r.normalValue+r.rareValue);
 assert.equal(r.normal,Object.values(r.normalItems).reduce((a,b)=>a+b,0));
});
