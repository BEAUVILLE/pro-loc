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
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "digiy-loc-guard-auth"
      }
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
      slug: (extra && extra.slug) || ctx.slug || "",
      phone: (extra && extra.phone) || ctx.phone || ""
    });
    window.location.href = target;
  }

  async function resolvePhoneBySlug(slug){
    const cleanSlug = normalizeSlug(slug);
    if(!cleanSlug) return "";

    const sb = createSupabase();

    const tries = [
      { slug: cleanSlug, module: MODULE_NAME },
      { slug: cleanSlug, module: MODULE_NAME.toLowerCase() },
      { slug: cleanSlug }
    ];

    for(const q of tries){
      try{
        const { data, error } = await sb
          .from("digiy_subscriptions_public")
          .select("phone,slug,module")
          .match(q)
          .limit(1);

        if(error) continue;

        if(Array.isArray(data) && data[0] && data[0].phone){
          return normalizePhone(data[0].phone);
        }
      }catch(_){}
    }

    return "";
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

  function parseVerifyAccessPinPayload(raw, fallbackPhone){
    const data = Array.isArray(raw) ? raw[0] : raw;
    if(!data) return null;

    if(typeof data === "object" && !Array.isArray(data)){
      if(data.ok === true){
        return {
          ok: true,
          phone: normalizePhone(data.phone || data.p_phone || fallbackPhone || ""),
          module: String(data.module || data.p_module || MODULE_NAME).toUpperCase(),
          owner_id: data.owner_id || null
        };
      }

      const vals = Object.values(data);
      if(vals.length >= 3){
        const okLike =
          vals[0] === true ||
          vals[0] === "t" ||
          vals[0] === "true" ||
          vals[0] === 1;

        if(okLike){
          return {
            ok: true,
            module: String(vals[1] || MODULE_NAME).toUpperCase(),
            phone: normalizePhone(vals[2] || fallbackPhone || ""),
            owner_id: vals[4] || null
          };
        }
      }
    }

    if(typeof data === "string"){
      const txt = data.trim();

      if(txt.startsWith("(") && txt.endsWith(")")){
        const m = txt.match(/^\(([^,]+),([^,]+),([^,]+),?(.*)\)$/);
        if(m){
          const okToken = String(m[1] || "").trim().replace(/^"|"$/g, "");
          const okLike = okToken === "t" || okToken === "true" || okToken === "1";

          if(okLike){
            return {
              ok: true,
              module: String(m[2] || "").trim().replace(/^"|"$/g, "") || MODULE_NAME,
              phone: normalizePhone(String(m[3] || "").trim().replace(/^"|"$/g, "") || fallbackPhone || ""),
              owner_id: null
            };
          }
        }
      }
    }

    return null;
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

    const sb = createSupabase();

    function finalizeSuccess(finalSlug, finalPhone, extra){
      const payload = {
        slug: normalizeSlug(finalSlug),
        phone: normalizePhone(finalPhone),
        validated_at: now(),
        session_token: String((extra && extra.session_token) || ""),
        access: true
      };

      writeStoredSession(payload);

      applyState({
        ready: true,
        access: true,
        slug: payload.slug,
        phone: payload.phone,
        validated_at: payload.validated_at,
        session_token: payload.session_token,
        reason: "ok"
      });

      return {
        ok: true,
        slug: payload.slug,
        phone: payload.phone,
        session_token: payload.session_token
      };
    }

    if(cleanPhone){
      try{
        const { data, error } = await sb.rpc("digiy_verify_pin", {
          p_phone: cleanPhone,
          p_module: MODULE_NAME,
          p_pin: cleanPin
        });

        if(!error && data && data.ok === true){
          const finalSlug = cleanSlug || normalizeSlug(data.slug) || getStoredSlug();
          const finalPhone = cleanPhone || normalizePhone(data.phone);
          return finalizeSuccess(finalSlug, finalPhone, data);
        }
      }catch(_){}
    }

    if(cleanSlug){
      try{
        const { data, error } = await sb.rpc("verify_access_pin", {
          p_slug: cleanSlug,
          p_pin: cleanPin
        });

        if(!error){
          const parsed = parseVerifyAccessPinPayload(data, cleanPhone);

          if(parsed && parsed.ok){
            let finalPhone = normalizePhone(parsed.phone || cleanPhone);
            if(!finalPhone){
              finalPhone = await resolvePhoneBySlug(cleanSlug);
            }

            if(finalPhone){
              return finalizeSuccess(cleanSlug, finalPhone, parsed);
            }
          }
        }
      }catch(_){}
    }

    return {
      ok: false,
      reason: "pin_invalid",
      slug: cleanSlug,
      phone: cleanPhone
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
