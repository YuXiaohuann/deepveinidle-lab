import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {browserPath} from '../../scripts/release-common.mjs';
import {preset} from '../../src/model.js';
import {priceDefaults} from '../../src/item-prices.js';
import {gatheringDefaults} from '../../src/gathering-model.js';
import {masteryDefaults} from '../../src/mastery.js';

export function masteryBrowserBuild(){
 const combat=preset('ranged');combat.manual.simulationHours=1;combat.manual.enemySelection='monster-7';combat.manual.hotSetting='off';
 const gathering=gatheringDefaults();gathering.simulationHours=1/60;gathering.hotSetting='off';
 const mastery=masteryDefaults();mastery.totalPoints=123;mastery.current.maxhit=1;mastery.target.maxhit=1;
 const prices=priceDefaults();prices.preferences.autoImport=false;
 return {combat,gathering,mastery,prices};
}

// Isolated synthetic builds, disabled market auto-import, and observable Workers.
export async function openMasteryBrowser({url,results,build=masteryBrowserBuild(),viewport={width:1440,height:1100}}){
 let baseURL=url,server,browser;
 const close=async()=>{server?.kill();if(browser)await browser.close();};
 try{
  if(!baseURL){
   const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
   server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
   await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error('Server exited: '+code);})]);
   baseURL='http://127.0.0.1:'+port;results.base=baseURL;
  }
  browser=await chromium.launch({headless:true,executablePath:await browserPath()});
  const context=await browser.newContext({viewport});
  await context.addInitScript(({combat,mastery,prices,gathering})=>{
   if(!localStorage.getItem('dvi-simulator-v1'))localStorage.setItem('dvi-simulator-v1',JSON.stringify({language:'zh',state:combat}));
   if(!localStorage.getItem('dvi-gathering-v1'))localStorage.setItem('dvi-gathering-v1',JSON.stringify(gathering));
   if(!localStorage.getItem('dvi-mastery-v1'))localStorage.setItem('dvi-mastery-v1',JSON.stringify(mastery));
   if(!localStorage.getItem('dvi-item-prices-v1'))localStorage.setItem('dvi-item-prices-v1',JSON.stringify(prices));
   window.optimizerWorkers=[];const OriginalWorker=Worker;
   window.Worker=class extends OriginalWorker{
    constructor(url,options){super(url,options);this.optimizer=String(url).includes('mastery-optimizer-worker.js');if(this.optimizer){window.optimizerWorkers.push(this);this.addEventListener('message',({data})=>{if(data.result)this.result=data.result;});}}
    postMessage(data,...rest){if(this.optimizer){this.request=structuredClone(data);if(window.optimizerMode==='wait')return;if(window.optimizerMode==='error'){setTimeout(()=>this.onmessage({data:{error:'controlled failure'}}),0);return;}}return super.postMessage(data,...rest);}
    terminate(){this.wasTerminated=true;return super.terminate();}
   };
  },build);
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>results.errors.push(e.message));
  await page.goto(`${baseURL}/mastery`);
  return {page,context,close};
 }catch(error){await close();throw error;}
}
