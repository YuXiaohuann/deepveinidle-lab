export const characterUpdateStorageKey=page=>`dvi-character-auto-import-${page}-v1`;
export function validateCharacterUpdates(raw,{inventory=false}={}){
 if(raw?.version!==1||typeof raw.config!=='boolean'||typeof raw.inventory!=='boolean'||(!inventory&&raw.inventory))throw Error('invalidAutoImport');
 return {version:1,config:raw.config,inventory:raw.inventory};
}
export function loadCharacterUpdates(storage,page,inventory=false){
 const raw=storage.getItem(characterUpdateStorageKey(page));
 if(raw!==null)return validateCharacterUpdates(JSON.parse(raw),{inventory});
 if(page==='collection'){
  const old=storage.getItem('dvi-collection-auto-import-v1');
  if(old!==null){const saved=JSON.parse(old);if(saved?.version!==1||typeof saved.enabled!=='boolean')throw Error('invalidAutoImport');return {version:1,config:saved.enabled,inventory:saved.enabled};}
 }
 return {version:1,config:false,inventory};
}

// One controller per page. Redraws never recreate listeners or start reads.
export function createCharacterUpdater({storage,page,inventory=false,read,apply,onError=()=>{},onBusy=()=>{},busy=()=>false,revision=()=>null,hasDraft=()=>false,onSettings=()=>{}}){
 let options,settingsError=null;
 try{options=loadCharacterUpdates(storage,page,inventory);}
 catch{options={version:1,config:false,inventory:false};settingsError='load';}
 let active=false,running=false,generation=0,retry=false;
 const automatic=()=>({config:options.config,inventory:options.inventory});
 async function run(flags=automatic(),manual=false){
  if(running||busy()||!active||(!flags.config&&!flags.inventory)||(!manual&&hasDraft()))return;
  running=true;
  const token=generation,previous=revision();
  onBusy(true,flags);
  try{
   const response=await read();
   if(!active||token!==generation||revision()!==previous||(!manual&&hasDraft()))return;
   if(!response.snapshot)throw Error('noSnapshot');
   await apply(response.snapshot,flags);
  }catch(error){if(active&&token===generation)onError(error,flags);}
  finally{
   running=false;onBusy(false,flags);
   if(retry){retry=false;void run();}
  }
 }
 return {
  get options(){return {...options};},
  get settingsError(){return settingsError;},
  setActive(value){
   if(value===active)return;
   active=value;generation++;
   if(active){if(running)retry=true;else void run();}
  },
  configure(next){
   options=validateCharacterUpdates({...options,...next},{inventory});generation++;
   try{storage.setItem(characterUpdateStorageKey(page),JSON.stringify(options));settingsError=null;}
   catch{settingsError='save';}
   onSettings();
   if(running)retry=true;else void run();
  },
  invalidate(){generation++;},
  trigger(){return run();},
  read(flags){return run(flags,true);},
 };
}
