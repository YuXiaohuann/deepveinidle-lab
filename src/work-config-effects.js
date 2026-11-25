import {encode,outfitXpBonus,withRarity} from './upstream.js';
import {bonusPercent} from './number-format.js';

const outfitSlots = ['helmet','body','legs'];

export function configuredWorkEquipment(gear) {
  return Object.fromEntries(['shield',...outfitSlots].map(slot => {
    const {id,tier,plus} = gear[slot];
    return [slot,id ? encode(withRarity(id,tier),plus) : null];
  }));
}

export function outfitPiece(equipment, slot) {
  return {helmet:null,body:null,legs:null,[slot]:equipment[slot]};
}

export function workOutfitNote(equipment, skill, language, slot) {
  const label = slot ? ['本件经验','Piece XP'] : ['套装经验合计','Outfit XP total'];
  const worn = slot ? outfitPiece(equipment,slot) : equipment;
  return label[language === 'zh' ? 0 : 1] + ' ' + bonusPercent(outfitXpBonus(worn,skill),language);
}
