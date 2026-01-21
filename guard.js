/* =========================
   DIGIY LOC PRO — GUARD (GO PIN PHASE 2) ✅
   GitHub Pages SAFE • Slug conservé • Session 8h • Logout propre
   - Expose: window.DIGIY_GUARD.loginWithPin(...)
   - Expose: window.DIGIY_GUARD.requireSession(...)
   - Expose: window.DIGIY_GUARD.logout(...)
========================= */
(function () {
  "use strict";

  // =============================
  // SUPABASE (déjà connu)
  // =============================
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA"; 

  // =============================
  // CONSTANTES SESSION
  // =============================
  const SESSION_KEY = "DIGIY_LOC_PRO_SESSION_V1";
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

  // =============================
  // HELPERS
  // =============================
  function now() { return Date.now(); }

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function getSlugFromUrl() {
    const u = new URL(location.href);
    const slug = (u.searchParams.get("slug") || "").trim();
    return slug || null;
  }

  function setSlugInUrl(slug) {
    if (!slug) return;
    const u = new URL(location.href);
    if (u.searchParams.get("slug") === slug) return;
    u.searchParams.set("slug", slug);
    history.replaceState({}, "", u.toString());
  }

  // Préserve slug dans les liens (utile GitHub Pages)
  function withSlug(url) {
    const slug = getSlug();
    if (!slug) return url;
    try {
      const base = new URL(url, location.href);
      base.searchParams.set("slug", slug);
      return base.toString();
    } catch {
      // fallback simple
      const sep = url.includes("?") ? "&" : "?";
      return url + sep + "slug=" + encodeURIComponent(slug);
    }
  }

  function go(url) {
    location.replace(withSlug(url));
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    const s = safeJsonParse(raw);
    if (!s) return null;
    if (!s.created_at || !s.expires_at) return null;
    if (now() > s.expires_at) return null;
    return s;
  }

  function setSession(payload) {
    const session = {
      ...payload,
      created_at: now(),
      expires_at: now() + SESSION_TTL_MS,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  // slug = URL d’abord, sinon session, sinon null
  function getSlug() {
    const urlSlug = getSlugFromUrl();
    if (urlSlug) return urlSlug;
    const s = getSession();
    if (s && s.slug) return s.slug;
    return null;
  }

  // =============================
  // SUPABASE INIT (robuste)
  // =============================
  function getSb() {
    // supabase-js v2 doit être chargé via CDN: window.supabase
    if (!window.supabase || !window.supabase.createClient) return null;
    if (!window.__digiy_sb__) {
      window.__digiy_sb__ = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.__digiy_sb__;
  }

  async function waitSupabase(ms = 2500) {
    const start = now();
    while (now() - start < ms) {
      const sb = getSb();
      if (sb) return sb;
      await new Promise(r => setTimeout(r, 50));
    }
    return null;
  }

  // =============================
  // RPC SAFE (ton infra)
  // =============================
  async function rpcVerifyAccessPin(phone, pin, moduleName = "loc_pro") {
    const sb = await waitSupabase();
    if (!sb) {
      return { ok: false, reason: "SUPABASE_NOT_READY" };
    }

    // RPC attendue: verify_access_pin(p_phone,p_pin,p_module) -> json { ok:true|false, reason, owner_id? }
    // Si ton RPC a un autre nom, change ici seulement.
    const { data, error } = await sb.rpc("verify_access_pin", {
      p_phone: phone,
      p_pin: pin,
      p_module: moduleName
    });

    if (error) {
      return { ok: false, reason: error.message || "RPC_ERROR" };
    }

    // certains RPC renvoient json direct ou string json
    const out = (typeof data === "string") ? safeJsonParse(data) : data;
    if (!out || typeof out !== "object") {
      return { ok: false, reason: "RPC_BAD_RESPONSE" };
    }
    return out;
  }

  async function rpcGoPinCheck(slug) {
    const sb = await waitSupabase();
    if (!sb) {
      return { ok: false, reason: "SUPABASE_NOT_READY" };
    }

    // RPC attendue: go_pin_check(p_slug) -> json { ok:true|false, ... }
    // Si tu ne l’utilises plus, tu peux ignorer.
    const { data, error } = await sb.rpc("go_pin_check", { p_slug: slug });

    if (error) return { ok: false, reason: error.message || "RPC_ERROR" };
    const out = (typeof data === "string") ? safeJsonParse(data) : data;
    if (!out || typeof out !== "object") return { ok: false, reason: "RPC_BAD_RESPONSE" };
    return out;
  }

  // =============================
  // API PUBLIQUE
  // =============================
  async function loginWithPin(opts) {
    // opts: { phone, pin, module?, slug?, rememberSlug? }
    const phone = (opts?.phone || "").trim();
    const pin = (opts?.pin || "").trim();
    const moduleName = (opts?.module || "loc_pro").trim();
    const forcedSlug = (opts?.slug || "").trim();

    if (!phone || !pin) {
      return { ok: false, reason: "MISSING_PHONE_OR_PIN" };
    }

    // slug: priorité param, sinon URL/session
    const slug = forcedSlug || getSlug();

    // Optionnel: check slug (si tu veux forcer un slug valide)
    if (slug) {
      const chk = await rpcGoPinCheck(slug);
      // si ton go_pin_check bloque trop, commente les 4 lignes ci-dessous
      if (chk && chk.ok === false && chk.reason) {
        // on ne bloque pas la connexion PIN si le slug check est “accessory”
        // mais on garde l’info en debug
        // return { ok:false, reason: "SLUG_CHECK_FAILED", detail: chk.reason };
      }
    }

    const out = await rpcVerifyAccessPin(phone, pin, moduleName);

    if (!out.ok) {
      return { ok: false, reason: out.reason || "INVALID_PIN" };
    }

    // owner_id si dispo (utile pour RLS & requêtes futures)
    const owner_id = out.owner_id || null;

    const s = setSession({
      ok: true,
      module: moduleName,
      phone,
      owner_id,
      slug: slug || null
    });

    // garantir slug dans URL
    if (s.slug) setSlugInUrl(s.slug);

    return { ok: true, session: s };
  }
  function requireSession(options) {
    // options: { module?, redirect?, onFail? }
    const moduleName = (options?.module || "loc_pro").trim();
    const redirect = options?.redirect || "pin.html";
    const s = getSession();

    // slugs
    const slug = getSlug();
    if (slug) setSlugInUrl(slug);

    if (!s || !s.ok || (s.module !== moduleName)) {
      if (typeof options?.onFail === "function") {
        options.onFail({ ok: false, reason: "NO_SESSION" });
        return null;
      }
      go(redirect);
      return null;
    }

    // session ok: renvoie la session
    return s;
  }

  function logout(redirect = "index.html") {
    clearSession();
    // on conserve slug si présent (option)
    go(redirect);
  }

  function getCurrent() {
  const s = getSession();
  const slug = getSlug();
  if (slug) setSlugInUrl(slug);
  return { session: s, slug };
}

async function boot(options){
  // compat: options peut contenir { module, redirect, slug }
  const moduleName = (options?.module || "loc_pro").trim();
  const redirect = options?.redirect || "pin.html";
  const slug = (options?.slug || "").trim();

  if (slug) setSlugInUrl(slug);

  // Vérifie session
  const s = requireSession({ module: moduleName, redirect });

  // renvoie un objet standard
  return { ok: !!s, session: s, slug: getSlug() };
}

// =============================
// EXPORT GLOBAL + HELPERS
// =============================
window.DIGIY_GUARD = {
  boot,
  loginWithPin,
  requireSession,
  logout,
  withSlug,
  go,
  getCurrent,
  _getSb: getSb
};

})();
