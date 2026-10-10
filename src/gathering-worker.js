import {normalizeGathering,selectedGatheringJobs,selectedGatheringSites} from './gathering-model.js';
import {simulateGatheringJob} from './gathering-simulation.js';
self.onmessage=({data})=>{
 try{
  const state=normalizeGathering(data.state),jobs=selectedGatheringJobs(state).filter(j=>state.levels[j.skill]>=j.levelReq);
  const total=jobs.reduce((sum,j)=>sum+selectedGatheringSites(state,j).length,0);let completed=0;
  for(const job of jobs){const count=selectedGatheringSites(state,job).length;let processed=0;
   try{const result=simulateGatheringJob(state,job,{now:data.now,onSite:site=>{processed++;completed++;self.postMessage({progress:{completed,total,jobId:job.id,site}});}});self.postMessage({result});}
   catch(error){completed+=count-processed;self.postMessage({jobError:{jobId:job.id,message:String(error.message??error)},progress:{completed,total}});}
  }
  self.postMessage({done:true});
 }catch(error){self.postMessage({error:String(error.message??error)});}
};
