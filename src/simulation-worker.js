import {game} from './model.js';
import {simulateMonster} from './simulation.js';
self.onmessage=({data})=>{
 try{for(const monster of game.monsters)self.postMessage({result:simulateMonster(data.state,monster,{now:data.now})});self.postMessage({done:true});}
 catch(error){self.postMessage({error:String(error?.message??error)});}
};
