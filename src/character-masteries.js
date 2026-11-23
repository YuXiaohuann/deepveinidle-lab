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
