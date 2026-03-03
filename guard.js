/* DIGIY GUARD SOFT — LOC (anti-boucle)
   - Ne redirige JAMAIS automatiquement
   - Affiche une porte douce si slug manquant / accès refusé / erreur RPC
   - Expose window.DIGIY_ACCESS = { ok, phone, slug, reason }
*/
(() => {
  "use strict";

  const MODULE = "LOC";
  const STORAGE_KEY = "digiy_loc_slug";

  const PAY_BASE = "https://commencer-a-payer.digiylyfe.com/";
  const SUPPORT_WA = "https://wa.me/221771342889";

  const qs = new URLSearchParams(location.search);
  const DEBUG = qs.get("debug") === "1";

  function $(id){ return document.getElementById(id); }

  function getSlug() {
    // 1) query
    const s1 = (qs.get("slug") || "").trim();
    if (s1) return s1;

    // 2) localStorage
    const saved = (localStorage.getItem(STORAGE_KEY) || "").trim();
    if (saved) return saved;

    // 3) pathname (si tu routes /loc-221...)
    const path = (location.pathname || "").replace(/^\/+/, "").trim();
    if (path && /^[a-z0-9-]{6,}$/i.test(path)) return path;

    return "";
  }

  function setSlugInUrl(slug){
    try{
      const u = new URL(location.href);
      u.searchParams.set("slug", slug);
      history.replaceState({}, "", u.toString());
    }catch(_){}
  }

  function buildPayUrl(slug){
    const u = new URL(PAY_BASE);
    u.searchParams.set("module", MODULE);
    // return = revenir sur pro-loc avec slug
    const ret = new URL(location.origin + location.pathname);
    if (slug) ret.searchParams.set("slug", slug);
    u.searchParams.set("return", ret.toString());
    return u.toString();
  }

  function showGate(reason, slug){
    // Si ta page a déjà une zone #gate, on l’utilise. Sinon on injecte full-screen.
    const html = `
      <div style="min-height:100vh;padding:18px;font-family:system-ui;background:#061b14;color:#eafff1">
        <div style="max-width:720px;margin:0 auto;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:14px;background:rgba(0,0,0,.18)">
          <h2 style="margin:0 0 8px">DIGIY LOC PRO</h2>
          <p style="margin:0 0 10px;opacity:.85">
            Accès verrouillé (pas de boucle). Raison : <b>${String(reason || "unknown")}</b>
          </p>

          <div style="margin:12px 0;border-top:1px solid rgba(255,255,255,.10)"></div>

          <label style="font-weight:900;font-size:12px;opacity:.85">Slug LOC</label>
          <input id="digiyGateSlug"
                 style="width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.14);color:#eafff1;font-weight:900"
                 placeholder="loc-221770000111" value="${slug ? String(slug) : ""}"/>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
            <button id="digiyGateEnter"
              style="flex:1;min-width:160px;padding:12px;border-radius:14px;border:1px solid rgba(34,197,94,.55);background:rgba(34,197,94,.18);color:#eafff1;font-weight:1000;cursor:pointer">
              🚀 Ouvrir
            </button>

            <a id="digiyGatePay"
              href="${buildPayUrl(slug)}"
              style="flex:1;min-width:160px;text-align:center;padding:12px;border-radius:14px;border:1px solid rgba(250,204,21,.45);background:rgba(250,204,21,.10);color:#facc15;font-weight:1000;text-decoration:none">
              💳 Commencer à payer
            </a>

            <a href="${SUPPORT_WA}" target="_blank" rel="noopener"
              style="flex:1;min-width:160px;text-align:center;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#eafff1;font-weight:1000;text-decoration:none">
              🛟 Support WhatsApp
            </a>
          </div>

          <p style="margin:12px 0 0;opacity:.75;font-size:12px">
            Astuce : ajoute <span style="font-family:ui-monospace">?debug=1</span> pour diagnostiquer sans aucune redirection.
          </p>
        </div>
      </div>
    `;

    document.body.innerHTML = html;

    const enter = $("digiyGateEnter");
    enter?.addEventListener("click", () => {
      const s = (document.getElementById("digiyGateSlug")?.value || "").trim();
      if(!s) return alert("Slug requis");
      localStorage.setItem(STORAGE_KEY, s);
      const u = new URL(location.origin + location.pathname);
      u.searchParams.set("slug", s);
      if (DEBUG) u.searchParams.set("debug","1");
      location.assign(u.toString());
    });
  }

  async function main(){
    window.DIGIY_ACCESS = { ok:false, phone:null, slug:null, reason:"init" };

    const slug = getSlug();
    if(!slug){
      window.DIGIY_ACCESS.reason = "slug_missing";
      return showGate("slug_missing", "");
    }

    localStorage.setItem(STORAGE_KEY, slug);
    setSlugInUrl(slug);

    const SUPABASE_URL = window.DIGIY_SUPABASE_URL || window.SUPABASE_URL;
    const SUPABASE_ANON = window.DIGIY_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;

    if(!SUPABASE_URL || !SUPABASE_ANON || !window.supabase?.createClient){
      window.DIGIY_ACCESS.reason = "supabase_config_missing";
      return showGate("supabase_config_missing", slug);
    }

    const sb = window.sb || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }
    });
    window.sb = sb;

    // 1) slug -> phone
    const { data: row, error: e1 } = await sb
      .from("digiy_subscriptions_public")
      .select("phone, slug, module")
      .eq("slug", slug)
      .maybeSingle();

    if(e1){
      console.error("[GUARD-SOFT] subscriptions_public error", e1);
      window.DIGIY_ACCESS.reason = "subscriptions_public_error";
      return showGate("subscriptions_public_error", slug);
    }
    if(!row?.phone){
      window.DIGIY_ACCESS.reason = "slug_not_found";
      return showGate("slug_not_found", slug);
    }

    // 2) has_access
    const { data: ok, error: e2 } = await sb.rpc("digiy_has_access", {
      p_phone: row.phone,
      p_module: MODULE
    });

    if(e2){
      console.error("[GUARD-SOFT] has_access rpc error", e2);
      window.DIGIY_ACCESS.reason = "has_access_rpc_error";
      return showGate("has_access_rpc_error", slug);
    }

    if(ok !== true){
      window.DIGIY_ACCESS.reason = "has_access_false";
      return showGate("has_access_false", slug);
    }

    // ✅ OK
    window.DIGIY_ACCESS = { ok:true, phone: row.phone, slug, reason:"ok" };
    console.log("[GUARD-SOFT] ✅ access ok", window.DIGIY_ACCESS);
  }

  // Expose helper pour que ton app attende l’accès
  window.digiyRequireAccess = async function(){
    if(window.DIGIY_ACCESS?.ok === true) return window.DIGIY_ACCESS;
    await main();
    if(window.DIGIY_ACCESS?.ok !== true) throw new Error(window.DIGIY_ACCESS?.reason || "access_denied");
    return window.DIGIY_ACCESS;
  };

  // Auto-run (mais sans rediriger)
  main().catch((e)=>{
    console.error("[GUARD-SOFT] crash", e);
    showGate("guard_crash", getSlug());
  });

})();
