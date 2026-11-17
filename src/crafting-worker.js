import {craftingJobs} from './crafting-model.js';
import {simulateCraftingWindow} from './crafting-simulation.js';
self.onmessage=({data})=>{
 const total=data.recipes.length;let completed=0,lastProgress=0;
 try{
  for(const recipe of data.recipes){
   try{
    const job=craftingJobs.find(j=>j.id===recipe.jobId);if(!job)throw Error('invalidRecipe');
    const result=simulateCraftingWindow(data.state,job,recipe.tier,{now:data.now,seed:data.seed,onProgress:()=>{const time=performance.now();if(time-lastProgress<250)return;lastProgress=time;self.postMessage({progress:{completed,total,key:recipe.key}});}});
    self.postMessage({result:{...result,key:recipe.key}});
   }catch(error){self.postMessage({jobError:{key:recipe.key,message:String(error.message??error)}});}
   completed++;self.postMessage({progress:{completed,total}});
  }
  self.postMessage({done:true});
 }catch(error){self.postMessage({error:String(error.message??error)});}
};
