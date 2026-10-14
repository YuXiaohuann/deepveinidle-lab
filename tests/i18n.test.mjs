import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from '../src/model.js';
import {dictionary,fallbackTranslations,translatedName,translatedItemName} from '../src/i18n.js';

test('all four upstream dictionaries retain precedence over missing-term supplements',()=>{
 const upstream={...game.uiTranslations,...game.worldTranslations,...game.translations,...game.homeTranslations};
 for(const [english,chinese] of Object.entries(upstream))assert.equal(dictionary[english],chinese,english);
 for(const english of Object.keys(fallbackTranslations))assert.equal(upstream[english],undefined,english);
 assert.equal(translatedName("Hunter's brew",'zh'),'猎人酿剂');
 assert.equal(translatedName("Hunter's brew",'en'),"Hunter's brew");
 assert.equal(translatedName('unknown game term','zh'),'unknown game term');
});

test('every base item, monster, room, mastery and perk has an upstream Chinese name',()=>{
 const entries=[...game.items.filter(x=>game.baseItemId(x.id)===x.id),...game.monsters,...game.bosses,...game.rooms,...game.masteries,...game.perks];
 for(const entry of entries){assert.ok(dictionary[entry.name],entry.name);assert.notEqual(translatedName(entry.name,'zh'),entry.name,entry.name);}
 for(const item of game.items){const base=game.item(game.baseItemId(item.id));assert.equal(translatedItemName(item.id,'zh'),dictionary[base.name],item.name);}
 for(const entry of [...game.masteries,...game.perks]){const description=entry.blurb??entry.each;assert.ok(dictionary[description],description);}
});
