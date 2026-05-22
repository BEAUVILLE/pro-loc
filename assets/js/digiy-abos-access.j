/* ============================================================
   DIGIYLYFE · ABOS ACCESS BRIDGE · SAFE / LIGHT
   À poser dans : assets/js/digiy-abos-access.js

   Doctrine :
   - Ne bloque jamais l'affichage d'une page.
   - Ne charge pas Supabase JS obligatoirement.
   - Appelle le RPC ABOS par fetch direct avec timeout court.
   - Cache court pour éviter de refaire le même contrôle sans arrêt.
   - Ne met jamais le téléphone dans une URL de redirection.
   - Le guard décide la navigation ; ce bridge ne tient pas la page en otage.
   ============================================================ */

(function () {
  "use strict";

  const DEFAULT_SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const DEFAULT_SUPABASE_KEY = "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3";

  const STORAGE_PREFIX = "DIGIY_ABOS_ACCESS";
  const DEFAULT_TTL_MS = 10 * 60 * 1000;
  const DEFAULT_TIMEOUT_MS = 1800;

  function cleanPhone(value) {
    const d = String(value || "").replace(/\D/g, "");
    if (d.length === 9) return "221" + d;
    return d;
  }

  function upperModule(value) {
    return String(value || "").trim().toUpperCase();
  }

  function readQuery(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (_) {
      return null;
    }
  }

  function safeJson(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function readStorage(keys) {
    for (const key of keys) {
      try {
        const s = sessionStorage.getItem(key);
        if (s) return s;

        const l = localStorage.getItem(key);
        if (l) {
          const obj = safeJson(l);
          if (obj && typeof obj === "object") {
            return (
              obj.phone ||
              obj.p_phone ||
              obj.owner_phone ||
              obj.tel ||
              obj.user_phone ||
              ""
            );
          }
          return l;
        }
      } catch (_) {}
    }
    return "";
  }

  function guessPhone() {
    return cleanPhone(
      readQuery("phone") ||
        readQuery("tel") ||
        readQuery("p") ||
        readStorage([
          "DIGIY_PHONE",
          "DIGIY_LAST_PHONE",
          "DIGIY_SESSION_PHONE",

          "DIGIY_LOC_PHONE",
          "DIGIY_LOC_SESSION_PHONE",
          "DIGIY_LOC_LAST_PHONE",
          "DIGIY_LOC_PRO_PHONE",
          "DIGIY_LOC_SESSION",
          "DIGIY_SESSION_LOC",

          "DIGIY_DRIVER_PHONE",
          "DIGIY_PAY_PHONE",
          "DIGIY_MARKET_PHONE",
          "DIGIY_RESA_PHONE",
          "DIGIY_BUILD_PHONE",
          "DIGIY_JOBS_PHONE",
          "DIGIY_EXPLORE_PHONE"
        ])
    );
  }

  function guessModule(options) {
    const opts = options || {};
    return upperModule(
      opts.module ||
        readQuery("abos_module") ||
        readQuery("module") ||
        window.DIGIY_ABOS_MODULE ||
        window.DIGIY_MODULE ||
        "LOC"
    );
  }

  function cacheKey(phone, module) {
    return `${STORAGE_PREFIX}:${upperModule(module)}:${cleanPhone(phone)}`;
  }

  function getCached(phone, module, ttlMs) {
    try {
      const raw =
        sessionStorage.getItem(cacheKey(phone, module)) ||
        localStorage.getItem(cacheKey(phone, module));

      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.saved_at) return null;
      if (Date.now() - Number(parsed.saved_at) > ttlMs) return null;

      return parsed;
    } catch (_) {
      return null;
    }
  }

  function setCached(phone, module, payload) {
    try {
      const body = JSON.stringify({
        ...payload,
        saved_at: Date.now()
      });

      sessionStorage.setItem(cacheKey(phone, module), body);
      localStorage.setItem(cacheKey(phone, module), body);
    } catch (_) {}
  }

  function savePhone(phone, module) {
    const p = cleanPhone(phone);
    const m = upperModule(module);
    if (!p) return;

    try {
      sessionStorage.setItem("DIGIY_LAST_PHONE", p);
      sessionStorage.setItem(`DIGIY_${m}_PHONE`, p);

      if (m === "LOC") {
        sessionStorage.setItem("DIGIY_LOC_PHONE", p);
        sessionStorage.setItem("DIGIY_LOC_LAST_PHONE", p);
      }
    } catch (_) {}
  }

  function normalizeAccess(data) {
    const row = Array.isArray(data) ? data[0] : data;

    if (row === true) {
      return { has_access: true, row: { has_access: true } };
    }

    if (row === false || row == null) {
      return { has_access: false, row: row || null };
    }

    if (typeof row === "string") {
      const v = row.trim().toLowerCase();
      return {
        has_access: ["true", "t", "1", "ok", "yes"].includes(v),
        row: { raw: row }
      };
    }

    if (typeof row === "number") {
      return {
        has_access: row > 0,
        row: { raw: row }
      };
    }

    if (typeof row === "object") {
      const hasAccess = !!(
        row.has_access === true ||
        row.access === true ||
        row.access_ok === true ||
        row.allowed === true ||
        row.active === true ||
        row.ok === true
      );

      return { has_access: hasAccess, row };
    }

    return { has_access: false, row: null };
  }

  function withTimeout(ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort();
      } catch (_) {}
    }, ms);

    return {
      signal: controller.signal,
      done: function () {
        clearTimeout(timer);
      }
    };
  }

  async function rpcAccessFetch(url, key, phone, module, timeoutMs) {
    const t = withTimeout(timeoutMs);

    try {
      const endpoint =
        `${url.replace(/\/+$/, "")}/rest/v1/rpc/digiy_has_module_access_from_abos`;

      const res = await fetch(endpoint, {
        method: "POST",
        signal: t.signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          p_phone: phone,
          p_module: module
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          ok: false,
          has_access: false,
          error: (data && (data.message || data.error)) || `HTTP_${res.status}`,
          phone,
          module
        };
      }

      const normalized = normalizeAccess(data);

      return {
        ok: true,
        has_access: normalized.has_access,
        phone,
        module,
        plan: normalized.row
          ? normalized.row.plan || normalized.row.plan_code || null
          : null,
        fiche_title: normalized.row
          ? normalized.row.fiche_title || normalized.row.title || null
          : null,
        expires_at: normalized.row
          ? normalized.row.expires_at || normalized.row.valid_until || null
          : null,
        module_rights: normalized.row
          ? normalized.row.module_rights || normalized.row.rights || []
          : [],
        raw: normalized.row || data
      };
    } catch (e) {
      return {
        ok: false,
        has_access: false,
        error:
          e && e.name === "AbortError"
            ? "ABOS_TIMEOUT"
            : (e && e.message) || "ABOS_FETCH_ERROR",
        phone,
        module
      };
    } finally {
      t.done();
    }
  }

  async function checkAccess(options) {
    const opts = options || {};
    const module = guessModule(opts);
    const phone = cleanPhone(opts.phone || guessPhone());
    const ttlMs = Number(opts.ttlMs || DEFAULT_TTL_MS);
    const timeoutMs = Number(opts.timeoutMs || DEFAULT_TIMEOUT_MS);

    if (!module) {
      return {
        ok: false,
        has_access: false,
        error: "MODULE_REQUIRED"
      };
    }

    if (!phone) {
      return {
        ok: false,
        has_access: false,
        error: "PHONE_REQUIRED",
        module
      };
    }

    savePhone(phone, module);

    const cached =
      opts.useCache !== false ? getCached(phone, module, ttlMs) : null;

    if (cached) {
      return {
        ...cached,
        from_cache: true
      };
    }

    const url =
      opts.supabaseUrl ||
      window.DIGIY_SUPABASE_URL ||
      DEFAULT_SUPABASE_URL;

    const key =
      opts.supabaseKey ||
      window.DIGIY_SUPABASE_KEY ||
      window.DIGIY_SUPABASE_ANON_KEY ||
      window.DIGIY_SUPABASE_ANON ||
      DEFAULT_SUPABASE_KEY;

    const result = await rpcAccessFetch(url, key, phone, module, timeoutMs);

    if (result.ok) {
      setCached(phone, module, result);
    } else if (cached) {
      return {
        ...cached,
        from_cache: true,
        stale_after_error: result.error || true
      };
    }

    return result;
  }

  function buildDeniedUrl(options) {
    const opts = options || {};
    const module = guessModule(opts);

    const base =
      opts.payUrl ||
      opts.deniedUrl ||
      window.DIGIY_LOGIN_URL ||
      "./pin.html";

    try {
      const url = new URL(base, window.location.href);

      if (module) url.searchParams.set("module", module);
      url.searchParams.set("reason", opts.reason || "abos_required");

      return url.pathname + url.search + url.hash;
    } catch (_) {
      return base;
    }
  }

  async function protect(options) {
    const opts = options || {};
    const result = await checkAccess(opts);

    if (result.ok && result.has_access) {
      if (typeof opts.onAllowed === "function") opts.onAllowed(result);
      return result;
    }

    if (typeof opts.onDenied === "function") {
      opts.onDenied(result);
      return result;
    }

    /*
      IMPORTANT :
      Par défaut on ne redirige plus.
      Le guard principal décide.
      Pour forcer une redirection : protect({ redirect:true })
    */
    if (opts.redirect === true) {
      window.location.href = buildDeniedUrl({
        ...opts,
        reason: result.error || "abos_required"
      });
    }

    return result;
  }

  function renderAccessBadge(target, result) {
    const el =
      typeof target === "string" ? document.querySelector(target) : target;

    if (!el || !result) return;

    const module = upperModule(result.module || window.DIGIY_MODULE || "LOC");

    if (result.has_access) {
      el.innerHTML = `
        <strong>✅ Accès ${module} actif</strong><br>
        ${result.fiche_title || module + " · DIGIY"}<br>
        <small>Expire : ${result.expires_at || "date suivie par DIGIY"}</small>
      `;
    } else {
      el.innerHTML = `
        <strong>🔒 Accès ${module} à vérifier</strong><br>
        <small>PAY garde la preuve, ADMIN valide, puis ${module} s’ouvre.</small>
      `;
    }
  }

  function clearCache(module, phone) {
    const m = upperModule(module || window.DIGIY_MODULE || "");
    const p = cleanPhone(phone || guessPhone());

    try {
      Object.keys(localStorage).forEach((key) => {
        if (!key.startsWith(STORAGE_PREFIX + ":")) return;
        if (m && !key.includes(":" + m + ":")) return;
        if (p && !key.endsWith(":" + p)) return;
        localStorage.removeItem(key);
      });
    } catch (_) {}

    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (!key.startsWith(STORAGE_PREFIX + ":")) return;
        if (m && !key.includes(":" + m + ":")) return;
        if (p && !key.endsWith(":" + p)) return;
        sessionStorage.removeItem(key);
      });
    } catch (_) {}
  }

  window.DIGIY_ABOS_ACCESS = {
    version: "digiy-abos-access-safe-light-20260522",
    checkAccess,
    protect,
    renderAccessBadge,
    guessPhone,
    cleanPhone,
    upperModule,
    clearCache
  };
})();
