import {craftingJobs} from './crafting-model.js';
import {simulateCrafting,simulateCraftingWindow} from './crafting-simulation.js';
self.onmessage=({data})=>{
 const total=data.plans.length;let completed=0,lastProgress=0;
 try{
  for(const plan of data.plans){
   try{
    const job=craftingJobs.find(j=>j.id===plan.jobId);if(!job)throw Error('invalidRecipe');
    const simulate=plan.mode==='rate'?(state,recipe,tier,count,options)=>simulateCraftingWindow(state,recipe,tier,options):simulateCrafting;
    const result=simulate(data.state,job,plan.tier,plan.count,{now:data.now,seed:data.seed,onProgress:row=>{const time=performance.now();if(time-lastProgress<250)return;lastProgress=time;self.postMessage({progress:{completed,total,key:plan.key,count:row.count,ticks:row.ticks,rowCompleted:row.completed}});}});
    self.postMessage({result:{...result,key:plan.key},mode:plan.mode});
   }catch(error){self.postMessage({jobError:{key:plan.key,mode:plan.mode,message:String(error.message??error)}});}
   completed++;self.postMessage({progress:{completed,total}});
  }
  self.postMessage({done:true});
 }catch(error){self.postMessage({error:String(error.message??error)});}
};
