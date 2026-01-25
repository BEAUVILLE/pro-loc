/* =========================
   DIGIY LOC PRO — GUARD CONSOLIDÉ (FINAL PROPRE) ✅ GITHUB PAGES SAFE
   - Session 8h
   - RPC verify_access_pin(p_slug,p_pin) -> {ok, owner_id, slug, title, phone, error?}
     + ✅ Fallback compat (legacy signatures)
   - Slug source of truth: URL > session > localStorage
   - Sync slug localStorage si URL.slug existe (anti slug fantôme)
   - Compat session keys (V1/V2) -> migration auto vers clé unifiée
   - Supabase ready lock (évite: "Supabase pas prêt")
   - No crash: fallback redirect propre si Supabase CDN KO
   - ✅ GitHub Pages SAFE: navigation relative + basePath auto
     -> Fix: custom domain safe (évite /planning.html/ )
   - ✅ withSlug safe: URLs absolues + ancres # non cassées
========================= */
(function () {
  "use strict";

  // =============================
  // CONFIG
  // =============================
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const SESSION_KEY = "DIGIY_LOC_PRO_SESSION"; // ✅ unifié
  const SESSION_KEYS_COMPAT = [
    "DIGIY_LOC_PRO_SESSION_V1",
    "DIGIY_LOC_PRO_SESSION_V2",
    "DIGIY_LOC_PRO_SESSION_V1_8H",
  ];
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

  const LS = {
    SLUG: "DIGIY_SLUG",
    PRO_ID: "DIGIY_PRO_ID",
    TITLE: "DIGIY_TITLE",
    PHONE: "DIGIY_PHONE",
  };

  function now() {
    return Date.now();
  }

  // =============================
  // SAFE localStorage
  // =============================
  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, String(v ?? ""));
    } catch (_) {}
  }
  function lsDel(k) {
    try {
      localStorage.removeItem(k);
    } catch (_) {}
  }

  // =============================
  // SLUG HELPERS (SOURCE OF TRUTH)
  // =============================
  function urlSlugRaw() {
    try {
      return (new URLSearchParams(location.search).get("slug") || "").trim();
    } catch (_) {
      return "";
    }
  }

  function cleanSlug(s) {
    const x = String(s || "").trim();
    if (!x) return "";
    return x
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\-_]/g, "")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "");
  }

  // =============================
  // SESSION (compat + unifié)
  // =============================
  function parseSession(raw) {
    try {
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.expires_at) return null;
      if (now() > s.expires_at) return null;
      return s;
    } catch (_) {
      return null;
    }
  }

  function getSessionUnsafe() {
    // 1) clé unifiée
    const primary = parseSession(lsGet(SESSION_KEY));
    if (primary) return primary;

    // 2) compat: V1/V2 -> migrate
    for (const k of SESSION_KEYS_COMPAT) {
      const s = parseSession(lsGet(k));
      if (s) {
        try {
          lsSet(SESSION_KEY, JSON.stringify(s));
        } catch (_) {}
        return s;
      }
    }
    return null;
  }

  function getSession() {
    return getSessionUnsafe();
  }

  function setSession(data) {
    const session = {
      ...data,
      created_at: now(),
      expires_at: now() + SESSION_TTL_MS,
    };
    lsSet(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    lsDel(SESSION_KEY);
    for (const k of SESSION_KEYS_COMPAT) lsDel(k);
  }

  function getSlug() {
    const u = cleanSlug(urlSlugRaw());
    if (u) return u;

    const s = getSessionUnsafe();
    const ss = cleanSlug(s?.slug || "");
    if (ss) return ss;

    return cleanSlug(lsGet(LS.SLUG) || "");
  }

  function syncSlugFromUrl() {
    const u = cleanSlug(urlSlugRaw());
    if (!u) return null;
    const cur = cleanSlug(lsGet(LS.SLUG) || "");
    if (cur !== u) lsSet(LS.SLUG, u);
    return u;
  }

  // 🔥 sync asap (anti slug fantôme)
  syncSlugFromUrl();

  // =============================
  // GITHUB PAGES SAFE BASE PATH ✅ (custom domain safe)
  // =============================
  function basePath() {
    const parts = location.pathname.split("/").filter(Boolean);
    const isGithubPages = /\.github\.io$/i.test(location.hostname);

    // ✅ Repo site: https://user.github.io/<repo>/...
    if (isGithubPages && parts.length > 0) return "/" + parts[0] + "/";

    // ✅ Custom domain / normal hosting
    return "/";
  }

  function withSlug(url) {
    const s = getSlug();
    let clean = String(url || "").trim();

    // ✅ URL absolue: ne pas casser
    if (/^https?:\/\//i.test(clean)) return clean;

    // ✅ ancre seule
    if (clean.startsWith("#")) return clean;

    // ✅ force relatif
    clean = clean.replace(/^\/+/, "");
    if (!clean) clean = "index.html";

    if (s) {
      clean += (clean.includes("?") ? "&" : "?") + "slug=" + encodeURIComponent(s);
    }

    return basePath() + clean;
  }

  function go(url, mode = "assign") {
    const dest = withSlug(url);
    if (mode === "replace") location.replace(dest);
    else location.assign(dest);
  }

  // =============================
  // READY LOCK (safe)
  // =============================
  const READY = (function () {
    let _resolve, _reject;
    const promise = new Promise((res, rej) => {
      _resolve = res;
      _reject = rej;
    });
    return { promise, resolve: _resolve, reject: _reject, done: false };
  })();

  function markReady() {
    if (READY.done) return;
    READY.done = true;
    READY.resolve(true);
  }

  async function ready(timeoutMs = 8000) {
    if (READY.done) return true;

    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error("GUARD_READY_TIMEOUT")), timeoutMs);
    });

    try {
      await Promise.race([READY.promise, timeout]);
      return true;
    } finally {
      clearTimeout(t);
    }
  }

  // =============================
  // SUPABASE (SAFE / LAZY)
  // =============================
  async function waitSupabaseCDN(timeoutMs = 8000) {
    const start = now();
    while (now() - start < timeoutMs) {
      if (window.supabase?.createClient) return true;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error("SUPABASE_CDN_NOT_READY");
  }

  async function getSbAsync() {
    await waitSupabaseCDN(8000);
    if (!window.__digiy_sb__) {
      window.__digiy_sb__ = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.__digiy_sb__;
  }

  // version sync (peut être null si pas prêt)
  function getSb() {
    if (!window.supabase?.createClient) return null;
    if (!window.__digiy_sb__) {
      window.__digiy_sb__ = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.__digiy_sb__;
  }

  // =============================
  // RPC COMPAT: verify_access_pin
  // =============================
  async function rpcVerifyAccessPin(sb, slug, pin) {
    // A) signature moderne: (p_slug, p_pin)
    let res = await sb.rpc("verify_access_pin", { p_slug: slug, p_pin: pin });

    if (res?.error) {
      const msg = String(res.error.message || "");
      const shouldFallback =
        /not exist|function|parameter|argument|p_phone|p_module|expects|unknown/i.test(msg);

      if (shouldFallback) {
        // B) fallback legacy: (p_phone, p_pin, p_module)
        // ⚠️ Si ton legacy n'est pas ça, adapte ici une seule fois.
        res = await sb.rpc("verify_access_pin", {
          p_phone: slug,
          p_pin: pin,
          p_module: "loc_pro",
        });
      }
    }
    return res;
  }

  // =============================
  // LOGIN (slug + pin)
  // =============================
  async function loginWithPin(slug, pin) {
    const s = cleanSlug(slug || getSlug());
    const p = String(pin || "").trim();

    if (!s || !p) return { ok: false, error: "Slug et PIN requis" };

    let sb = null;
    try {
      sb = await getSbAsync();
    } catch (e) {
      return { ok: false, error: "Supabase non initialisé (CDN)" };
    }
    if (!sb) return { ok: false, error: "Supabase non initialisé" };

    const { data, error } = await rpcVerifyAccessPin(sb, s, p);
    if (error) return { ok: false, error: error.message || String(error) };

    const result =
      typeof data === "string"
        ? (function () {
            try {
              return JSON.parse(data);
            } catch (_) {
              return null;
            }
          })()
        : data;

    const ownerId = String(result?.owner_id || "").trim();

    if (!result?.ok || !ownerId) {
      return { ok: false, error: result?.error || "PIN invalide" };
    }

    // ✅ session
    const session = setSession({
      ok: true,
      owner_id: ownerId,
      slug: cleanSlug(result.slug || s),
      title: result.title || "",
      phone: result.phone || "",
    });

    // ✅ sync LS utile
    lsSet(LS.PRO_ID, session.owner_id);
    lsSet(LS.SLUG, session.slug);
    if (session.title) lsSet(LS.TITLE, session.title);
    if (session.phone) lsSet(LS.PHONE, session.phone);

    markReady();
    return { ok: true, session };
  }

  // =============================
  // REQUIRE SESSION
  // =============================
  function requireSession(redirect = "pin.html") {
    // 🔥 autorité URL slug -> écrase LS
    syncSlugFromUrl();

    const s = getSessionUnsafe();
    if (!s || !String(s.owner_id || "").trim()) {
      go(redirect, "replace");
      return null;
    }
    return s;
  }

  // =============================
  // BOOT (pages privées)
  // =============================
  async function boot(options) {
    const loginUrl = options?.login || "pin.html";

    // session required
    const s = requireSession(loginUrl);
    if (!s) return { ok: false };

    // ensure supabase is ready for the app
    try {
      await getSbAsync();
      markReady();
      return { ok: true, session: s };
    } catch (e) {
      console.warn("[GUARD] Supabase not ready:", e);
      go(loginUrl, "replace");
      return { ok: false, error: "SUPABASE_NOT_READY" };
    }
  }

  // =============================
  // LOGOUT
  // =============================
  function logout(redirect = "index.html") {
    clearSession();
    go(redirect, "replace");
  }

  // =============================
  // EXPORT
  // =============================
  window.DIGIY_GUARD = {
    boot,
    loginWithPin,
    requireSession,
    logout,
    getSession,
    getSb, // sync (nullable)
    getSbAsync, // ✅ recommended
    ready, // ✅ await guard readiness
    getSlug,
    withSlug,
    go,
    syncSlugFromUrl,
    basePath, // ✅ debug utile
  };
})();
