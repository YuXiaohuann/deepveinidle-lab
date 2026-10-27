export const enhancementPercentiles=Object.freeze([80,90,95]);
const maxStoredCells=5_000_000,maxEvaluatedCells=500_000_000;

// Decimal money is scaled with BigInt before GCD compression. Probabilities
// remain Float64; no random sampling or rounding of per-attempt costs is used.
function decimal(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('invalidPrice');
 const [mantissa,exp='0']=String(value).split('e'),parts=mantissa.split('.');
 const places=(parts[1]?.length??0)-Number(exp);
 return {units:BigInt(parts.join(''))*10n**BigInt(Math.max(0,-places)),places:Math.max(0,places)};
}
function integers(values){
 const parsed=values.map(decimal),places=Math.max(0,...parsed.map(x=>x.places));
 return {values:parsed.map(x=>x.units*10n**BigInt(places-x.places)),scale:10n**BigInt(places)};
}
const gcd=(a,b)=>{while(b){[a,b]=[b,a%b];}return a;};
function resourceLimit(reason,details={}){
 const error=Error('distributionLimit');error.details={reason,...details};throw error;
}
// Eliminate certain-success states by charging their entire forced path to
// the branch that enters it. Branch values below are total costs, not extras.
function stochasticStates(steps,start,values){
 const target=steps.length,next=Array(target+1).fill(target),forced=Array(target+1).fill(0n);
 for(let k=target-1;k>=0;k--){
  if(steps[k].chance===1){next[k]=next[k+1];forced[k]=values[2*k]+forced[k+1];}
  else next[k]=k;
 }
 const originals=steps.map((s,k)=>s.chance<1?k:null).filter(k=>k!==null);
 const index=new Map(originals.map((k,i)=>[k,i]));index.set(target,originals.length);
 return {
  prefix:forced[start],start:index.get(next[start]),
  steps:originals.map(k=>({chance:steps[k].chance,failTo:index.get(next[steps[k].failTo])})),
  values:originals.flatMap(k=>[values[2*k]+forced[k+1],values[2*k]+values[2*k+1]+forced[steps[k].failTo]])
 };
}
export function exactCostDistribution(steps,start,{alphas=[.95,.99],maxCells=maxStoredCells,maxWork=maxEvaluatedCells}={}){
 if(!Number.isSafeInteger(start)||start<0||start>steps.length||!Number.isSafeInteger(maxCells)||maxCells<=0||!Number.isSafeInteger(maxWork)||maxWork<=0||!alphas.length||alphas.some(a=>!Number.isFinite(a)||a<=0||a>=1))throw Error('invalidConfiguration');
 for(const [k,s]of steps.entries())if(!Number.isFinite(s.chance)||s.chance<=0||s.chance>1||!Number.isSafeInteger(s.failTo)||s.failTo<0||s.failTo>k)throw Error('invalidConfiguration');
 const {values,scale}=integers(steps.flatMap(s=>[s.cost,s.failureCost]));
 return solve(steps,start,values,scale,alphas,maxCells,maxWork);
}
function solve(steps,start,values,scale,alphas,maxCells,maxWork){
 let target=steps.length,prefix=0n;
 const output=(cost,probability)=>{
  cost+=prefix;
  if(!Number.isFinite(Number(scale))||cost>BigInt(Number.MAX_SAFE_INTEGER))throw Error('distributionPrecision');
  return {minPrice:Number(cost)/Number(scale),actualProbability:probability};
 };
 if(start===target)return {quantiles:alphas.map(alpha=>({alpha,...output(0n,1)})),evaluatedBudgetPoints:0};
 if(steps.slice(start).every(s=>s.chance===1)){
  const cost=steps.slice(start).reduce((total,_,i)=>total+values[(i+start)*2],0n);
  return {quantiles:alphas.map(alpha=>({alpha,...output(cost,1)})),evaluatedBudgetPoints:0};
 }
 ({steps,start,values,prefix}=stochasticStates(steps,start,values));
 target=steps.length;
 let unit=0n;
 for(const cost of values)unit=gcd(unit,cost);
 if(unit===0n)return {quantiles:alphas.map(alpha=>({alpha,...output(0n,1)})),evaluatedBudgetPoints:1};
 const points=Math.floor(maxWork/target);
 if(!points)resourceLimit('work',{states:target,maxWork});
 // Delays beyond the evaluated budget need no array index conversion.
 const index=v=>Number(v/unit>BigInt(points)?BigInt(points):v/unit);
 const costs=steps.map((_,k)=>index(values[2*k])),failureCosts=steps.map((_,k)=>index(values[2*k+1]));
 // A row only needs to retain values until its last incoming transition
 // has read them. The extra cell prevents overwriting a still-needed value.
 const lengths=steps.map(()=>1);
 for(let k=0;k<target;k++){
  if(k+1<target&&costs[k]<points)lengths[k+1]=Math.max(lengths[k+1],costs[k]+1);
  if(failureCosts[k]<points)lengths[steps[k].failTo]=Math.max(lengths[steps[k].failTo],failureCosts[k]+1);
 }
 const storedCells=lengths.reduce((sum,n)=>sum+n,0);
 if(storedCells>maxCells)resourceLimit('memory',{states:target,storedCells,maxCells});
 const rows=lengths.map(n=>new Float64Array(n)),found=new Map(),requested=new Set(alphas).size;
 for(let n=0;n<points;n++){
  for(let k=target-1;k>=0;k--){
   const s=steps[k],success=n-costs[k],failure=n-failureCosts[k];
   const win=success<0?0:k+1===target?1:rows[k+1][success%lengths[k+1]];
   // Only a self-loop may refer to this cell. Eliminate it algebraically.
   const self=s.failTo===k&&failure===n;
   if(costs[k]===0&&s.failTo<k&&failure===n)throw Error('distributionPrecision');
   const value=self?win:s.chance*win+(1-s.chance)*(failure<0?0:rows[s.failTo][failure%lengths[s.failTo]]);
   if(!Number.isFinite(value)||value<0||value>1+1e-12)throw Error('unreliableCalculation');
   rows[k][n%lengths[k]]=Math.min(1,value);
  }
  for(const alpha of alphas)if(!found.has(alpha)&&rows[start][n%lengths[start]]>=alpha)found.set(alpha,{alpha,...output(BigInt(n)*unit,rows[start][n%lengths[start]])});
  if(found.size===requested)return {quantiles:alphas.map(a=>found.get(a)),evaluatedBudgetPoints:n+1,storedCells,dpStates:target};
 }
 resourceLimit('work',{states:target,maxWork,evaluatedBudgetPoints:points,storedCells});
}
export function enhancementDistribution(input,result){
 if(result.pricedGold===null)return null;
 const {values,scale}=integers([input.shardPrice??0,input.scrollPrice??0,...result.steps.map(s=>s.gold)]);
 const steps=result.steps;
 const costs=result.steps.flatMap((s,k)=>[values[k+2]+BigInt(s.shards)*values[0],s.protected?values[1]:0n]);
 return solve(steps,input.current,costs,scale,enhancementPercentiles.map(p=>p/100),maxStoredCells,maxEvaluatedCells);
}
