// claw-tools-loc.js — DIGIY LOC PRO bridge v1
// Doctrine : terrain extrait de app-propriétaire.html + guard.js LOC.
// API canonique : window.DIGIY_CLAW_LOC
// Alias confort  : window.CLAW_LOC = window.DIGIY_CLAW_LOC
// ─────────────────────────────────────────────────────────────────────────────

(() => {
  "use strict";

  const CFG = {
    MODULE:       "LOC",
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
      fiche_abo:          "./fiche-abo.html"
    },

    TABLES: {
      SUBSCRIPTIONS_PUBLIC:    "digiy_subscriptions_public",
      CLAW_RECOMMENDATIONS:    "digiy_claw_recommendations"
    },

    // RPCs réels déclarés dans app-propriétaire.html
    RPCS: {
      WAVE_STATS:   "loc_wave_payments_stats_owner",
      WAVE_LIST:    "loc_wave_payments_list_owner",
      WAVE_DECLARE: "loc_wave_payment_declare_owner",
      WAVE_VERIFY:  "loc_wave_payment_verify"
    },

    STORAGE: {
      SESSION_LIST: [
        "DIGIY_LOC_PIN_SESSION",
        "DIGIY_PIN_SESSION",
        "DIGIY_ACCESS",
        "DIGIY_SESSION_LOC",
        "digiy_loc_session"
      ],
      SLUG:      "digiy_loc_slug",
      PHONE:     "digiy_loc_phone",
      LAST_SLUG: "digiy_loc_last_slug"
    },

    SUPABASE_URL:
      window.DIGIY_SUPABASE_URL ||
      "https://wesqmwjjtsefyjnluosj.supabase.co",

    SUPABASE_ANON_KEY:
      window.DIGIY_SUPABASE_ANON ||
      window.DIGIY_SUPABASE_ANON_KEY ||
      "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3",

    // Statuts CLAW acceptés — miroir de l'app propriétaire
    CLAW_STATUSES: ["approved", "published", "ready", "active", "validated"]
  };

  const CACHE = { sb: null };

  // ── NORMALISEURS ───────────────────────────────────────────────────────────
  function normSlug(v) {
    return String(v || "").trim().toLowerCase()
      .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  function normPhone(v) {
    const raw     = String(v || "").trim();
    const cleaned = raw.replace(/[^\d+]/g, "");
    const digits  = cleaned.replace(/[^\d]/g, "");
    if (!digits) return "";
    return cleaned.startsWith("+") ? `+${digits}` : digits;
  }

  function asError(message, extra = {}) {
    return { ok: false, error: String(message || "Erreur."), ...extra };
  }

  function withIdentity(pathname, ctx = {}) {
    const url   = new URL(pathname, location.href);
    const slug  = normSlug(ctx.slug  || "");
    const phone = normPhone(ctx.phone || "");
    if (slug)  url.searchParams.set("slug",  slug);
    if (phone) url.searchParams.set("phone", phone);
    return url.toString();
  }

  // ── CLIENT SUPABASE ────────────────────────────────────────────────────────
  function getSupabaseClient() {
    if (CACHE.sb) return CACHE.sb;

    if (window.sb && typeof window.sb.from === "function") {
      CACHE.sb = window.sb;
      return CACHE.sb;
    }

    if (!window.supabase?.createClient) return null;

    CACHE.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    return CACHE.sb;
  }

  // ── CONTEXTE GUARD ────────────────────────────────────────────────────────
  async function getContext() {
    const g = window.DIGIY_GUARD;

    if (!g) {
      const slug  = normSlug(new URLSearchParams(location.search).get("slug") || "");
      const phone = normPhone(new URLSearchParams(location.search).get("phone") || "");
      return {
        ok: true, module: CFG.MODULE, slug, phone,
        owner_id: null, access_ok: false, preview: true,
        source: "guard_missing", pin_url: null, pay_url: null
      };
    }

    let state = null;
    if (typeof g.getSession === "function") state = g.getSession();
    if (!state?.ready_flag && typeof g.ready === "function") state = await g.ready();
    state = state || {};

    return {
      ok:        true,
      module:    String(state.module || CFG.MODULE).toUpperCase(),
      slug:      normSlug(state.slug  || ""),
      phone:     normPhone(state.phone || ""),
      owner_id:  state.owner_id || null,
      access_ok: !!(state.access_ok || state.access),
      preview:   !!state.preview,
      source:    state.source || "guard",
      pin_url:   state.pin_url || null,
      pay_url:   state.pay_url || null
    };
  }

  async function requireContext() {
    const ctx = await getContext();
    if (!ctx.ok) return ctx;
    if (!ctx.slug) return asError("Slug LOC manquant.", { context: ctx });
    return ctx;
  }

  async function requireAccess() {
    const ctx = await requireContext();
    if (!ctx.ok) return ctx;
    if (!ctx.access_ok || ctx.preview) {
      return asError("Accès LOC non actif.", { context: ctx, code: "access_required" });
    }
    return ctx;
  }

  // ── TOOLS MÉTIER ───────────────────────────────────────────────────────────

  // CLAW recommendations — miroir de loadClaw() dans app-propriétaire.html
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
      .order("created_at",       { ascending: false })
      .limit(payload.limit || 3);

    if (error) return asError(`load_claw_recommendations: ${error.message}`, { context: ctx });
    return {
      ok:    true,
      tool:  "load_claw_recommendations",
      context: ctx,
      count: (data || []).length,
      rows:  data || []
    };
  }

  // Wave stats — miroir de loadStats() dans app-propriétaire.html
  async function getWaveStats(payload = {}) {
    const ctx = await requireAccess();
    if (!ctx.ok) return ctx;

    const sb = getSupabaseClient();
    if (!sb) return asError("Supabase indisponible.", { context: ctx });

    const { data, error } = await sb.rpc(CFG.RPCS.WAVE_STATS, {
      p_slug:        ctx.slug,
      p_owner_phone: ctx.phone
    });

    if (error) return asError(`get_wave_stats: ${error.message}`, { context: ctx });
    if (!data?.ok) return asError(data?.reason || "stats_failed", { context: ctx });

    return { ok: true, tool: "get_wave_stats", context: ctx, data };
  }

  // Wave list — miroir de loadList() dans app-propriétaire.html
  async function listWavePayments(payload = {}) {
    const ctx = await requireAccess();
    if (!ctx.ok) return ctx;

    const sb = getSupabaseClient();
    if (!sb) return asError("Supabase indisponible.", { context: ctx });

    const { data, error } = await sb.rpc(CFG.RPCS.WAVE_LIST, {
      p_slug:        ctx.slug,
      p_owner_phone: ctx.phone
    });

    if (error) return asError(`list_wave_payments: ${error.message}`, { context: ctx });
    const rows = Array.isArray(data) ? data : [];
    return { ok: true, tool: "list_wave_payments", context: ctx, count: rows.length, rows };
  }

  // Wave declare — miroir de btnDeclareOwner dans app-propriétaire.html
  // payload: { amount_fcfa, client_name?, client_phone?, note? }
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
      p_slug:         ctx.slug,
      p_owner_phone:  ctx.phone,
      p_amount_fcfa:  amt,
      p_client_name:  String(payload.client_name  || ""),
      p_client_phone: String(payload.client_phone || ""),
      p_note:         String(payload.note         || "")
    });

    if (error) return asError(`declare_wave_payment: ${error.message}`, { context: ctx });
    if (!data?.ok) return asError(data?.reason || "declare_failed", { context: ctx });
    return { ok: true, tool: "declare_wave_payment", context: ctx, data };
  }

  // Wave verify — miroir de jsVerify dans app-propriétaire.html
  // payload: { id } — l'id du paiement à vérifier
  async function verifyWavePayment(payload = {}) {
    const ctx = await requireAccess();
    if (!ctx.ok) return ctx;

    const id = Number(payload.id || 0);
    if (!id) return asError("ID de paiement manquant.", { context: ctx });

    const sb = getSupabaseClient();
    if (!sb) return asError("Supabase indisponible.", { context: ctx });

    const { data, error } = await sb.rpc(CFG.RPCS.WAVE_VERIFY, {
      p_id:          id,
      p_slug:        ctx.slug,
      p_owner_phone: ctx.phone
    });

    if (error) return asError(`verify_wave_payment: ${error.message}`, { context: ctx });
    if (!data?.ok) return asError(data?.reason || "verify_failed", { context: ctx });
    return { ok: true, tool: "verify_wave_payment", context: ctx, data };
  }

  // Navigation
  async function openPlanning()    { const ctx = await requireContext(); if (!ctx.ok) return ctx; return { ok: true, url: withIdentity(CFG.PATHS.planning,     ctx) }; }
  async function openReservations(){ const ctx = await requireContext(); if (!ctx.ok) return ctx; return { ok: true, url: withIdentity(CFG.PATHS.reservations,  ctx) }; }
  async function openTarifs()      { const ctx = await requireContext(); if (!ctx.ok) return ctx; return { ok: true, url: withIdentity(CFG.PATHS.tarifs,        ctx) }; }
  async function openPinWave()     { const ctx = await requireContext(); if (!ctx.ok) return ctx; return { ok: true, url: withIdentity(CFG.PATHS.pin_wave,      ctx) }; }
  async function openPin() {
    const ctx = await getContext();
    const g   = window.DIGIY_GUARD;
    if (g?.goPin) { g.goPin({ slug: ctx.slug, phone: ctx.phone }); return { ok: true, tool: "open_pin" }; }
    location.replace(withIdentity(CFG.PATHS.pin, ctx));
    return { ok: true, tool: "open_pin" };
  }

  async function refreshContext() {
    const g = window.DIGIY_GUARD;
    if (!g?.refresh) return asError("refresh guard indisponible.");
    const state = await g.refresh();
    return { ok: true, tool: "refresh_context", context: {
      module:    String(state?.module   || CFG.MODULE).toUpperCase(),
      slug:      normSlug(state?.slug   || ""),
      phone:     normPhone(state?.phone || ""),
      access_ok: !!(state?.access_ok || state?.access),
      preview:   !!state?.preview
    }};
  }

  // ── SNAPSHOT ───────────────────────────────────────────────────────────────
  async function snapshot() {
    const ctx = await getContext();
    return {
      guard_loaded:  !!window.DIGIY_GUARD,
      authenticated: ctx.ok && ctx.access_ok,
      slug:          ctx.slug    || "(aucun)",
      phone:         ctx.phone   || "(aucun)",
      preview:       ctx.preview ?? true,
      source:        ctx.source  || "none",
      module:        CFG.MODULE,
      tools:         listTools().map(t => t.name)
    };
  }

  // Console goTo
  async function goTo(page) {
    const map = {
      planning: "open_planning", reservations: "open_reservations",
      tarifs:   "open_tarifs",   pin_wave:      "open_pin_wave",
      pin:      "open_pin"
    };
    const action = map[String(page || "").toLowerCase()];
    if (!action) return asError(`Navigation inconnue : "${page}"`);
    const res = await runAction(action);
    if (res?.url) location.href = res.url;
    return res;
  }

  // ── REGISTRE TOOLS ─────────────────────────────────────────────────────────
  const tools = {
    get_context:               { description: "Retourne le contexte réel LOC.",                                                     run: getContext },
    load_claw_recommendations: { description: "Charge les conseils CLAW depuis digiy_claw_recommendations (payload: {limit?}).",     run: loadClawRecommendations },
    get_wave_stats:            { description: "Charge les stats Wave via loc_wave_payments_stats_owner.",                            run: getWaveStats },
    list_wave_payments:        { description: "Liste les paiements Wave via loc_wave_payments_list_owner.",                          run: listWavePayments },
    declare_wave_payment:      { description: "Déclare un paiement Wave (payload: {amount_fcfa, client_name?, client_phone?, note?}).", run: declareWavePayment },
    verify_wave_payment:       { description: "Vérifie un paiement Wave (payload: {id}).",                                          run: verifyWavePayment },
    open_planning:             { description: "Retourne l'URL planning.html avec le slug actif.",                                   run: openPlanning },
    open_reservations:         { description: "Retourne l'URL reservations.html avec le slug actif.",                               run: openReservations },
    open_tarifs:               { description: "Retourne l'URL tarifs.html avec le slug actif.",                                     run: openTarifs },
    open_pin_wave:             { description: "Retourne l'URL pin-wave.html avec le slug actif.",                                   run: openPinWave },
    open_pin:                  { description: "Renvoie vers pin.html si la session est cassée.",                                    run: openPin },
    refresh_context:           { description: "Redemande l'état réel au guard.",                                                    run: refreshContext }
  };

  function listTools() {
    return Object.entries(tools).map(([name, spec]) => ({ name, description: spec.description }));
  }

  async function runAction(name, payload = {}) {
    const key  = String(name || "").trim().toLowerCase();
    const tool = tools[key];
    if (!tool?.run) return asError(`Tool inconnu : "${name}". Disponibles : ${Object.keys(tools).join(", ")}`);
    try { return await tool.run(payload); }
    catch (err) { return asError(err?.message || `Erreur pendant "${name}"`); }
  }

  async function ready() {
    const ctx = await getContext();
    return { ok: true, module: CFG.MODULE, context: ctx.ok ? ctx : null, tools: listTools() };
  }

  // ── EXPOSITION ─────────────────────────────────────────────────────────────
  const API = {
    ready, getContext, snapshot,
    listTools, runAction, tools,
    goTo,
    normSlug, normPhone,
    PATHS: CFG.PATHS, TABLES: CFG.TABLES, RPCS: CFG.RPCS, MODULE: CFG.MODULE,
    CLAW_STATUSES: CFG.CLAW_STATUSES
  };

  window.DIGIY_CLAW_LOC = API;
  window.CLAW_LOC        = API;

  console.info(
    "[CLAW_LOC v1] chargé —",
    window.DIGIY_GUARD ? "guard présent ✓" : "guard absent ✗",
    "— tape CLAW_LOC.snapshot() pour l'état complet"
  );
})();
