export const characterUpdateStorageKey=page=>`dvi-character-auto-import-${page}-v1`;
export function validateCharacterUpdates(raw){
 if(raw?.version!==1||typeof raw.config!=='boolean')throw Error('invalidAutoImport');
 return {version:1,config:raw.config};
}
export function loadCharacterUpdates(storage,page){
 const raw=storage.getItem(characterUpdateStorageKey(page));
 if(raw!==null)return validateCharacterUpdates(JSON.parse(raw));
 return {version:1,config:false};
}

// One controller per page. Redraws never recreate listeners or start reads.
export function createCharacterUpdater({storage,page,read,apply,onError=()=>{},onBusy=()=>{},busy=()=>false,revision=()=>null,hasDraft=()=>false,onSettings=()=>{}}){
 let options,settingsError=null;
 try{options=loadCharacterUpdates(storage,page);}
 catch{options={version:1,config:false};settingsError='load';}
 let active=false,running=false,generation=0,retry=false;
 async function run(manual=false){
  if(running||busy()||!active||(!manual&&!options.config)||(!manual&&hasDraft()))return;
  running=true;
  const token=generation,previous=revision();
  onBusy(true);
  try{
   const response=await read();
   if(!active||token!==generation||revision()!==previous||(!manual&&hasDraft()))return;
   if(!response.snapshot)throw Error('noSnapshot');
   await apply(response.snapshot);
  }catch(error){if(active&&token===generation)onError(error);}
  finally{
   running=false;onBusy(false);
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
   options=validateCharacterUpdates({...options,...next});generation++;
   try{storage.setItem(characterUpdateStorageKey(page),JSON.stringify(options));settingsError=null;}
   catch{settingsError='save';}
   onSettings();
   if(running)retry=true;else void run();
  },
  invalidate(){generation++;},
  trigger(){return run();},
  read(){return run(true);},
 };
}
