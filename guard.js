/**
 * DIGIY GUARD-SOFT — LOC SAFE (anti-crash)
 * - Ne dépend d'aucun élément HTML (page-safe)
 * - slug-first : ?slug=... ou localStorage digiy_loc_slug ou pathname (/loc-...)
 * - résout slug->phone via digiy_subscriptions_public
 * - vérifie accès via RPC digiy_has_access(phone,module)
 * - expose digiyRequireAccess() + DIGIY_GUARD API
 *
 * Pré-requis :
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   (optionnel mais conseillé) définir window.DIGIY_SUPABASE_URL / window.DIGIY_SUPABASE_ANON_KEY avant d’inclure ce fichier
 */

(() => {
  "use strict";

  const MODULE = "LOC";
  const STORAGE_SLUG_KEY = "digiy_loc_slug";
  const STORAGE_LAST_SLUG = "digiy_last_slug";

  // ✅ IMPORTANT : ton ABOS / pages peuvent poser ces globals
  // window.DIGIY_SUPABASE_URL = "...";
  // window.DIGIY_SUPABASE_ANON_KEY = "...";

  const FALLBACK_SUPABASE_URL =
    "https://wesqmwjjtsefyjnluosj.supabase.co";
  const FALLBACK_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const PAY_URL_DEFAULT = "https://commencer-a-payer.digiylyfe.com/?module=LOC";
  const PIN_URL_DEFAULT = "pin.html";

  // ===== state interne =====
  let _sb = null;
  let _bootPromise = null;
  let _readyPromise = null;

  const _session = {
    ok: false,
    slug: "",
    phone: "",
    module: MODULE,
    reason: "",
    debug: false,
    ts: 0,
  };

  // ===== helpers =====
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function qps() {
    try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); }
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
    // Support: https://digiylyfe.com/loc-22177...
    try {
      const p = String(location.pathname || "").replace(/^\/+/, "").replace(/\/+$/, "");
      if (!p) return "";
      // si on a un fichier (planning.html) on ignore
      if (p.includes(".html")) return "";
      // si c’est un slug "loc-..." on accepte
      return normSlug(p);
    } catch {
      return "";
    }
  }

  function pickSlug() {
    const qs = qps();
    const fromQs = normSlug(qs.get("slug") || "");
    if (fromQs) return fromQs;

    let fromLS = "";
    try { fromLS = normSlug(localStorage.getItem(STORAGE_SLUG_KEY) || ""); } catch {}
    if (fromLS) return fromLS;

    const fromPath = getSlugFromPathname();
    if (fromPath) return fromPath;

    return "";
  }

  function rememberSlug(slug) {
    try { localStorage.setItem(STORAGE_SLUG_KEY, slug); } catch {}
    try { localStorage.setItem(STORAGE_LAST_SLUG, slug); } catch {}
  }

  function ensureSlugInUrl(slug) {
    // on évite de toucher si déjà présent
    try {
      const u = new URL(location.href);
      if (!u.searchParams.get("slug")) {
        u.searchParams.set("slug", slug);
        history.replaceState({}, "", u.toString());
      }
    } catch {}
  }

  function getPayUrl(slug) {
    // si page a défini PAY_URL global, on l’utilise
    const base = (typeof window.PAY_URL === "string" && window.PAY_URL) ? window.PAY_URL : PAY_URL_DEFAULT;
    try {
      const u = new URL(base, location.href);
      u.searchParams.set("module", MODULE);
      if (slug) u.searchParams.set("slug", slug);
      // return = page courante (utile pour revenir)
      u.searchParams.set("return", location.origin + location.pathname + "?slug=" + encodeURIComponent(slug));
      return u.toString();
    } catch {
      return base;
    }
  }

  function getPinUrl(slug) {
    const pin = (typeof window.DIGIY_PIN_URL === "string" && window.DIGIY_PIN_URL) ? window.DIGIY_PIN_URL : PIN_URL_DEFAULT;
    try {
      const u = new URL(pin, location.href);
      if (slug) u.searchParams.set("slug", slug);
      return u.toString();
    } catch {
      // fallback naïf
      const sep = pin.includes("?") ? "&" : "?";
      return pin + sep + "slug=" + encodeURIComponent(slug || "");
    }
  }

  function safeBodyReady() {
    if (document.body) return Promise.resolve(true);
    return new Promise((resolve) => {
      window.addEventListener("DOMContentLoaded", () => resolve(true), { once: true });
      setTimeout(() => resolve(true), 1200);
    });
  }

  // ===== UI gate minimal (optionnel) =====
  let _gateMounted = false;
  function mountGate() {
    if (_gateMounted) return;
    _gateMounted = true;

    // page-safe : si body pas prêt, on attend
    safeBodyReady().then(() => {
      if (!document.body) return;

      const wrap = document.createElement("div");
      wrap.id = "digiy-guard-gate";
      wrap.style.cssText =
        "position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.86);backdrop-filter:blur(6px);" +
        "display:none;align-items:center;justify-content:center;padding:16px;";

      wrap.innerHTML = `
        <div style="width:min(680px,96vw);border:1px solid rgba(148,163,184,.22);border-radius:18px;
                    background:linear-gradient(180deg, rgba(15,23,42,.92), rgba(2,6,23,.92));
                    box-shadow:0 22px 70px rgba(0,0,0,.55);padding:14px;color:#f8fafc;font-family:system-ui;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
            <div style="font-weight:1000;">DIGIY ${MODULE} PRO — Accès sécurisé</div>
            <div id="dg_tag" style="font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.22);color:#cbd5e1;">
              Guard
            </div>
          </div>

          <div id="dg_msg" style="margin-top:10px;white-space:pre-wrap;color:#e2e8f0;font-weight:850;line-height:1.45;">
            Vérification…
          </div>

          <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
            <a id="dg_btn_pay" href="#" style="flex:1;min-width:180px;text-decoration:none;text-align:center;
                border:1px solid rgba(250,204,21,.35);background:rgba(250,204,21,.10);color:#fde68a;
                padding:10px 12px;border-radius:14px;font-weight:1000;">💳 Commencer à payer</a>

            <a id="dg_btn_pin" href="#" style="flex:1;min-width:180px;text-decoration:none;text-align:center;
                border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.10);color:#bbf7d0;
                padding:10px 12px;border-radius:14px;font-weight:1000;">🔑 Ouvrir (PIN)</a>

            <button id="dg_btn_close" type="button" style="flex:1;min-width:180px;
                border:1px solid rgba(148,163,184,.22);background:rgba(255,255,255,.06);color:#e5e7eb;
                padding:10px 12px;border-radius:14px;font-weight:1000;cursor:pointer;">↻ Recharger</button>
          </div>

          <div style="margin-top:10px;color:#94a3b8;font-size:12px;font-weight:800;">
            Astuce : ouvre toujours via ton lien/QR avec <b>?slug=...</b>
          </div>
        </div>
      `;

      document.body.appendChild(wrap);

      wrap.querySelector("#dg_btn_close")?.addEventListener("click", () => location.reload());
    });
  }

  function showGate(message, opts = {}) {
    // ✅ anti-crash : ne suppose jamais l’existence du DOM
    mountGate();
    safeBodyReady().then(() => {
      const gate = document.getElementById("digiy-guard-gate");
      if (!gate) return;

      const msg = gate.querySelector("#dg_msg");
      const tag = gate.querySelector("#dg_tag");
      const btnPay = gate.querySelector("#dg_btn_pay");
      const btnPin = gate.querySelector("#dg_btn_pin");

      if (msg) msg.textContent = message || "";
      if (tag) tag.textContent = opts.tag || "Guard";

      const slug = _session.slug || pickSlug();
      if (btnPay) btnPay.href = getPayUrl(slug);
      if (btnPin) btnPin.href = getPinUrl(slug);

      gate.style.display = "flex";
    });
  }

  function hideGate() {
    safeBodyReady().then(() => {
      const gate = document.getElementById("digiy-guard-gate");
      if (gate) gate.style.display = "none";
    });
  }

  // ===== supabase init =====
  function getConfig() {
    const url = (window.DIGIY_SUPABASE_URL || "").trim() || FALLBACK_SUPABASE_URL;
    const key = (window.DIGIY_SUPABASE_ANON_KEY || "").trim() || FALLBACK_SUPABASE_ANON_KEY;
    return { url, key };
  }

  function ensureSupabaseClient() {
    if (_sb) return _sb;

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("supabase_lib_missing");
    }

    const { url, key } = getConfig();
    if (!url || !key || key.length < 80) throw new Error("supabase_config_missing");

    _sb = window.supabase.createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      },
    });

    // expose utile pour debug
    window.sb = window.sb || _sb;

    return _sb;
  }

  // ===== core: resolve + access =====
  async function resolveSlugToPhone(sb, slug) {
    // digiy_subscriptions_public: slug, phone, module
    const { data, error } = await sb
      .from("digiy_subscriptions_public")
      .select("slug,phone,module")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.warn("[GUARD-SOFT] subscriptions_public error", error);
      const e = new Error("subscriptions_public_error");
      e.cause = error;
      throw e;
    }
    if (!data?.phone) {
      const e = new Error("subscriptions_public_empty");
      e.cause = data;
      throw e;
    }
    return {
      slug: data.slug || slug,
      phone: normPhoneDigits(data.phone),
      module: String(data.module || "").toUpperCase(),
    };
  }

  async function checkAccess(sb, phoneDigits, module) {
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

  // ===== public API: digiyRequireAccess =====
  async function digiyRequireAccess(options = {}) {
    const debug = (qps().get("debug") === "1") || !!options.debug;
    _session.debug = debug;

    let slug = normSlug(options.slug || pickSlug());
    _session.slug = slug;

    if (!slug) {
      _session.ok = false;
      _session.reason = "slug_missing";
      if (debug) {
        showGate(
          "⚠️ Lien incomplet.\n➡️ Ouvre via ton QR / lien GO PIN.\nExemple : index.html?slug=chez-astou-saly",
          { tag: "SLUG" }
        );
        return { ok: false, reason: _session.reason, slug: "", phone: "" };
      }
      // en non-debug on montre gate (pas de boucle agressive)
      showGate(
        "⚠️ SLUG manquant.\n➡️ Reviens depuis ton lien GO PIN (avec ?slug=...).",
        { tag: "SLUG" }
      );
      throw new Error("slug_missing");
    }

    rememberSlug(slug);
    ensureSlugInUrl(slug);

    let sb;
    try {
      sb = ensureSupabaseClient();
    } catch (e) {
      _session.ok = false;
      _session.reason = String(e?.message || e);
      showGate(
        "Accès verrouillé (pas de boucle).\nRaison : " + _session.reason,
        { tag: "CONFIG" }
      );
      throw e;
    }

    // 1) slug -> phone
    const brid = await resolveSlugToPhone(sb, slug);
    const phoneDigits = normPhoneDigits(brid.phone);
    _session.phone = phoneDigits;
    _session.slug = brid.slug || slug;

    // 2) has_access
    const ok = await checkAccess(sb, phoneDigits, MODULE);
    if (!ok) {
      _session.ok = false;
      _session.reason = "has_access_false";

      if (debug) {
        showGate(
          "❌ Accès refusé.\n\n" +
          `slug: ${_session.slug}\nphone: ${_session.phone}\nmodule: ${MODULE}\n\n` +
          "➡️ Clique Commencer à payer, ou repasse par PIN.",
          { tag: "NO ACCESS" }
        );
        return { ok: false, reason: _session.reason, slug: _session.slug, phone: _session.phone, module: MODULE };
      }

      // en mode normal : on affiche gate (pas de loop agressive)
      showGate(
        "❌ Accès non actif pour ce cockpit.\n➡️ Clique Commencer à payer, ou ouvre via PIN.",
        { tag: "NO ACCESS" }
      );
      const err = new Error("has_access_false");
      err.code = "has_access_false";
      throw err;
    }

    _session.ok = true;
    _session.reason = "ok";
    _session.ts = Date.now();
    hideGate();

    console.log("[GUARD-SOFT] ✅ access ok", { slug: _session.slug, phone: _session.phone, module: MODULE });

    return {
      ok: true,
      slug: _session.slug,
      phone: _session.phone,
      module: MODULE,
      sb,
      session: { ..._session },
    };
  }

  // ===== DIGIY_GUARD API =====
  const DIGIY_GUARD = {
    module: MODULE,

    getSlug: () => _session.slug || pickSlug(),
    getSession: () => ({ ..._session }),
    getSb: () => _sb,

    boot: async (opts = {}) => {
      if (_bootPromise) return _bootPromise;
      _bootPromise = (async () => {
        try {
          const res = await digiyRequireAccess(opts);
          return { ok: true, ...res };
        } catch (e) {
          return { ok: false, reason: String(e?.message || e), error: e };
        }
      })();
      return _bootPromise;
    },

    ready: async (timeoutMs = 8000) => {
      if (_readyPromise) return _readyPromise;
      _readyPromise = (async () => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          if (_session.ok && _sb) return true;
          await sleep(120);
        }
        return false;
      })();
      return _readyPromise;
    },

    go: (target, mode = "assign") => {
      try {
        if (!target) return;
        if (target === "__back__") {
          if (history.length > 1) return history.back();
          return location.assign("listing.html");
        }
        if (mode === "replace") location.replace(target);
        else location.assign(target);
      } catch (_) {}
    },

    logout: (redirect = PIN_URL_DEFAULT) => {
      try { localStorage.removeItem(STORAGE_SLUG_KEY); } catch {}
      try { localStorage.removeItem(STORAGE_LAST_SLUG); } catch {}
      _session.ok = false;
      _session.phone = "";
      _session.reason = "logout";
      const u = getPinUrl("");
      location.replace(redirect ? new URL(redirect, location.href).toString() : u);
    },
  };

  // expose global
  window.DIGIY_GUARD = DIGIY_GUARD;
  window.digiyRequireAccess = digiyRequireAccess;

})();
