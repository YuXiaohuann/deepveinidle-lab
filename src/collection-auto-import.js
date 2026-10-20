export const collectionAutoImportStorageKey='dvi-collection-auto-import-v1';
export function validateCollectionAutoImport(raw){
 if(raw?.version!==1||typeof raw.enabled!=='boolean')throw Error('invalidAutoImport');
 return {version:1,enabled:raw.enabled};
}

// Lifecycle and request coalescing stay independent of UI redraws.
export function createCollectionAutoImporter({run,onError,listenFocus}){
 let enabled=false,active=false,busy=false,generation=0;
 async function trigger(){
  if(!enabled||!active||busy)return;
  busy=true;const current=generation;
  try{await run(()=>enabled&&active&&current===generation);}catch(error){onError(error);}finally{busy=false;}
 }
 const unlisten=listenFocus(trigger);
 return {
  set(next){
   if(typeof next.enabled!=='boolean'||typeof next.active!=='boolean')throw Error('invalidAutoImport');
   if(enabled===next.enabled&&active===next.active)return;
   enabled=next.enabled;active=next.active;generation++;
   if(enabled&&active)void trigger();
  },
  invalidate(){generation++;},
  dispose(){enabled=false;active=false;generation++;unlisten();},
 };
}
