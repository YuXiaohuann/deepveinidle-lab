import {simulateCollection} from './collection-simulation.js';
self.onmessage=({data})=>{
 let lastProgress=0;
 try{const result=simulateCollection(data.state,data.id,data.jobId,{target:data.target,seed:data.seed,now:data.now,onProgress:progress=>{const now=performance.now();if(now-lastProgress>=250){lastProgress=now;self.postMessage({run:data.run,progress});}}});self.postMessage({run:data.run,result});}
 catch(error){self.postMessage({run:data.run,error:String(error.message??error)});}
};
