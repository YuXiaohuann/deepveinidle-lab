import {optimizeMastery} from './mastery-optimizer.js';
self.onmessage=({data})=>{
 try{const result=optimizeMastery(data,{onProgress:progress=>self.postMessage({progress})});self.postMessage({result});}
 catch(error){self.postMessage({error:String(error?.message??error),itemIds:error.itemIds});}
};
