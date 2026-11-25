export function formatOneDecimal(value, language) {
 return value.toLocaleString(language==='zh'?'zh-CN':'en',{minimumFractionDigits:1,maximumFractionDigits:1});
}

export function bonusPercent(bonus, language) {
 return '+' + (bonus * 100).toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:2}) + '%';
}

export function formatUnitPrice(value, language) {
 return compactNumber(value)??value.toLocaleString(language==='zh'?'zh-CN':'en',{maximumFractionDigits:0});
}

// Return null below the threshold so callers retain their existing precision.
export function compactNumber(value) {
 const absolute=Math.abs(value);
 if(absolute<1000)return null;
 const units=[[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'K']];
 let index=units.findIndex(([scale])=>absolute>=scale);
 // Promote a rounded 1000K to 1M, and likewise for the larger units.
 if(index>0&&Number((absolute/units[index][0]).toFixed(2))>=1000)index--;
 const [scale,suffix]=units[index];
 return (value/scale).toFixed(2)+suffix;
}
