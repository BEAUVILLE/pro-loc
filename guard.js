/* =========================
   DIGIY LOC PRO — GUARD (FINAL PRO)
   GitHub Pages SAFE • Session fluide • Logout fiable
   - RPC: go_pin_check(p_slug) -> json { ok:true, ... } (RLS-safe)
   - RPC: verify_access_pin(p_phone,p_pin,p_module) -> json { ok:true|false, reason }
   - ✅ Conserve slug sur toutes les pages
   - ✅ Conserve session (8h) => plus de re-saisie tel+PIN à chaque page
   - ✅ Logout: purge propre (session + cache + phone) + redirect
========================= */
(function(){
  "use strict";

  // =============================
  // SUPABASE
  // =============================
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  // =============================
  // STORAGE KEYS
  // =============================
  const KEY = {
    slug: "digiy_loc_slug",
    phone: "digiy_phone",
    sess: "digiy_loc_pro_session_v2",   // { phone, ok:true, exp, module, slug }
  };

  // =============================
  // DEFAULTS
  // =============================
  const DEFAULTS = {
    module: "LOC",
    sessionMs: 8 * 60 * 60 * 1000,     // 8h
    requireSlug: true,

    // pages (repo-safe)
    login: "./pin.html",
    home: "./index.html",
    dashboard: "./index.html",
    diagnostic: "./health-loc.html",

    // payment page (external ok)
    pay: "https://beauville.github.io/commencer-a-payer/",
  };

  // =============================
  // SMALL HELPERS
  // =============================
  function now(){ return Date.now(); }

  function qs(name){
    try { return new URL(location.href).searchParams.get(name) || ""; }
    catch(_){ return ""; }
  }

  function currentFile(){
    try{
      const p = location.pathname.split("/").filter(Boolean);
      return p.length ? p[p.length - 1] : "";
    }catch(_){
      return "";
    }
  }

  function isAbsUrl(u){ return /^https?:\/\//i.test(String(u||"")); }

  function getSB(){
    if (window.__sb) return window.__sb;
    if (!window.supabase?.createClient) throw new Error("Supabase JS not loaded (include supabase-js before guard.js)");
    window.__sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return window.__sb;
  }

  function normPhone(p){
    p = String(p||"").trim().replace(/\s+/g,"").replace(/[^\d+]/g,"");
    if (p.startsWith("00221")) p = "+221" + p.slice(5);
    if (!p.startsWith("+") && p.startsWith("221")) p = "+" + p;
    if (!p.startsWith("+221") && /^\d{9}$/.test(p)) p = "+221" + p;
    return p;
  }

  // =============================
  // SLUG
  // =============================
  function getSlug(){
    const s = String(qs("slug") || "").trim();
    if (s){
      try { localStorage.setItem(KEY.slug, s); } catch(_){}
      return s;
    }
    try { return String(localStorage.getItem(KEY.slug) || "").trim(); } catch(_){}
    return "";
  }

  function withSlug(url){
    const slug = getSlug();
    if (!slug) return String(url);

    const raw = String(url||"");
    const abs = isAbsUrl(raw);

    try{
      const u = new URL(raw, location.href);
      if (!u.searchParams.get("slug")) u.searchParams.set("slug", slug);
      if (abs) return u.toString();
      return u.pathname + u.search + u.hash;
    }catch(_){
      const sep = raw.includes("?") ? "&" : "?";
      return raw + sep + "slug=" + encodeURIComponent(slug);
    }
  }

  function go(url){
    location.replace(withSlug(url));
  }

  // =============================
  // SESSION
  // =============================
  function getSession(){
    try{
      const s = JSON.parse(localStorage.getItem(KEY.sess) || "null");
      if (!s?.phone || !s?.ok) return null;
      if (s?.exp && now() > Number(s.exp)) return null;
      return s;
    }catch(_){
      return null;
    }
  }

  function setSession({ phone, module, slug, sessionMs }){
    const exp = now() + Number(sessionMs || DEFAULTS.sessionMs);
    const sess = {
      ok: true,
      phone: normPhone(phone),
      module: String(module || DEFAULTS.module),
      slug: String(slug || getSlug() || ""),
      exp
    };
    try{ localStorage.setItem(KEY.sess, JSON.stringify(sess)); }catch(_){}
    try{ sessionStorage.setItem(KEY.phone, sess.phone); }catch(_){}
    try{ localStorage.setItem("digiy_access_pin", JSON.stringify({ phone: sess.phone })); }catch(_){}
    return sess;
  }

  function clearSession(){
    try{ localStorage.removeItem(KEY.sess); }catch(_){}
    try{ sessionStorage.removeItem(KEY.phone); }catch(_){}
    try{ localStorage.removeItem("digiy_access_pin"); }catch(_){}
    // on garde le slug (c'est un "lieu", pas une session)
  }

  function getPhone(){
    try{
      const s = sessionStorage.getItem(KEY.phone);
      if (s) return s;
    }catch(_){}
    const sess = getSession();
    if (sess?.phone) return sess.phone;
    return null;
  }

  // =============================
  // RPC
  // =============================
  async function rpcGoPinCheck(slug){
    const sb = getSB();
    const { data, error } = await sb.rpc("go_pin_check", { p_slug: String(slug||"") });
    if (error) throw error;
    return data;
  }

  async function rpcVerifyAccessPin(phone, pin, module){
    const sb = getSB();
    const { data, error } = await sb.rpc("verify_access_pin", {
      p_phone: phone,
      p_pin: String(pin||""),
      p_module: String(module||DEFAULTS.module)
    });
    if (error) throw error;
    return data;
  }

  // =============================
  // REDIRECT PAY
  // =============================
  function redirectToPay(pay, module, phone, slug){
    const from = location.href;
    location.replace(
      String(pay)
      + "?module=" + encodeURIComponent(module)
      + "&phone=" + encodeURIComponent(phone)
      + "&from=" + encodeURIComponent(from)
      + (slug ? "&slug=" + encodeURIComponent(slug) : "")
      + "&status=pending"
    );
  }

  // =============================
  // PUBLIC API
  // =============================
  async function boot(cfg){
    cfg = cfg || {};
    const module = String(cfg.module || DEFAULTS.module).trim();
    const requireSlug = (cfg.requireSlug !== false) && DEFAULTS.requireSlug;

    const login = cfg.login || DEFAULTS.login;
    const dashboard = cfg.dashboard || DEFAULTS.dashboard;
    const diagnostic = cfg.diagnostic || DEFAULTS.diagnostic;
    const pay = cfg.pay || DEFAULTS.pay;

    const file = currentFile();
    const isLoginPage = (file === "pin.html" || file === "login.html" || file === "create-pin.html");
    const force = !!cfg.force;

    const slug = getSlug();
    if (requireSlug && !slug){
      // pas de slug => impossible de savoir quel GO PIN
      if (!isLoginPage) go(login);
      return { ok:false, reason:"NO_SLUG" };
    }

    // ✅ 1) check GO PIN (RLS-safe via RPC)
    let goPin;
    try{
      goPin = await rpcGoPinCheck(slug);
    }catch(e){
      console.warn("go_pin_check error:", e);
      if (!isLoginPage) go(diagnostic);
      return { ok:false, reason:"GO_PIN_RPC_ERROR", error:String(e?.message||e) };
    }

    if (!goPin || goPin.ok !== true){
      // slug inconnu ou inactif
      if (!isLoginPage) go(login);
      return { ok:false, reason:goPin?.reason || "GO_PIN_INVALID" };
    }

    // ✅ 2) session?
    const sess = getSession();
    if (!sess?.phone){
      if (!isLoginPage) go(login);
      return { ok:false, reason:"NO_SESSION" };
    }

    // ✅ 3) module actif ? (optionnel)
    // Ici, on n'a pas une RPC module_active dans cette version.
    // => On te laisse la logique paiement au niveau "commencer-a-payer" si tu veux.
    // Si tu veux remettre is_module_active plus tard, on le rajoute.

    // ✅ 4) si tout OK -> rester sur page, ou rediriger dashboard si demandé
    // - Sur login page -> on pousse vers dashboard
    // - Sur autres pages -> on ne force pas, sauf cfg.redirectToDashboard
    if (isLoginPage){
      go(dashboard);
      return { ok:true, goPin, sess };
    }

    if (cfg.redirectToDashboard === true){
      const dashName = String(dashboard).split("/").pop();
      if (dashName && location.pathname.endsWith(dashName)) return { ok:true, goPin, sess };
      go(dashboard);
      return { ok:true, goPin, sess };
    }

    return { ok:true, goPin, sess };
  }

  async function loginWithPin(phone, pin, module){
    const p = normPhone(phone);
    const mod = String(module || DEFAULTS.module);

    const slug = getSlug();
    if (!slug) return { ok:false, reason:"NO_SLUG" };

    // GO PIN check d'abord (évite confusion)
    const goPin = await rpcGoPinCheck(slug);
    if (!goPin || goPin.ok !== true){
      return { ok:false, reason: goPin?.reason || "GO_PIN_INVALID" };
    }

    const res = await rpcVerifyAccessPin(p, String(pin||""), mod);

    const ok =
      (res === true) ||
      (res && typeof res === "object" && (res.ok === true || res.allowed === true || res.valid === true));

    if (!ok) return { ok:false, res };

    setSession({ phone: p, module: mod, slug, sessionMs: DEFAULTS.sessionMs });
    return { ok:true, res, goPin };
  }

  function logout(opts){
    opts = opts || {};
    const to = opts.redirect || DEFAULTS.login;
    clearSession();

    // bonus: flush aussi les caches legacy éventuels
    try{ localStorage.removeItem("digiy_loc_subs_cache_v1"); }catch(_){}
    try{ localStorage.removeItem("digiy_loc_subs_cache_v2"); }catch(_){}
    try{ sessionStorage.removeItem("digiy_driver_phone"); }catch(_){}

    go(to);
  }

  // API exposée
  const API = {
    boot,
    loginWithPin,
    logout,
    getPhone,
    getSession,
    clearSession,
    normPhone,
    getSlug,
    withSlug
  };

  window.DIGIY_LOC_PRO_GUARD = API;
  window.DIGIY_GUARD = API;
})();
