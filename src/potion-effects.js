import {
  abyssalGoldBonus,bossFeedRules,brewRarityMultiplier,brewScale,hasteAttackSpeedBonus,nourishHealingBonus,
  warriorAccuracyBonus,warriorMaxHitBonus,workXpMultiplier,
} from './upstream.js';
import {bonusPercent} from './number-format.js';

const percentageEffects = {
  gatherer:['采集经验','Gathering XP',player => workXpMultiplier(player,true) - 1],
  hunter:['稀有度与稀有发现','Rarity and rare finds',player => brewRarityMultiplier(player) - 1],
  elixir:['所有经验','All XP',player => workXpMultiplier(player,false) - 1],
  abyssal:['怪物金币','Monster coins',(_,scale) => abyssalGoldBonus * scale],
  swift:['移动速度','Movement speed',(_,scale) => bossFeedRules.swiftSpeedBonus * scale],
  nourish:['食物治疗','Food healing',(_,scale) => nourishHealingBonus * scale],
  haste:['攻击速度','Attack speed',(_,scale) => hasteAttackSpeedBonus * scale],
};

export function potionEffectNote(kind, tier, language) {
  // Isolate this potion from the other buffs applied by the player's build.
  const player = {lastTick:0,brews:{[kind]:tier < 0 ? 0 : 1},brewTier:{[kind]:tier}};
  const scale = brewScale(player,kind);
  const isChinese = language === 'zh';
  if (kind === 'warrior') {
    const accuracy = Math.round(warriorAccuracyBonus * scale);
    const maxHit = bonusPercent(warriorMaxHitBonus * scale,language);
    return isChinese ? `命中 +${accuracy} · 最大伤害 ${maxHit}` : `Accuracy +${accuracy} · Max hit ${maxHit}`;
  }
  const [chinese,english,effect] = percentageEffects[kind];
  return (isChinese ? chinese : english) + ' ' + bonusPercent(effect(player,scale),language);
}
