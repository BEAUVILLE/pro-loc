/* ============================
   DIGIY LOC PRO — GUARD (FREEZE ENTRY)
   - slug requis (query ?slug=)
   - session Supabase requise
   - PIN validé requis (flag sessionStorage)
============================ */

/* 🔐 SUPABASE — DÉJÀ POSÉ */
const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iD1w0l2jQj8mVv0ZkqvS8v2Vx0o5e7mGmZ8o"; // <= garde ta vraie

(function () {
  const STORAGE_SLUG_KEY = "digiy_loc_slug";
  const PIN_OK_KEY = (slug) => `digiy_loc_pin_ok:${slug}`;
  const PIN_OK_AT_KEY = (slug) => `digiy_loc_pin_ok_at:${slug}`;

  const DEFAULTS = {
    requireSlug: true,
    requireAuth: true,
    requirePin: true,
    pinTtlHours: 12, // re-PIN après X heures
    loginUrl: "login.html",
    pinUrl: "pin.html",
    slugParam: "slug",
  };

  function $(q) {
    return document.querySelector(q);
  }

  function nowMs() {
    return Date.now();
  }

  function ttlMs(hours) {
    return Math.max(1, hours) * 60 * 60 * 1000;
  }

  function safeRedirect(url) {
    // évite boucles bizarres
    try {
      window.location.replace(url);
    } catch {
      window.location.href = url;
    }
  }

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function setQueryParam(name, value) {
    const u = new URL(window.location.href);
    u.searchParams.set(name, value);
    window.history.replaceState({}, "", u.toString());
  }

  function normalizeSlug(raw) {
    const s = (raw || "").trim();
    // accepte lettres/chiffres/_/-
    if (!s) return null;
    const ok = /^[a-zA-Z0-9_-]{2,40}$/.test(s);
    return ok ? s : null;
  }

  function getSlug(opts) {
    const fromQuery = normalizeSlug(getQueryParam(opts.slugParam));
    if (fromQuery) {
      localStorage.setItem(STORAGE_SLUG_KEY, fromQuery);
      return fromQuery;
    }
    const fromStorage = normalizeSlug(localStorage.getItem(STORAGE_SLUG_KEY));
    return fromStorage;
  }

  function withSlugInUrl(opts, slug) {
    // on force l’URL à refléter le slug (gèle l’entrée)
    const current = normalizeSlug(getQueryParam(opts.slugParam));
    if (slug && current !== slug) setQueryParam(opts.slugParam, slug);
  }

  function getSupabase() {
    if (!window.supabase || !window.supabase.createClient) return null;
    if (!window.__digiy_sb) {
      window.__digiy_sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    }
    return window.__digiy_sb;
  }

  async function requireAuth(opts) {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase JS non chargé. Ajoute le CDN supabase-js avant guard.js");
    const { data, error } = await sb.auth.getSession();
    if (error) return false;
    return !!data?.session;
  }

  function isPinOk(opts, slug) {
    const ok = sessionStorage.getItem(PIN_OK_KEY(slug)) === "1";
    if (!ok) return false;

    const at = parseInt(sessionStorage.getItem(PIN_OK_AT_KEY(slug)) || "0", 10);
    if (!at) return false;

    const expired = nowMs() - at > ttlMs(opts.pinTtlHours);
    if (expired) {
      sessionStorage.removeItem(PIN_OK_KEY(slug));
      sessionStorage.removeItem(PIN_OK_AT_KEY(slug));
      return false;
    }
    return true;
  }

  function markPinOk(slug) {
    sessionStorage.setItem(PIN_OK_KEY(slug), "1");
    sessionStorage.setItem(PIN_OK_AT_KEY(slug), String(nowMs()));
  }

  function clearPinOk(slug) {
    sessionStorage.removeItem(PIN_OK_KEY(slug));
    sessionStorage.removeItem(PIN_OK_AT_KEY(slug));
  }

  function buildUrl(base, opts, slug) {
    const u = new URL(base, window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "/"));
    u.searchParams.set(opts.slugParam, slug);
    return u.pathname + u.search;
  }

  async function requireAll(custom = {}) {
    const opts = { ...DEFAULTS, ...custom };

    // 1) slug
    const slug = getSlug(opts);
    if (opts.requireSlug && !slug) {
      // pas de slug = pas d’entrée
      safeRedirect(opts.loginUrl);
      return { ok: false, reason: "NO_SLUG" };
    }
    if (slug) withSlugInUrl(opts, slug);

    // 2) auth
    if (opts.requireAuth) {
      const okAuth = await requireAuth(opts);
      if (!okAuth) {
        // purge PIN (sécurité) + redirect login
        if (slug) clearPinOk(slug);
        safeRedirect(opts.loginUrl + (slug ? `?${opts.slugParam}=${encodeURIComponent(slug)}` : ""));
        return { ok: false, reason: "NO_SESSION" };
      }
    }

    // 3) pin
    if (opts.requirePin && slug) {
      if (!isPinOk(opts, slug)) {
        safeRedirect(buildUrl(opts.pinUrl, opts, slug));
        return { ok: false, reason: "NO_PIN" };
      }
    }

    // expose slug partout
    window.DIGIY = window.DIGIY || {};
    window.DIGIY.slug = slug;

    return { ok: true, slug };
  }

  // API globale
  window.DigiyGuard = {
    require: requireAll,
    getSlug: () => getSlug(DEFAULTS),
    markPinOk,
    clearPinOk,
    supabase: getSupabase,
  };
})();

