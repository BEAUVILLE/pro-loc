/*
  DIGIY LOC — Sync UI
  Branche le pont commun sur les pages LOC de lecture :
  hub.html, app.html, today.html, reservations.html

  Ne pas mettre dans planning.html.
*/

(function(){
  "use strict";

  if(window.DIGIY_LOC_SYNC_UI_READY) return;
  window.DIGIY_LOC_SYNC_UI_READY = true;

  const CFG = {
    module: "LOC",

    reservationRpcs: [
      "digiy_loc_reservations_by_slug"
    ],

    availabilityRpcs: [
      "digiy_loc_month_calendar",
      "digiy_loc_calendar_by_slug",
      "digiy_loc_get_availability",
      "digiy_loc_availability_by_slug"
    ],

    availabilityTables: [
      {
        table: "digiy_loc_availability",
        slugCol: "slug",
        dateCol: "date"
      }
    ]
  };

  function $(id){
    return document.getElementById(id);
  }

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, function(m){
      return {
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        "\"":"&quot;",
        "'":"&#39;"
      }[m];
    });
  }

  function fmtDate(ymd){
    if(!ymd) return "—";

    const d = new Date(String(ymd).slice(0,10) + "T00:00:00");

    if(Number.isNaN(d.getTime())) return ymd;

    return d.toLocaleDateString("fr-FR", {
      day:"numeric",
      month:"short"
    });
  }

  function waitForBridge(){
    return new Promise(function(resolve){
      if(window.DIGIY_BRIDGE){
        resolve(window.DIGIY_BRIDGE);
        return;
      }

      let tries = 0;

      const timer = setInterval(function(){
        tries += 1;

        if(window.DIGIY_BRIDGE){
          clearInterval(timer);
          resolve(window.DIGIY_BRIDGE);
        }

        if(tries > 40){
          clearInterval(timer);
          resolve(null);
        }
      }, 100);
    });
  }

  function ensureStyles(){
    if($("digiyLocSyncStyle")) return;

    const style = document.createElement("style");
    style.id = "digiyLocSyncStyle";
    style.textContent = `
      .digiy-loc-sync-card{
        margin:12px 0;
        padding:14px;
        border-radius:22px;
        border:2px solid rgba(250,204,21,.42);
        background:
          radial-gradient(circle at top left,rgba(250,204,21,.14),transparent 44%),
          rgba(255,255,255,.08);
        color:inherit;
        box-shadow:0 14px 32px rgba(0,0,0,.16);
      }

      .digiy-loc-sync-title{
        font-size:1.15rem;
        font-weight:1000;
        line-height:1.15;
        color:#fde68a;
      }

      .digiy-loc-sync-sub{
        margin-top:5px;
        font-size:.95rem;
        font-weight:900;
        line-height:1.35;
        opacity:.86;
      }

      .digiy-loc-sync-grid{
        margin-top:10px;
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }

      .digiy-loc-sync-pill{
        border:1px solid rgba(255,255,255,.16);
        border-radius:16px;
        padding:10px;
        background:rgba(0,0,0,.12);
        font-size:.85rem;
        font-weight:1000;
        line-height:1.2;
      }

      .digiy-loc-sync-pill strong{
        display:block;
        font-size:1.35rem;
        line-height:1;
        margin-bottom:5px;
        color:#fff;
      }

      .digiy-loc-sync-alert{
        margin-top:10px;
        padding:11px 12px;
        border-radius:16px;
        border:1px solid rgba(239,68,68,.35);
        background:rgba(239,68,68,.10);
        color:#fecaca;
        font-weight:1000;
        line-height:1.35;
      }

      .digiy-loc-sync-ok{
        margin-top:10px;
        padding:11px 12px;
        border-radius:16px;
        border:1px solid rgba(34,197,94,.35);
        background:rgba(34,197,94,.10);
        color:#bbf7d0;
        font-weight:1000;
        line-height:1.35;
      }

      @media(max-width:700px){
        .digiy-loc-sync-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function findInsertTarget(){
    return (
      document.querySelector(".hero") ||
      document.querySelector(".hubHead") ||
      document.querySelector(".top") ||
      document.querySelector("main") ||
      document.body
    );
  }

  function upsertCard(data){
    ensureStyles();

    let card = $("digiyLocSyncCard");

    if(!card){
      card = document.createElement("section");
      card.id = "digiyLocSyncCard";
      card.className = "digiy-loc-sync-card";

      const target = findInsertTarget();

      if(target && target.parentNode){
        target.insertAdjacentElement("afterend", card);
      }else{
        document.body.prepend(card);
      }
    }

    const s = data.summary || {};
    const c = s.counts || {};

    const closedSoon = s.closedSoon || [];
    const firstClosed = closedSoon[0];

    const alertHtml = firstClosed
      ? `
        <div class="digiy-loc-sync-alert">
          ⛔ Fermeture détectée : ${esc(fmtDate(firstClosed.date))}.
          Le planning a parlé. Le reste du logiciel doit maintenant en tenir compte.
        </div>
      `
      : `
        <div class="digiy-loc-sync-ok">
          ✅ Aucune fermeture proche détectée dans le planning.
        </div>
      `;

    card.innerHTML = `
      <div class="digiy-loc-sync-title">🔁 Synchronisation LOC</div>
      <div class="digiy-loc-sync-sub">
        Le pont lit maintenant réservations + disponibilités + fermetures.
      </div>

      <div class="digiy-loc-sync-grid">
        <div class="digiy-loc-sync-pill">
          <strong>${esc(c.arrivalsToday || 0)}</strong>
          Arrivées aujourd’hui
        </div>

        <div class="digiy-loc-sync-pill">
          <strong>${esc(c.departuresToday || 0)}</strong>
          Départs aujourd’hui
        </div>

        <div class="digiy-loc-sync-pill">
          <strong>${esc(c.pending || 0)}</strong>
          Demandes à confirmer
        </div>

        <div class="digiy-loc-sync-pill">
          <strong>${esc(c.closedSoon || 0)}</strong>
          Fermetures proches
        </div>
      </div>

      ${alertHtml}
    `;
  }

  function updateExistingCounters(data){
    const s = data.summary || {};
    const c = s.counts || {};

    if($("countArrivals")) $("countArrivals").textContent = String(c.arrivalsToday || 0);
    if($("countDepartures")) $("countDepartures").textContent = String(c.departuresToday || 0);
    if($("countPending")) $("countPending").textContent = String(c.pending || 0);
    if($("countDue")) $("countDue").textContent = String(c.due || 0);
  }

  function upsertChefSignals(data){
    const chef = $("chefList");

    if(!chef) return;

    const s = data.summary || {};
    const rows = [];

    if((s.closedSoon || []).length){
      rows.push({
        title: "Fermeture planning détectée",
        meta: "Disponibilités · calendrier",
        href: "./planning.html"
      });
    }

    if((s.pending || []).length){
      rows.push({
        title: `${s.pending.length} demande(s) à confirmer`,
        meta: "Réservations · clients",
        href: "./reservations.html"
      });
    }

    if((s.due || []).length){
      rows.push({
        title: `${s.due.length} paiement(s) à encaisser`,
        meta: "Réservations · argent",
        href: "./reservations.html"
      });
    }

    if(!rows.length) return;

    const html = rows.map(function(r){
      return `
        <div class="chefItem">
          <div>
            <div class="chefItemTitle">${esc(r.title)}</div>
            <div class="chefItemMeta">${esc(r.meta)}</div>
          </div>
          <a class="chefGo" href="${esc(r.href)}">Ouvrir</a>
        </div>
      `;
    }).join("");

    chef.innerHTML = html;
  }

  async function boot(){
    const bridge = await waitForBridge();

    if(!bridge){
      console.warn("[DIGIY LOC SYNC] Pont introuvable. Charge digiy-module-bridge.js avant digiy-loc-sync-ui.js.");
      return;
    }

    try{
      await bridge.init(CFG);

      const data = await bridge.load({
        ...CFG
      });

      upsertCard(data);
      updateExistingCounters(data);
      upsertChefSignals(data);

      console.log("[DIGIY LOC SYNC] Lecture commune OK", data.summary);
    }catch(e){
      console.warn("[DIGIY LOC SYNC] Erreur sync", e?.message || e);
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();
