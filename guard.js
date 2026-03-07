/**
 * DIGIY GUARD — LOC UNIVERSAL PREVIEW-SAFE
 * Stratégie :
 * - sans slug => aperçu élégant
 * - avec slug + accès OK => mode vivant
 * - avec slug + pas d’accès => aperçu propre
 *
 * Contrat exposé :
 *   await window.DIGIY_GUARD.ready
 *   const st = window.DIGIY_GUARD.state
 *
 * API :
 *   window.DIGIY_GUARD.ready
 *   window.DIGIY_GUARD.state
 *   window.DIGIY_GUARD.refresh()
 *   window.DIGIY_GUARD.checkAccess()
 *   window.DIGIY_GUARD.rpc(fn, args)
 *
 * Compatibilité :
 * - slug-first : ?slug=... puis localStorage puis pathname
 * - digiy_subscriptions_public pour slug -> phone
 * - digiy_has_access(phone, module) pour accès réel
 */

(() => {
  "use strict";

  const MODULE = "LOC";
  const STORAGE_SLUG_KEY = "digiy_loc_slug";
  const STORAGE_LAST_SLUG = "digiy_last_slug";

  const FALLBACK_SUPABASE_URL =
    "https://wesqmwjjtsefyjnluosj.supabase.co";

  const FALLBACK_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const PAY_URL_DEFAULT =
    "https://commencer-a-payer.digiylyfe.com/?module=LOC";

  const PIN_URL_DEFAULT = "pin.html";

  let _sb = null;
  let _bootPromise = null;

  const state = {
    module: MODULE,
    preview: true,
    access_ok: false,
    slug: "",
    phone: "",
    reason: "booting",
    ts: 0,
  };

  function qps() {
    try {
      return new URLSearchParams(location.search);
    } catch {
      return new URLSearchParams();
    }
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
    return String(p || "").trim().replace(/[^\d]/g, "");
  }

  function getSlugFromPathname() {
    try {
      const clean = String(location.pathname || "")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");

      if (!clean) return "";

      const parts = clean.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || "";

      if (!last || last.includes(".html")) return "";

      const candidate = normSlug(last);
      if (/^loc-[a-z0-9-]+$/i.test(candidate)) return candidate;

      return "";
    } catch {
      return "";
    }
  }

  function pickSlug() {
    const qs = qps();

    const fromQs = normSlug(qs.get("slug") || "");
    if (fromQs) return fromQs;

    try {
      const fromLS = normSlug(localStorage.getItem(STORAGE_SLUG_KEY) || "");
      if (fromLS) return fromLS;
    } catch {}

    const fromPath = getSlugFromPathname();
    if (fromPath) return fromPath;

    return "";
  }

  function rememberSlug(slug) {
    if (!slug) return;
    try {
      localStorage.setItem(STORAGE_SLUG_KEY, slug);
    } catch {}
    try {
      localStorage.setItem(STORAGE_LAST_SLUG, slug);
    } catch {}
  }

  function clearSlugMemory() {
    try {
      localStorage.removeItem(STORAGE_SLUG_KEY);
    } catch {}
    try {
      localStorage.removeItem(STORAGE_LAST_SLUG);
    } catch {}
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

  function getPayUrl(slug = "") {
    const base =
      typeof window.PAY_URL === "string" && window.PAY_URL
        ? window.PAY_URL
        : PAY_URL_DEFAULT;

    try {
      const u = new URL(base, location.href);
      u.searchParams.set("module", MODULE);
      if (slug) u.searchParams.set("slug", slug);
      u.searchParams.set(
        "return",
        location.origin +
          location.pathname +
          (slug ? `?slug=${encodeURIComponent(slug)}` : "")
      );
      return u.toString();
    } catch {
      return base;
    }
  }

  function getPinUrl(slug = "") {
    const pin =
      typeof window.DIGIY_PIN_URL === "string" && window.DIGIY_PIN_URL
        ? window.DIGIY_PIN_URL
        : PIN_URL_DEFAULT;

    try {
      const u = new URL(pin, location.href);
      if (slug) u.searchParams.set("slug", slug);
      return u.toString();
    } catch {
      const sep = pin.includes("?") ? "&" : "?";
      return slug ? `${pin}${sep}slug=${encodeURIComponent(slug)}` : pin;
    }
  }

  function getConfig() {
    const url =
      (window.DIGIY_SUPABASE_URL || "").trim() || FALLBACK_SUPABASE_URL;
    const key =
      (window.DIGIY_SUPABASE_ANON_KEY || "").trim() ||
      FALLBACK_SUPABASE_ANON_KEY;
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

    window.sb = window.sb || _sb;
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

    if (!data?.phone) {
      return null;
    }

    return {
      slug: data.slug || slug,
      phone: normPhoneDigits(data.phone),
      module: String(data.module || "").toUpperCase(),
    };
  }

  async function hasAccessRaw(sb, phoneDigits, module) {
    const { data, error } = await sb.rpc("digiy_has_access", {
      p_phone: phoneDigits,
      p_module: module,
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
    return state;
  }

  function setAccessOk(reason = "ok", extra = {}) {
    state.preview = false;
    state.access_ok = true;
    state.reason = reason;
    state.slug = extra.slug ?? state.slug ?? "";
    state.phone = extra.phone ?? state.phone ?? "";
    state.ts = Date.now();
    return state;
  }

  function resetState() {
    state.preview = true;
    state.access_ok = false;
    state.slug = "";
    state.phone = "";
    state.reason = "booting";
    state.ts = Date.now();
  }

  async function bootOnce(force = false) {
    if (_bootPromise && !force) return _bootPromise;

    _bootPromise = (async () => {
      resetState();

      const slug = pickSlug();
      state.slug = slug;

      // 1) Pas de slug => aperçu élégant
      if (!slug) {
        return setPreview("slug_missing", { slug: "" });
      }

      rememberSlug(slug);
      ensureSlugInUrl(slug);

      // 2) Init Supabase
      let sb;
      try {
        sb = ensureSupabaseClient();
      } catch (e) {
        return setPreview(String(e?.message || "supabase_init_failed"), {
          slug,
        });
      }

      // 3) slug -> phone
      let bridged = null;
      try {
        bridged = await resolveSlugToPhone(sb, slug);
      } catch (e) {
        return setPreview(String(e?.message || "slug_resolve_failed"), {
          slug,
        });
      }

      if (!bridged?.phone) {
        return setPreview("slug_unknown", { slug });
      }

      state.slug = bridged.slug || slug;
      state.phone = bridged.phone || "";

      // 4) check access
      try {
        const ok = await hasAccessRaw(sb, state.phone, MODULE);

        if (ok) {
          return setAccessOk("ok", {
            slug: state.slug,
            phone: state.phone,
          });
        }

        return setPreview("has_access_false", {
          slug: state.slug,
          phone: state.phone,
        });
      } catch (e) {
        return setPreview(String(e?.message || "has_access_failed"), {
          slug: state.slug,
          phone: state.phone,
        });
      }
    })();

    DIGIY_GUARD.ready = _bootPromise;
    return _bootPromise;
  }

  async function refresh() {
    return bootOnce(true);
  }

  async function checkAccess() {
    await DIGIY_GUARD.ready;

    if (!_sb || !state.slug || !state.phone) {
      return { ...state };
    }

    try {
      const ok = await hasAccessRaw(_sb, state.phone, MODULE);

      if (ok) {
        setAccessOk("ok", {
          slug: state.slug,
          phone: state.phone,
        });
      } else {
        setPreview("has_access_false", {
          slug: state.slug,
          phone: state.phone,
        });
      }
    } catch (e) {
      setPreview(String(e?.message || "has_access_failed"), {
        slug: state.slug,
        phone: state.phone,
      });
    }

    return { ...state };
  }

  async function rpc(fnName, args = {}) {
    const sb = ensureSupabaseClient();

    const { data, error } = await sb.rpc(fnName, args);
    if (error) throw error;
    return data;
  }

  async function digiyRequireAccess(options = {}) {
    await DIGIY_GUARD.ready;

    if (state.access_ok) {
      return {
        ok: true,
        slug: state.slug,
        phone: state.phone,
        module: MODULE,
        preview: state.preview,
        access_ok: state.access_ok,
        reason: state.reason,
        sb: _sb,
      };
    }

    const mode = options.mode || "none"; // none | pin | pay
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
      module: MODULE,
      preview: state.preview,
      access_ok: state.access_ok,
      reason: state.reason,
      pin_url: getPinUrl(slug),
      pay_url: getPayUrl(slug),
      sb: _sb,
    };
  }

  const DIGIY_GUARD = {
    module: MODULE,
    state,

    ready: null,

    refresh,
    checkAccess,
    rpc,

    getSb: () => _sb,
    getSlug: () => state.slug || pickSlug(),
    getPayUrl: (slug = "") => getPayUrl(slug || state.slug),
    getPinUrl: (slug = "") => getPinUrl(slug || state.slug),

    go(target, mode = "assign") {
      try {
        if (!target) return;

        if (target === "__back__") {
          if (history.length > 1) return history.back();
          return location.assign("index.html");
        }

        if (mode === "replace") location.replace(target);
        else location.assign(target);
      } catch {}
    },

    logout(redirect = PIN_URL_DEFAULT) {
      clearSlugMemory();
      state.preview = true;
      state.access_ok = false;
      state.slug = "";
      state.phone = "";
      state.reason = "logout";
      state.ts = Date.now();

      const url = redirect
        ? new URL(redirect, location.href).toString()
        : getPinUrl("");
      location.replace(url);
    },
  };

  window.DIGIY_GUARD = DIGIY_GUARD;
  window.digiyRequireAccess = digiyRequireAccess;

  DIGIY_GUARD.ready = bootOnce(false);
})();
