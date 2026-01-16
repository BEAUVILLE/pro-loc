/* =========================
   DIGIY LOC PRO GUARD — GitHub Pages SAFE (PRO FINAL)
   - RPC: verify_access_pin(p_phone,p_pin,p_module) -> json|bool
   - RPC optional: is_module_active(p_phone,p_module) -> bool
   - ✅ Repo-safe relative redirects
   - ✅ Keeps ?slug=... across pages
   - ✅ Session 8h (localStorage) + phone (sessionStorage)
   - ✅ Sub check cached (5 min)
   - ✅ No forced dashboard redirect (opt-in)
   - ✅ Network/RPC errors => go Diagnostic (no session wipe)
   - ✅ Exposes window.DIGIY_GUARD + window.DIGIY_LOC_PRO_GUARD
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
    phone: "digiy_phone",
    sess:  "digiy_loc_pro_session",        // { phone, ok, token?, exp }
    slug:  "digiy_loc_slug",
    subs:  "digiy_loc_subs_cache_v1"        // { "<phone>|<module>": { ok, exp } }
  };

  // =============================
  // DEFAULTS
  // =============================
  const DEFAULTS = {
    module: "LOC",
    login: "./login.html",
    dashboard: "./planning.html",
    diagnostic: "./health-loc.html",
    pay: "https://beauville.github.io/commencer-a-payer/",
    requireSlug: true,
    checkSubscription: true,
    subsCacheMs: 5 * 60 * 1000,            // 5 minutes
    sessionMs: 8 * 60 * 60 * 1000          // 8 hours
  };

  // =============================
  // URL / SLUG HELPERS
  // =============================
  function qs(name){
    try { return new URL(location.href).searchParams.get(name) || ""; }
    catch(_){ return ""; }
  }

  function getSlug(){
    const s = String(qs("slug") || "").trim();
    if (s) { try { localStorage.setItem(KEY.slug, s); } catch(_){} return s; }
    try { return String(localStorage.getItem(KEY.slug) || "").trim(); } catch(_){}
    return "";
  }

  // - If url is absolute http(s): keep absolute
  // - If url is relative: keep within GH Pages base
  function withSlug(url){
    const slug = getSlug();
    if (!slug) return String(url);

    const raw = String(url);
    const isAbs = /^https?:\/\//i.test(raw);

    try{
      const u = new URL(raw, location.href);
      if (!u.searchParams.get("slug")) u.searchParams.set("slug", slug);
      if (isAbs) return u.toString();
      return u.pathname + u.search + u.hash;
    }catch(_){
      const sep = raw.includes("?") ? "&" : "?";
      return raw + sep + "slug=" + encodeURIComponent(slug);
    }
  }

  function go(url){
    location.replace(withSlug(url));
  }

  function currentFile(){
    try{
      const p = location.pathname.split("/").filter(Boolean);
      return p.length ? p[p.length - 1] : "";
    }catch(_){
      return "";
    }
  }

  // =============================
  // PHONE / SESSION
  // =============================
  function normPhone(p){
    p = String(p||"").trim().replace(/\s+/g,"").replace(/[^\d+]/g,"");
    if (p.startsWith("00221")) p = "+221" + p.slice(5);
    if (!p.startsWith("+") && p.startsWith("221")) p = "+" + p;
    if (!p.startsWith("+221") && /^\d{9}$/.test(p)) p = "+221" + p;
    return p;
  }

  function getSB(){
    if (window.__sb) return window.__sb;
    if (!window.supabase?.createClient) {
      throw new Error("Supabase JS not loaded (include supabase-js before guard.js)");
    }
    // Note: We do NOT rely on Supabase Auth sessions here (PIN system is custom).
    window.__sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return window.__sb;
  }

  function getPhone(){
    // prefer sessionStorage
    const s = sessionStorage.getItem(KEY.phone) || sessionStorage.getItem("digiy_driver_phone");
    if (s) return s;

    // fallback: session object in localStorage
    try{
      const obj = JSON.parse(localStorage.getItem(KEY.sess) || "null");
      if (obj?.phone) return obj.phone;
    }catch(_){}
    return null;
  }

  function setPhone(phone){
    const p = normPhone(phone);
    sessionStorage.setItem(KEY.phone, p);
    sessionStorage.setItem("digiy_driver_phone", p);
    try{
      // compat keys used elsewhere
      localStorage.setItem("digiy_access_pin", JSON.stringify({ phone: p }));
      localStorage.setItem("digiy_driver_access_pin", JSON.stringify({ phone: p }));
    }catch(_){}
    return p;
  }

  function getSession(){
    try{
      const s = JSON.parse(localStorage.getItem(KEY.sess) || "null");
      if (!s?.phone) return null;
      if (s?.exp && Date.now() > Number(s.exp)) return null;
      return s;
    }catch(_){
      return null;
    }
  }

  function setSession(obj, sessionMs){
    const phone = normPhone(obj.phone);
    const exp = obj.exp ? Number(obj.exp) : (Date.now() + Number(sessionMs || DEFAULTS.sessionMs));
    const sess = { phone, ok:true, token: obj.token ? String(obj.token) : null, exp };
    try{ localStorage.setItem(KEY.sess, JSON.stringify(sess)); }catch(_){}
    setPhone(phone);
    return sess;
  }

  function clearSession(){
    try{ localStorage.removeItem(KEY.sess); }catch(_){}
    try{ sessionStorage.removeItem(KEY.phone); }catch(_){}
  }

  function logout(loginUrl){
    clearSession();
    try{ localStorage.removeItem(KEY.subs); }catch(_){}
    // slug: tu peux choisir de garder slug si tu veux.
    // Ici je le laisse, car c’est souvent un contexte de business utile.
    // Si tu veux le supprimer: décommente la ligne suivante.
    // try{ localStorage.removeItem(KEY.slug); }catch(_){}
    go(loginUrl || DEFAULTS.login);
  }

  function sessionLooksValid(){
    const s = getSession();
    if (!s?.phone) return false;
    if (s.exp && Date.now() > Number(s.exp)) return false;
    return true;
  }

  // =============================
  // SUBS CACHE
  // =============================
  function readSubsCache(){
    try { return JSON.parse(localStorage.getItem(KEY.subs) || "{}") || {}; }
    catch(_){ return {}; }
  }

  function writeSubsCache(cache){
    try { localStorage.setItem(KEY.subs, JSON.stringify(cache || {})); } catch(_){}
  }

  function subsCacheKey(phone, module){
    return String(phone || "") + "|" + String(module || "");
  }

  function getCachedSub(phone, module){
    const cache = readSubsCache();
    const k = subsCacheKey(phone, module);
    const v = cache[k];
    if (!v) return null;
    if (v.exp && Date.now() > Number(v.exp)) return null;
    return !!v.ok;
  }

  function setCachedSub(phone, module, ok, ttlMs){
    const cache = readSubsCache();
    const k = subsCacheKey(phone, module);
    cache[k] = { ok: !!ok, exp: Date.now() + Number(ttlMs || DEFAULTS.subsCacheMs) };
    writeSubsCache(cache);
  }

  // =============================
  // RPC
  // =============================
  async function rpcVerifyAccessPin(phone, pin, module){
    const sb = getSB();
    const { data, error } = await sb.rpc("verify_access_pin", {
      p_phone: phone, p_pin: pin, p_module: module
    });
    if (error) throw error;
    return data;
  }

  async function rpcIsModuleActive(phone, module){
    const sb = getSB();
    const { data, error } = await sb.rpc("is_module_active", {
      p_phone: phone, p_module: module
    });
    if (error) throw error;
    return !!data;
  }

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
  // BOOT (PROTECT PAGE)
  // =============================
  async function boot(cfg){
    cfg = cfg || {};

    const module = String(cfg.module || DEFAULTS.module).trim();
    const login = cfg.login || DEFAULTS.login;
    const dashboard = cfg.dashboard || DEFAULTS.dashboard;
    const pay = cfg.pay || DEFAULTS.pay;
    const diagnostic = cfg.diagnostic || DEFAULTS.diagnostic;

    // behaviors
    const requireSlug = (cfg.requireSlug !== false) && DEFAULTS.requireSlug;
    const checkSubscription = (cfg.checkSubscription !== false) && DEFAULTS.checkSubscription;
    const subsCacheMs = Number(cfg.subsCacheMs || DEFAULTS.subsCacheMs);

    // IMPORTANT: do NOT force redirect by default
    const redirectToDashboard = (cfg.redirectToDashboard === true);

    const file = currentFile();
    const force = !!cfg.force;

    // Do not guard auth pages unless forced
    if (!force && (file === "login.html" || file === "pin.html" || file === "create-pin.html")) {
      getSlug(); // keep slug if present
      return { ok:true, skipped:true };
    }

    const slug = getSlug();
    if (requireSlug && !slug) { go(login); return { ok:false, reason:"missing_slug" }; }

    const phoneRaw = getPhone();
    if (!phoneRaw) { go(login); return { ok:false, reason:"missing_phone" }; }

    const phone = setPhone(phoneRaw);

    if (!sessionLooksValid()){
      // Session expired or missing -> login
      clearSession();
      go(login);
      return { ok:false, reason:"session_invalid" };
    }

    // Subscription check (cached)
    if (checkSubscription){
      const cached = getCachedSub(phone, module);

      if (cached === true){
        // ok
      } else if (cached === false){
        redirectToPay(pay, module, phone, slug);
        return { ok:false, reason:"sub_inactive_cached" };
      } else {
        try{
          const ok = await rpcIsModuleActive(phone, module);
          setCachedSub(phone, module, ok, subsCacheMs);

          if (!ok){
            redirectToPay(pay, module, phone, slug);
            return { ok:false, reason:"sub_inactive" };
          }
        }catch(e){
          // PRO: do NOT wipe session on network/RPC error
          console.warn("is_module_active error:", e);
          go(diagnostic);
          return { ok:false, reason:"sub_check_error", error:String(e?.message || e) };
        }
      }
    }

    // Optional redirect to dashboard
    if (redirectToDashboard){
      const dashName = String(dashboard).split("/").pop();
      if (!(dashName && location.pathname.endsWith(dashName))) {
        go(dashboard);
        return { ok:true, redirected:true, to:dashboard };
      }
    }

    // Stay on current page
    return { ok:true, phone, module, slug };
  }

  // =============================
  // LOGIN WITH PIN
  // =============================
  async function loginWithPin(phone, pin, module){
    const p = setPhone(phone);
    const mod = String(module || DEFAULTS.module);

    const res = await rpcVerifyAccessPin(p, String(pin||""), mod);

    const ok =
      (res === true) ||
      (res && typeof res === "object" && (res.ok === true || res.allowed === true || res.valid === true));

    if (!ok) return { ok:false, res };

    // session expiration handling
    let exp = Date.now() + DEFAULTS.sessionMs;
    if (res && typeof res === "object"){
      if (res.exp_ms) exp = Date.now() + Number(res.exp_ms);
      if (res.exp) exp = Number(res.exp);
    }
    const token = (res && typeof res === "object" && res.token) ? String(res.token) : null;

    setSession({ phone: p, token, exp }, DEFAULTS.sessionMs);

    // small optimistic cache for sub status to avoid immediate recheck
    setCachedSub(p, mod, true, 30 * 1000);

    return { ok:true, res };
  }

  // =============================
  // PUBLIC API
  // =============================
  const API = {
    boot,
    loginWithPin,
    logout,
    getPhone,
    setPhone,
    getSession,
    setSession,
    clearSession,
    normPhone,
    getSlug,
    withSlug
  };

  window.DIGIY_LOC_PRO_GUARD = API;
  window.DIGIY_GUARD = API;
})();
