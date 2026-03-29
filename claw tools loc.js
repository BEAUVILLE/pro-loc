// claw-tools-loc.js — DIGIY LOC bridge v2
// Doctrine : sobre devant, redoutable derrière.
// API canonique : window.DIGIY_CLAW_LOC
// Alias confort  : window.CLAW_LOC = window.DIGIY_CLAW_LOC

(() => {
  "use strict";

  const CFG = {
    MODULE: "LOC",
    MODULE_LOWER: "loc",

    PATHS: {
      pin:                "./pin.html",
      planning:           "./planning.html",
      block_dates:        "./planning.html",
      reservations:       "./reservations.html",
      tarifs:             "./tarifs.html",
      pin_wave:           "./pin-wave.html",
      listing:            "./listing.html",
      photos:             "./photos.html",
      manage_links:       "./manage-links.html",
      reservations_pulse: "./reservations-pulse.html",
      generator:          "./generator.html",
      qr:                 "./qr.html",
      qr_factory:         "./qr-factory.html",
      ndimbal:            "./ndimbal.html",
      ndimbal_loc:        "./ndimbal-loc.html",
      go_pin_public:      "./go-pin-public.html",
      fiche_abo:          "./fiche-abo.html",
      app:                "./app.html"
    },

    TABLES: {
      SUBSCRIPTIONS_PUBLIC: "digiy_subscriptions_public",
      CLAW_RECOMMENDATIONS: "digiy_claw_recommendations"
    },

    RPCS: {
      WAVE_STATS:   "loc_wave_payments_stats_owner",
      WAVE_LIST:    "loc_wave_payments_list_owner",
      WAVE_DECLARE: "loc_wave_payment_declare_owner",
      WAVE_VERIFY:  "loc_wave_payment_verify"
    },

    STORAGE: {
      SESSION_LIST: [
        "digiy_loc_session",
        "DIGIY_LOC_PIN_SESSION",
        "DIGIY_PIN_SESSION",
        "DIGIY_ACCESS",
        "DIGIY_SESSION_LOC"
      ],
      SLUG_KEYS: [
        "digiy_loc_last_slug",
        "digiy_loc_slug",
        "digiy_last_slug",
        "DIGIY_SLUG"
      ],
      PHONE_KEYS: [
        "digiy_loc_phone",
        "digiy_last_phone",
        "DIGIY_PHONE"
      ]
    },

    SUPABASE_URL:
      window.DIGIY_SUPABASE_URL ||
      "https://wesqmwjjtsefyjnluosj.supabase.co",

    SUPABASE_ANON_KEY:
      window.DIGIY_SUPABASE_ANON ||
      window.DIGIY_SUPABASE_ANON_KEY ||
      "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3",

    CLAW_STATUSES: ["approved", "published", "ready", "active", "validated"]
  };

  const CACHE = { sb: null };

  function normSlug(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function normPhone(v) {
    const raw = String(v || "").trim();
    const cleaned = raw.replace(/[^\d+]/g, "");
    const digits = cleaned.replace(/[^\d]/g, "");
    if (!digits) return "";
    return cleaned.startsWith("+") ? `+${digits}` : digits;
  }

  function asError(message, extra = {}) {
    return { ok: false, error: String(message || "Erreur."), ...extra };
  }

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function readStorage(key) {
    try {
      const v1 = localStorage.getItem(key);
      if (v1) return v1;
    } catch (_) {}
    try {
      const v2 = sessionStorage.getItem(key);
      if (v2) return v2;
    } catch (_) {}
    return "";
  }

  function getSearchParam(name) {
    try {
      return new URLSearchParams(location.search).get(name) || "";
    } catch (_) {
      return "";
    }
  }

  function firstStored(keys, normalizer) {
    for (const key of keys) {
      const raw = readStorage(key);
      if (!raw) continue;
      const val = normalizer ? normalizer(raw) : raw;
      if (val) return val;
    }
    return "";
  }

  function buildSafeUrl(base, params = {}) {
    const baseStr = String(base || "").trim();
    if (!baseStr) return location.href;

    try {
      const u = new URL(baseStr, location.href);
      Object.entries(params).forEach(([k, v]) => {
        const val = String(v ?? "").trim();
        if (val) u.searchParams.set(k, val);
      });
      return u.toString();
    } catch (_) {
      try {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
          const val = String(v ?? "").trim();
          if (val) query.set(k, val);
        });
        const qs = query.toString();
        if (!qs) return baseStr;
        return baseStr + (baseStr.includes("?") ? "&" : "?") + qs;
      } catch (__){
        return baseStr;
      }
    }
  }

  function withIdentity(pathname, ctx = {}) {
    return buildSafeUrl(pathname, {
      slug: normSlug(ctx.slug || ""),
      phone: normPhone(ctx.phone || "")
    });
  }

  function getSupabaseClient() {
    if (CACHE.sb) return CACHE.sb;

    if (window.sb && typeof window.sb.from === "function") {
      CACHE.sb = window.sb;
      return CACHE.sb;
    }

    if (!window.supabase?.createClient) return null;

    CACHE.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    return CACHE.sb;
  }

  function readStoredSession() {
    for (const key of CFG.STORAGE.SESSION_LIST) {
      const raw = readStorage(key);
      if (!raw) continue;

      const parsed = safeJsonParse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
    return {};
  }

  function baseFallbackContext() {
    return {
      module: CFG.MODULE,
      slug:
        normSlug(getSearchParam("slug")) ||
        firstStored(CFG.STORAGE.SLUG_KEYS, normSlug) ||
        "",
      phone:
        normPhone(getSearchParam("phone")) ||
        firstStored(CFG.STORAGE.PHONE_KEYS, normPhone) ||
        "",
      owner_id: null,
      access_ok: false,
      preview: true,
      source: "fallback",
      pin_url: null,
      pay_url: null
    };
  }

  async function getContext() {
    const g = window.DIGIY_GUARD;
    const fallback = baseFallbackContext();
    const stored = readStoredSession();

    if (!g) {
      return {
        ok: true,
        ...fallback,
        source: "guard_missing",
        pin_url: withIdentity(CFG.PATHS.pin, fallback),
        pay_url: withIdentity(CFG.PATHS.pin_wave, fallback)
      };
    }

    let fromSession = {};
    let fromState = {};
    let fromReady = {};

    try {
      if (typeof g.getSession === "function") {
        fromSession = g.getSession() || {};
      }
    } catch (_) {}

    try {
      if (g.state && typeof g.state === "object") {
        fromState = g.state;
      }
    } catch (_) {}

    const needReady =
      !normSlug(fromSession.slug || fromState.slug || fallback.slug) ||
      !normPhone(fromSession.phone || fromState.phone || fallback.phone) ||
      !((fromSession.access === true) || (fromState.access === true) || (fromSession.access_ok === true) || (fromState.access_ok === true));

    if (needReady && typeof g.ready === "function") {
      try {
        fromReady = await g.ready({
          redirect: false,
          preserve_validation: true,
          allow_soft_session: true
        }) || {};
      } catch (_) {}
    }

    const merged = {
      module:
        String(
          fromState.module ||
          fromSession.module ||
          fromReady.module ||
          stored.module ||
          CFG.MODULE
        ).toUpperCase(),

      slug:
        normSlug(
          fromState.slug ||
          fromSession.slug ||
          fromReady.slug ||
          stored.slug ||
          fallback.slug
        ),

      phone:
        normPhone(
          fromState.phone ||
          fromSession.phone ||
          fromReady.phone ||
          stored.phone ||
          fallback.phone
        ),

      owner_id:
        fromState.owner_id ||
        fromSession.owner_id ||
        fromReady.owner_id ||
        stored.owner_id ||
        null,

      access_ok: !!(
        fromState.access_ok === true ||
        fromState.access === true ||
        fromSession.access_ok === true ||
        fromSession.access === true ||
        fromReady.access_ok === true ||
        fromReady.access === true ||
        stored.access === true ||
        stored.ok === true
      ),

      preview: !!(
        fromState.preview === true ||
        fromSession.preview === true ||
        fromReady.preview === true
      )
    };

    const source =
      fromState.access === true || fromState.slug || fromState.phone ? "guard.state" :
      fromSession.access === true || fromSession.slug || fromSession.phone ? "guard.getSession" :
      fromReady.access === true || fromReady.slug || fromReady.phone ? "guard.ready" :
      "fallback";

    return {
      ok: true,
      module: merged.module || CFG.MODULE,
      slug: merged.slug || "",
      phone: merged.phone || "",
      owner_id: merged.owner_id || null,
      access_ok: merged.access_ok,
      preview: merged.preview,
      source,
      pin_url: withIdentity(CFG.PATHS.pin, merged),
      pay_url: withIdentity(CFG.PATHS.pin_wave, merged)
    };
  }

  async function requireContext() {
    const ctx = await getContext();
    if (!ctx.ok) return ctx;
    if (!ctx.slug) {
      return asError("Identifiant LOC manquant.", { context: ctx, code: "slug_required" });
    }
    return ctx;
  }

  async function requireAccess() {
    const ctx = await requireContext();
    if (!ctx.ok) return ctx;

    if (!ctx.access_ok || ctx.preview === true) {
      return asError("Accès LOC non actif.", {
        context: ctx,
        code: "access_required"
      });
    }

    if (!ctx.phone) {
      return asError("Téléphone propriétaire manquant.", {
        context: ctx,
        code: "phone_required"
      });
    }

    return ctx;
  }

  async function loadClawRecommendations(payload = {}) {
    const ctx = await requireContext();
    if (!ctx.ok) return ctx;

    const sb = getSupabaseClient();
    if (!sb) return asError("Supabase indisponible.", { context: ctx });

    const { data, error } = await sb
      .from(CFG.TABLES.CLAW_RECOMMENDATIONS)
      .select("id,slug,module,recommendation_type,title,summary,rationale,proposed_action,confidence_score,risk_level,status,created_at")
      .eq("module", CFG.MODULE)
      .eq("slug", ctx.slug)
      .in("status", CFG.CLAW_STATUSES)
      .order("confidence_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(payload.limit || 3);

    if (error) {
      return asError(`load_claw_recommendations: ${error.message}`, { context: ctx });
    }

    return {
      ok: true,
      tool: "load_claw_recommendations",
      context: ctx,
      count: Array.isArray(data) ? data.length : 0,
      rows: Array.isArray(data) ? data : []
    };
  }

  async function getWaveStats() {
    const ctx = await requireAccess();
    if (!ctx.ok) return ctx;

    const sb = getSupabaseClient();
    if (!sb) return asError("Supabase indisponible.", { context: ctx });

    const { data, error } = await sb.rpc(CFG.RPCS.WAVE_STATS, {
      p_slug: ctx.slug,
      p_owner_phone: ctx.phone
    });

    if (error) return asError(`get_wave_stats: ${error.message}`, { context: ctx });
    if (!data?.ok) return asError(data?.reason || "stats_failed", { context: ctx });

    return { ok: true, tool: "get_wave_stats", context: ctx, data };
  }

  async function listWavePayments() {
    const ctx = await requireAccess();
    if (!ctx.ok) return ctx;

    const sb = getSupabaseClient();
    if (!sb) return asError("Supabase indisponible.", { context: ctx });

    const { data, error } = await sb.rpc(CFG.RPCS.WAVE_LIST, {
      p_slug: ctx.slug,
      p_owner_phone: ctx.phone
    });

    if (error) return asError(`list_wave_payments: ${error.message}`, { context: ctx });

    const rows = Array.isArray(data) ? data : [];
    return { ok: true, tool: "list_wave_payments", context: ctx, count: rows.length, rows };
  }

  async function declareWavePayment(payload = {}) {
    const ctx = await requireAccess();
    if (!ctx.ok) return ctx;

    const amt = Number(String(payload.amount_fcfa || 0).replace(/[^\d]/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) {
      return asError("Montant invalide.", { context: ctx });
    }

    const sb = getSupabaseClient();
    if (!sb) return asError("Supabase indisponible.", { context: ctx });

    const { data, error } = await sb.rpc(CFG.RPCS.WAVE_DECLARE, {
      p_slug: ctx.slug,
      p_owner_phone: ctx.phone,
      p_amount_fcfa: amt,
      p_client_name: String(payload.client_name || ""),
      p_client_phone: String(payload.client_phone || ""),
      p_note: String(payload.note || "")
    });

    if (error) return asError(`declare_wave_payment: ${error.message}`, { context: ctx });
    if (!data?.ok) return asError(data?.reason || "declare_failed", { context: ctx });

    return { ok: true, tool: "declare_wave_payment", context: ctx, data };
  }

  async function verifyWavePayment(payload = {}) {
    const ctx = await requireAccess();
    if (!ctx.ok) return ctx;

    const idRaw = payload.id;
    const id = Number(idRaw);

    if (!idRaw || !Number.isFinite(id) || id <= 0) {
      return asError("ID de paiement manquant.", { context: ctx });
    }

    const sb = getSupabaseClient();
    if (!sb) return asError("Supabase indisponible.", { context: ctx });

    const { data, error } = await sb.rpc(CFG.RPCS.WAVE_VERIFY, {
      p_id: id,
      p_slug: ctx.slug,
      p_owner_phone: ctx.phone
    });

    if (error) return asError(`verify_wave_payment: ${error.message}`, { context: ctx });
    if (!data?.ok) return asError(data?.reason || "verify_failed", { context: ctx });

    return { ok: true, tool: "verify_wave_payment", context: ctx, data };
  }

  async function openPlanning() {
    const ctx = await requireContext();
    if (!ctx.ok) return ctx;
    return { ok: true, tool: "open_planning", url: withIdentity(CFG.PATHS.planning, ctx), context: ctx };
  }

  async function openReservations() {
    const ctx = await requireContext();
    if (!ctx.ok) return ctx;
    return { ok: true, tool: "open_reservations", url: withIdentity(CFG.PATHS.reservations, ctx), context: ctx };
  }

  async function openTarifs() {
    const ctx = await requireContext();
    if (!ctx.ok) return ctx;
    return { ok: true, tool: "open_tarifs", url: withIdentity(CFG.PATHS.tarifs, ctx), context: ctx };
  }

  async function openPinWave() {
    const ctx = await requireContext();
    if (!ctx.ok) return ctx;
    return { ok: true, tool: "open_pin_wave", url: withIdentity(CFG.PATHS.pin_wave, ctx), context: ctx };
  }

  async function openPin() {
    const ctx = await getContext();
    location.replace(withIdentity(CFG.PATHS.pin, ctx));
    return { ok: true, tool: "open_pin", context: ctx };
  }

  async function refreshContext() {
    const g = window.DIGIY_GUARD;
    if (!g) return asError("Guard indisponible.");

    try {
      if (typeof g.refresh === "function") {
        await g.refresh();
      } else if (typeof g.ready === "function") {
        await g.ready({
          redirect: false,
          preserve_validation: true,
          allow_soft_session: true
        });
      } else {
        return asError("Aucun refresh disponible côté guard.");
      }
    } catch (err) {
      return asError(err?.message || "refresh_failed");
    }

    const ctx = await getContext();
    return { ok: true, tool: "refresh_context", context: ctx };
  }

  async function snapshot() {
    const ctx = await getContext();
    return {
      guard_loaded: !!window.DIGIY_GUARD,
      authenticated: ctx.ok && ctx.access_ok && !ctx.preview,
      slug: ctx.slug || "(aucun)",
      phone: ctx.phone || "(aucun)",
      preview: ctx.preview ?? true,
      source: ctx.source || "none",
      module: CFG.MODULE,
      tools: listTools().map(t => t.name)
    };
  }

  async function goTo(page) {
    const map = {
      planning: "open_planning",
      reservations: "open_reservations",
      tarifs: "open_tarifs",
      pin_wave: "open_pin_wave",
      pin: "open_pin"
    };

    const action = map[String(page || "").trim().toLowerCase()];
    if (!action) {
      return asError(`Navigation inconnue : "${page}"`);
    }

    const res = await runAction(action);
    if (res?.url) location.href = res.url;
    return res;
  }

  const tools = {
    get_context: {
      description: "Retourne le contexte réel LOC.",
      run: getContext
    },
    load_claw_recommendations: {
      description: "Charge les recommandations Analyse depuis digiy_claw_recommendations (payload: {limit?}).",
      run: loadClawRecommendations
    },
    get_wave_stats: {
      description: "Charge les stats Wave via loc_wave_payments_stats_owner.",
      run: getWaveStats
    },
    list_wave_payments: {
      description: "Liste les paiements Wave via loc_wave_payments_list_owner.",
      run: listWavePayments
    },
    declare_wave_payment: {
      description: "Déclare un paiement Wave (payload: {amount_fcfa, client_name?, client_phone?, note?}).",
      run: declareWavePayment
    },
    verify_wave_payment: {
      description: "Vérifie un paiement Wave (payload: {id}).",
      run: verifyWavePayment
    },
    open_planning: {
      description: "Retourne l'URL planning.html avec le contexte actif.",
      run: openPlanning
    },
    open_reservations: {
      description: "Retourne l'URL reservations.html avec le contexte actif.",
      run: openReservations
    },
    open_tarifs: {
      description: "Retourne l'URL tarifs.html avec le contexte actif.",
      run: openTarifs
    },
    open_pin_wave: {
      description: "Retourne l'URL pin-wave.html avec le contexte actif.",
      run: openPinWave
    },
    open_pin: {
      description: "Renvoie vers pin.html si la session est cassée.",
      run: openPin
    },
    refresh_context: {
      description: "Redemande l'état réel au guard.",
      run: refreshContext
    }
  };

  function listTools() {
    return Object.entries(tools).map(([name, spec]) => ({
      name,
      description: spec.description
    }));
  }

  async function runAction(name, payload = {}) {
    const key = String(name || "").trim().toLowerCase();
    const tool = tools[key];

    if (!tool?.run) {
      return asError(`Tool inconnu : "${name}". Disponibles : ${Object.keys(tools).join(", ")}`);
    }

    try {
      return await tool.run(payload);
    } catch (err) {
      return asError(err?.message || `Erreur pendant "${name}"`);
    }
  }

  async function ready() {
    const ctx = await getContext();
    return {
      ok: true,
      module: CFG.MODULE,
      context: ctx.ok ? ctx : null,
      tools: listTools()
    };
  }

  const API = {
    ready,
    getContext,
    snapshot,
    listTools,
    runAction,
    tools,
    goTo,
    normSlug,
    normPhone,
    PATHS: CFG.PATHS,
    TABLES: CFG.TABLES,
    RPCS: CFG.RPCS,
    MODULE: CFG.MODULE,
    CLAW_STATUSES: CFG.CLAW_STATUSES
  };

  window.DIGIY_CLAW_LOC = API;
  window.CLAW_LOC = API;

  console.info(
    "[CLAW_LOC v2] chargé —",
    window.DIGIY_GUARD ? "guard présent ✓" : "guard absent ✗",
    "— tape CLAW_LOC.snapshot() pour l'état complet"
  );
})();
