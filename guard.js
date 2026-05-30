// guard.js — DIGIY LOC PRO / JE LOUE
// Doctrine : PIN une seule fois → session locale fraîche 8h → navigation interne directe
// Rail ABOS : digiy_has_module_access_from_abos(phone, "LOC") d'abord
// Secours transition : digiy_has_access avec alias LOC / LOCATION / JE_LOUE
// PRO = coffre sécurisé / PUBLIC = vitrine propre / RPC = pont contrôlé
//
// Ce fichier remplace guard.js stop_moteur (20260522).
// Il restaure la vérification PIN + ABOS réelle côté Supabase.
// Prérequis terrain avant déploiement :
//   - Vérifier que le RPC digiy_verify_pin fonctionne avec p_module="LOC"
//   - Tester avec phone 221771342889 / PIN 3435 sur appareil réel
//   - Confirmer que digiy_has_module_access_from_abos répond pour LOC
//   - Si Supabase/ABOS bloquent encore → ne pas déployer, garder stop_moteur

(function () {
  "use strict";

  const MODULE        = "LOC";
  const MODULE_LOWER  = "loc";
  const MODULE_ALIASES = ["LOC", "LOC_PRO", "LOCATION", "JE_LOUE", "LOCATION_PRO"];
  const SESSION_KEY   = "DIGIY_LOC_PRO_SESSION_V1";
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

  const SAFE_HOME = "./pin.html";

  const PUBLIC_KEYS_TO_REMOVE = [
    "phone",
    "tel",
    "owner_phone",
    "owner",
    "owner_id",
    "slug",
    "loc_slug",
    "loc_phone",
    "loc_tel",
    "business_phone",
    "whatsapp",
    "access",
    "pin",
    "pin4",
    "code",
    "session",
    "token",
    "session_token"
  ];

  let bootPromise   = null;
  let client        = null;
  let currentSession = null;

  // ─── Utilitaires ────────────────────────────────────────────────────────────

  function now() {
    return Date.now();
  }

  function normalizePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("221") && digits.length === 12) return digits;
    if (digits.length === 9) return "221" + digits;
    return digits;
  }

  function normalizeSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "");
  }

  function isSessionFresh(session) {
    if (!session) return false;
    if (!session.phone && !session.slug) return false;
    if (!session.validated_at) return false;
    return now() - Number(session.validated_at) < SESSION_TTL_MS;
  }

  function safeJsonParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function isSensitiveSlug(slug) {
    return /\d{7,}/.test(String(slug || ""));
  }

  // ─── Session locale ──────────────────────────────────────────────────────────

  function getStoredSession() {
    // Lire aussi les clés héritées du stop_moteur pour transition douce
    const KEYS = [
      SESSION_KEY,
      "DIGIY_LOC_SESSION",
      "DIGIY_LOC_PIN_SESSION",
      "DIGIY_SESSION_LOC",
      "digiy_loc_session"
    ];
    try {
      for (const key of KEYS) {
        const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
        if (!raw) continue;
        const session = safeJsonParse(raw);
        // Ignorer les sessions stop_moteur (pas de validated_at réel)
        if (session && !session.stop_moteur && isSessionFresh(session)) {
          return session;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  function saveSession(session) {
    const clean = {
      module:       MODULE,
      public_name:  "Je loue",
      phone:        normalizePhone(session.phone),
      slug:         normalizeSlug(session.slug || ""),
      role:         session.role || "owner",
      access:       true,
      access_ok:    true,
      pin_session_ok: true,
      validated_at: session.validated_at || now(),
      expires_at:   session.expires_at   || (now() + SESSION_TTL_MS)
    };

    currentSession = clean;

    try {
      const raw = JSON.stringify(clean);
      // Écrire dans la clé canonique + clés héritées pour compatibilité pages existantes
      [
        SESSION_KEY,
        "DIGIY_LOC_SESSION",
        "DIGIY_LOC_PIN_SESSION",
        "DIGIY_SESSION_LOC",
        "digiy_loc_session"
      ].forEach(key => {
        try { localStorage.setItem(key, raw); }   catch (_) {}
        try { sessionStorage.setItem(key, raw); } catch (_) {}
      });

      if (clean.slug) {
        localStorage.setItem("digiy_loc_slug", clean.slug);
        sessionStorage.setItem("digiy_loc_slug", clean.slug);
        localStorage.setItem("digiy_loc_last_slug", clean.slug);
      }

      if (clean.phone) {
        // Téléphone uniquement en sessionStorage (pas en localStorage pour éviter persistance)
        sessionStorage.setItem("digiy_loc_phone", clean.phone);
        try { localStorage.removeItem("digiy_loc_phone"); } catch (_) {}
      }

      window.DIGIY_LOC_SESSION = clean;
      window.DIGIY_ACCESS = Object.assign({}, window.DIGIY_ACCESS || {}, clean);
    } catch (_) {}

    return clean;
  }

  function clearSession() {
    currentSession = null;
    [
      SESSION_KEY,
      "DIGIY_LOC_SESSION",
      "DIGIY_LOC_PIN_SESSION",
      "DIGIY_SESSION_LOC",
      "digiy_loc_session",
      "DIGIY_ACCESS",
      "DIGIY_PIN_SESSION"
    ].forEach(key => {
      try { localStorage.removeItem(key); }   catch (_) {}
      try { sessionStorage.removeItem(key); } catch (_) {}
    });
    try { sessionStorage.removeItem("digiy_loc_phone"); } catch (_) {}
    try { delete window.DIGIY_LOC_SESSION; }              catch (_) {}
  }

  // ─── URL propre ──────────────────────────────────────────────────────────────

  function cleanSensitiveUrl() {
    try {
      const url = new URL(window.location.href);
      let changed = false;

      PUBLIC_KEYS_TO_REMOVE.forEach(key => {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      });

      const slug = normalizeSlug(url.searchParams.get("slug") || "");
      if (slug && isSensitiveSlug(slug)) {
        url.searchParams.delete("slug");
        changed = true;
      }

      if (changed) {
        const clean =
          url.pathname +
          (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") +
          url.hash;
        window.history.replaceState({}, document.title, clean);
      }
    } catch (_) {}
  }

  function setPageState(state) {
    try {
      document.documentElement.dataset.digiyGuard = state;
      if (document.body) document.body.dataset.digiyGuard = state;
    } catch (_) {}
  }

  function showPage() {
    try {
      document.documentElement.style.visibility = "visible";
      document.documentElement.style.opacity    = "1";
      if (document.body) {
        document.body.style.visibility = "visible";
        document.body.style.opacity    = "1";
        document.body.removeAttribute("aria-hidden");
      }
    } catch (_) {}
  }

  // ─── Client Supabase ─────────────────────────────────────────────────────────

  function getSupabaseClient() {
    if (client) return client;

    const url =
      window.DIGIY_SUPABASE_URL  ||
      window.SUPABASE_URL         ||
      "https://wesqmwjjtsefyjnluosj.supabase.co";

    const anon =
      window.DIGIY_SUPABASE_ANON_KEY ||
      window.DIGIY_SUPABASE_ANON     ||
      window.SUPABASE_ANON_KEY       ||
      "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3";

    if (!window.supabase || !window.supabase.createClient) {
      console.warn("[DIGIY LOC GUARD] Supabase CDN absent.");
      return null;
    }

    client = window.supabase.createClient(url, anon, {
      auth: {
        persistSession:      false,
        autoRefreshToken:    false,
        detectSessionInUrl:  false
      },
      global: {
        headers: { "x-digiy-module": MODULE }
      }
    });

    return client;
  }

  // ─── RPC helpers ─────────────────────────────────────────────────────────────

  function boolFromRpcData(data) {
    const raw = Array.isArray(data) ? data[0] : data;
    if (raw === true || raw === 1) return true;
    if (typeof raw === "string") {
      const txt = raw.trim().toLowerCase();
      if (["true","t","1","yes","ok"].includes(txt)) return true;
      if (txt.startsWith("(")) {
        const first = txt.replace(/^\(/, "").split(",")[0];
        const token = String(first || "").trim().replace(/^"|"$/g, "").toLowerCase();
        if (["t","true","1"].includes(token)) return true;
      }
      return false;
    }
    if (raw && typeof raw === "object") {
      if (
        raw.ok === true || raw.access === true || raw.access_ok === true ||
        raw.has_access === true || raw.allowed === true || raw.active === true ||
        raw.is_active === true || raw.subscribed === true || raw.valid === true
      ) return true;
      if (Object.values(raw).some(v => v === true || v === 1 || v === "t" || v === "true")) return true;
    }
    return false;
  }

  async function tryRpc(name, payloads) {
    const sb = getSupabaseClient();
    if (!sb) return { ok: false, data: null, error: "Supabase non prêt" };

    for (const payload of payloads) {
      try {
        const { data, error } = await sb.rpc(name, payload);
        if (error) continue;
        return { ok: true, data, payload };
      } catch (_) {}
    }
    return { ok: false, data: null, error: "RPC non disponible" };
  }

  async function tryRpcBoolean(name, payloads) {
    const sb = getSupabaseClient();
    if (!sb) return false;

    for (const payload of payloads) {
      try {
        const { data, error } = await sb.rpc(name, payload);
        if (error) continue;
        if (boolFromRpcData(data)) return true;
      } catch (_) {}
    }
    return false;
  }

  // ─── Payloads d'accès ────────────────────────────────────────────────────────

  function buildAccessPayloads(phone) {
    const cleanPhone = normalizePhone(phone);
    const payloads = [];
    MODULE_ALIASES.forEach(moduleCode => {
      payloads.push({ p_phone: cleanPhone, p_module: moduleCode });
      payloads.push({ phone: cleanPhone,   module: moduleCode   });
      payloads.push({ input_phone: cleanPhone, input_module: moduleCode });
    });
    payloads.push({ p_phone: cleanPhone, p_module: MODULE_LOWER });
    payloads.push({ phone:   cleanPhone, module:   MODULE_LOWER });
    return payloads;
  }

  // ─── Vérification accès ──────────────────────────────────────────────────────

  async function checkAccessFromAbos(phone) {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return false;
    return tryRpcBoolean("digiy_has_module_access_from_abos", buildAccessPayloads(cleanPhone));
  }

  async function checkAccessLegacy(phone) {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return false;
    return tryRpcBoolean("digiy_has_access", buildAccessPayloads(cleanPhone));
  }

  async function checkAccess(phone) {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return false;
    // 1. Rail principal ABOS
    if (await checkAccessFromAbos(cleanPhone)) return true;
    // 2. Secours legacy
    if (await checkAccessLegacy(cleanPhone))   return true;
    return false;
  }

  // ─── Résolution slug ↔ phone ─────────────────────────────────────────────────

  async function resolvePhoneBySlug(slug) {
    const cleanSlug = normalizeSlug(slug);
    if (!cleanSlug) return null;

    const rpcRes = await tryRpc("digiy_loc_resolve_phone_by_slug", [
      { p_slug: cleanSlug },
      { slug: cleanSlug },
      { input_slug: cleanSlug }
    ]);
    if (rpcRes.ok && rpcRes.data) {
      if (typeof rpcRes.data === "string") return normalizePhone(rpcRes.data);
      if (rpcRes.data.phone)       return normalizePhone(rpcRes.data.phone);
      if (rpcRes.data.owner_phone) return normalizePhone(rpcRes.data.owner_phone);
    }

    // Fallback table directe
    const sb = getSupabaseClient();
    if (!sb) return null;

    for (const moduleCode of MODULE_ALIASES) {
      try {
        const { data, error } = await sb
          .from("digiy_subscriptions_public")
          .select("phone,slug,module")
          .eq("slug", cleanSlug)
          .eq("module", moduleCode)
          .limit(1);
        if (!error && Array.isArray(data) && data[0]?.phone)
          return normalizePhone(data[0].phone);
      } catch (_) {}
    }

    try {
      const { data, error } = await sb
        .from("digiy_subscriptions_public")
        .select("phone,slug,module")
        .eq("slug", cleanSlug)
        .limit(1);
      if (!error && Array.isArray(data) && data[0]?.phone)
        return normalizePhone(data[0].phone);
    } catch (_) {}

    return null;
  }

  async function resolveSlugByPhone(phone) {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return null;

    const sb = getSupabaseClient();
    if (!sb) return null;

    for (const moduleCode of MODULE_ALIASES) {
      try {
        const { data, error } = await sb
          .from("digiy_subscriptions_public")
          .select("phone,slug,module")
          .eq("phone", cleanPhone)
          .eq("module", moduleCode)
          .limit(1);
        if (!error && Array.isArray(data) && data[0]?.slug)
          return normalizeSlug(data[0].slug);
      } catch (_) {}
    }

    try {
      const { data, error } = await sb
        .from("digiy_subscriptions_public")
        .select("phone,slug,module")
        .eq("phone", cleanPhone)
        .limit(1);
      if (!error && Array.isArray(data) && data[0]?.slug)
        return normalizeSlug(data[0].slug);
    } catch (_) {}

    return null;
  }

  // ─── Lecture entrée (URL / localStorage) ─────────────────────────────────────

  function readUrlEntry() {
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        phone: normalizePhone(
          params.get("phone") || params.get("tel") ||
          params.get("owner_phone") || params.get("loc_phone") || ""
        ),
        slug: normalizeSlug(
          params.get("slug") || params.get("loc_slug") || ""
        )
      };
    } catch (_) {
      return { phone: "", slug: "" };
    }
  }

  function readStorageEntry() {
    try {
      const slug = normalizeSlug(
        sessionStorage.getItem("digiy_loc_slug") ||
        localStorage.getItem("digiy_loc_slug")   || ""
      );
      const phone = normalizePhone(
        sessionStorage.getItem("digiy_loc_phone") ||
        window.DIGIY_LOC_SESSION?.phone           || ""
      );
      return { phone, slug };
    } catch (_) {
      return { phone: "", slug: "" };
    }
  }

  async function absorbUrlSessionIfPossible() {
    const entry = readUrlEntry();
    if (!entry.phone && entry.slug) entry.phone = await resolvePhoneBySlug(entry.slug);
    if (entry.phone && !entry.slug) entry.slug  = await resolveSlugByPhone(entry.phone);
    if (!entry.phone) return null;
    const allowed = await checkAccess(entry.phone);
    if (!allowed) return null;
    return saveSession({
      phone: entry.phone,
      slug:  entry.slug || null,
      validated_at: now(),
      expires_at:   now() + SESSION_TTL_MS
    });
  }

  // ─── Normalisation réponse RPC verify_pin ────────────────────────────────────

  function normalizeVerifyPayload(payload, fallbackPhone) {
    let current = Array.isArray(payload) ? payload[0] : payload;

    if (typeof current === "string") {
      const txt = current.trim();
      if (txt.startsWith("(") && txt.endsWith(")")) {
        const parts = txt.slice(1, -1).split(",");
        const first = String(parts[0] || "").trim().toLowerCase();
        const phone = String(parts[2] || "").replace(/\D/g, "");
        if (["t","true","1"].includes(first))
          return { ok: true, phone: normalizePhone(phone || fallbackPhone) };
      }
      try { current = JSON.parse(txt); } catch (_) { return null; }
    }

    if (current === true)
      return { ok: true, phone: normalizePhone(fallbackPhone) };

    if (current && typeof current === "object") {
      if (
        current.ok === true || current.success === true || current.valid === true ||
        current.is_valid === true || current.allowed === true ||
        current.access === true || current.access_ok === true
      ) {
        return {
          ok: true,
          phone: normalizePhone(
            current.phone || current.p_phone || current.owner_phone || fallbackPhone
          ),
          slug: normalizeSlug(
            current.slug || current.loc_slug || current.owner_slug || ""
          )
        };
      }
      const vals = Object.values(current);
      if (vals.length >= 3) {
        const okLike = vals[0] === true || vals[0] === "t" || vals[0] === "true" || vals[0] === 1;
        if (okLike)
          return { ok: true, phone: normalizePhone(vals[2] || fallbackPhone), slug: "" };
      }
    }
    return null;
  }

  // ─── Vérification PIN ────────────────────────────────────────────────────────

  async function verifyPin(phone, pin) {
    const cleanPhone = normalizePhone(phone);
    const cleanPin   = String(pin || "").trim().replace(/\s+/g, "");

    if (!cleanPhone || !cleanPin)
      return { ok: false, message: "Téléphone ou code manquant." };

    // 1. RPC métier LOC (si elle existe)
    const locRes = await tryRpc("digiy_loc_verify_pin", [
      { p_phone: cleanPhone, p_pin: cleanPin },
      { phone: cleanPhone,   pin: cleanPin   },
      { input_phone: cleanPhone, input_pin: cleanPin }
    ]);
    let parsed = locRes.ok ? normalizeVerifyPayload(locRes.data, cleanPhone) : null;

    // 2. RPC générique avec tous les alias LOC
    if (!parsed?.ok) {
      const genericRes = await tryRpc("digiy_verify_pin", [
        { p_phone: cleanPhone, p_module: MODULE,       p_pin: cleanPin },
        { p_phone: cleanPhone, p_module: MODULE_LOWER, p_pin: cleanPin },
        ...MODULE_ALIASES.map(a => ({ p_phone: cleanPhone, p_module: a, p_pin: cleanPin }))
      ]);
      parsed = genericRes.ok ? normalizeVerifyPayload(genericRes.data, cleanPhone) : null;
    }

    if (!parsed?.ok)
      return { ok: false, message: "Code incorrect ou accès Je loue non actif." };

    const finalPhone = normalizePhone(parsed.phone || cleanPhone);
    let slug = normalizeSlug(parsed.slug || "");
    if (!slug) slug = await resolveSlugByPhone(finalPhone);

    // Vérification abonnement LOC
    const accessOk = await checkAccess(finalPhone);
    if (!accessOk)
      return { ok: false, message: "Abonnement LOC / Je loue inactif." };

    const session = saveSession({
      phone: finalPhone,
      slug,
      role:         "owner",
      validated_at: now(),
      expires_at:   now() + SESSION_TTL_MS
    });

    cleanSensitiveUrl();
    return { ok: true, session };
  }

  // loginWithPin : entrée par slug (lien pro) → résout le phone puis vérifie le PIN
  async function loginWithPin(slug, pin) {
    const cleanSlug = normalizeSlug(slug);
    const cleanPin  = String(pin || "").trim().replace(/\s+/g, "");

    if (!cleanSlug) return { ok: false, message: "Identifiant manquant." };
    if (!cleanPin)  return { ok: false, message: "Code manquant." };

    const phone = await resolvePhoneBySlug(cleanSlug);
    if (!phone) return { ok: false, message: "Identifiant LOC introuvable. Vérifie ton lien pro." };

    return verifyPin(phone, cleanPin);
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────

  async function boot() {
    setPageState("loading");
    cleanSensitiveUrl();
    showPage(); // page toujours visible — on ne cache jamais

    // 1. Session fraîche en cache local
    const stored = getStoredSession();
    if (stored) {
      currentSession = stored;
      cleanSensitiveUrl();
      setPageState("ready");
      return { ok: true, session: stored, source: "storage" };
    }

    // 2. Session transmise par URL (cas lien direct)
    const absorbed = await absorbUrlSessionIfPossible();
    if (absorbed) {
      cleanSensitiveUrl();
      setPageState("ready");
      return { ok: true, session: absorbed, source: "url" };
    }

    // 3. Identité locale connue → re-vérifier l'accès ABOS
    const fallback = readStorageEntry();
    if (fallback.phone) {
      const allowed = await checkAccess(fallback.phone);
      if (allowed) {
        const session = saveSession({
          phone:        fallback.phone,
          slug:         fallback.slug || null,
          validated_at: now(),
          expires_at:   now() + SESSION_TTL_MS
        });
        cleanSensitiveUrl();
        setPageState("ready");
        return { ok: true, session, source: "local_identity" };
      }
    }

    // Aucune session valide → verrouillé
    setPageState("locked");
    return { ok: false, session: null, message: "Accès LOC non ouvert." };
  }

  function ready() {
    if (!bootPromise) bootPromise = boot();
    return bootPromise;
  }

  async function requireSession(options = {}) {
    const result = await ready();
    if (result.ok && result.session) return result.session;
    if (options.redirect !== false) {
      window.location.href = options.to || SAFE_HOME;
      return null;
    }
    return null;
  }

  function getSession() {
    if (currentSession && isSessionFresh(currentSession)) return currentSession;
    const stored = getStoredSession();
    if (stored) { currentSession = stored; return stored; }
    return null;
  }

  function logout(to = SAFE_HOME) {
    clearSession();
    window.location.href = to;
  }

  // ─── Export public ───────────────────────────────────────────────────────────

  window.DIGIY_GUARD = {
    VERSION:    "loc-guard-pin8h-abos-20260530",
    module:     MODULE,
    publicName: "Je loue",

    ready,
    requireSession,
    getSession,

    verifyPin,
    loginWithPin,

    checkAccess,
    checkAccessFromAbos,
    checkAccessLegacy,

    resolvePhoneBySlug,
    resolveSlugByPhone,

    logout,
    cleanSensitiveUrl,

    getSb() { return getSupabaseClient(); }
  };

  // Démarrage dès le DOM prêt
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { ready(); }, { once: true });
  } else {
    ready();
  }

  console.info("[DIGIY LOC] guard PIN 8h + ABOS actif", "loc-guard-pin8h-abos-20260530");
})();

