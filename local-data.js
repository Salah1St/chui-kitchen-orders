/* Device-only storage. No network requests or credentials. */
(function(root){
  'use strict';
  const APP='chui-kitchen-local',VERSION=1,DB='chui-kitchen-local-v1',STORE='ingredients';
  function normalizeEntry(entry,knownIds){
    if(!entry||!knownIds.has(entry.id)||!(entry.priceCents===null||(Number.isSafeInteger(entry.priceCents)&&entry.priceCents>=0&&entry.priceCents<=1000000000000))||typeof entry.unit!=='string'||!entry.unit.trim()||entry.unit.length>24||/[\u0000-\u001f\u007f]/.test(entry.unit))throw new Error('ราคา หน่วย หรือรหัสวัตถุดิบในไฟล์ไม่ถูกต้อง');
    return {id:entry.id,priceCents:entry.priceCents,unit:entry.unit.trim().replace(/\s+/g,' ')};
  }
  function validateEntries(entries,knownIds,complete=false){
    if(!Array.isArray(entries)||(complete&&entries.length!==knownIds.size))throw new Error('ไฟล์ต้องมีข้อมูลวัตถุดิบมาตรฐานครบทั้ง 87 รายการ');
    const seen=new Set();return entries.map(entry=>{const value=normalizeEntry(entry,knownIds);if(seen.has(value.id))throw new Error('มีรหัสวัตถุดิบซ้ำในไฟล์');seen.add(value.id);return value;});
  }
  function parseBackup(text,knownIds){
    if(typeof text!=='string'||text.length>262144)throw new Error('ไฟล์สำรองใหญ่เกินไป');
    let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('อ่านไฟล์ JSON ไม่ได้');}
    if(data?.app!==APP||data.schemaVersion!==VERSION)throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรอง Chui Kitchen ที่รองรับ');
    return validateEntries(data.items,knownIds,true);
  }
  function createBackup(items){return {app:APP,schemaVersion:VERSION,exportedAt:new Date().toISOString(),items:items.filter(x=>x.group!=='custom').map(({id,name,priceCents,unit})=>({id,name,priceCents,unit}))};}
  function createStore(indexedDB){
    let opening;
    function open(){
      if(!indexedDB)return Promise.reject(new Error('เครื่องนี้ยังบันทึกข้อมูลเว็บไม่ได้'));
      if(opening)return opening;
      opening=new Promise((resolve,reject)=>{
        let finished=false;
        const timer=setTimeout(()=>{if(!finished){finished=true;reject(new Error('เปิดที่เก็บข้อมูลไม่ได้ กรุณาปิดแท็บ Chui Kitchen อื่นแล้วเปิดใหม่'));}},5000);
        let request;try{request=indexedDB.open(DB,1);}catch(error){clearTimeout(timer);reject(error);return;}
        request.onupgradeneeded=()=>{if(finished){request.transaction.abort();return;}if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
        request.onsuccess=()=>{clearTimeout(timer);const db=request.result;if(finished){db.close();return;}finished=true;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
        request.onerror=()=>{clearTimeout(timer);if(!finished){finished=true;reject(request.error||new Error('เปิดที่เก็บข้อมูลไม่สำเร็จ'));}};
      });
      return opening;
    }
    async function transact(mode,operation){const db=await open();return new Promise((resolve,reject)=>{let result;const tx=db.transaction(STORE,mode);tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(tx.error||new Error('บันทึกข้อมูลในเครื่องไม่สำเร็จ'));try{operation(tx.objectStore(STORE),value=>{result=value;});}catch(error){try{tx.abort();}catch{}reject(error);}});}
    return {
      read:()=>transact('readonly',(store,set)=>{const request=store.getAll();request.onsuccess=()=>set(request.result);}),
      put:entry=>transact('readwrite',store=>{store.put({...entry});}),
      replace:entries=>transact('readwrite',store=>{store.clear();entries.forEach(entry=>store.put({...entry}));})
    };
  }
  const api={APP,VERSION,normalizeEntry,validateEntries,parseBackup,createBackup,createStore};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.ChuiLocalData=api;
})(typeof window==='undefined'?globalThis:window);
