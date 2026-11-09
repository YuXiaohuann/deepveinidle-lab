import {translatedName} from '../../src/i18n.js';

export async function selectSearchOption(page,id,item){
 const language=await page.locator('#language').inputValue();
 await page.locator(`#${id}`).fill(item.name);
 await page.locator(`#${id}-list`).getByRole('option',{name:`${translatedName(item.name,language)} · ${item.levelReq??item.level}`,exact:true}).click();
}
