/* DIGIY LOC — masque sécurité façade
   À inclure sur les pages LOC qui affichent encore des identifiants.
   Le moteur garde les données en session, mais l'écran ne les crie pas. */
(function(){
  "use strict";
  var PRO_CARNET_SIGNUP_URL="https://digiy-carnet-pro.digiylyfe.com/inscription-pay.html";
  function isSensitiveSlug(v){ return /loc-\d{7,}/i.test(String(v||"")); }
  function maskText(text){
    return String(text||"")
      .replace(/identifiant\s*:\s*loc-\d{7,}/gi,"identifiant : Espace logement sécurisé")
      .replace(/lieu\s*:\s*loc-\d{7,}/gi,"lieu : Espace logement sécurisé")
      .replace(/activité\s*:\s*LOC\s*\n\s*identifiant\s*:\s*loc-\d{7,}/gi,"activité : LOC\nidentifiant : Espace logement sécurisé")
      .replace(/loc-\d{7,}/gi,"Espace logement sécurisé")
      .replace(/(Téléphone\s*)\n?\s*(\+?221\d{9}|\d{9,})/gi,"$1\nCompte reconnu")
      .replace(/📞\s*(\+?221\d{9}|\d{9,})/g,"📞 Compte reconnu")
      .replace(/👤\s*(\+?221\d{9}|\d{9,})/g,"👤 Compte reconnu")
      .replace(/\b221\d{9}\b/g,"Compte reconnu");
  }
  function scrubNode(node){
    if(!node) return;
    if(node.nodeType===Node.TEXT_NODE){
      var before=node.nodeValue; var after=maskText(before);
      if(after!==before) node.nodeValue=after;
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE) return;
    if(node.matches && node.matches('script,style,textarea,input')) return;
    Array.from(node.childNodes||[]).forEach(scrubNode);
  }
  function scrubLinks(){
    document.querySelectorAll('a[href]').forEach(function(a){
      try{
        var raw=a.getAttribute('href')||'';
        var u=new URL(raw, location.href);
        u.searchParams.delete('phone');
        var s=u.searchParams.get('slug')||'';
        if(isSensitiveSlug(s)) u.searchParams.delete('slug');
        a.setAttribute('href', u.origin===location.origin ? u.pathname+u.search+u.hash : u.toString());
      }catch(e){}
    });
  }
  function fixOfficialLinks(){
    var button=document.getElementById('btnMonArgent');
    if(!button) return;
    button.setAttribute('href',PRO_CARNET_SIGNUP_URL);
    button.setAttribute('aria-label','S’inscrire à PRO CARNET');
    button.removeAttribute('target');
  }
  function cleanUrl(){
    try{
      var u=new URL(location.href); var changed=false;
      if(u.searchParams.has('phone')){u.searchParams.delete('phone'); changed=true;}
      var s=u.searchParams.get('slug')||'';
      if(isSensitiveSlug(s)){u.searchParams.delete('slug'); changed=true;}
      if(changed) history.replaceState({}, document.title, u.pathname+u.search+u.hash);
    }catch(e){}
  }
  function run(){ cleanUrl(); scrubNode(document.body); scrubLinks(); fixOfficialLinks(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', run); else run();
  new MutationObserver(function(){ run(); }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();