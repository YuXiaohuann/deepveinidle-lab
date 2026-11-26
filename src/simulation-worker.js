import {monsterKey,selectedEnemies} from './enemy-selection.js';
import {simulateMonster} from './simulation.js';
self.onmessage=({data})=>{
 try{
  const completedEnemies=new Set(data.completedEnemies);
  for(const monster of selectedEnemies(data.enemySelection??data.state.manual?.enemySelection).monsters){
   if(!completedEnemies.has(monsterKey(monster)))self.postMessage({result:simulateMonster(data.state,monster,{now:data.now,seed:data.seed})});
  }
  self.postMessage({done:true});
 }
 catch(error){self.postMessage({error:String(error?.message??error)});}
};
