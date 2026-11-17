const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../world10-owner.js'),'utf8');

function screen(query){
 const els=new Map();
 for(const key of ['heading','intro','open','security','back','choose','saly','sarlat','other','site']){
   els.set(key,{key,textContent:'',getAttribute(x){return x==='data-i18n'?this.key:null}});
 }
 const picker={value:'fr',callbacks:{},addEventListener(t,fn){this.callbacks[t]=fn}};
 const makeAnchor=()=>({href:'',hidden:false,removeAttribute(name){if(name==='href')this.href=''}});
 const main=makeAnchor(),sarlat=makeAnchor(),custom=makeAnchor();
 const document={
  documentElement:{lang:'fr',dir:'ltr'},
  getElementById(id){return {
    locWorld10Picker:picker,ownerLink:main,sarlatLink:sarlat,customOwnerLink:custom
  }[id]||null},
  querySelectorAll(s){return s==='[data-i18n]'?[...els.values()]:[]}
 };
 const u=new URL('https://pro-loc.digiylyfe.com/'+query),memory=new Map();
 const ctx={document,URL,URLSearchParams,location:{search:u.search,href:u.href,pathname:u.pathname,hash:u.hash},
   history:{replaceState(){}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};
 vm.runInNewContext(source,ctx,{timeout:3000});
 return{document,main,sarlat,custom,els,memory,change(lang){picker.value=lang;picker.callbacks.change()}};
}
test('public entry Saly exactly retains the site the working PRO fiche passes',()=>{
 const p=screen('?lang=fr');
 const u=new URL(p.main.href);
 assert.equal(u.origin,'https://pro-espace.digiylyfe.com');
 assert.equal(u.searchParams.get('site'),'saly-chez-baptiste');
 assert.equal(u.searchParams.get('module'),null);
 assert.equal(u.searchParams.get('lang'),'fr');
 assert.equal(new URL(p.sarlat.href).searchParams.get('site'),'sarlat-chez-baptiste');
 assert.equal(p.custom.hidden,true);
 p.change('en');
 assert.equal(new URL(p.main.href).searchParams.get('site'),'saly-chez-baptiste');
 assert.equal(new URL(p.main.href).searchParams.get('lang'),'en');
 assert.match(p.els.get('saly').textContent,/OWNER ACCESS/);
 assert.equal(p.memory.get('digiy_loc_owner_lang'),'en');
});
test('known site scoped Saly, Sarlat never loses slug and no generic landing',()=>{
 const a=screen('?site=saly-chez-baptiste');
 assert.equal(new URL(a.main.href).searchParams.get('site'),'saly-chez-baptiste');
 assert.equal(a.custom.hidden,true);
 const b=screen('?site=sarlat-chez-baptiste');
 assert.equal(new URL(b.sarlat.href).searchParams.get('site'),'sarlat-chez-baptiste');
 assert.equal(b.custom.hidden,true);
});
test('new tenant slug from a professional fiche gets its own link but no arbitrary domain',()=>{
 const p=screen('?site=ngaparou-villa-2026&lang=wo');
 assert.equal(p.custom.hidden,false);
 const u=new URL(p.custom.href);
 assert.equal(u.origin,'https://pro-espace.digiylyfe.com');
 assert.equal(u.searchParams.get('site'),'ngaparou-villa-2026');
 assert.equal(u.searchParams.get('lang'),'wo');
 assert.equal(p.document.documentElement.lang,'wo');
 p.change('ar');
 assert.equal(p.document.documentElement.dir,'rtl');
 assert.equal(new URL(p.custom.href).searchParams.get('lang'),'ar');
});
test('unsafe site slug cannot redirect to arbitrary URL',()=>{
 const p=screen('?site=https://phishing.example/%2F&lang=zh');
 assert.equal(p.custom.hidden,true);
 assert.equal(new URL(p.main.href).origin,'https://pro-espace.digiylyfe.com');
 assert.equal(p.document.documentElement.lang,'zh');
 p.change('fr');
 assert.equal(p.document.documentElement.dir,'ltr');
});
