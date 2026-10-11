import * as game from './upstream.js';
export const masteryStorageKey='dvi-mastery-v1';
export const masteryTracks=game.masteries;
export const masteryLimit=game.masteryRankLimit;
export function masteryDefaults(){return {mode:'limited',budget:0,totalPoints:0,current:Object.fromEntries(masteryTracks.map(m=>[m.id,0])),target:Object.fromEntries(masteryTracks.map(m=>[m.id,0]))};}
function integer(value,max){
 if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()==='')throw Error('invalidInteger');
 const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>max)throw Error('invalidInteger');return n;
}
export function validateMastery(raw){
 if(!raw||!['limited','unlimited'].includes(raw.mode))throw Error('invalidConfiguration');
 const s={mode:raw.mode,budget:0,totalPoints:raw.totalPoints==null?null:integer(raw.totalPoints,Number.MAX_SAFE_INTEGER),current:{},target:{}};
 for(const m of masteryTracks){s.current[m.id]=integer(raw.current?.[m.id],masteryLimit);s.target[m.id]=integer(raw.target?.[m.id],masteryLimit);if(s.target[m.id]<s.current[m.id])throw Error('targetBelowCurrent');}
 const currentCost=game.masteriesTotalCost(s.current);
 if(s.totalPoints===null)s.totalPoints=integer(currentCost+integer(raw.budget,Number.MAX_SAFE_INTEGER),Number.MAX_SAFE_INTEGER);
 s.budget=s.totalPoints-currentCost;
 return s;
}
export function calculateMastery(raw){
 const s=validateMastery(raw),currentCost=game.masteriesTotalCost(s.current),targetCost=game.masteriesTotalCost(s.target),spent=targetCost-currentCost;
 return {budget:s.budget,currentCost,targetCost,spent,remaining:s.budget-spent,rows:masteryTracks.map(m=>({id:m.id,current:s.current[m.id],target:s.target[m.id],cost:game.masteryTotalCost(s.target[m.id])-game.masteryTotalCost(s.current[m.id]),nextCost:s.target[m.id]===masteryLimit?null:game.masteryRankCost(s.target[m.id]+1)}))};
}
export function highestAffordableMastery(raw,id){
 const s=validateMastery(raw);if(!masteryTracks.some(m=>m.id===id))throw Error('unknownMastery');
 const result=calculateMastery(s),row=result.rows.find(m=>m.id===id),available=s.budget-(result.spent-row.cost);
 if(available<0)throw Error('otherTracksOverBudget');
 let low=s.current[id],high=masteryLimit;const base=game.masteryTotalCost(low);
 while(low<high){const mid=Math.ceil((low+high)/2);if(game.masteryTotalCost(mid)-base<=available)low=mid;else high=mid-1;}
 return low;
}

export function readMasterySettings(storage){
 const saved=storage.getItem(masteryStorageKey);return saved===null?masteryDefaults():validateMastery(JSON.parse(saved));
}
export function writeMasterySettings(storage,state){
 const {mode,totalPoints,current,target}=validateMastery(state);
 storage.setItem(masteryStorageKey,JSON.stringify({mode,totalPoints,current,target}));
}

export function importMastery(current,snapshot){
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 if(!record(snapshot)||snapshot.version!==2||!Number.isSafeInteger(snapshot.capturedAt)||snapshot.capturedAt<=0||snapshot.capturedAt>Date.now()+60000||!record(snapshot.player))throw Error('invalidSnapshot');
 const p=snapshot.player;
 if(!record(p.masteries)||!record(p.collections)||!record(p.forgeLog))throw Error('incompleteSnapshot');
 for(const [key,qty]of Object.entries(p.collections)){
  const id=Number(key);if(!Number.isSafeInteger(id)||id<1||String(id)!==key||game.itemTier(id)>4||!Number.isSafeInteger(qty)||qty<0)throw Error('invalidSnapshot');
  try{game.item(id);}catch{throw Error('invalidSnapshot');}
 }
 for(const [key,bits]of Object.entries(p.forgeLog)){const id=Number(key);if(!Number.isInteger(id)||id<0||id>=30||String(id)!==key||!Number.isInteger(bits)||bits<0||bits>2**30-1)throw Error('invalidSnapshot');}
 const ranks={};
 for(const m of masteryTracks){const value=snapshot.player.masteries[m.id]??0;
  if(Object.hasOwn(snapshot.player.masteries,m.id)&&typeof snapshot.player.masteries[m.id]!=='number')throw Error('invalidSnapshot');
  if(!Number.isSafeInteger(value)||value<0||value>masteryLimit)throw Error('invalidSnapshot');ranks[m.id]=value;
 }
 const totalPoints=game.masteryEarnedPoints(p),allocated=game.masteriesTotalCost(ranks),budget=totalPoints-allocated;
 if(!Number.isSafeInteger(totalPoints)||totalPoints<0||!Number.isSafeInteger(budget)||budget<0)throw Error('invalidSnapshot');
 const state=validateMastery({mode:'limited',budget,totalPoints,current:ranks,target:{...ranks}});
 return {state,capturedAt:snapshot.capturedAt};
}

export function changeMasteryTotal(raw,value){
 return validateMastery({...raw,totalPoints:integer(value,Number.MAX_SAFE_INTEGER)});
}
