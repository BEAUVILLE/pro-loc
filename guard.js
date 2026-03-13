(() => {
  "use strict";

  const DEFAULT_MODULE = "LOC";
  const DEFAULT_STORAGE_SLUG_KEY = "digiy_loc_slug";
  const DEFAULT_STORAGE_LAST_SLUG = "digiy_last_slug";
  const DEFAULT_PIN_URL = "./pin.html";
  const DEFAULT_PAY_URL = "https://commencer-a-payer.digiylyfe.com/?module=LOC";
  const DEFAULT_DASHBOARD_URL = "./app.html";

  const FALLBACK_SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const FALLBACK_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  let _sb = null;
  let _bootPromise = null;

  const config = {
    module: DEFAULT_MODULE,
    pin: DEFAULT_PIN_URL,
    pay: DEFAULT_PAY_URL,
    dashboard: DEFAULT_DASHBOARD_URL,
    requireSlug: false,
    checkSubscription: true,
    storageSlugKey: DEFAULT_STORAGE_SLUG_KEY,
    storageLastSlugKey: DEFAULT_STORAGE_LAST_SLUG,
  };

  const state = {
    module: DEFAULT_MODULE,
    preview: true,
    access_ok: false,
    slug: "",
    phone: "",
    reason: "booting",
    ts: 0,
  };

  function upperModule(v) {
    return String(v || DEFAULT_MODULE).trim().toUpperCase() || DEFAULT_MODULE;
  }

  function storageGet(key) {
    if (!key) return "";
    try {
      const s = sessionStorage.getItem(key);
      if (s) return s;
    } catch {}
    try {
      const l = localStorage.getItem(key);
      if (l) return l;
    } catch {}
    return "";
  }

  function storageSet(key, value) {
    if (!key) return;
    try {
      sessionStorage.setItem(key, String(value ?? ""));
    } catch {}
    try {
      localStorage.setItem(key, String(value ?? ""));
    } catch {}
  }

  function storageRemove(key) {
    if (!key) return;
    try {
      sessionStorage.removeItem(key);
    } catch {}
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  function normSlug(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function normPhoneDigits(p) {
    return String(p || "").replace(/[^\d]/g, "");
  }

  function safeJsonParse(v) {
    try {
      return typeof v === "string" ? JSON.parse(v) : v;
    } catch {
      return null;
    }
  }

  function qps() {
    try {
      return new URLSearchParams(location.search || "");
    } catch {
      return new URLSearchParams();
    }
  }

  function getSlugFromPathname() {
    try {
      const clean = String(location.pathname || "")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");

      if (!clean) return "";

      const parts = clean.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || "";
      if (!last || /\.html?$/i.test(last)) return "";

      const candidate = normSlug(last);
      return candidate || "";
    } catch {
      return "";
    }
  }

  function getModuleSessionKey(moduleName) {
    const m = upperModule(moduleName).toLowerCase();
    return `DIGIY_${m.toUpperCase()}_PRO_SESSION`;
  }

  function applyOptions(opts = {}) {
    if (opts.module) config.module = upperModule(opts.module);
    if (opts.login || opts.pin) config.pin = String(opts.login || opts.pin).trim() || DEFAULT_PIN_URL;
    if (opts.pay) config.pay = String(opts.pay).trim() || DEFAULT_PAY_URL;
    if (opts.dashboard) config.dashboard = String(opts.dashboard).trim() || DEFAULT_DASHBOARD_URL;
    if (Object.prototype.hasOwnProperty.call(opts, "requireSlug")) config.requireSlug = !!opts.requireSlug;
    if (Object.prototype.hasOwnProperty.call(opts, "checkSubscription")) config.checkSubscription = !!opts.checkSubscription;
    if (opts.storageSlugKey) config.storageSlugKey = String(opts.storageSlugKey).trim();
    if (opts.storageLastSlugKey) config.storageLastSlugKey = String(opts.storageLastSlugKey).trim();

    state.module = config.module;
  }

  function rememberSlug(slug) {
    if (!slug) return;
    storageSet(config.storageSlugKey, slug);
    storageSet(config.storageLastSlugKey, slug);
    storageSet("DIGIY_SLUG", slug);
    storageSet("digiy_slug", slug);
  }

  function rememberPhone(phone) {
    const digits = normPhoneDigits(phone);
    if (!digits) return;
    const lower = config.module.toLowerCase();
    storageSet("DIGIY_PHONE", digits);
    storageSet(`DIGIY_${config.module}_PHONE`, digits);
    storageSet(`digiy_${lower}_phone`, digits);
  }

  function rememberSessionBits(session) {
    if (!session || typeof session !== "object") return;

    const slug = normSlug(session.slug || state.slug || "");
    const phone = normPhoneDigits(session.phone || state.phone || "");
    const ownerId = String(session.owner_id || session.ownerId || "").trim();
    const businessCode = String(session.business_code || session.businessCode || session.code || "").trim();
    const businessName = String(session.business_name || session.businessName || session.name || session.title || "").trim();
    const moduleUpper = upperModule(session.module || config.module);
    const moduleLower = moduleUpper.toLowerCase();

    if (slug) rememberSlug(slug);
    if (phone) rememberPhone(phone);

    if (ownerId) {
      storageSet(`DIGIY_${moduleUpper}_OWNER_ID`, ownerId);
      storageSet(`digiy_${moduleLower}_owner_id`, ownerId);
      storageSet("DIGIY_OWNER_ID", ownerId);
      storageSet("owner_id", ownerId);
    }

    if (businessCode) {
      storageSet(`DIGIY_${moduleUpper}_BUSINESS_CODE`, businessCode);
      storageSet("DIGIY_BUSINESS_CODE", businessCode);
    }

    if (businessName) {
      storageSet(`DIGIY_${moduleUpper}_BUSINESS_NAME`, businessName);
      storageSet("DIGIY_BUSINESS_NAME", businessName);
      storageSet("DIGIY_TITLE", businessName);
    }
  }

  function buildSyntheticSession() {
    const moduleUpper = config.module;
    const moduleLower = moduleUpper.toLowerCase();
    const slug = state.slug || normSlug(storageGet(config.storageSlugKey) || storageGet(config.storageLastSlugKey) || storageGet("DIGIY_SLUG") || storageGet("digiy_slug"));
    const phone = state.phone || normPhoneDigits(storageGet("DIGIY_PHONE") || storageGet(`DIGIY_${moduleUpper}_PHONE`) || storageGet(`digiy_${moduleLower}_phone`));
    const ownerId = storageGet(`DIGIY_${moduleUpper}_OWNER_ID`) || storageGet(`digiy_${moduleLower}_owner_id`) || storageGet("DIGIY_OWNER_ID") || storageGet("owner_id") || "";
    const businessCode = storageGet(`DIGIY_${moduleUpper}_BUSINESS_CODE`) || storageGet("DIGIY_BUSINESS_CODE") || "";
    const businessName = storageGet(`DIGIY_${moduleUpper}_BUSINESS_NAME`) || storageGet("DIGIY_BUSINESS_NAME") || "";

    if (!slug && !phone && !ownerId && !businessCode && !businessName) return null;

    return {
      ok: true,
      module: moduleUpper,
      slug,
      phone,
      owner_id: ownerId,
      business_code: businessCode,
      business_name: businessName,
    };
  }

  function getSession() {
    const keys = [
      getModuleSessionKey(config.module),
      "DIGIY_PRO_SESSION",
      `DIGIY_${config.module}_SESSION`,
    ];

    for (const key of keys) {
      const raw = storageGet(key);
      if (!raw) continue;

      const parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed !== "object") continue;

      if (parsed.expires_at && Number(parsed.expires_at) > 0 && Date.now() > Number(parsed.expires_at)) {
        storageRemove(key);
        continue;
      }

      const session = {
        ...parsed,
        module: upperModule(parsed.module || config.module),
        slug: normSlug(parsed.slug || state.slug || ""),
        phone: normPhoneDigits(parsed.phone || state.phone || ""),
      };

      rememberSessionBits(session);
      return session;
    }

    const synthetic = buildSyntheticSession();
    if (synthetic) {
      rememberSessionBits(synthetic);
      return synthetic;
    }

    return null;
  }

  function pickSlug() {
    const qs = qps();
    const fromQs = normSlug(qs.get("slug") || "");
    if (fromQs) return fromQs;

    const fromSession = getSession();
    if (fromSession?.slug) return normSlug(fromSession.slug);

    const fromStorage = normSlug(
      storageGet(config.storageSlugKey) ||
      storageGet(config.storageLastSlugKey) ||
      storageGet("DIGIY_SLUG") ||
      storageGet("digiy_slug") ||
      ""
    );
    if (fromStorage) return fromStorage;

    return getSlugFromPathname();
  }

  function ensureSlugInUrl(slug) {
    if (!slug) return;
    try {
      const u = new URL(location.href);
      if (!u.searchParams.get("slug")) {
        u.searchParams.set("slug", slug);
        history.replaceState({}, "", u.toString());
      }
    } catch {}
  }

  function withSlug(target = "") {
    const slug = state.slug || pickSlug();
    if (!target || !slug) return target;

    try {
      const u = new URL(target, location.href);
      if (!u.searchParams.get("slug")) u.searchParams.set("slug", slug);
      if (u.origin === location.origin) return u.pathname + u.search + u.hash;
      return u.toString();
    } catch {
      const sep = String(target).includes("?") ? "&" : "?";
      return `${target}${sep}slug=${encodeURIComponent(slug)}`;
    }
  }

  function getPayUrl(slug = "") {
    const finalSlug = slug || state.slug || pickSlug();
    try {
      const u = new URL(config.pay || DEFAULT_PAY_URL, location.href);
      u.searchParams.set("module", config.module);
      if (finalSlug) u.searchParams.set("slug", finalSlug);
      u.searchParams.set("return", location.origin + location.pathname + (finalSlug ? `?slug=${encodeURIComponent(finalSlug)}` : ""));
      return u.toString();
    } catch {
      return withSlug(config.pay || DEFAULT_PAY_URL);
    }
  }

  function getPinUrl(slug = "") {
    const finalSlug = slug || state.slug || pickSlug();
    try {
      const u = new URL(config.pin || DEFAULT_PIN_URL, location.href);
      if (finalSlug && !u.searchParams.get("slug")) u.searchParams.set("slug", finalSlug);
      return u.toString();
    } catch {
      return withSlug(config.pin || DEFAULT_PIN_URL);
    }
  }

  function getConfig() {
    const url = String(window.DIGIY_SUPABASE_URL || "").trim() || FALLBACK_SUPABASE_URL;
    const key = String(window.DIGIY_SUPABASE_ANON_KEY || window.DIGIY_SUPABASE_ANON || "").trim() || FALLBACK_SUPABASE_ANON_KEY;
    return { url, key };
  }

  function ensureSupabaseClient() {
    if (_sb) return _sb;

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("supabase_lib_missing");
    }

    const { url, key } = getConfig();
    if (!url || !key || key.length < 80) {
      throw new Error("supabase_config_missing");
    }

    _sb = window.supabase.createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    });

    if (!window.sb) window.sb = _sb;
    return _sb;
  }

  async function resolveSlugToPhone(sb, slug) {
    const { data, error } = await sb
      .from("digiy_subscriptions_public")
      .select("slug,phone,module")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      const e = new Error("subscriptions_public_error");
      e.cause = error;
      throw e;
    }

    if (data?.phone) {
      return {
        slug: normSlug(data.slug || slug),
        phone: normPhoneDigits(data.phone),
        module: upperModule(data.module || config.module),
      };
    }

    const session = getSession();
    if (session?.slug && normSlug(session.slug) === normSlug(slug) && session.phone) {
      return {
        slug: normSlug(session.slug),
        phone: normPhoneDigits(session.phone),
        module: upperModule(session.module || config.module),
      };
    }

    return null;
  }

  async function hasAccessRaw(sb, phoneDigits, moduleName) {
    if (!phoneDigits) return false;

    const { data, error } = await sb.rpc("digiy_has_access", {
      p_phone: phoneDigits,
      p_module: upperModule(moduleName),
    });

    if (error) {
      const e = new Error("has_access_rpc_error");
      e.cause = error;
      throw e;
    }

    return !!data;
  }

  function setPreview(reason, extra = {}) {
    state.preview = true;
    state.access_ok = false;
    state.reason = reason || "preview";
    state.slug = extra.slug ?? state.slug ?? "";
    state.phone = extra.phone ?? state.phone ?? "";
    state.ts = Date.now();
    return { ...state, ok: false, sb: _sb, pin_url: getPinUrl(state.slug), pay_url: getPayUrl(state.slug) };
  }

  function setAccessOk(reason = "ok", extra = {}) {
    state.preview = false;
    state.access_ok = true;
    state.reason = reason;
    state.slug = extra.slug ?? state.slug ?? "";
    state.phone = extra.phone ?? state.phone ?? "";
    state.ts = Date.now();
    return { ...state, ok: true, sb: _sb, pin_url: getPinUrl(state.slug), pay_url: getPayUrl(state.slug) };
  }

  function resetState() {
    state.module = config.module;
    state.preview = true;
    state.access_ok = false;
    state.slug = "";
    state.phone = "";
    state.reason = "booting";
    state.ts = Date.now();
  }

  async function bootOnce(force = false, opts = {}) {
    if (_bootPromise && !force) return _bootPromise;

    applyOptions(opts);

    _bootPromise = (async () => {
      resetState();

      const slug = pickSlug();
      state.slug = slug;

      if (!slug) {
        return setPreview("slug_missing", { slug: "" });
      }

      rememberSlug(slug);
      ensureSlugInUrl(slug);

      let sb;
      try {
        sb = ensureSupabaseClient();
      } catch (e) {
        return setPreview(String(e?.message || "supabase_init_failed"), { slug });
      }

      let bridged;
      try {
        bridged = await resolveSlugToPhone(sb, slug);
      } catch (e) {
        return setPreview(String(e?.message || "slug_resolve_failed"), { slug });
      }

      if (!bridged?.phone) {
        return setPreview("slug_unknown", { slug });
      }

      state.slug = bridged.slug || slug;
      state.phone = bridged.phone || "";
      rememberSlug(state.slug);
      rememberPhone(state.phone);

      if (config.checkSubscription === false) {
        return setAccessOk("ok_no_subscription_check", {
          slug: state.slug,
          phone: state.phone,
        });
      }

      try {
        const ok = await hasAccessRaw(sb, state.phone, config.module);
        if (ok) {
          return setAccessOk("ok", { slug: state.slug, phone: state.phone });
        }
        return setPreview("has_access_false", { slug: state.slug, phone: state.phone });
      } catch (e) {
        return setPreview(String(e?.message || "has_access_failed"), { slug: state.slug, phone: state.phone });
      }
    })();

    DIGIY_GUARD.ready = _bootPromise;
    return _bootPromise;
  }

  async function refresh() {
    return bootOnce(true, {});
  }

  async function boot(opts = {}) {
    return bootOnce(true, opts);
  }

  async function checkAccess() {
    await DIGIY_GUARD.ready;

    if (!_sb || !state.slug || !state.phone) {
      return { ...state, ok: false, sb: _sb, pin_url: getPinUrl(state.slug), pay_url: getPayUrl(state.slug) };
    }

    try {
      const ok = await hasAccessRaw(_sb, state.phone, config.module);
      if (ok) {
        return setAccessOk("ok", { slug: state.slug, phone: state.phone });
      }
      return setPreview("has_access_false", { slug: state.slug, phone: state.phone });
    } catch (e) {
      return setPreview(String(e?.message || "has_access_failed"), { slug: state.slug, phone: state.phone });
    }
  }

  async function rpc(fnName, args = {}) {
    const sb = ensureSupabaseClient();
    const { data, error } = await sb.rpc(fnName, args);
    if (error) throw error;
    return typeof data === "string" ? safeJsonParse(data) ?? data : data;
  }

  async function digiyRequireAccess(options = {}) {
    await DIGIY_GUARD.ready;

    if (state.access_ok) {
      return {
        ok: true,
        slug: state.slug,
        phone: state.phone,
        module: config.module,
        preview: state.preview,
        access_ok: state.access_ok,
        reason: state.reason,
        sb: _sb,
      };
    }

    const mode = options.mode || "none";
    const slug = state.slug || pickSlug();

    if (mode === "pin") {
      location.assign(getPinUrl(slug));
      return;
    }

    if (mode === "pay") {
      location.assign(getPayUrl(slug));
      return;
    }

    return {
      ok: false,
      slug: state.slug,
      phone: state.phone,
      module: config.module,
      preview: state.preview,
      access_ok: state.access_ok,
      reason: state.reason,
      pin_url: getPinUrl(slug),
      pay_url: getPayUrl(slug),
      sb: _sb,
    };
  }

  const DIGIY_GUARD = {
    module: config.module,
    state,
    ready: null,

    refresh,
    boot,
    checkAccess,
    rpc,

    getSb: () => _sb,
    getSupabase: () => _sb,
    getSlug: () => state.slug || pickSlug(),
    getSession,
    getPayUrl: (slug = "") => getPayUrl(slug || state.slug),
    getPinUrl: (slug = "") => getPinUrl(slug || state.slug),
    withSlug,

    go(target, mode = "assign") {
      try {
        let finalTarget = target;

        if (!finalTarget || finalTarget === "__back__") {
          finalTarget = config.dashboard || DEFAULT_DASHBOARD_URL;
        }

        finalTarget = withSlug(finalTarget);

        if (mode === "replace") location.replace(finalTarget);
        else location.assign(finalTarget);
      } catch {}
    },

    logout(redirect = "") {
      const moduleUpper = config.module;
      const moduleLower = moduleUpper.toLowerCase();

      storageRemove(config.storageSlugKey);
      storageRemove(config.storageLastSlugKey);
      storageRemove("DIGIY_SLUG");
      storageRemove("digiy_slug");
      storageRemove("DIGIY_PHONE");
      storageRemove(`DIGIY_${moduleUpper}_PHONE`);
      storageRemove(`digiy_${moduleLower}_phone`);
      storageRemove(`DIGIY_${moduleUpper}_PRO_SESSION`);
      storageRemove("DIGIY_PRO_SESSION");
      storageRemove(`DIGIY_${moduleUpper}_OWNER_ID`);
      storageRemove(`digiy_${moduleLower}_owner_id`);
      storageRemove("DIGIY_OWNER_ID");
      storageRemove("owner_id");
      storageRemove(`DIGIY_${moduleUpper}_BUSINESS_CODE`);
      storageRemove("DIGIY_BUSINESS_CODE");
      storageRemove(`DIGIY_${moduleUpper}_BUSINESS_NAME`);
      storageRemove("DIGIY_BUSINESS_NAME");

      state.preview = true;
      state.access_ok = false;
      state.slug = "";
      state.phone = "";
      state.reason = "logout";
      state.ts = Date.now();

      const url = redirect ? new URL(redirect, location.href).toString() : getPinUrl("");
      location.replace(url);
    },
  };

  window.DIGIY_GUARD = DIGIY_GUARD;
  window.digiyRequireAccess = digiyRequireAccess;

  DIGIY_GUARD.ready = bootOnce(false, {});
})();;
