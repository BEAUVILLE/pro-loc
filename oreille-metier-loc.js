/* DIGIY OREILLE MÉTIER — LOC / JE LOUE V1
   Moins d’écrits, plus de clics.
   Le propriétaire dit ou choisit le geste. DIGIY prépare. Le terrain valide.
*/
(function(){
  'use strict';

  const BUILD='oreille-metier-loc-v1-conteneur-safe-20260519';

  let lastDraft=null;
  let recognition=null;
  let listening=false;

  const $=id=>document.getElementById(id);

  const esc=v=>String(v??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');

  const strip=v=>String(v||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'');

  const norm=v=>strip(String(v||'').toLowerCase())
    .replace(/[’']/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  const toast=m=>{
    if(typeof window.showToast==='function'){
      window.showToast(m);
      return;
    }

    try{
      const n=document.createElement('div');
      n.textContent=m;
      n.style.cssText='position:fixed;left:14px;right:14px;bottom:92px;z-index:99999;padding:13px 15px;border-radius:18px;background:#062612;color:#f0fff5;border:1px solid rgba(250,204,21,.35);font:900 15px system-ui;box-shadow:0 16px 38px rgba(0,0,0,.28);';
      document.body.appendChild(n);
      setTimeout(()=>n.remove(),2600);
    }catch(_){
      alert(m);
    }
  };

  function money(text){
    const m=String(text||'').match(/(\d[\d\s.,]*)\s*(?:f|fcfa|francs?|xof|€|eur|euro)?/i);
    return m ? Number(String(m[1]).replace(/[^\d]/g,'')) || 0 : 0;
  }

  function parseDate(text){
    const t=norm(text);
    const d=new Date();

    const iso=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;

    if(t.includes('aujourd hui')) return iso(d);

    if(t.includes('demain')){
      d.setDate(d.getDate()+1);
      return iso(d);
    }

    if(t.includes('apres demain') || t.includes('apres-demain')){
      d.setDate(d.getDate()+2);
      return iso(d);
    }

    if(t.includes('fin du mois')){
      return iso(new Date(d.getFullYear(),d.getMonth()+1,0));
    }

    const w={
      dimanche:0,
      lundi:1,
      mardi:2,
      mercredi:3,
      jeudi:4,
      vendredi:5,
      samedi:6
    };

    for(const [name,target] of Object.entries(w)){
      if(t.includes(name)){
        let add=(target-d.getDay()+7)%7;
        if(add===0) add=7;
        d.setDate(d.getDate()+add);
        return iso(d);
      }
    }

    const m=String(text||'').match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);

    if(m){
      const y=m[3]
        ? Number(String(m[3]).length===2 ? '20'+m[3] : m[3])
        : d.getFullYear();

      return iso(new Date(y,Number(m[2])-1,Number(m[1])));
    }

    return '';
  }

  function cleanClient(text){
    const raw=String(text||'')
      .replace(/(?:tel|tél|telephone|téléphone|whatsapp|wa)\s*[:\-]?\s*[+0-9][0-9\s().-]{6,}/ig,' ')
      .replace(/\d[\d\s.,]*/g,' ');

    const stop=new Set(
      'loc logement reservation réservation client arrive arrivee arrivée depart départ demande demandeur date demain aujourd hui payer paiement acompte solde reste note tarif tarifs planning bloquer ouvrir fermer disponible indisponible nuits nuit semaine mois tel telephone téléphone whatsapp wa'.split(' ')
    );

    for(const w of raw.replace(/[.,;:!?()]/g,' ').split(/\s+/).filter(Boolean)){
      const k=norm(w);
      if(k.length>=2 && !stop.has(k)){
        return w.charAt(0).toUpperCase()+w.slice(1);
      }
    }

    return 'Client';
  }

  function hasContact(text){
    const s=String(text||'');

    return /(?:tel|tél|telephone|téléphone|whatsapp|wa)\s*[:\-]?\s*[+0-9][0-9\s().-]{6,}/i.test(s)
      || /(?:\+?221)?\s*(7[05678])[\s.-]?(\d{3})[\s.-]?(\d{2})[\s.-]?(\d{2})/.test(s);
  }

  function routeDraft(title,href,note){
    return {
      type:'route',
      title,
      href,
      note:note||''
    };
  }

  function parse(text){
    const original=String(text||'').trim();
    const t=norm(original);

    if(!original) return null;

    if(/\b(hub|menu|portes|navigation)\b/.test(t)){
      return routeDraft('🧭 Ouvrir le HUB LOC','./hub.html','Retour aux pavés.');
    }

    if(/\b(session|acces|accès|nettoyer|ouvrir le code|code pin|pin)\b/.test(t)){
      return routeDraft('🛡️ Ouvrir ma session','./session.html','Contrôler l’accès sans afficher les identifiants.');
    }

    if(/\b(travail|gerer|gérer|logements?|accueil)\b/.test(t)){
      return routeDraft('🏠 Gérer mes logements','./app.html','Retour à la page de travail.');
    }

    if(/\b(reservations?|réservations?|demandes?|clients?)\b/.test(t)){
      return routeDraft('📋 Voir les réservations','./reservations.html','Ouvrir la liste des demandes.');
    }

    if(/\b(planning|disponibilites|disponibilités|dates?|calendrier|bloquer|ouvrir date|fermer date|indisponible|disponible)\b/.test(t)){
      return {
        type:'availability',
        title:'🗓️ Préparer une disponibilité',
        href:'./planning.html',
        date:parseDate(original),
        note:original
      };
    }

    if(/\b(aujourd hui|arrivees?|arrivées?|departs?|départs?)\b/.test(t)){
      return routeDraft('📅 Voir aujourd’hui','./today.html','Arrivées, départs et points chauds.');
    }

    if(/\b(tarifs?|prix|caution|nuit|semaine|mois)\b/.test(t)){
      return {
        type:'pricing',
        title:'💰 Préparer un tarif',
        href:'./tarifs.html',
        amount:money(original),
        date:parseDate(original),
        note:original
      };
    }

    if(/\b(qr|code qr|partager|lien client)\b/.test(t)){
      return routeDraft('🔳 Ouvrir mon QR','./qr.html','Partager la bonne porte logement.');
    }

    if(/\b(liens?|outils?|mes outils|copier mes liens)\b/.test(t)){
      return routeDraft('🔗 Ouvrir mes liens utiles','./manage-links.html','Regrouper les chemins utiles.');
    }

    if(/\b(photos?|image|images|galerie)\b/.test(t)){
      return routeDraft('🖼️ Ouvrir les photos','./photos.html','Préparer ou vérifier les liens photo.');
    }

    if(/\b(fiche|annonce|preparer une fiche|préparer une fiche|publication|public)\b/.test(t)){
      return routeDraft('🏡 Préparer la fiche logement','./generator.html','Présenter le logement avec des choix guidés.');
    }

    if(/\b(wave|paiement wave|preuve wave)\b/.test(t)){
      return {
        type:'payment',
        title:'🌊 Préparer preuve Wave',
        href:'./pin-wave.html',
        amount:money(original),
        note:original
      };
    }

    if(/\b(pay|argent|paiement|acompte|solde|reste a payer|reste à payer|depense|dépense)\b/.test(t)){
      return {
        type:'payment',
        title:'💰 Préparer Mon Argent',
        href:'https://pro-pay.digiylyfe.com/admin.html',
        amount:money(original),
        note:original
      };
    }

    if(/\b(note|rappel|rappelle|a faire|à faire|message|demande)\b/.test(t)){
      return {
        type:'note',
        title:'📝 Note logement',
        client:cleanClient(original),
        contact:hasContact(original),
        date:parseDate(original),
        amount:money(original),
        note:original
      };
    }

    return {
      type:'note',
      title:'📝 Note à préciser',
      client:cleanClient(original),
      contact:hasContact(original),
      date:parseDate(original),
      amount:money(original),
      note:original
    };
  }

  function saveDraftLocal(d){
    try{
      const key='digiy_loc_oreille_notes';
      const list=JSON.parse(localStorage.getItem(key)||'[]');

      list.unshift({
        id:Date.now(),
        date:new Date().toISOString(),
        type:d.type||'note',
        title:d.title||'Note LOC',
        client:d.client||'Client',
        contact:!!d.contact,
        dueDate:d.date||'',
        amount:Number(d.amount||0),
        text:d.note||''
      });

      localStorage.setItem(key,JSON.stringify(list.slice(0,80)));
      localStorage.setItem('digiy_loc_oreille_last_note',JSON.stringify(list[0]));
    }catch(_){}
  }

  function renderDraft(d){
    const box=$('digiyLocDraft');
    const btn=$('digiyLocValidate');

    if(!box || !btn) return;

    lastDraft=d;
    btn.disabled=!d;

    if(!d){
      box.innerHTML='<strong>Doctrine</strong><span>Moins d’écrits. Tu choisis, tu dis, DIGIY prépare.</span>';
      return;
    }

    if(d.type==='route'){
      box.innerHTML=`<strong>${esc(d.title)}</strong><span>Chemin : ${esc(d.href)}</span><em>${esc(d.note||'Valide pour ouvrir la bonne porte.')}</em>`;
      return;
    }

    if(d.type==='availability'){
      box.innerHTML=`<strong>${esc(d.title)}</strong><span>Date repérée : ${esc(d.date||'à choisir dans le planning')}</span><span>Action : ouvrir les disponibilités.</span><em>Valide pour aller au planning.</em>`;
      return;
    }

    if(d.type==='pricing'){
      box.innerHTML=`<strong>${esc(d.title)}</strong><span>Montant entendu : ${d.amount?esc(d.amount.toLocaleString('fr-FR'))+' F':'à compléter'}</span><span>Chemin : tarifs.</span><em>Valide pour ouvrir les tarifs.</em>`;
      return;
    }

    if(d.type==='payment'){
      box.innerHTML=`<strong>${esc(d.title)}</strong><span>Montant entendu : ${d.amount?esc(d.amount.toLocaleString('fr-FR'))+' F':'à compléter'}</span><span>Trace gardée localement avant ouverture.</span><em>Valide pour ouvrir la porte paiement.</em>`;
      return;
    }

    box.innerHTML=`<strong>${esc(d.title)}</strong><span>Client : ${esc(d.client||'Client')}</span><span>Contact : ${d.contact?'renseigné':'—'}</span><span>Date : ${esc(d.date||'à préciser')}</span><span>Montant : ${d.amount?esc(d.amount.toLocaleString('fr-FR'))+' F':'—'}</span><em>Valide pour garder la note et ouvrir Notes rapides.</em>`;
  }

  function executeDraft(){
    const d=lastDraft;

    if(!d) return;

    if(d.type==='note' || d.type==='payment' || d.type==='pricing' || d.type==='availability'){
      saveDraftLocal(d);
    }

    if(d.type==='note'){
      toast('📝 Note LOC gardée. Ouverture des notes.');
      setTimeout(()=>{ location.href='./notes.html'; },180);
      return;
    }

    if(d.href){
      toast('🧭 Porte ouverte');
      setTimeout(()=>{ location.href=d.href; },160);
      return;
    }

    toast('Geste préparé.');
  }

  function startVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const btn=$('digiyLocMic');
    const input=$('digiyLocInput');

    if(!SR){
      toast('Voix non disponible sur ce navigateur. Écris court, ça marche aussi.');
      return;
    }

    try{
      if(recognition && listening){
        recognition.stop();
        return;
      }

      recognition=new SR();
      recognition.lang='fr-FR';
      recognition.interimResults=false;
      recognition.maxAlternatives=1;

      recognition.onstart=()=>{
        listening=true;
        if(btn) btn.textContent='🎧 J’écoute…';
      };

      recognition.onend=()=>{
        listening=false;
        if(btn) btn.textContent='🎙️ Parler';
      };

      recognition.onerror=()=>{
        listening=false;
        if(btn) btn.textContent='🎙️ Parler';
        toast('Voix non comprise. Écris la phrase courte.');
      };

      recognition.onresult=e=>{
        const said=e?.results?.[0]?.[0]?.transcript||'';

        if(input && said){
          input.value=said;
          renderDraft(parse(said));
          toast('Phrase captée. Vérifie puis valide.');
        }
      };

      recognition.start();
    }catch(_){
      toast('Micro déjà ouvert ou navigateur bloqué.');
    }
  }

  function inject(){
    if($('digiyLocEar')) return;

    const anchor =
      document.querySelector('#voiceBox') ||
      document.querySelector('.doctrineBox') ||
      document.querySelector('.hubHead') ||
      document.querySelector('main') ||
      document.body;

    if(!anchor) return;

    const css=document.createElement('style');

    css.textContent=`
      .digiy-loc-ear{
        margin:12px 0;
        padding:14px;
        border:2px solid rgba(250,204,21,.34);
        border-radius:22px;
        background:linear-gradient(160deg,rgba(255,255,255,.86),rgba(240,253,244,.78));
        box-shadow:0 14px 32px rgba(6,53,31,.14);
        display:grid;
        gap:10px;
        color:#0d2a1f;
      }

      .digiy-loc-ear summary{
        list-style:none;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        font-weight:1000;
        color:#07351f;
      }

      .digiy-loc-ear summary::-webkit-details-marker{
        display:none;
      }

      .digiy-loc-ear-title{
        font-size:19px;
        font-weight:1000;
        line-height:1.1;
      }

      .digiy-loc-ear-sub{
        margin-top:4px;
        font-size:14.5px;
        font-weight:950;
        color:rgba(13,42,31,.72);
        line-height:1.35;
      }

      .digiy-loc-ear-chevron{
        font-size:20px;
        color:#7a5200;
        font-weight:1000;
      }

      .digiy-loc-ear[open] .digiy-loc-ear-chevron{
        transform:rotate(180deg);
      }

      .digiy-loc-ear-body{
        display:grid;
        gap:10px;
        margin-top:12px;
      }

      .digiy-loc-chips{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      }

      .digiy-loc-chip{
        min-height:54px;
        border-radius:16px;
        border:1px solid rgba(6,53,31,.16);
        background:#fff;
        color:#0d2a1f;
        padding:10px 11px;
        font-size:15px;
        font-weight:1000;
        text-align:center;
        cursor:pointer;
      }

      .digiy-loc-chip.gold{
        background:#fff7d6;
        border-color:rgba(212,160,23,.30);
        color:#6f4b00;
      }

      .digiy-loc-chip.green{
        background:#dcfce7;
        border-color:rgba(34,197,94,.28);
        color:#14532d;
      }

      .digiy-loc-input-grid{
        display:grid;
        grid-template-columns:1fr .85fr;
        gap:10px;
        align-items:start;
      }

      .digiy-loc-ear textarea{
        width:100%;
        min-height:98px;
        border:1px solid rgba(6,53,31,.16);
        border-radius:16px;
        padding:12px;
        font-size:18px;
        font-weight:950;
        color:#0d2a1f;
        background:#fff;
        resize:vertical;
        outline:none;
      }

      .digiy-loc-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:8px;
      }

      .digiy-loc-actions button{
        min-height:44px;
        border-radius:999px;
        border:1px solid rgba(6,53,31,.16);
        background:#fff;
        color:#0d2a1f;
        padding:9px 12px;
        font-size:15px;
        font-weight:1000;
        cursor:pointer;
      }

      .digiy-loc-actions button.primary{
        background:#facc15;
        border-color:#eab308;
        color:#1a1200;
      }

      .digiy-loc-actions button.ok{
        background:#22c55e;
        border-color:#16a34a;
        color:#04160e;
      }

      .digiy-loc-actions button:disabled{
        opacity:.52;
        cursor:not-allowed;
      }

      .digiy-loc-draft{
        min-height:98px;
        border:1px solid rgba(6,53,31,.16);
        border-radius:16px;
        background:#fff;
        padding:12px;
        display:grid;
        gap:5px;
        font-size:15px;
        line-height:1.4;
        color:rgba(13,42,31,.74);
        font-weight:950;
      }

      .digiy-loc-draft strong{
        color:#07351f;
        font-size:18px;
        font-weight:1000;
      }

      .digiy-loc-draft em{
        color:#7a5200;
        font-style:normal;
        font-weight:1000;
      }

      @media(max-width:760px){
        .digiy-loc-input-grid{
          grid-template-columns:1fr;
        }

        .digiy-loc-chips{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:520px){
        .digiy-loc-ear-title{
          font-size:18px;
        }

        .digiy-loc-chip{
          font-size:14px;
          min-height:52px;
        }

        .digiy-loc-ear textarea{
          font-size:17px;
        }

        .digiy-loc-actions button{
          font-size:14.5px;
        }
      }
    `;

    document.head.appendChild(css);

    const panel=document.createElement('details');
    panel.className='digiy-loc-ear';
    panel.id='digiyLocEar';
    panel.open=false;

    panel.innerHTML=`
      <summary>
        <span>
          <span class="digiy-loc-ear-title">🎙️ Mes oreilles LOC</span>
          <span class="digiy-loc-ear-sub">Tu choisis ou tu dis le geste. DIGIY prépare, tu valides.</span>
        </span>
        <span class="digiy-loc-ear-chevron">⌄</span>
      </summary>

      <div class="digiy-loc-ear-body">
        <div class="digiy-loc-chips">
          <button class="digiy-loc-chip green" type="button" data-loc-example="Voir les réservations">📋 Réservations</button>
          <button class="digiy-loc-chip" type="button" data-loc-example="Ouvrir le planning">🗓️ Planning</button>
          <button class="digiy-loc-chip gold" type="button" data-loc-example="Préparer un acompte 50000">💰 Acompte</button>
          <button class="digiy-loc-chip" type="button" data-loc-example="Partager mon QR">🔳 QR</button>
          <button class="digiy-loc-chip" type="button" data-loc-example="Préparer une fiche logement">🏡 Fiche</button>
          <button class="digiy-loc-chip gold" type="button" data-loc-example="Ajouter note client arrivée demain">📝 Note</button>
        </div>

        <div class="digiy-loc-input-grid">
          <div>
            <textarea id="digiyLocInput" placeholder="Ex. arrivée demain / bloquer vendredi / acompte 50000 / client demande 3 nuits / ouvrir QR"></textarea>

            <div class="digiy-loc-actions">
              <button id="digiyLocMic" type="button">🎙️ Parler</button>
              <button class="primary" id="digiyLocPrepare" type="button">⚡ Préparer</button>
              <button class="ok" id="digiyLocValidate" type="button" disabled>✅ Valider</button>
              <button id="digiyLocClear" type="button">Effacer</button>
            </div>
          </div>

          <div class="digiy-loc-draft" id="digiyLocDraft">
            <strong>Doctrine</strong>
            <span>Moins d’écrits. Tu choisis, tu dis, DIGIY prépare.</span>
          </div>
        </div>
      </div>
    `;

    if(anchor.id==='voiceBox' || anchor.classList?.contains('doctrineBox') || anchor.classList?.contains('hubHead')){
      anchor.insertAdjacentElement('afterend',panel);
    }else{
      anchor.prepend(panel);
    }

    $('digiyLocMic')?.addEventListener('click',startVoice);

    $('digiyLocPrepare')?.addEventListener('click',()=>{
      renderDraft(parse($('digiyLocInput')?.value||''));
    });

    $('digiyLocValidate')?.addEventListener('click',executeDraft);

    $('digiyLocClear')?.addEventListener('click',()=>{
      if($('digiyLocInput')) $('digiyLocInput').value='';
      renderDraft(null);
    });

    panel.querySelectorAll('[data-loc-example]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const v=btn.getAttribute('data-loc-example')||'';
        const input=$('digiyLocInput');

        if(input) input.value=v;

        renderDraft(parse(v));
      });
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',inject);
  }else{
    inject();
  }

  window.DIGIY_OREILLE_METIER_LOC={
    BUILD,
    parse,
    renderDraft,
    executeDraft
  };
})();
