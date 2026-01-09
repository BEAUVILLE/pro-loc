/* =========================
   DIGIY GUARD — HYBRIDE (ANTI-LOOP)
   ✅ GitHub Pages safe
   ✅ Anti ping-pong (lock 4s)
   ✅ Supabase Auth (p_user_id) puis fallback (p_phone)
   ✅ Redirige: login -> pay -> dashboard
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
  // ANTI-LOOP LOCK
  // =============================
  const LOCK_KEY = "digiy_guard_lock";
  const LOCK_MS  = 4000;

  function now(){ return Date.now(); }
  function isLocked(){
    const t = Number(sessionStorage.getItem(LOCK_KEY) || "0");
    return (now() - t) < LOCK_MS;
  }
  function lock(){ sessionStorage.setItem(LOCK_KEY, String(now())); }
  function unlock(){ sessionStorage.removeItem(LOCK_KEY); }

  function go(url){
    if(isLocked()){
      console.warn("DIGIY_GUARD: redirect blocked (anti-loop) ->", url);
      return;
    }
    lock();
    location.replace(url);
  }

  // =============================
  // PHONE CACHE
  // =============================
  function normPhone(p){
    p = String(p||"").trim().replace(/\s+/g,"").replace(/[^\d+]/g,"");
    if(p.startsWith("00221")) p = "+221" + p.slice(5);
    if(!p.startsWith("+") && p.startsWith("221")) p = "+" + p;
    if(!p.startsWith("+221") && /^\d{9}$/.test(p)) p = "+221" + p;
    return p;
  }

  function getPhone(){
    const s =
      sessionStorage.getItem("digiy_phone") ||
      sessionStorage.getItem("digiy_driver_phone");
    if(s) return s;

    try{
      const a = JSON.parse(localStorage.getItem("digiy_access_pin")||"null");
      if(a?.phone) return a.phone;
    }catch(_){}

    try{
      const b = JSON.parse(localStorage.getItem("digiy_driver_access_pin")||"null");
      if(b?.phone) return b.phone;
    }catch(_){}

    return null;
  }

  function setPhone(phone){
    const p = normPhone(phone);
    sessionStorage.setItem("digiy_phone", p);
    sessionStorage.setItem("digiy_driver_phone", p);
    try{
      localStorage.setItem("digiy_access_pin", JSON.stringify({ phone: p }));
      localStorage.setItem("digiy_driver_access_pin", JSON.stringify({ phone: p }));
    }catch(_){}
    return p;
  }

  // =============================
  // SUPABASE CLIENT
  // =============================
  function getSB(){
    if(window.__sb) return window.__sb;
    if(!window.supabase?.createClient) throw new Error("Supabase JS not loaded");
    window.__sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return window.__sb;
  }

  async function getUser(){
    const sb = getSB();
    const { data, error } = await sb.auth.getUser();
    if(error) throw error;
    return data?.user || null;
  }

  // OPTIONAL RPC (ne bloque pas si absent)
  async function ensureProfilePhone(phone){
    if(!phone) return;
    const sb = getSB();
    const { error } = await sb.rpc("ensure_profile_phone", { p_phone: phone });
    if(error){
      console.warn("ensure_profile_phone ignored:", error.message);
    }
  }

  // =============================
  // RPC ACTIVE — HYBRIDE
  // 1) try is_module_active(p_user_id, p_module)
  // 2) fallback is_module_active(p_phone, p_module)
  // =============================
  async function isActiveHybrid(userId, phone, module){
    const sb = getSB();

    // Try by user id
    if(userId){
      const r1 = await sb.rpc("is_module_active", {
        p_user_id: userId,
        p_module: module
      });
      if(!r1.error) return !!r1.data;
      console.warn("is_module_active(user) failed:", r1.error.message);
    }

    // Fallback by phone
    if(phone){
      const r2 = await sb.rpc("is_module_active", {
        p_phone: phone,
        p_module: module
      });
      if(!r2.error) return !!r2.data;
      console.warn("is_module_active(phone) failed:", r2.error.message);
      throw r2.error;
    }

    // Nothing to check with
    return false;
  }

  // =============================
  // BOOT
  // cfg: { module:"LOC", dashboard:"./planning.html", login:"./login.html", pay:"https://..." }
  // =============================
  async function boot(cfg){
    const module = String(cfg.module || "").trim() || "LOC";
    const dashboard = cfg.dashboard || "./";
    const login = cfg.login || "./login.html";
    const pay = cfg.pay || "https://beauville.github.io/commencer-a-payer/";

    const rawPhone = getPhone();
    const phone = rawPhone ? setPhone(rawPhone) : null;

    try{
      const user = await getUser();
      if(!user){
        unlock();
        go(login);
        return;
      }

      await ensureProfilePhone(phone);

      const ok = await isActiveHybrid(user.id, phone, module);

      unlock();

      if(!ok){
        const from = location.href;
        go(
          pay
          + "?module=" + encodeURIComponent(module)
          + (phone ? ("&phone=" + encodeURIComponent(phone)) : "")
          + "&from=" + encodeURIComponent(from)
        );
        return;
      }

      // If already on dashboard, do nothing
      const dashName = String(dashboard).split("/").pop();
      if(dashName && location.pathname.endsWith(dashName)) return;

      // Otherwise go dashboard
      go(dashboard);

    }catch(e){
      unlock();
      console.warn("DIGIY_GUARD error:", e);
      go(login);
    }
  }

  window.DIGIY_GUARD = { boot, getPhone, setPhone, normPhone };
})();
