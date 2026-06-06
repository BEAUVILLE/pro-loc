/* DIGIYLYFE — Orientation PRO · action-digiy-pro-orient.js
   Rôle : moteur d'orientation pro partagé entre les 10 hub.html.
   Le pro exprime un besoin → les fiches modules remontent → bouton PIN direct.
   Doctrine : aucun hub pro ouvert sans PIN. Ce fichier oriente, le guard protège.
   Version : action-digiy-pro-orient-20260606
*/
(function(){
  "use strict";

  var VERSION = "action-digiy-pro-orient-20260606";
  var DIGIY_CONTACT = "221771342889";

  /* ─────────────────────────────────────────────
     10 MODULES PRO — fiches + clés terrain
  ───────────────────────────────────────────── */
  var MODULES = [
    {
      id:"MARKET", icon:"🛍️", tag:"#je-vends", title:"Je vends — MARKET",
      desc:"Ma boutique, mes produits, mes ventes directes. Catalogue, prix, stock, contact client.",
      pin:"https://pro-market.digiylyfe.com/pin.html",
      hub:"https://pro-market.digiylyfe.com/hub.html",
      wa:"Bonjour, je suis pro DIGIY MARKET. Je souhaite de l'aide pour mon module Je vends.",
      keys:["vendre","vente","vends","boutique","produit","catalogue","stock","prix","market","commerce",
            "article","marchandise","client","commande","vêtement","vetement","tissu","pagne","cosmetique",
            "cosmétique","alimentation","epicerie","épicerie","fourniture","electronique","électronique",
            "local","magasin","acheter","achat","offre","promotion","solde","réapprovisionnement"]
    },
    {
      id:"CAISSE", icon:"💰", tag:"#mon-commerce", title:"Mon commerce — CAISSE",
      desc:"Encaisser, suivre mes ventes, garder la main. POS, ticket, stats, notes rapides.",
      pin:"https://commerce-pro.digiylyfe.com/pin.html",
      hub:"https://commerce-pro.digiylyfe.com/hub.html",
      wa:"Bonjour, je suis pro DIGIY CAISSE. Je souhaite de l'aide pour mon module Mon commerce.",
      keys:["caisse","pos","encaisser","ticket","vente","stats","statistique","chiffre","journee","journée",
            "recette","tpe","terminal","recu","reçu","facture","tva","note","collegue","collègue","station",
            "inventaire","gestion","commerce","mon commerce","marchandise","stock caisse","fermeture"]
    },
    {
      id:"LOC", icon:"🏠", tag:"#je-loue", title:"Je loue — LOC",
      desc:"Mes logements, disponibilités, clients directs. Villa, chambre, studio — 0% commission.",
      pin:"https://pro-loc.digiylyfe.com/pin.html",
      hub:"https://pro-loc.digiylyfe.com/hub.html",
      wa:"Bonjour, je suis pro DIGIY LOC. Je souhaite de l'aide pour mon module Je loue.",
      keys:["louer","location","logement","chambre","villa","maison","studio","appartement","appart",
            "hebergement","hébergement","disponibilite","disponibilité","calendrier","sejour","séjour",
            "client","reservation","réservation","nuit","week-end","weekend","tarif","loc","saly",
            "petite cote","petite côte","mbour","ngaparou","proprietaire","propriétaire","gite","gîte"]
    },
    {
      id:"RESA", icon:"📅", tag:"#je-reserve", title:"Je réserve — RESA",
      desc:"Mes créneaux bloqués, mon planning clair. Réservations resto, services, rendez-vous.",
      pin:"https://pro-resa-resto.digiylyfe.com/pin.html",
      hub:"https://pro-resa-resto.digiylyfe.com/hub.html",
      wa:"Bonjour, je suis pro DIGIY RESA. Je souhaite de l'aide pour mon module Je réserve.",
      keys:["reservation","réservation","reserver","réserver","planning","creneau","créneau","agenda",
            "calendrier","dispo","disponible","table","couverts","resto","restaurant","rdv","rendez-vous",
            "confirmer","annuler","modifier","bloquer","date","heure","service","midi","soir","semaine"]
    },
    {
      id:"DRIVER", icon:"🚗", tag:"#je-conduis", title:"Je conduis — DRIVER",
      desc:"Mes zones, mes tarifs, ma présence chauffeur. Trajets, transferts, AIBD — 0% commission.",
      pin:"https://pro-driver.digiylyfe.com/pin.html",
      hub:"https://pro-driver.digiylyfe.com/hub.html",
      wa:"Bonjour, je suis pro DIGIY DRIVER. Je souhaite de l'aide pour mon module Je conduis.",
      keys:["chauffeur","driver","conduire","conduite","trajet","course","taxi","aibd","aeroport","aéroport",
            "transfert","navette","dakar","saly","mbour","zone","tarif","prix trajet","vehicule","véhicule",
            "voiture","sedan","4x4","minibus","sept places","7 places","disponible","planning chauffeur",
            "client","ride","transport","diamniadio","thies","thiès","ziguinchor"]
    },
    {
      id:"JOBS", icon:"💼", tag:"#je-recrute", title:"Je recrute — JOBS",
      desc:"Publier une offre, recevoir les candidatures. Recrutement terrain direct, sans intermédiaire.",
      pin:"https://pro-job.digiylyfe.com/pin.html",
      hub:"https://pro-job.digiylyfe.com/hub.html",
      wa:"Bonjour, je suis pro DIGIY JOBS. Je souhaite de l'aide pour mon module Je recrute.",
      keys:["recruter","recrutement","offre","emploi","job","jobs","candidat","cv","poste","contrat",
            "mission","stage","stagiaire","embaucher","embauche","serveur","serveuse","cuisinier","cuisinière",
            "receptionniste","réceptionniste","femme de chambre","lingere","lingère","gardien","agent",
            "technicien","commercial","livreur","animateur","freelance","prestation","interim","intérim"]
    },
    {
      id:"BUILD", icon:"🏗️", tag:"#mes-services", title:"Mes services — BUILD",
      desc:"Services, chantiers, artisanat — le pro valide chaque demande. Construction, dépannage, entretien.",
      pin:"https://pro-build.digiylyfe.com/pin.html",
      hub:"https://pro-build.digiylyfe.com/hub.html",
      wa:"Bonjour, je suis pro DIGIY BUILD. Je souhaite de l'aide pour mon module Mes services.",
      keys:["artisan","build","travaux","chantier","depannage","dépannage","fuite","plomberie","plombier",
            "electricien","électricien","maçon","macon","carrelage","peinture","peintre","menuisier",
            "soudeur","climatisation","clim","toiture","toit","dalle","fondation","renovation","rénovation",
            "entretien","maintenance","entrepreneur","construire","construction","batir","bâtir","bâtiment",
            "batiment","gros oeuvre","gros œuvre","villa","immeuble","devis","architecte","ingenieur",
            "ingénieur","terrassement","ferrailleur","coffreur","ciment","beton","béton","parpaing",
            "finition","piscine","garage","extension","agrandissement","saly","petite cote","petite côte"]
    },
    {
      id:"EXPLORE", icon:"🗺️", tag:"#me-faire-connaitre", title:"Me faire connaître — EXPLORE",
      desc:"Lieu, visibilité, territoire — être trouvé. Fiche lieu, QR, carte, présence digitale.",
      pin:"https://pro-explore.digiylyfe.com/pin.html",
      hub:"https://pro-explore.digiylyfe.com/hub.html",
      wa:"Bonjour, je suis pro DIGIY EXPLORE. Je souhaite de l'aide pour mon module Me faire connaître.",
      keys:["explore","lieu","visibilite","visibilité","territoire","carte","fiche lieu","qr","tourisme",
            "touriste","excursion","visite","activite","activité","loisir","balade","sortie","peche","pêche",
            "pirogue","mer","plage","ocean","océan","sport nautique","kayak","hotel","hôtel","resort",
            "connaitre","connaître","trouver","référencer","referencer","presence","présence","digital"]
    },
    {
      id:"PAY", icon:"💳", tag:"#mon-argent", title:"Mon argent — PAY",
      desc:"Entrées, sorties, reste, notes rapides. Wave, cash, suivi — tout reste chez moi.",
      pin:"https://pro-pay.digiylyfe.com/pin.html",
      hub:"https://pro-pay.digiylyfe.com/hub.html",
      wa:"Bonjour, je suis pro DIGIY PAY. Je souhaite de l'aide pour mon module Mon argent.",
      keys:["pay","paiement","payer","wave","orange money","cash","argent","solde","entree","entrée",
            "sortie","reste","note","suivi","transaction","virement","transfert","mobile money","free money",
            "depot","dépôt","retrait","abonnement","activer","preuve","recu","reçu","facture","reglement",
            "règlement","caisse pay","tresorerie","trésorerie","bilan","compte","finance"]
    },
    {
      id:"RESEAU", icon:"📣", tag:"#publier", title:"Publier — RÉSEAU DIGIY",
      desc:"Annonce, fiche, lien partageable — COM AU CLIC. Visibilité locale, réseau terrain.",
      pin:"https://reseau-digiy.digiylyfe.com/inscription.html",
      hub:"https://reseau-digiy.digiylyfe.com/inscription.html",
      wa:"Bonjour, je suis pro DIGIY RÉSEAU. Je souhaite de l'aide pour mon module Publier.",
      keys:["reseau","réseau","annonce","publier","publication","fiche","qr","partage","visibilite",
            "visibilité","communication","com au clic","promotion","pub","publicite","publicité",
            "mettre en avant","référencer","referencer","notoriete","notoriété","lien","partager",
            "communiquer","affichage","flyer","local","terrain","audience","abonnes","abonnés"]
    }
  ];

  /* ─────────────────────────────────────────────
     UTILITAIRES
  ───────────────────────────────────────────── */
  function $(id){ return document.getElementById(id); }

  function norm(s){
    return String(s||"").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[''`]/g,"'").trim();
  }

  function tokens(s){
    return norm(s).split(/[\s,.\-!?;:()\n]+/).filter(function(w){ return w.length >= 3; });
  }

  function waLink(txt){
    return "https://wa.me/" + DIGIY_CONTACT + "?text=" + encodeURIComponent(txt);
  }

  /* ─────────────────────────────────────────────
     MOTEUR FUZZY — même logique que public
  ───────────────────────────────────────────── */
  function matchModules(text){
    var n    = norm(text);
    var toks = tokens(text);

    if(!n || toks.length === 0) return MODULES.slice(0,3);

    var scored = MODULES.map(function(m){
      var score = 0;

      toks.forEach(function(tok){
        if(tok === norm(m.id))    score += 5;
        if(norm(m.title).indexOf(tok) >= 0) score += 2;
        if(norm(m.desc).indexOf(tok)  >= 0) score += 1;

        m.keys.forEach(function(k){
          var nk = norm(k);
          if(tok === nk)                           score += 4;
          else if(nk.indexOf(tok) >= 0)            score += 3;
          else if(tok.indexOf(nk) >= 0 && nk.length >= 4) score += 2;
        });
      });

      /* bonus clé multi-mots */
      m.keys.forEach(function(k){
        if(k.indexOf(" ") >= 0 && n.indexOf(norm(k)) >= 0) score += 5;
      });

      return Object.assign({}, m, {score: score});
    });

    var matched = scored
      .filter(function(m){ return m.score > 0; })
      .sort(function(a,b){ return b.score - a.score; })
      .slice(0, 5);

    if(matched.length === 0) return [MODULES[0], MODULES[4], MODULES[8]]; /* MARKET, DRIVER, PAY */
    return matched;
  }

  /* ─────────────────────────────────────────────
     INJECT CSS — si pas déjà présent
  ───────────────────────────────────────────── */
  function injectCss(){
    if(document.getElementById("digiyProOrientCss")) return;
    var s = document.createElement("style");
    s.id = "digiyProOrientCss";
    /* détecte fond sombre via --bg ou luminosité background */
    var dark=(function(){
      var bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      if(!bg)bg=getComputedStyle(document.body).backgroundColor;
      if(/^#[0-4]/i.test(bg))return true;
      var m=bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if(m){var lum=(+m[1]*299+ +m[2]*587+ +m[3]*114)/1000;return lum<100;}
      return false;
    })();
    var c=dark?{h3:'#fff0a8',qBg:'rgba(255,255,255,.10)',qC:'#f0fff5',qBd:'rgba(255,255,255,.22)',
      obDk:'rgba(255,255,255,.10)',obDkC:'#f0fff5',obDkB:'rgba(255,255,255,.20)',
      stBg:'rgba(250,204,21,.14)',stBd:'rgba(250,204,21,.30)',stC:'#fff0a8',wrap:'rgba(255,255,255,.06)',
      mcBg:'rgba(255,255,255,.10)',mcBd:'rgba(255,255,255,.18)',mcH4:'#f0fff5',mcP:'rgba(240,255,245,.72)',
      mcTag:'rgba(250,204,21,.14)',mcTagBd:'rgba(250,204,21,.28)',mcTagC:'#fff0a8'}
    :{h3:'#102f24',qBg:'rgba(255,255,255,.85)',qC:'#102f24',qBd:'rgba(18,60,45,.18)',
      obDk:'rgba(18,60,45,.07)',obDkC:'#102f24',obDkB:'rgba(18,60,45,.15)',
      stBg:'rgba(246,196,83,.16)',stBd:'rgba(246,196,83,.30)',stC:'#6b4b08',wrap:'transparent',
      mcBg:'rgba(255,255,255,.80)',mcBd:'rgba(18,60,45,.13)',mcH4:'#102f24',mcP:'rgba(32,55,45,.72)',
      mcTag:'rgba(246,196,83,.14)',mcTagBd:'rgba(246,196,83,.28)',mcTagC:'#6b4b08'};

    s.textContent=[
      '#digiy-orient-wrap{margin:18px 0;padding:16px;border-radius:22px;background:'+c.wrap+';font-family:Outfit,system-ui,-apple-system,sans-serif}',
      '#digiy-orient-wrap h3{margin:0 0 10px;font-size:18px;font-weight:900;color:'+c.h3+';letter-spacing:-.03em}',
      '#digiy-orient-q{width:100%;min-height:72px;border-radius:20px;border:1px solid '+c.qBd+';background:'+c.qBg+';color:'+c.qC+';padding:14px 16px;font-size:16px;font-weight:800;outline:none;resize:none;line-height:1.45}',
      '#digiy-orient-bar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}',
      '.digiy-ob{border:0;cursor:pointer;border-radius:999px;min-height:44px;padding:0 16px;font:900 14px Outfit,system-ui,sans-serif}',
      '.digiy-ob-primary{background:linear-gradient(135deg,#fff2bf,#f6c453);color:#0d170d}',
      '.digiy-ob-green{background:linear-gradient(135deg,#d8ffe6,#7ee6a7);color:#062515}',
      '.digiy-ob-dark{background:'+c.obDk+';color:'+c.obDkC+';border:1px solid '+c.obDkB+'!important}',
      '#digiy-orient-status{font-size:13px;font-weight:900;color:'+c.stC+';margin-bottom:12px;padding:10px 14px;border-radius:14px;background:'+c.stBg+';border:1px solid '+c.stBd+'}',
      '#digiy-orient-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}',
      '.digiy-mc{background:'+c.mcBg+';border:1px solid '+c.mcBd+';border-radius:22px;overflow:hidden;display:flex;flex-direction:column}',
      '.digiy-mc-cover{height:80px;display:grid;place-items:center;font-size:38px;background:linear-gradient(135deg,rgba(246,196,83,.22),rgba(22,129,67,.12))}',
      '.digiy-mc-body{padding:14px;display:flex;flex-direction:column;gap:8px;flex:1}',
      '.digiy-mc-tag{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;border-radius:999px;border:1px solid '+c.mcTagBd+';background:'+c.mcTag+';color:'+c.mcTagC+';font-size:11px;font-weight:1000}',
      '.digiy-mc h4{margin:0;font-size:16px;font-weight:900;line-height:1.2;color:'+c.mcH4+'}',
      '.digiy-mc p{margin:0;font-size:13px;color:'+c.mcP+';font-weight:760;line-height:1.45;flex:1}',
      '.digiy-mc-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}',
      '.digiy-mc-actions a{flex:1 1 90px;display:inline-flex;align-items:center;justify-content:center;min-height:40px;border-radius:14px;border:0;font:900 13px Outfit,system-ui,sans-serif;text-decoration:none;cursor:pointer}',
      '.digiy-mc-pin{background:linear-gradient(135deg,#fff2bf,#f6c453);color:#0d170d}',
      '.digiy-mc-wa{background:linear-gradient(135deg,#d8ffe6,#7ee6a7);color:#062515}',
      '@media(max-width:520px){#digiy-orient-cards{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ─────────────────────────────────────────────
     CONSTRUIRE LE BLOC HTML dans le DOM
  ───────────────────────────────────────────── */
  function buildBlock(){
    if(document.getElementById("digiy-orient-wrap")) return;

    var wrap = document.createElement("section");
    wrap.id = "digiy-orient-wrap";
    wrap.innerHTML = [
      '<h3>🧭 Quel est ton besoin pro aujourd\'hui ?</h3>',
      '<textarea id="digiy-orient-q" placeholder="Ex : je veux publier une annonce, gérer ma caisse, recruter un serveur…"></textarea>',
      '<div id="digiy-orient-bar">',
        '<button class="digiy-ob digiy-ob-primary" id="digiy-ob-search">🔎 Voir les modules</button>',
        '<button class="digiy-ob digiy-ob-green"   id="digiy-ob-wa">💬 WhatsApp DIGIY</button>',
        '<button class="digiy-ob digiy-ob-dark"    id="digiy-ob-clear">🧹 Effacer</button>',
      '</div>',
      '<div id="digiy-orient-status">Tape ton besoin — les modules s\'orientent automatiquement.</div>',
      '<div id="digiy-orient-cards"></div>'
    ].join("");

    /* cherche un point d'ancrage : #orient-zone, .orient-zone, ou body en fallback */
    var anchor = document.getElementById("orient-zone")
      || document.querySelector(".orient-zone")
      || document.querySelector("main")
      || document.body;

    /* prepend dans l'ancre */
    anchor.insertBefore(wrap, anchor.firstChild);
  }

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  function render(){
    var q      = $("digiy-orient-q");
    var cards  = $("digiy-orient-cards");
    var status = $("digiy-orient-status");
    if(!q || !cards) return;

    var text = q.value.trim();
    var res  = matchModules(text);

    cards.innerHTML = "";

    res.forEach(function(m){
      var waMsg = m.wa + (text ? "\n\nMon besoin : " + text : "");
      var card  = document.createElement("article");
      card.className = "digiy-mc";
      card.innerHTML =
        '<div class="digiy-mc-cover">' + m.icon + '</div>' +
        '<div class="digiy-mc-body">' +
          '<span class="digiy-mc-tag">' + m.tag + '</span>' +
          '<h4>' + m.title + '</h4>' +
          '<p>' + m.desc + '</p>' +
          '<div class="digiy-mc-actions">' +
            '<a class="digiy-mc-pin" href="' + m.pin + '">🔐 Entrer avec mon PIN</a>' +
            '<a class="digiy-mc-wa" href="' + waLink(waMsg) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' +
          '</div>' +
        '</div>';
      cards.appendChild(card);
    });

    if(status){
      status.textContent = res.length
        ? res.length + " module(s) identifié(s). Entre avec ton PIN."
        : "Besoin non identifié. DIGIY peut t'orienter sur WhatsApp.";
    }
  }

  /* ─────────────────────────────────────────────
     BIND EVENTS
  ───────────────────────────────────────────── */
  function bind(){
    var q       = $("digiy-orient-q");
    var btnSrc  = $("digiy-ob-search");
    var btnWa   = $("digiy-ob-wa");
    var btnClr  = $("digiy-ob-clear");
    var status  = $("digiy-orient-status");

    if(btnSrc) btnSrc.onclick = render;

    if(btnWa) btnWa.onclick = function(){
      var text = q && q.value.trim()
        ? q.value.trim()
        : "Bonjour, je suis un pro DIGIY. Je cherche de l'aide sur un module.";
      location.href = waLink("Bonjour, je suis un pro DIGIY. Voici mon besoin : " + text);
    };

    if(btnClr) btnClr.onclick = function(){
      if(q) q.value = "";
      render();
      if(status) status.textContent = "Tape ton besoin — les modules s'orientent automatiquement.";
    };

    /* render live à la frappe après 400ms de pause */
    if(q){
      var debounce;
      q.addEventListener("input", function(){
        clearTimeout(debounce);
        debounce = setTimeout(render, 400);
      });
    }

    render(); /* affiche top 3 par défaut */
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  function init(){
    injectCss();
    buildBlock();
    bind();
  }

  window.DIGIY_PRO_ORIENT = { version:VERSION, modules:MODULES, matchModules:matchModules, render:render };

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
