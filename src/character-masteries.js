const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const pageNumber=value=>value===1||value===2||value===3;

export function characterMasteries(player,skill){
 const current={ranks:player.masteries,source:{page:null}};
 const {masteryPage,masterySkills,masteryAway}=player;
 if(!skill||!pageNumber(masteryPage)||!record(masterySkills)||!Object.hasOwn(masterySkills,skill))return current;

 const page=masterySkills[skill];
 if(page===masteryPage){
  return record(masteryAway)&&Object.keys(masteryAway).length?{ranks:current.ranks,source:{page,skill}}:current;
 }
 if(pageNumber(page)&&record(masteryAway)&&Object.hasOwn(masteryAway,page)&&record(masteryAway[page])){
  return {ranks:masteryAway[page],source:{page,skill}};
 }
 return {...current,source:{page:null,fallback:true}};
}

export function restoreSkillMasteries(state,raw,skills,rankLimit){
 if(!record(raw))return;
 const ranks=Object.keys(state.masteries);
 const profiles=Object.fromEntries(skills.filter(skill=>record(raw[skill])).map(skill=>[
  skill,Object.fromEntries(ranks.map(id=>{
   const rank=raw[skill][id];
   return [id,Number.isInteger(rank)&&rank>=0&&rank<=rankLimit?rank:0];
  })),
 ]));
 if(Object.keys(profiles).length)state.masteriesBySkill=profiles;
}

export function switchSkillMasteries(state,previousSkill,nextSkill){
 if(previousSkill===nextSkill)return;
 if(!state.masteriesBySkill)rememberSkillMasteries(state,previousSkill);
 const ranks=state.masteriesBySkill?.[nextSkill];
 state.masteries=ranks?{...ranks}:emptyMasteryRanks(state.masteries);
}

export function rememberSkillMasteries(state,skill){
 (state.masteriesBySkill??={})[skill]={...state.masteries};
}

export const emptyMasteryRanks=ranks=>Object.fromEntries(Object.keys(ranks).map(id=>[id,0]));
