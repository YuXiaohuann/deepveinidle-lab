import {selectedEnemies} from './enemy-selection.js';
import {simulateMonster} from './simulation.js';
self.onmessage=({data})=>{
 try{for(const monster of selectedEnemies(data.enemySelection??data.state.manual?.enemySelection).monsters)self.postMessage({result:simulateMonster(data.state,monster,{now:data.now})});self.postMessage({done:true});}
 catch(error){self.postMessage({error:String(error?.message??error)});}
};
