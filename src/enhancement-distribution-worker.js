import {calculateEnhancement} from './enhancement.js';
import {enhancementDistribution} from './enhancement-distribution.js';
self.onmessage=({data})=>{
 try{self.postMessage({result:enhancementDistribution(data,calculateEnhancement(data))});}
 catch(error){self.postMessage({error:error.message,details:error.details});}
};
