const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../world10-owner.js'),'utf8');
function screen(){
 const nodes=[{text:'ACCÈS PROPRIÉTAIRE'},
              {text:'Vérification de votre session sécurisée…'},
              {text:'La connexion est indépendante de l’activation de votre offre LOC.'},
              {text:'Période active jusqu’au 17/11/2027',kind:'private'},
              {text:'Jean Baptiste Beauville',kind:'private'}].map(e=>({
   nodeValue:e.text,
   parentElement:{
     closest(sel){return e.kind==='private'&&sel.includes('#meta')?{}:null}
   }
 }));
 const selector={
   value:'fr',handlers:{},
   addEventListener(name,cb){this.handlers[name]=cb},
   change(v){this.value=v;this.handlers.change()}
 };
 const doc={
   body:{},title:'DIGIY LOC — Accès propriétaire',
   documentElement:{lang:'fr',dir:'ltr'},
   getElementById(id){return id==='locWorld10Picker'?selector:null},
   createTreeWalker(){
     let index=-1;
     return {currentNode:null,nextNode(){index++;if(index>=nodes.length)return false;this.currentNode=nodes[index];return true}};
   }
 };
 const storage=new Map(),loc='https://pro-loc.digiylyfe.com/?site=saly';
 const ctx={document:doc,location:{search:'?site=saly',href:loc,pathname:'/',hash:''},
   URL,URLSearchParams,NodeFilter:{SHOW_TEXT:4},
   history:{replaceState(){}},
   localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
   MutationObserver:class{observe(){}}
 };
 ctx.window=ctx;
 vm.runInNewContext(source,ctx,{timeout:3000});
 return {api:ctx.DIGIY_LOC_OWNER_WORLD10,selector,doc,nodes,storage};
}
test('owner sees 10 locale options and can switch FR EN AR WO ZH without altering private data',()=>{
 const p=screen();assert.equal(p.api.locales.length,10);
 p.selector.change('en');
 assert.equal(p.nodes[0].nodeValue,'OWNER ACCESS');
 assert.equal(p.nodes[1].nodeValue,'Checking your secure session…');
 assert.equal(p.nodes[3].nodeValue,'Période active jusqu’au 17/11/2027');
 assert.equal(p.nodes[4].nodeValue,'Jean Baptiste Beauville');
 assert.equal(p.api.t('Période active jusqu’au '),'Active until ');
 p.selector.change('ar');
 assert.equal(p.doc.documentElement.dir,'rtl');
 assert.match(p.nodes[0].nodeValue,/[\u0600-\u06FF]/);
 p.selector.change('wo');
 assert.equal(p.nodes[0].nodeValue,'DUGGUB BOROOM');
 p.selector.change('zh');
 assert.match(p.nodes[0].nodeValue,/[\u4e00-\u9fff]/);
 p.selector.change('fr');
 assert.equal(p.nodes[0].nodeValue,'ACCÈS PROPRIÉTAIRE');
 assert.equal(p.nodes[1].nodeValue,'Vérification de votre session sécurisée…');
 assert.equal(p.storage.get('digiy_loc_owner_lang'),'fr');
});
test('login errors localize but server detail and access logic are not changed',()=>{
 const p=screen();
 p.api.setLang('es');
 assert.equal(p.api.t('✅ Compte connecté. ⚠️ Aucun droit LOC actif reconnu pour les outils réservés aux adhérents.'),
  '✅ Cuenta conectada. ⚠️ Sin derechos LOC activos para las funciones de miembros.');
 assert.equal(p.api.t('Envoi temporairement impossible. Réessayez plus tard.'),
  'Envío no disponible ahora. Inténtalo más tarde.');
 p.api.setLang('ar');
 assert.equal(p.api.locale(),'ar-SA');
 assert.equal(p.doc.documentElement.dir,'rtl');
});
