import {game} from './model.js';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const tick=value=>Number.isSafeInteger(value)&&value>=0;
// Require the complete collections consumed by the original clone and timeline.
const maps=['skills','equipment','bank','overflow','plots','guide','perks','house','housePoints','houseFurniture','houseUpgrades','quests','streak','brews','brewTier','tally','collection','collections','masteries','achievements'];
const lists=['pack','bankOrder','bankLocked','queue','tunics','houseCells','titles'];
export function importSnapshot(snapshot){
 if(!record(snapshot)||snapshot.version!==2)throw Error('invalidSnapshot');
 if(snapshot.captureError==='incompatibleClient'||snapshot.clientBuild!==undefined&&snapshot.clientBuild!=='index-C3S-5Yeu.js')throw Error('incompatibleClient');
 const input=snapshot.prediction;
 if(!input||input.source!=='predictor')throw Error('predictionMissing');
 if(input.clientBuild!=='index-C3S-5Yeu.js')throw Error('incompatibleClient');
 const p=input.player;
 if(!record(p)||!tick(input.capturedAt)||input.capturedAt>Date.now()+60000||!tick(p.lastTick)||!Number.isSafeInteger(p.id)||!Number.isSafeInteger(input.seed)||!Array.isArray(input.windows))throw Error('invalidSnapshot');
 if(maps.some(key=>!record(p[key]))||lists.some(key=>!Array.isArray(p[key]))||!Array.isArray(p.quests.daily)||!Array.isArray(p.quests.weekly)||!record(p.tally.items)||!record(p.tally.monsters))throw Error('incompleteSnapshot');
 if(game.allSkills.some(key=>typeof p.skills[key]!=='number'||!Number.isFinite(p.skills[key])||p.skills[key]<0))throw Error('incompleteSnapshot');
 if(input.windows.some(w=>!record(w)||!tick(w.fromTick)||!tick(w.toTick)||w.toTick<w.fromTick||['xpMult','rarityMult'].some(key=>w[key]!==undefined&&(!Number.isFinite(w[key])||w[key]<0))))throw Error('invalidSnapshot');
 const copy=structuredClone(input);
 // Exercise the native initialization before replacing any page state.
 try{game.predict(copy.player,game.createContext(game.world,copy.seed),()=>false);}catch(error){throw Error('incompatibleSnapshot: '+error.message);}
 return copy;
}
