import assert from 'node:assert/strict';
import fs from 'node:fs';
import {game,preset} from '../src/model.js';
import {createScenario,simulateMonster} from '../src/simulation.js';

const manifest=JSON.parse(fs.readFileSync(new URL('../vendor/manifest.json',import.meta.url),'utf8'));
assert.equal(manifest.sha256,'fd1ef0cfa8dc09cd68b357077674a9661585834c5b0563e134671ccdd895005e');
let matched=0;
for(const style of ['melee','ranged','magic'])for(const monster of game.monsters){
 const player=createScenario(preset(style)).player;
 Object.assign(player,{id:127,lastTick:1500000,bank:{64:100,65:100,66:100},bankLocked:[65],foodItemId:null,guildBonus:.095,forgeLog:{3:7}});
 const windows=[{fromTick:1000000,toTick:1006000,xpMult:1.1,rarityMult:1.2}];
 const context={...game.createContext(game.world,314),windows};
 const zone=game.world.zones.find(z=>z.monsterId===monster.id);
 const native=game.predict(player,context,p=>game.startFight(p,context,zone.id));
 const snapshot={source:'predictor',clientBuild:'index-C3S-5Yeu.js',capturedAt:Date.now(),player,seed:314,windows};
 const result=simulateMonster({format:'snapshot',snapshot},monster);
 assert.deepEqual(result.bySkill,native.bySkill);
 assert.equal(result.deaths,native.deaths);assert.equal(result.elapsedTicks,native.ticks);
 assert.equal(result.xp,Object.values(native.bySkill).reduce((total,xp)=>total+xp,0));
 const items={...result.normalItems};
 for(const [id,qty]of Object.entries(result.rareItems))items[id]=(items[id]??0)+qty;
 if(native.itemsGained[game.coinItemId])items[game.coinItemId]=result.kills;
 assert.deepEqual(items,native.itemsGained);
 matched++;
}
console.log(`Current native predictor and full snapshot simulator: ${matched}/${matched} matched.`);
