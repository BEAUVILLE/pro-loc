/* DIGIY GUARD-SOFT — LOC SAFE (anti-crash)
 * - Ne dépend d'aucun élément HTML (page-safe)
 * - slug-first : ?slug=... ou localStorage digiy_loc_slug
 * - résout slug->phone via digiy_subscriptions_public
 * - vérifie accès via RPC digiy_has_access(phone,module)
 * - expose digiyRequireAccess() + DIGIY_GUARD API
 */
(() => {
  "use strict";

  const MODULE = "LOC";
  const STORAGE_SLUG_KEY = "digiy_loc_slug";
  const STORAGE_LAST_SLUG = "digiy_last_slug";

  // ✅ Si tu veux centraliser, tu peux aussi mettre :
  // window.DIGIY_SUPABASE_URL / window.DIGIY_SUPABASE_ANON_KEY dans index.html
  const SUPABASE_URL =
    window.DIGIY_SUPABASE_URL ||
    "https://wesqmwjjtsefyjnluosj.supabase.co";

  const SUPABASE_ANON_KEY =
    window.DIGIY_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  // Pages
  const DEFAULT_LOGIN_PAGE = "pin.html"; // porte locale du repo
  const DEFAULT_PAY_URL = "https://commencer-a-payer.digiylyfe.com/?module=LOC";

  // -------- utils safe DOM --------
  const $id = (id) => (id ? document.getElementById(id) : null);
  const qs = (sel) => (sel ? document.querySelector(sel) : null);

  function setText(el, txt) {
    if (!el) return;
    el.textContent = String(txt ?? "");
  }
  function setHTML(el, html) {
    if (!el) return;
    el.innerHTML = String(html ?? "");
  }
  function show(el, on) {
    if (!el) return;
    el.style.display = on ? "block" : "none";
  }

  // ---- option UI (si présent) ----
  // Tu peux ajouter dans une page des éléments optionnels :
  // <div data-guard="gate"></div>
  // <div data-guard="msg"></div>
  // <span data-guard="slug"></span>
  // <span data-guard="phone"></span>
  // etc.
  function ui() {
    return {
      gate: qs('[data-guard="gate"]') || $id("gate") || null,
      msg: qs('[data-guard="msg"]') || $id("gateMsg") || $id("note") || null,
      slug: qs('[data-guard="slug"]') || $id("vLieu") || null,
      phone: qs('[data-guard="phone"]') || $id("vPhone") || null,
      sb: qs('[data-guard="sb"]') || $id("vSb") || null,
      sess: qs('[data-guard="sess"]') || $id("vSess") || null,
    };
  }

  function debugOn() {
    try {
      return new URL(location.href).searchParams.get("debug") === "1";
    } catch (_) {
      return false;
    }
  }
  const DEBUG = debugOn();

  function log(...a) {
    if (DEBUG) console.log("[GUARD-SOFT]", ...a);
  }
  function warn(...a) {
    console.warn("[GUARD-SOFT]", ...a);
  }

  function cleanSlug(s) {
    const x = String(s || "").trim();
    if (!x) return "";
    return x
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\-_]/g, "")
      .replace(/-+/g, "-");
  }

  function getSlugFromUrlOrPath() {
    try {
      const u = new URL(location.href);
      const q = (u.searchParams.get("slug") || "").trim();
      if (q) return q;

      // slug dans pathname (ex: /loc-22177...)
      const p = u.pathname.replace(/^\/+/, "").trim();
      if (p && p.includes("-")) return p;

      return "";
    } catch (_) {
      return "";
    }
  }

  function getSavedSlug() {
    try {
      return (localStorage.getItem(STORAGE_SLUG_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function saveSlug(slug) {
    try {
      localStorage.setItem(STORAGE_SLUG_KEY, slug);
      localStorage.setItem(STORAGE_LAST_SLUG, slug);
    } catch (_) {}
  }

  function ensureSlugInUrl(slug) {
    if (!slug) return;
    try {
      const u = new URL(location.href);
      if (!u.searchParams.get("slug")) {
        u.searchParams.set("slug", slug);
        history.replaceState({}, "", u.toString());
      }
    } catch (_) {}
  }

  function makeSb() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("supabase_cdn_missing");
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("supabase_config_missing");
    }
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return sb;
  }

  // -------- internal state --------
  let _sb = null;
  let _session = { ok: false, phone: null, slug: null, module: MODULE };
  let _booted = false;

  // -------- UI helpers (safe) --------
  function showGate(message) {
    const U = ui();
    // ✅ NE JAMAIS CRASH si ça n'existe pas
    if (U.gate) {
      show(U.gate, true);
      // si c'est un container, on peut lui injecter un message basique
      // mais seulement si utile
    }
    if (message) setText(U.msg, message);
  }

  function hideGate() {
    const U = ui();
    if (U.gate) show(U.gate, false);
    setText(U.msg, "");
  }

  // -------- access logic --------
  async function resolvePhoneFromSlug(slug) {
    const { data, error } = await _sb
      .from("digiy_subscriptions_public")
      .select("phone, slug, module")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      warn("subscriptions_public error", error);
      throw new Error("subscriptions_public_error");
    }
    if (!data?.phone) {
      throw new Error("slug_not_found");
    }
    return String(data.phone).trim();
  }

  async function hasAccess(phone) {
    const { data, error } = await _sb.rpc("digiy_has_access", {
      p_phone: phone,
      p_module: MODULE,
    });
    if (error) {
      warn("digiy_has_access rpc error", error);
      throw new Error("has_access_rpc_error");
    }
    return !!data;
  }

  function go(url, mode = "assign") {
    try {
      if (mode === "replace") location.replace(url);
      else location.assign(url);
    } catch (_) {
      location.href = url;
    }
  }

  function logout(loginPage = DEFAULT_LOGIN_PAGE) {
    try {
      localStorage.removeItem(STORAGE_SLUG_KEY);
    } catch (_) {}
    go(loginPage, "replace");
  }

  // ✅ MAIN — this is what your pages call
  async function digiyRequireAccess(opts = {}) {
    const login = opts.login || DEFAULT_LOGIN_PAGE;
    const payUrl = opts.payUrl || DEFAULT_PAY_URL;
    const requireSlug = opts.requireSlug !== false; // default true

    if (!_sb) _sb = makeSb();

    // slug
    let slug = cleanSlug(getSlugFromUrlOrPath()) || cleanSlug(getSavedSlug());
    if (slug) {
      saveSlug(slug);
      ensureSlugInUrl(slug);
    }

    if (!slug && requireSlug) {
      showGate("⚠️ Lien incomplet.\n➡️ Ouvre via ton QR / lien GO PIN.\nExemple : index.html?slug=loc-22177...");
      throw new Error("slug_missing");
    }

    // resolve phone
    const phone = slug ? await resolvePhoneFromSlug(slug) : null;

    // check access
    const ok = phone ? await hasAccess(phone) : false;
    if (!ok) {
      // pas de boucle automatique ici : on affiche + on laisse l’UI décider
      showGate("Accès non actif.\n➡️ Ouvre via PIN ou commence à payer.");
      // optionnel : rediriger si pas en debug
      if (!DEBUG && opts.autoRedirectToPay) {
        const u = new URL(payUrl, location.href);
        if (slug) u.searchParams.set("slug", slug);
        if (phone) u.searchParams.set("phone", phone);
        go(u.toString(), "replace");
      }
      throw new Error("has_access_false");
    }

    hideGate();
    _session = { ok: true, phone, slug, module: MODULE };
    log("✅ access ok", _session);
    return { ok: true, phone, slug, module: MODULE };
  }

  // Boot wrapper (compat avec ton code actuel)
  async function boot(opts = {}) {
    try {
      const res = await digiyRequireAccess(opts);
      return res;
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  async function ready(ms = 6000) {
    // garde compat : certains pages attendent ready()
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (_sb) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return true;
  }

  // -------- Expose API --------
  window.digiyRequireAccess = digiyRequireAccess;

  window.DIGIY_GUARD = {
    module: MODULE,
    boot,
    ready,
    go,
    logout,
    getSb: () => _sb,
    getSession: () => _session,
    getSlug: () => _session?.slug || cleanSlug(getSlugFromUrlOrPath()) || cleanSlug(getSavedSlug()),
  };

  // Auto-run minimal (sans casser)
  (async () => {
    try {
      _sb = makeSb();
      _booted = true;
      log("booted");
    } catch (e) {
      warn("boot crash", e);
      showGate("❌ Guard non prêt.\n➡️ Vérifie Supabase CDN / clé / chemin guard.js");
    }
  })();
})();
