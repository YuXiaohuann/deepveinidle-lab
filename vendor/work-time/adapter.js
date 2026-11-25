export function requireCapability(valid,feature,capability){
 if(valid)return;
 const error=Error(`invalidGameAdapter: ${feature} requires ${capability}`);
 error.feature=feature;error.capability=capability;throw error;
}

export function validateAdapter(game){
 requireCapability(game!==null&&typeof game==='object'&&!Array.isArray(game),'createWorkTimeEngine','game');
}

export function callRule(game,capability,feature,...args){
 const rule=game[capability];
 requireCapability(typeof rule==='function',feature,capability);
 return rule.apply(game,args);
}

export function tickMilliseconds(game,feature){
 const value=game.tickMs;
 requireCapability(Number.isFinite(value)&&value>0,feature,'tickMs');
 return value;
}
