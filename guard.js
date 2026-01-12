/* =========================
   DIGIY LOC PRO GUARD — GitHub Pages SAFE (FINAL + PENDING)
   - RPC: verify_access_pin(p_phone,p_pin,p_module) -> json|bool
   - RPC optional: is_module_active(p_phone,p_module) -> bool
   - ✅ Redirects repo-safe (relative/within same GH Pages base)
   - ✅ Exposes window.DIGIY_GUARD (compat)
   - ✅ Keeps ?slug=... across pages
   - ✅ Subscription check cached (avoid spamming RPC)
   - ✅ If not active -> redirects to pay with status=pending (Wave/WA flow)
========================= */
(function(){
  "use strict";

  // =============================
  // SUPABASE
  // =============================
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const KEY = {
    phone: "digiy_phone",
    sess:  "digiy_loc_pro_session",      // { phone, ok, token?, exp }
    slug:  "digiy_loc_slug",
    subs:  "digiy_loc_subs_cache_v1"      // { "<phone>|<module>": { ok, exp } }
  };

  const DEFAULTS = {
    module: "LOC",
    dashboard: "./planning.html",                 // repo-safe
    login: "./login.html",                        // repo-safe
    pay: "https://beauville.github.io/commencer-a-payer/",
    requireSlug: true,
    checkSubscription: true,
    subsCacheMs: 5 * 60 * 1000,                   // 5 min cache
    sessionMs: 8 * 60 * 60 * 1000                 // 8h session
  };

  // =============================
  // URL / SLUG helpers
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

  // Return a repo-safe URL string:
  // - If input is absolute http(s), keep absolute (payment page is often external)
  // - If input is relative, keep it within current GH Pages base
  function withSlug(url){
    const slug = getSlug();
    if (!slug) return url;

    const isAbs = /^https?:\/\//i.test(String(url));
    try{
      const u = new URL(String(url), location.href);
      if (!u.searchParams.get("slug")) u.searchParams.set("slug", slug);

      if (isAbs) return u.toString();

      return u.pathname + u.search + u.hash;
    }catch(_){
      const sep = String(url).includes("?") ? "&" : "?";
      return String(url) + sep + "slug=" + encodeURIComponent(slug);
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
    if (!window.supabase?.createClient) throw new Error("Supabase JS not loaded (include supabase-js before guard.js)");
    window.__sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return window.__sb;
  }

  function getPhone(){
    const s = sessionStorage.getItem(KEY.phone) || sessionStorage.getItem("digiy_driver_phone");
    if (s) return s;
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
    localStorage.setItem(KEY.sess, JSON.stringify(sess));
    setPhone(phone);
    return sess;
  }

  function clearSession(){
    try{ localStorage.removeItem(KEY.sess); }catch(_){}
    try{ sessionStorage.removeItem(KEY.phone); }catch(_){}
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
      pay
      + "?module=" + encodeURIComponent(module)
      + "&phone=" + encodeURIComponent(phone)
      + "&from=" + encodeURIComponent(from)
      + (slug ? "&slug=" + encodeURIComponent(slug) : "")
      + "&status=pending" // ✅ Wave/WA: show EN ATTENTE instead of scary INACTIF
    );
  }

  // =============================
  // PUBLIC API
  // =============================
  async function boot(cfg){
    cfg = cfg || {};

    const module = String(cfg.module || DEFAULTS.module).trim();
    const dashboard = cfg.dashboard || DEFAULTS.dashboard;
    const login = cfg.login || DEFAULTS.login;
    const pay = cfg.pay || DEFAULTS.pay;

    const requireSlug = (cfg.requireSlug !== false) && DEFAULTS.requireSlug;
    const checkSubscription = (cfg.checkSubscription !== false) && DEFAULTS.checkSubscription;
    const subsCacheMs = Number(cfg.subsCacheMs || DEFAULTS.subsCacheMs);

    const file = currentFile();
    const force = !!cfg.force;
    if (!force && (file === "login.html" || file === "pin.html" || file === "create-pin.html")) {
      getSlug();
      return;
    }

    const slug = getSlug();
    if (requireSlug && !slug) { go(login); return; }

    const phoneRaw = getPhone();
    if (!phoneRaw) { go(login); return; }
    const phone = setPhone(phoneRaw);

    if (!sessionLooksValid()){
      clearSession();
      go(login);
      return;
    }

    if (checkSubscription){
      const cached = getCachedSub(phone, module);

      if (cached === true){
        // ok
      } else if (cached === false){
        redirectToPay(pay, module, phone, slug);
        return;
      } else {
        try{
          const ok = await rpcIsModuleActive(phone, module);
          setCachedSub(phone, module, ok, subsCacheMs);

          if (!ok){
            redirectToPay(pay, module, phone, slug);
            return;
          }
        }catch(e){
          console.warn("is_module_active error:", e);
          clearSession();
          go(login);
          return;
        }
      }
    }

    const dashName = String(dashboard).split("/").pop();
    if (dashName && location.pathname.endsWith(dashName)) return;

    go(dashboard);
  }

  async function loginWithPin(phone, pin, module){
    const p = setPhone(phone);
    const mod = String(module || DEFAULTS.module);

    const res = await rpcVerifyAccessPin(p, String(pin||""), mod);

    const ok =
      (res === true) ||
      (res && typeof res === "object" && (res.ok === true || res.allowed === true || res.valid === true));

    if (!ok) return { ok:false, res };

    let exp = Date.now() + DEFAULTS.sessionMs;
    if (res && typeof res === "object"){
      if (res.exp_ms) exp = Date.now() + Number(res.exp_ms);
      if (res.exp) exp = Number(res.exp);
    }
    const token = (res && typeof res === "object" && res.token) ? String(res.token) : null;

    setSession({ phone: p, token, exp }, DEFAULTS.sessionMs);
    setCachedSub(p, mod, true, 30 * 1000);

    return { ok:true, res };
  }

  const API = {
    boot,
    loginWithPin,
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
