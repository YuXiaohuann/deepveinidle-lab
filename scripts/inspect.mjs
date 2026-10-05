import fs from 'node:fs';
const s=fs.readFileSync('vendor/game-original.js','utf8');
for(const q of ['Gnawer:"','"Vein Colossus":','function u1(']){const i=s.indexOf(q);console.log(q,i,s.slice(i-150,i+800));}
for(const m of s.matchAll(/\bNh\b/g))console.log(m.index,s.slice(m.index-350,m.index+400));
