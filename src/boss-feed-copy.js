import {translatedName} from './i18n.js';

export const rarityNames = language => language === 'zh'
  ? ['普通','罕见','稀有','史诗','传说']
  : ['Normal','Uncommon','Rare','Epic','Legendary'];

export const skillName = (skill, language) => translatedName(skill[0].toUpperCase() + skill.slice(1), language);

export const escape = value => String(value ?? '').replace(/[&<>"']/g,
  char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export const option = (value, label) => `<option value="${escape(value)}">${escape(label)}</option>`;

export function bossText(language) {
  const zh = language === 'zh';
  const text = (chinese, english) => zh ? chinese : english;
  const numbers = new Intl.NumberFormat(zh ? 'zh-CN' : 'en', {maximumFractionDigits:2});
  return {
    text,
    skill:skill => skillName(skill,language),
    named:(chinese,english) => {
      const name = translatedName(english,language);
      return zh && name === english ? chinese : name;
    },
    rarity:tier => rarityNames(language)[tier],
    number:value => Number.isFinite(value) ? numbers.format(value) : '—',
    date:value => value ? new Date(value).toLocaleString(zh ? 'zh-CN' : 'en') : '',
  };
}
