(function () {
  "use strict";

  const MODULE_NAME = "LOC";
  const SESSION_KEY = "digiy_loc_session";
  const SESSION_KEYS = [
    "digiy_loc_session",
    "digiy_loc_guard_session",
    "digiy_guard_loc_session"
  ];

  const LAST_SLUG_KEY = "digiy_loc_last_slug";
  const ALT_SLUG_KEYS = [
    "digiy_loc_last_slug",
    "digiy_loc_slug",
    "digiy_last_slug"
  ];

  const LAST_PHONE_KEY = "digiy_loc_phone";
  const ALT_PHONE_KEYS = [
    "digiy_loc_phone",
    "digiy_loc_last_phone",
    "DIGIY_LOC_HUB_PHONE"
  ];

  const MAX_AGE_MS = 8 * 60 * 60 * 1000;
  const LOGIN_URL = window.DIGIY_LOGIN_URL || "./pin.html";

  const state = {
    ready: false,
    access: false,
    access_ok: false,
    module: MODULE_NAME,
    slug: "",
    phone: "",
    validated_at: 0,
    session_token: "",
    reason: ""
  };

  let supabaseClient = null;

  function normalizeSlug(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizePhone(value) {
    return String(value || "").replace(/[^\d]/g, "");
  }

  function isSensitiveSlug(slug) {
    return /\d{7,}/.test(String(slug || ""));
  }

  function canExposeSlug(slug) {
    const clean = normalizeSlug(slug);
    return !!clean && !isSensitiveSlug(clean);
  }

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function qs() {
    return new URLSearchParams(window.location.search || "");
  }

  function now() {
    return Date.now();
  }

  function parseTime(value) {
    if (value === null || value === undefined || value === "") return 0;

    if (typeof value === "number" && Number.isFinite(value)) {
      if (value > 0 && value < 100000000000) return value * 1000;
      return value;
    }

    const str = String(value).trim();
    if (!str) return 0;

    if (/^\d+$/.test(str)) {
      const n = Number(str);
      if (!Number.isFinite(n) || n <= 0) return 0;
      if (n < 100000000000) return n * 1000;
      return n;
    }

    const d = Date.parse(str);
    return Number.isFinite(d) ? d : 0;
  }

  function isFresh(ts) {
    const n = parseTime(ts);
    if (!n) return false;
    return (now() - n) <= MAX_AGE_MS;
  }

  function createSupabase() {
    if (supabaseClient) return supabaseClient;

    const url =
      window.DIGIY_SUPABASE_URL ||
      window.SUPABASE_URL ||
      "";

    const key =
      window.DIGIY_SUPABASE_ANON_KEY ||
      window.DIGIY_SUPABASE_ANON ||
      window.SUPABASE_ANON_KEY ||
      "";

    if (!url || !key) {
      throw new Error("Supabase non configuré");
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
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

    window.sb = supabaseClient;
    return supabaseClient;
  }

  function readSessionStorage(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function readLocalStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function readStorage(key) {
    return readSessionStorage(key) || readLocalStorage(key) || "";
  }

  function writeSessionStorage(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (_) {}
  }

  function writeLocalStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function removeSessionStorage(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (_) {}
  }

  function removeLocalStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function removeStorage(key) {
    removeSessionStorage(key);
    removeLocalStorage(key);
  }

  function writeSlugContext(slug) {
    const cleanSlug = normalizeSlug(slug);
    if (!cleanSlug) return;

    if (isSensitiveSlug(cleanSlug)) {
      writeSessionStorage(LAST_SLUG_KEY, cleanSlug);
      removeLocalStorage(LAST_SLUG_KEY);
      removeLocalStorage("digiy_loc_slug");
      removeLocalStorage("digiy_last_slug");
      return;
    }

    writeSessionStorage(LAST_SLUG_KEY, cleanSlug);
    writeLocalStorage(LAST_SLUG_KEY, cleanSlug);
  }

  function writePhoneContext(phone) {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return;

    ALT_PHONE_KEYS.forEach((key) => {
      writeSessionStorage(key, cleanPhone);
      removeLocalStorage(key);
    });
  }

  function removeLegacySensitiveLocal() {
    ALT_PHONE_KEYS.forEach(removeLocalStorage);

    ALT_SLUG_KEYS.forEach((key) => {
      const v = normalizeSlug(readLocalStorage(key) || "");
      if (v && isSensitiveSlug(v)) {
        removeLocalStorage(key);
      }
    });
  }

  function readStoredSession() {
    for (const key of SESSION_KEYS) {
      const raw = readStorage(key);
      if (!raw) continue;

      const parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed !== "object") continue;

      const validatedAt =
        parseTime(parsed.validated_at) ||
        parseTime(parsed.validatedAt) ||
        parseTime(parsed.ts) ||
        parseTime(parsed.created_at);

      return {
        slug: normalizeSlug(parsed.slug || parsed.last_slug || ""),
        phone: normalizePhone(parsed.phone || parsed.owner_phone || parsed.p_phone || ""),
        module: String(parsed.module || MODULE_NAME).toUpperCase(),
        validated_at: validatedAt,
        expires_at: parseTime(parsed.expires_at || parsed.expiresAt),
        session_token: String(parsed.session_token || parsed.token || ""),
        access: !!(
          parsed.access === true ||
          parsed.access_ok === true ||
          parsed.ok === true ||
          parsed.validated === true ||
          parsed.status === "ok"
        )
      };
    }

    return null;
  }

  function sessionFresh(session) {
    if (!session) return false;
    if (session.expires_at && now() < session.expires_at) return true;
    return isFresh(session.validated_at);
  }

  function writeStoredSession(payload) {
    const clean = {
      slug: normalizeSlug(payload.slug),
      phone: normalizePhone(payload.phone),
      module: MODULE_NAME,
      validated_at: parseTime(payload.validated_at) || now(),
      expires_at: parseTime(payload.expires_at) || (now() + MAX_AGE_MS),
      session_token: String(payload.session_token || ""),
      access: !!payload.access,
      access_ok: !!payload.access
    };

    const raw = JSON.stringify(clean);

    SESSION_KEYS.forEach((key) => {
      writeSessionStorage(key, raw);
      removeLocalStorage(key);
    });

    if (clean.slug) writeSlugContext(clean.slug);
    if (clean.phone) writePhoneContext(clean.phone);

    return clean;
  }

  function clearStoredSession() {
    SESSION_KEYS.forEach(removeStorage);
    ALT_PHONE_KEYS.forEach(removeStorage);
  }

  function getStoredSlug() {
    for (const key of ALT_SLUG_KEYS) {
      const v = normalizeSlug(readStorage(key));
      if (v) return v;
    }
    return "";
  }

  function getStoredPhone() {
    for (const key of ALT_PHONE_KEYS) {
      const v = normalizePhone(readStorage(key));
      if (v) return v;
    }
    return "";
  }

  function readUrlContext() {
    const p = qs();
    return {
      slug: normalizeSlug(p.get("slug")),
      phone: normalizePhone(p.get("phone"))
    };
  }

  function cleanVisibleUrl(contextSlug) {
    try {
      const url = new URL(window.location.href);
      let changed = false;

      if (url.searchParams.has("phone")) {
        url.searchParams.delete("phone");
        changed = true;
      }

      const urlSlug = normalizeSlug(url.searchParams.get("slug") || "");
      const finalSlug = normalizeSlug(contextSlug || urlSlug || "");

      if (urlSlug && isSensitiveSlug(urlSlug)) {
        url.searchParams.delete("slug");
        changed = true;
      }

      if (finalSlug && isSensitiveSlug(finalSlug) && url.searchParams.has("slug")) {
        url.searchParams.delete("slug");
        changed = true;
      }

      if (changed) {
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    } catch (_) {}
  }

  function pickBestContext() {
    const urlCtx = readUrlContext();
    const stored = readStoredSession();

    let slug = urlCtx.slug || "";
    let phone = urlCtx.phone || "";

    if (!slug && stored && sessionFresh(stored)) slug = stored.slug || "";
    if (!phone && stored && sessionFresh(stored)) phone = stored.phone || "";

    if (!slug) slug = getStoredSlug();
    if (!phone) phone = getStoredPhone();

    if (slug) writeSlugContext(slug);
    if (phone) writePhoneContext(phone);

    cleanVisibleUrl(slug);
    removeLegacySensitiveLocal();

    return { slug, phone, stored };
  }

  function applyState(patch) {
    Object.assign(state, patch || {});
    state.access_ok = !!state.access;
    return state;
  }

  function buildUrl(url, params) {
    const base = new URL(url, window.location.href);

    Object.entries(params || {}).forEach(([key, value]) => {
      const str = String(value ?? "").trim();
      if (!str) return;

      if (key === "phone") return;

      if (key === "slug") {
        const cleanSlug = normalizeSlug(str);
        if (canExposeSlug(cleanSlug)) base.searchParams.set("slug", cleanSlug);
        return;
      }

      base.searchParams.set(key, str);
    });

    base.searchParams.delete("phone");

    const slug = normalizeSlug(base.searchParams.get("slug") || "");
    if (slug && isSensitiveSlug(slug)) {
      base.searchParams.delete("slug");
    }

    return base.toString();
  }

  function syncUrlContext(slug) {
    try {
      const url = new URL(window.location.href);
      const cleanSlug = normalizeSlug(slug);

      url.searchParams.delete("phone");

      if (canExposeSlug(cleanSlug)) {
        url.searchParams.set("slug", cleanSlug);
      } else if (url.searchParams.has("slug")) {
        url.searchParams.delete("slug");
      }

      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function isLoginPage() {
    const pathname = String(window.location.pathname || "").toLowerCase();
    return pathname.endsWith("/pin.html") || pathname.endsWith("pin.html");
  }

  function goLogin(extra) {
    const ctx = pickBestContext();
    const targetSlug = normalizeSlug((extra && extra.slug) || ctx.slug || "");
    const targetPhone = normalizePhone((extra && extra.phone) || ctx.phone || "");

    if (targetSlug) writeSlugContext(targetSlug);
    if (targetPhone) writePhoneContext(targetPhone);

    if (isLoginPage()) {
      syncUrlContext(targetSlug);
      return;
    }

    const target = buildUrl(LOGIN_URL, {
      slug: targetSlug
    });

    window.location.href = target;
  }

  function go(target, mode) {
    const finalUrl = buildUrl(target || window.location.href, {});
    if (mode === "replace") window.location.replace(finalUrl);
    else window.location.assign(finalUrl);
  }

  async function resolvePhoneBySlug(slug) {
    const cleanSlug = normalizeSlug(slug);
    if (!cleanSlug) return "";

    const sb = createSupabase();

    const tries = [
      { slug: cleanSlug, module: MODULE_NAME },
      { slug: cleanSlug, module: MODULE_NAME.toLowerCase() },
      { slug: cleanSlug }
    ];

    for (const q of tries) {
      try {
        const { data, error } = await sb
          .from("digiy_subscriptions_public")
          .select("phone,slug,module")
          .match(q)
          .limit(1);

        if (error) continue;

        if (Array.isArray(data) && data[0] && data[0].phone) {
          return normalizePhone(data[0].phone);
        }
      } catch (_) {}
    }

    return "";
  }

  async function checkAccess(slug, phone) {
    const cleanSlug = normalizeSlug(slug);
    let cleanPhone = normalizePhone(phone);

    if (!cleanSlug && !cleanPhone) {
      return { ok: false, reason: "missing_context", slug: "", phone: "" };
    }

    if (!cleanPhone && cleanSlug) {
      cleanPhone = await resolvePhoneBySlug(cleanSlug);
    }

    if (!cleanPhone) {
      return {
        ok: false,
        reason: "phone_not_resolved",
        slug: cleanSlug,
        phone: ""
      };
    }

    const sb = createSupabase();

    try {
      const { data, error } = await sb.rpc("digiy_has_access", {
        p_phone: cleanPhone,
        p_module: MODULE_NAME
      });

      if (error) {
        return {
          ok: false,
          reason: "rpc_error",
          details: error.message || "rpc_error",
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
    } catch (err) {
      return {
        ok: false,
        reason: "rpc_error",
        details: err && err.message ? err.message : "rpc_error",
        slug: cleanSlug,
        phone: cleanPhone
      };
    }
  }

  function parseVerifyAccessPinPayload(raw, fallbackPhone) {
    const data = Array.isArray(raw) ? raw[0] : raw;
    if (!data) return null;

    if (typeof data === "object" && !Array.isArray(data)) {
      if (data.ok === true) {
        return {
          ok: true,
          phone: normalizePhone(data.phone || data.p_phone || fallbackPhone || ""),
          module: String(data.module || data.p_module || MODULE_NAME).toUpperCase(),
          owner_id: data.owner_id || null,
          session_token: String(data.session_token || "")
        };
      }

      const vals = Object.values(data);
      if (vals.length >= 3) {
        const okLike =
          vals[0] === true ||
          vals[0] === "t" ||
          vals[0] === "true" ||
          vals[0] === 1;

        if (okLike) {
          return {
            ok: true,
            module: String(vals[1] || MODULE_NAME).toUpperCase(),
            phone: normalizePhone(vals[2] || fallbackPhone || ""),
            owner_id: vals[4] || null,
            session_token: ""
          };
        }
      }
    }

    if (typeof data === "string") {
      const txt = data.trim();

      if (txt.startsWith("(") && txt.endsWith(")")) {
        const m = txt.match(/^\(([^,]+),([^,]+),([^,]+),?(.*)\)$/);
        if (m) {
          const okToken = String(m[1] || "").trim().replace(/^"|"$/g, "");
          const okLike = okToken === "t" || okToken === "true" || okToken === "1";

          if (okLike) {
            return {
              ok: true,
              module: String(m[2] || "").trim().replace(/^"|"$/g, "") || MODULE_NAME,
              phone: normalizePhone(String(m[3] || "").trim().replace(/^"|"$/g, "") || fallbackPhone || ""),
              owner_id: null,
              session_token: ""
            };
          }
        }
      }
    }

    return null;
  }

  async function loginWithPin(slug, pin, phone) {
    const cleanSlug = normalizeSlug(slug);
    const cleanPin = String(pin || "").trim();
    let cleanPhone = normalizePhone(phone);

    if (!cleanPin) {
      return { ok: false, reason: "missing_pin" };
    }

    if (!cleanPhone && cleanSlug) {
      cleanPhone = await resolvePhoneBySlug(cleanSlug);
    }

    const sb = createSupabase();

    function finalizeSuccess(finalSlug, finalPhone, extra) {
      const payload = {
        slug: normalizeSlug(finalSlug),
        phone: normalizePhone(finalPhone),
        validated_at: now(),
        expires_at: now() + MAX_AGE_MS,
        session_token: String((extra && extra.session_token) || ""),
        access: true
      };

      writeStoredSession(payload);
      syncUrlContext(payload.slug);

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

    if (cleanPhone) {
      try {
        const { data, error } = await sb.rpc("digiy_verify_pin", {
          p_phone: cleanPhone,
          p_module: MODULE_NAME,
          p_pin: cleanPin
        });

        if (!error && data && data.ok === true) {
          const finalSlug = cleanSlug || normalizeSlug(data.slug) || getStoredSlug();
          const finalPhone = cleanPhone || normalizePhone(data.phone);
          return finalizeSuccess(finalSlug, finalPhone, data);
        }
      } catch (_) {}
    }

    if (cleanSlug) {
      try {
        const { data, error } = await sb.rpc("verify_access_pin", {
          p_slug: cleanSlug,
          p_pin: cleanPin
        });

        if (!error) {
          const parsed = parseVerifyAccessPinPayload(data, cleanPhone);

          if (parsed && parsed.ok) {
            let finalPhone = normalizePhone(parsed.phone || cleanPhone);
            if (!finalPhone) {
              finalPhone = await resolvePhoneBySlug(cleanSlug);
            }

            if (finalPhone) {
              return finalizeSuccess(cleanSlug, finalPhone, parsed);
            }
          }
        }
      } catch (_) {}
    }

    return {
      ok: false,
      reason: "pin_invalid",
      slug: cleanSlug,
      phone: cleanPhone
    };
  }

  async function boot(options) {
    const opts = Object.assign(
      {
        redirect: true,
        preserve_validation: true
      },
      options || {}
    );

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

    if (ctx.slug) writeSlugContext(ctx.slug);
    if (ctx.phone) writePhoneContext(ctx.phone);

    cleanVisibleUrl(ctx.slug);

    if (
      ctx.stored &&
      ctx.stored.access &&
      ctx.stored.module === MODULE_NAME &&
      sessionFresh(ctx.stored)
    ) {
      const storedSlug = normalizeSlug(ctx.stored.slug || ctx.slug);
      const storedPhone = normalizePhone(ctx.stored.phone || ctx.phone);

      const saved = writeStoredSession({
        slug: storedSlug,
        phone: storedPhone,
        validated_at: parseTime(ctx.stored.validated_at),
        expires_at: parseTime(ctx.stored.expires_at) || (now() + MAX_AGE_MS),
        session_token: String(ctx.stored.session_token || ""),
        access: true
      });

      applyState({
        ready: true,
        access: true,
        slug: saved.slug,
        phone: saved.phone,
        validated_at: saved.validated_at,
        session_token: saved.session_token,
        reason: "session_valid"
      });

      syncUrlContext(saved.slug);

      return {
        ok: true,
        from: "session",
        slug: saved.slug,
        phone: saved.phone
      };
    }

    if (!opts.preserve_validation) {
      clearStoredSession();
    }

    applyState({
      ready: true,
      access: false,
      slug: ctx.slug || "",
      phone: ctx.phone || "",
      validated_at: 0,
      session_token: "",
      reason: ctx.slug || ctx.phone ? "login_required" : "missing_context"
    });

    if (opts.redirect !== false && !isLoginPage()) {
      goLogin({
        slug: state.slug,
        phone: state.phone
      });
    }

    return {
      ok: false,
      reason: state.reason,
      slug: state.slug,
      phone: state.phone
    };
  }

  function logout(redirect) {
    const keepSlug = state.slug;

    clearStoredSession();

    applyState({
      ready: true,
      access: false,
      access_ok: false,
      validated_at: 0,
      session_token: "",
      reason: "logout"
    });

    cleanVisibleUrl(keepSlug);

    if (redirect !== false) {
      goLogin({
        slug: keepSlug,
        phone: ""
      });
    }
  }

  function requireAccess() {
    if (!state.access) {
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
    VERSION: "loc-guard-security-v2-20260504",
    state,
    boot,
    ready: boot,
    logout,
    requireAccess,
    loginWithPin,
    checkAccess,
    resolvePhoneBySlug,
    getSb() {
      return createSupabase();
    },
    go,
    getSession() {
      return readStoredSession();
    },
    saveContext(slug, phone) {
      const cleanSlug = normalizeSlug(slug);
      const cleanPhone = normalizePhone(phone);

      if (cleanSlug) writeSlugContext(cleanSlug);
      if (cleanPhone) writePhoneContext(cleanPhone);

      syncUrlContext(cleanSlug);

      return {
        slug: cleanSlug,
        phone: cleanPhone
      };
    },
    getContext() {
      return pickBestContext();
    },
    cleanUrl() {
      cleanVisibleUrl(state.slug);
    }
  };

  cleanVisibleUrl();
})();
