/* =========================
   DIGIY LOC PRO — GUARD (FINAL PRO) ✅
   - Expose: DIGIY_GUARD.sb + DIGIY_GUARD.getSupabase()
   - Conserve slug + session + owner_id
   - GitHub Pages SAFE
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
    sess: "digiy_loc_pro_session_v2" // { phone, ok:true, exp, module, slug, owner_id? }
  };

  // =============================
  // CLIENT
  // =============================
  const sb = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // =============================
  // HELPERS
  // =============================
  const now = ()=> Date.now();
  const clampStr = (s)=> String(s || "").trim();
  const safeJsonParse = (v)=>{ try{return JSON.parse(v);}catch(e){return null;} };

  function getUrl(){
    try{ return new URL(location.href); }catch(e){ return null; }
  }

  function getSlugFromUrl(){
    const u = getUrl();
    const s = u?.searchParams?.get("slug");
    return clampStr(s).replace(/\/+$/,"").toLowerCase();
  }

  function setSlug(slug){
    slug = clampStr(slug).toLowerCase();
    if(!slug) return;
    localStorage.setItem(KEY.slug, slug);
  }

  function getSlug(){
    // priorité URL, sinon storage
    const u = getSlugFromUrl();
    if(u){ setSlug(u); return u; }
    return clampStr(localStorage.getItem(KEY.slug)).toLowerCase();
  }

  function withSlug(path){
    const slug = getSlug();
    try{
      const x = new URL(path, location.href);
      if(slug && !x.searchParams.get("slug")) x.searchParams.set("slug", slug);
      return x.toString();
    }catch(e){
      // fallback simple
      if(!slug) return path;
      return path + (path.includes("?") ? "&" : "?") + "slug=" + encodeURIComponent(slug);
    }
  }

  function readSession(){
    const raw = localStorage.getItem(KEY.sess);
    const s = safeJsonParse(raw);
    if(!s || typeof s !== "object") return { ok:false };
    // expire
    if(s.exp && Number(s.exp) > 0 && now() > Number(s.exp)){
      clearSession();
      return { ok:false };
    }
    // ok
    return { ok: !!s.ok, ...s };
  }

  function writeSession(obj){
    localStorage.setItem(KEY.sess, JSON.stringify(obj || {}));
  }

  function clearSession(){
    localStorage.removeItem(KEY.sess);
  }

  function setPhone(phone){
    if(!phone) return;
    localStorage.setItem(KEY.phone, String(phone));
  }

  function getPhone(){
    return clampStr(localStorage.getItem(KEY.phone));
  }

  // =============================
  // RPCs
  // =============================
  async function rpc_goPinCheck(slug){
    if(!sb) throw new Error("Supabase client absent");
    const { data, error } = await sb.rpc("go_pin_check", { p_slug: slug });
    if(error) throw error;
    return data;
  }

  async function rpc_verifyPin(phone, pin, module){
    if(!sb) throw new Error("Supabase client absent");
    const { data, error } = await sb.rpc("verify_access_pin", {
      p_phone: phone,
      p_pin: pin,
      p_module: module
    });
    if(error) throw error;
    return data;
  }

  // =============================
  // FLOW
  // =============================
  async function ensureSlugOrRedirect(opts){
    if(!opts?.requireSlug) return true;

    const slug = getSlug();
    if(slug) return true;

    // slug manquant -> redirect dashboard/login (au choix)
    const target = opts?.dashboard || opts?.login || "./index.html";
    location.href = target;
    return false;
  }

  function ensureSessionOrRedirect(opts){
    if(!opts?.requireSession) return true;

    const s = readSession();
    if(s.ok) return true;

    const target = opts?.login || "./pin.html";
    location.href = withSlug(target);
    return false;
  }

  async function boot(opts){
    // 1) slug
    const okSlug = await ensureSlugOrRedirect(opts);
    if(!okSlug) return;

    // 2) go_pin_check (optionnel mais utile)
    if(opts?.requireSlug){
      try{
        const slug = getSlug();
        if(slug){
          // check public-safe (RLS)
          const chk = await rpc_goPinCheck(slug);
          // si ok:false -> on ne casse pas la page, mais on peut rediriger si demandé
          if(chk && chk.ok === false && opts?.redirectIfGoPinInvalid){
            location.href = (opts?.dashboard || "./index.html");
            return;
          }
        }
      }catch(e){
        // on n’explose pas la page, c’est "best effort"
        // console.warn("[DIGIY_GUARD] go_pin_check ignored:", e?.message || e);
      }
    }

    // 3) session (si demandé)
    ensureSessionOrRedirect(opts);
  }

  // Login helper: appelé depuis pin.html si tu veux centraliser
  async function verifyAccessAndCreateSession({ phone, pin, module, keepHours = 8 }){
    phone = clampStr(phone);
    pin = clampStr(pin);
    module = clampStr(module || "loc");

    if(!phone || !pin) return { ok:false, reason:"missing" };

    const res = await rpc_verifyPin(phone, pin, module);
    // attendu: { ok:true|false, reason, owner_id? }
    if(!res || res.ok !== true){
      return { ok:false, reason: res?.reason || "invalid" };
    }

    // session 8h
    const exp = now() + (Number(keepHours) * 60 * 60 * 1000);

    const slug = getSlug(); // conserve
    setPhone(phone);

    writeSession({
      ok: true,
      phone,
      module,
      slug,
      owner_id: res.owner_id || null,
      exp
    });

    return { ok:true, owner_id: res.owner_id || null, exp };
  }

  function getSession(){
    return readSession();
  }

  function logout(redirectTo){
    try{
      clearSession();
      // on conserve slug volontairement (terrain)
      // localStorage.removeItem(KEY.slug);  // NON
    }catch(e){}

    const target = redirectTo || "./pin.html";
    location.href = withSlug(target);
  }

  // =============================
  // PUBLIC API
  // =============================
  window.DIGIY_GUARD = {
    // supabase access (pour tes pages PRO)
    sb,
    getSupabase: ()=> sb,

    // slug
    getSlug,
    withSlug,
    setSlug,

    // session
    getSession,
    verifyAccessAndCreateSession,
    logout,

    // util (optionnel)
    boot
  };
})();

