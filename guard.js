(function(){
  "use strict";

  const MODULE_NAME = "LOC";
  const SESSION_KEY = "digiy_loc_session";
  const LAST_SLUG_KEY = "digiy_loc_last_slug";
  const LAST_PHONE_KEY = "digiy_loc_phone";
  const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h

  const LOGIN_URL = window.DIGIY_LOGIN_URL || "./pin.html";

  const state = {
    ready: false,
    access: false,
    module: MODULE_NAME,
    slug: "",
    phone: "",
    validated_at: 0,
    session_token: "",
    reason: ""
  };

  let supabaseClient = null;

  function normalizeSlug(value){
    return String(value || "").trim().toLowerCase();
  }

  function normalizePhone(value){
    return String(value || "").replace(/[^\d]/g, "");
  }

  function safeJsonParse(raw){
    try{
      return JSON.parse(raw);
    }catch(_){
      return null;
    }
  }

  function qs(){
    return new URLSearchParams(window.location.search || "");
  }

  function now(){
    return Date.now();
  }

  function isFresh(ts){
    const n = Number(ts || 0);
    if(!n) return false;
    return (now() - n) <= MAX_AGE_MS;
  }

  function createSupabase(){
    if(supabaseClient) return supabaseClient;

    const url =
      window.DIGIY_SUPABASE_URL ||
      window.SUPABASE_URL ||
      "";

    const key =
      window.DIGIY_SUPABASE_ANON_KEY ||
      window.DIGIY_SUPABASE_ANON ||
      window.SUPABASE_ANON_KEY ||
      "";

    if(!url || !key){
      throw new Error("Supabase non configuré");
    }

    if(!window.supabase || typeof window.supabase.createClient !== "function"){
      throw new Error("Librairie Supabase absente");
    }

    supabaseClient = window.supabase.createClient(url, key, {
      auth: { persistSession: false }
    });

    return supabaseClient;
  }

  function readStoredSession(){
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return null;

    const parsed = safeJsonParse(raw);
    if(!parsed || typeof parsed !== "object") return null;

    return {
      slug: normalizeSlug(parsed.slug),
      phone: normalizePhone(parsed.phone),
      module: String(parsed.module || "").toUpperCase(),
      validated_at: Number(parsed.validated_at || parsed.ts || 0),
      session_token: String(parsed.session_token || ""),
      access: !!parsed.access
    };
  }

  function writeStoredSession(payload){
    const clean = {
      slug: normalizeSlug(payload.slug),
      phone: normalizePhone(payload.phone),
      module: MODULE_NAME,
      validated_at: Number(payload.validated_at || now()),
      session_token: String(payload.session_token || ""),
      access: !!payload.access
    };

    if(clean.slug){
      localStorage.setItem(LAST_SLUG_KEY, clean.slug);
    }
    if(clean.phone){
      localStorage.setItem(LAST_PHONE_KEY, clean.phone);
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(clean));
    return clean;
  }

  function clearStoredSession(){
    localStorage.removeItem(SESSION_KEY);
  }

  function getStoredSlug(){
    return normalizeSlug(localStorage.getItem(LAST_SLUG_KEY));
  }

  function getStoredPhone(){
    return normalizePhone(localStorage.getItem(LAST_PHONE_KEY));
  }

  function readUrlContext(){
    const p = qs();
    return {
      slug: normalizeSlug(p.get("slug")),
      phone: normalizePhone(p.get("phone"))
    };
  }

  function pickBestContext(){
    const urlCtx = readUrlContext();
    const stored = readStoredSession();

    let slug = urlCtx.slug || "";
    let phone = urlCtx.phone || "";

    if(!slug && stored && isFresh(stored.validated_at)) slug = stored.slug || "";
    if(!phone && stored && isFresh(stored.validated_at)) phone = stored.phone || "";

    if(!slug) slug = getStoredSlug();
    if(!phone) phone = getStoredPhone();

    return { slug, phone, stored };
  }

  function applyState(patch){
    Object.assign(state, patch || {});
    return state;
  }

  function buildUrl(url, params){
    const base = new URL(url, window.location.href);
    Object.entries(params || {}).forEach(([key, value]) => {
      if(value !== undefined && value !== null && String(value) !== ""){
        base.searchParams.set(key, String(value));
      }
    });
    return base.toString();
  }

  function goLogin(extra){
    const ctx = pickBestContext();
    const target = buildUrl(LOGIN_URL, {
      slug: extra?.slug || ctx.slug || "",
      phone: extra?.phone || ctx.phone || ""
    });
    window.location.href = target;
  }

  async function resolvePhoneBySlug(slug){
    const cleanSlug = normalizeSlug(slug);
    if(!cleanSlug) return "";

    const sb = createSupabase();

    try{
      const { data, error } = await sb
        .from("digiy_subscriptions_public")
        .select("phone,module,slug")
        .eq("slug", cleanSlug)
        .eq("module", MODULE_NAME)
        .maybeSingle();

      if(error) throw error;
      return normalizePhone(data?.phone || "");
    }catch(_){
      return "";
    }
  }

  async function checkAccess(slug, phone){
    const cleanSlug = normalizeSlug(slug);
    let cleanPhone = normalizePhone(phone);

    if(!cleanSlug && !cleanPhone){
      return { ok:false, reason:"missing_context" };
    }

    if(!cleanPhone && cleanSlug){
      cleanPhone = await resolvePhoneBySlug(cleanSlug);
    }

    if(!cleanPhone){
      return { ok:false, reason:"phone_not_resolved", slug: cleanSlug, phone: "" };
    }

    const sb = createSupabase();
    const { data, error } = await sb.rpc("digiy_has_access", {
      p_phone: cleanPhone,
      p_module: MODULE_NAME
    });

    if(error){
      return {
        ok:false,
        reason:error.message || "rpc_error",
        slug: cleanSlug,
        phone: cleanPhone
      };
    }

    return {
      ok: !!data,
      reason: data ? "ok" : "inactive_subscription",
      slug: cleanSlug,
      phone: cleanPhone
    };
  }

  async function loginWithPin(slug, pin, phone){
    const cleanSlug = normalizeSlug(slug);
    const cleanPin = String(pin || "").trim();
    let cleanPhone = normalizePhone(phone);

    if(!cleanPin){
      return { ok:false, reason:"missing_pin" };
    }

    if(!cleanPhone && cleanSlug){
      cleanPhone = await resolvePhoneBySlug(cleanSlug);
    }

    if(!cleanPhone){
      return { ok:false, reason:"phone_not_resolved" };
    }

    const sb = createSupabase();
    const { data, error } = await sb.rpc("digiy_verify_pin", {
      p_phone: cleanPhone,
      p_module: MODULE_NAME,
      p_pin: cleanPin
    });

    if(error){
      return { ok:false, reason:error.message || "pin_rpc_error" };
    }

    const ok = !!(data && data.ok);
    if(!ok){
      return {
        ok:false,
        reason:(data && data.reason) || "pin_invalid",
        slug: cleanSlug,
        phone: cleanPhone
      };
    }

    const finalSlug = cleanSlug || normalizeSlug(data.slug) || getStoredSlug();
    const finalPhone = cleanPhone || normalizePhone(data.phone);

    writeStoredSession({
      slug: finalSlug,
      phone: finalPhone,
      validated_at: now(),
      session_token: data.session_token || "",
      access: true
    });

    applyState({
      ready: true,
      access: true,
      slug: finalSlug,
      phone: finalPhone,
      validated_at: now(),
      session_token: data.session_token || "",
      reason: "ok"
    });

    return {
      ok:true,
      slug: finalSlug,
      phone: finalPhone,
      session_token: data.session_token || ""
    };
  }

  async function boot(options){
    const opts = options || {};
    const ctx = pickBestContext();

    applyState({
      ready: false,
      access: false,
      slug: ctx.slug || "",
      phone: ctx.phone || "",
      validated_at: 0,
      session_token: "",
      reason: ""
    });

    if(ctx.slug) localStorage.setItem(LAST_SLUG_KEY, ctx.slug);
    if(ctx.phone) localStorage.setItem(LAST_PHONE_KEY, ctx.phone);

    if(ctx.stored && isFresh(ctx.stored.validated_at) && ctx.stored.access){
      const storedSlug = normalizeSlug(ctx.stored.slug || ctx.slug);
      const storedPhone = normalizePhone(ctx.stored.phone || ctx.phone);

      applyState({
        ready: true,
        access: true,
        slug: storedSlug,
        phone: storedPhone,
        validated_at: Number(ctx.stored.validated_at || 0),
        session_token: String(ctx.stored.session_token || ""),
        reason: "session_valid"
      });

      return { ok:true, from:"session", slug:storedSlug, phone:storedPhone };
    }

    const access = await checkAccess(ctx.slug, ctx.phone);

    if(access.ok){
      writeStoredSession({
        slug: access.slug,
        phone: access.phone,
        validated_at: now(),
        session_token: "",
        access: true
      });

      applyState({
        ready: true,
        access: true,
        slug: access.slug,
        phone: access.phone,
        validated_at: now(),
        session_token: "",
        reason: "access_ok"
      });

      return { ok:true, from:"rpc", slug:access.slug, phone:access.phone };
    }

    clearStoredSession();

    applyState({
      ready: true,
      access: false,
      slug: access.slug || ctx.slug || "",
      phone: access.phone || ctx.phone || "",
      validated_at: 0,
      session_token: "",
      reason: access.reason || "access_denied"
    });

    if(opts.redirect !== false){
      goLogin({
        slug: state.slug,
        phone: state.phone
      });
    }

    return {
      ok:false,
      reason: state.reason,
      slug: state.slug,
      phone: state.phone
    };
  }

  function logout(redirect){
    clearStoredSession();
    applyState({
      ready: true,
      access: false,
      validated_at: 0,
      session_token: "",
      reason: "logout"
    });

    if(redirect !== false){
      goLogin({
        slug: state.slug,
        phone: state.phone
      });
    }
  }

  function requireAccess(){
    if(!state.access){
      goLogin({
        slug: state.slug,
        phone: state.phone
      });
      return false;
    }
    return true;
  }

  window.DIGIY_GUARD = {
    MODULE_NAME,
    MAX_AGE_MS,
    state,
    boot,
    ready: boot,
    logout,
    requireAccess,
    loginWithPin,
    checkAccess,
    resolvePhoneBySlug,
    getSession(){
      return readStoredSession();
    },
    saveContext(slug, phone){
      const cleanSlug = normalizeSlug(slug);
      const cleanPhone = normalizePhone(phone);
      if(cleanSlug) localStorage.setItem(LAST_SLUG_KEY, cleanSlug);
      if(cleanPhone) localStorage.setItem(LAST_PHONE_KEY, cleanPhone);
      return { slug: cleanSlug, phone: cleanPhone };
    },
    getContext(){
      return pickBestContext();
    }
  };
})();
