const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../world10-owner.js'),'utf8');
function screen(query){
  const boxes=new Map();
  for(const k of ['heading','intro','open','security','back'])boxes.set(k,{
    key:k,textContent:'',
    getAttribute(n){return n==='data-i18n'?this.key:null}
  });
  const picker={value:'fr',listeners:{},addEventListener(name,cb){this.listeners[name]=cb}};
  const anchor={href:''};
  const doc={
    documentElement:{lang:'fr',dir:'ltr'},
    getElementById(n){return n==='locWorld10Picker'?picker:n==='ownerLink'?anchor:null},
    querySelectorAll(s){return s==='[data-i18n]'?[...boxes.values()]:[]}
  };
  const storage=new Map();
  const changes=[];
  const href='https://pro-loc.digiylyfe.com/'+query;
  const u=new URL(href);
  const ctx={
    document:doc,URL,URLSearchParams,
    location:{search:u.search,href:u.href,pathname:u.pathname,hash:u.hash},
    history:{replaceState(...args){changes.push(args[2])}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}
  };
  vm.runInNewContext(script,ctx,{timeout:4000});
  return{boxes,picker,anchor,doc,storage,changes,
    choose(lang){picker.value=lang;picker.listeners.change()}};
}
test('owner slug from working professional fiche reaches actual LOC owner portal',()=>{
 const p=screen('?site=saly-chez-baptiste&lang=fr');
 const u=new URL(p.anchor.href);
 assert.equal(u.origin,'https://pro-espace.digiylyfe.com');
 assert.equal(u.searchParams.get('module'),'loc');
 assert.equal(u.searchParams.get('site'),'saly-chez-baptiste');
 assert.equal(u.searchParams.get('lang'),'fr');
 assert.match(p.boxes.get('open').textContent,/OUVRIR MON ESPACE/);
 p.choose('en');
 const next=new URL(p.anchor.href);
 assert.equal(next.searchParams.get('site'),'saly-chez-baptiste');
 assert.equal(next.searchParams.get('lang'),'en');
 assert.match(p.boxes.get('heading').textContent,/Your LOC owner/);
 assert.equal(p.storage.get('digiy_loc_owner_lang'),'en');
});
test('unsafe site identifier is dropped and never becomes a redirect URL',()=>{
 const p=screen('?site=https://phishing.example/&lang=zh');
 const u=new URL(p.anchor.href);
 assert.equal(u.origin,'https://pro-espace.digiylyfe.com');
 assert.equal(u.searchParams.get('site'),null);
 assert.equal(u.searchParams.get('lang'),'zh');
 assert.equal(p.doc.documentElement.lang,'zh');
 p.choose('ar');
 assert.equal(p.doc.documentElement.dir,'rtl');
 assert.match(p.boxes.get('heading').textContent,/[\u0600-\u06ff]/);
});
test('unscoped LOC link opens proprietor list, not an arbitrary rental or public vitrine',()=>{
 const p=screen('?lang=wo');
 const u=new URL(p.anchor.href);
 assert.equal(u.searchParams.get('site'),null);
 assert.equal(u.searchParams.get('module'),'loc');
 assert.equal(p.doc.documentElement.lang,'wo');
 assert.match(p.boxes.get('heading').textContent,/boroom LOC/);
 p.choose('fr');
 assert.equal(p.doc.documentElement.dir,'ltr');
 assert.equal(new URL(p.anchor.href).searchParams.get('lang'),'fr');
});
