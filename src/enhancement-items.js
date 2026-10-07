import * as game from './upstream.js';
import {enhanceableItems} from './enhancement.js';
const definitions=new Map([...game.equipment,...game.tools].map(x=>[x.itemId,x]));
export const enhancementTypes=[['all','全部','All'],['melee','近战武器','Melee weapons'],['ranged','远程武器','Ranged weapons'],['magic','法杖','Magic weapons'],['shield','副手','Off hand'],['helmet','头部','Head'],['body','胸部','Body'],['legs','腿部','Legs'],['ring','戒指','Rings'],['amulet','护符','Amulets'],['pickaxe','镐','Pickaxes'],['rod','鱼竿','Fishing rods'],['axe','斧','Axes'],['gloves','手套','Gloves'],['pan','锅','Pans'],['hammer','锤','Hammers'],['knife','刀','Knives'],['needle','针','Needles'],['mortar','研钵','Mortars'],['hoe','锄','Hoes'],['mount','坐骑','Mounts']];
export function enhancementItemType(id){const definition=definitions.get(id);if(!definition)throw Error('invalidItem');return definition.slot==='weapon'?(definition.magic?'magic':definition.ranged?'ranged':'melee'):definition.slot;}
export function enhancementItemsForType(type){return enhanceableItems.filter(x=>type==='all'||enhancementItemType(x.id)===type);}
