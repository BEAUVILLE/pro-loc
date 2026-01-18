/* =========================
   DIGIY LOC PRO — GUARD (FINAL PRO) ✅ PATCH OWNER_ID + LOGOUT SAFE
   GitHub Pages SAFE • Session fluide • Logout fiable
   - RPC: go_pin_check(p_slug) -> json { ok:true, ... } (RLS-safe)
   - RPC: verify_access_pin(p_phone,p_pin,p_module) -> json { ok:true|false, reason, owner_id? }
   - ✅ Conserve slug sur toutes les pages
   - ✅ Conserve session (8h)
   - ✅ Logout: purge propre + redirect
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
    sess: "digiy_loc_pro_session_v2",   // { phone, ok:true, exp, module, slug, owner_id? }
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

  function getSB(){
    if (window.__sb) return window.__sb;
    if (!window.supabase?.createClient) {
      throw new Error("Supabase JS not loaded (include supabase-js before guard.js)");
    }
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

  function safeStr(x){ return (x === null || x === undefined) ? "" : String(x); }

  // =============================
  // SLUG
  // =============================
  function getSlug(){
    const s = safeStr(qs("slug")).trim();
    if (s){
      try { localStorage.setItem(KEY.slug, s); } catch(_){}
      return s;
    }
    try { return safeStr(localStorage.getItem(KEY.slug)).trim(); } catch(_){}
    return "";
  }

  function withSlug(url){
    const slug = getSlug();
    const raw = safeStr(url || "");

    try{
      const u = new URL(raw, location.href);
      if (slug && !u.searchParams.get("slug")) u.searchParams.set("slug", slug);
      return u.toString(); // ✅ TOUJOURS ABSOLU (comme tu veux)
    }catch(_){
      const sep = raw.includes("?") ? "&" : "?";
      return new URL(raw + (slug ? (sep + "slug=" + encodeURIComponent(slug)) : ""), location.href).toString();
    }
  }

  // ✅ MISSING PIECE: NAVIGATION SAFE (anti-boucle)
  function go(url){
    const target = withSlug(url);
    // évite de recharger exactement la même URL (petite protection)
    if (target === location.href) return;
    location.href = target;
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

  // ✅ owner_id ajouté
  function setSession({ phone, owner_id, module, slug, sessionMs }){
    const exp = now() + Number(sessionMs || DEFAULTS.sessionMs);
    const sess = {
      ok: true,
      phone: normPhone(phone),
      owner_id: owner_id || null,
      module: safeStr(module || DEFAULTS.module),
      slug: safeStr(slug || getSlug() || ""),
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
    // on garde le slug
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
    const { data, error } = await sb.rpc("go_pin_check", { p_slug: safeStr(slug) });
    if (error) throw error;
    return data;
  }

  async function rpcVerifyAccessPin(phone, pin, module){
    const sb = getSB();
    const { data, error } = await sb.rpc("verify_access_pin", {
      p_phone: phone,
      p_pin: safeStr(pin),
      p_module: safeStr(module || DEFAULTS.module)
    });
    if (error) throw error;
    return data;
  }

  // =============================
  // PUBLIC API
  // =============================
  async function boot(cfg){
    cfg = cfg || {};
    const module = safeStr(cfg.module || DEFAULTS.module).trim();
    const requireSlug = (cfg.requireSlug !== false) && DEFAULTS.requireSlug;

    const login = cfg.login || DEFAULTS.login;
    const dashboard = cfg.dashboard || DEFAULTS.dashboard;
    const diagnostic = cfg.diagnostic || DEFAULTS.diagnostic;

    const file = currentFile();
    const isLoginPage = (file === "pin.html" || file === "login.html" || file === "create-pin.html");

    const slug = getSlug();
    if (requireSlug && !slug){
      if (!isLoginPage) go(login);
      return { ok:false, reason:"NO_SLUG" };
    }

    // ✅ 1) check GO PIN
    let goPin;
    try{
      goPin = await rpcGoPinCheck(slug);
    }catch(e){
      console.warn("go_pin_check error:", e);
      if (!isLoginPage) go(diagnostic);
      return { ok:false, reason:"GO_PIN_RPC_ERROR", error:safeStr(e?.message||e) };
    }

    if (!goPin || goPin.ok !== true){
      if (!isLoginPage) go(login);
      return { ok:false, reason:goPin?.reason || "GO_PIN_INVALID" };
    }

    // ✅ 2) session?
    const sess = getSession();
    if (!sess?.phone){
      if (!isLoginPage) go(login);
      return { ok:false, reason:"NO_SESSION" };
    }

    // ✅ 3) si login page -> dashboard
    if (isLoginPage){
      go(dashboard);
      return { ok:true, goPin, sess };
    }

    if (cfg.redirectToDashboard === true){
      const dashName = safeStr(dashboard).split("/").pop();
      if (dashName && location.pathname.endsWith(dashName)) return { ok:true, goPin, sess };
      go(dashboard);
      return { ok:true, goPin, sess };
    }

    return { ok:true, goPin, sess };
  }

  async function loginWithPin(phone, pin, module){
    const p = normPhone(phone);
    const mod = safeStr(module || DEFAULTS.module).toUpperCase();

    const slug = getSlug();
    if (!slug) return { ok:false, reason:"NO_SLUG" };

    // GO PIN check d'abord
    const goPin = await rpcGoPinCheck(slug);
    if (!goPin || goPin.ok !== true){
      return { ok:false, reason: goPin?.reason || "GO_PIN_INVALID" };
    }

    const res = await rpcVerifyAccessPin(p, safeStr(pin), mod);

    const ok =
      (res === true) ||
      (res && typeof res === "object" && (res.ok === true || res.allowed === true || res.valid === true));

    if (!ok) return { ok:false, res };

    // ✅ owner_id si disponible
    const owner_id = (res && typeof res === "object")
      ? (res.owner_id || res.ownerId || res.user_id || res.uid || null)
      : null;

    const sess = setSession({ phone: p, owner_id, module: mod, slug, sessionMs: DEFAULTS.sessionMs });
    return { ok:true, res, goPin, sess };
  }

  // ✅ logout accepte string OU objet
  function logout(opts){
    let redirect = DEFAULTS.login;

    if (typeof opts === "string") {
      redirect = opts;
    } else if (opts && typeof opts === "object") {
      redirect = opts.redirect || DEFAULTS.login;
    }

    clearSession();

    try{ localStorage.removeItem("digiy_loc_subs_cache_v1"); }catch(_){}
    try{ localStorage.removeItem("digiy_loc_subs_cache_v2"); }catch(_){}
    try{ sessionStorage.removeItem("digiy_driver_phone"); }catch(_){}

    go(redirect);
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
