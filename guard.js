/* =========================
   DIGIY LOC PRO — GUARD (GO PIN PHASE 2) ✅ + SLUG→PRO_ID BRIDGE
   GitHub Pages SAFE • Slug conservé • Session 8h • Logout propre
========================= */
(function () {
  "use strict";

  // =============================
  // SUPABASE (déjà connu)
  // =============================
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXqiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

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

  function safeSet(k, v){
    try{ localStorage.setItem(k, String(v ?? "")); }catch(_){}
  }

  function safeGet(k){
    try{ return localStorage.getItem(k); }catch(_){ return null; }
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
  // SLUG → PRO_ID BRIDGE ✅
  // =============================
  async function resolveProIdFromSlug(slug){
    const sb = await waitSupabase();
    if (!sb || !slug) return null;

    // Lecture directe sur go_pins (RLS OK chez toi)
    const { data, error } = await sb
      .from("go_pins")
      .select("owner_id,title,phone")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data?.owner_id) return null;

    return {
      pro_id: data.owner_id,
      title: data.title || null,
      phone: data.phone || null
    };
  }

  async function ensureProIdBridge(slug){
    if (!slug) return null;
    const already = safeGet("DIGIY_PRO_ID");
    if (already && /^[0-9a-f-]{36}$/i.test(already)) return already;

    const bridged = await resolveProIdFromSlug(slug);
    if (bridged?.pro_id){
      safeSet("DIGIY_PRO_ID", bridged.pro_id);
      safeSet("DIGIY_SLUG", slug);
      if (bridged.title) safeSet("DIGIY_TITLE", bridged.title);
      if (bridged.phone) safeSet("DIGIY_PHONE", bridged.phone);
      return bridged.pro_id;
    }
    return null;
  }

  // =============================
  // RPC SAFE (ton infra)
  // =============================
  async function rpcVerifyAccessPin(phone, pin, moduleName = "loc_pro") {
    const sb = await waitSupabase();
    if (!sb) return { ok: false, reason: "SUPABASE_NOT_READY" };

    const { data, error } = await sb.rpc("verify_access_pin", {
      p_phone: phone,
      p_pin: pin,
      p_module: moduleName
    });

    if (error) return { ok: false, reason: error.message || "RPC_ERROR" };
    const out = (typeof data === "string") ? safeJsonParse(data) : data;
    if (!out || typeof out !== "object") return { ok: false, reason: "RPC_BAD_RESPONSE" };
    return out;
  }

  async function rpcGoPinCheck(slug) {
    const sb = await waitSupabase();
    if (!sb) return { ok: false, reason: "SUPABASE_NOT_READY" };

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
    const phone = (opts?.phone || "").replace(/\s+/g, "").trim();
    const pin   = (opts?.pin   || "").replace(/\s+/g, "").trim();
    const moduleName = (opts?.module || "loc_pro").trim();
    const forcedSlug = (opts?.slug || "").trim();

    if (!phone || !pin) return { ok: false, reason: "MISSING_PHONE_OR_PIN" };

    const slug = forcedSlug || getSlug();

    // ✅ bridge slug → pro_id AVANT (pour que tout l’intérieur ait la clé)
    if (slug) await ensureProIdBridge(slug);

    // (optionnel) check slug
    if (slug) await rpcGoPinCheck(slug);

    const out = await rpcVerifyAccessPin(phone, pin, moduleName);
    if (!out.ok) return { ok: false, reason: out.reason || "INVALID_PIN" };

    const owner_id = out.owner_id || null;

    const s = setSession({
      ok: true,
      module: moduleName,
      phone,
      owner_id,
      slug: slug || null
    });

    if (s.slug) setSlugInUrl(s.slug);

    return { ok: true, session: s };
  }

  function requireSession(options) {
    const moduleName = (options?.module || "loc_pro").trim();
    const redirect = options?.redirect || "pin.html";
    const s = getSession();

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
    return s;
  }

  function logout(redirect = "index.html") {
    clearSession();
    go(redirect);
  }

  function getCurrent() {
    const s = getSession();
    const slug = getSlug();
    if (slug) setSlugInUrl(slug);
    return { session: s, slug, pro_id: safeGet("DIGIY_PRO_ID") || null };
  }

  async function boot(options){
    const moduleName = (options?.module || "loc_pro").trim();
    const redirect = options?.redirect || "pin.html";
    const slug = (options?.slug || "").trim();

    if (slug) setSlugInUrl(slug);

    // ✅ bridge slug → pro_id au boot (cas “je reviens plus tard”)
    const currentSlug = getSlug();
    if (currentSlug) await ensureProIdBridge(currentSlug);

    const s = requireSession({ module: moduleName, redirect });
    return { ok: !!s, session: s, slug: getSlug(), pro_id: safeGet("DIGIY_PRO_ID") || null };
  }

  // =============================
  // EXPORT GLOBAL
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
