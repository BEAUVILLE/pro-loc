/*
  DIGIY MODULE BRIDGE — pont commun modules
  Version terrain V1 — 2026-05-20

  But :
  - Unifier session / slug / téléphone masqué
  - Lire les données métier du module
  - Lire les réservations / demandes
  - Lire les disponibilités / fermetures quand le module en a
  - Produire un résumé commun pour app.html, today.html, planning.html, reservations.html, hub.html
  - Écrire des signaux locaux que toutes les pages du module peuvent relire

  Doctrine :
  Le module garde ses pages.
  Le pont donne la même vérité à toutes les pages.
*/

(function(){
  "use strict";

  if(window.DIGIY_MODULE_BRIDGE_READY) return;
  window.DIGIY_MODULE_BRIDGE_READY = true;

  const DEFAULT_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

  const DEFAULT_SENSITIVE_KEYS = [
    "phone",
    "tel",
    "p_phone",
    "owner_phone",
    "owner_id",
    "loc_phone",
    "business_phone",
    "whatsapp",
    "pin",
    "pin4",
    "token",
    "session_token",
    "client_phone"
  ];

  const STATE = {
    config: null,
    sb: null,
    lastLoad: null
  };

  function nowIso(){
    return new Date().toISOString();
  }

  function upper(value){
    return String(value || "").trim().toUpperCase();
  }

  function lower(value){
    return String(value || "").trim().toLowerCase();
  }

  function digits(value){
    return String(value || "").replace(/\D/g, "");
  }

  function normalizePhone(value){
    const raw = String(value || "").trim();
    if(!raw) return "";
    const d = digits(raw);
    if(!d) return "";
    return raw.startsWith("+") ? "+" + d : d;
  }

  function normalizeSlug(value){
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function isSensitiveSlug(slug){
    const s = normalizeSlug(slug);
    return /\d{7,}/.test(s);
  }

  function ymd(value){
    if(!value) return "";

    const s = String(value).trim().slice(0, 10);

    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
      return s;
    }

    const d = new Date(value);

    if(isNaN(d.getTime())){
      return "";
    }

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function todayYmd(){
    return ymd(new Date());
  }

  function addDays(dateString, days){
    const base = ymd(dateString || todayYmd());
    const d = new Date(base + "T00:00:00");
    d.setDate(d.getDate() + Number(days || 0));
    return ymd(d);
  }

  function dayNum(value){
    const s = ymd(value);

    if(!s) return NaN;

    const d = new Date(s + "T00:00:00");

    if(isNaN(d.getTime())) return NaN;

    return Math.floor(d.getTime() / 86400000);
  }

  function parseDateMs(value){
    if(!value) return 0;

    if(typeof value === "number" && Number.isFinite(value)){
      return value < 100000000000 ? value * 1000 : value;
    }

    const s = String(value).trim();

    if(!s) return 0;

    if(/^\d+$/.test(s)){
      const n = Number(s);
      return n < 100000000000 ? n * 1000 : n;
    }

    const t = Date.parse(s);

    return Number.isFinite(t) ? t : 0;
  }

  function isFresh(value, maxAgeMs){
    const t = parseDateMs(value);
    return !!t && Date.now() - t <= (maxAgeMs || DEFAULT_SESSION_MAX_AGE_MS);
  }

  function storageGet(key){
    try{
      const s = sessionStorage.getItem(key);
      if(s) return s;
    }catch(_){}

    try{
      const l = localStorage.getItem(key);
      if(l) return l;
    }catch(_){}

    return "";
  }

  function storageSet(key, value, sessionOnly){
    if(value == null || String(value).trim() === "") return;

    const v = String(value).trim();

    try{
      sessionStorage.setItem(key, v);
    }catch(_){}

    if(!sessionOnly){
      try{
        localStorage.setItem(key, v);
      }catch(_){}
    }
  }

  function parseJson(raw){
    try{
      return JSON.parse(raw);
    }catch(_){
      return null;
    }
  }

  function pick(obj, keys){
    if(!obj || typeof obj !== "object") return "";

    for(const key of keys){
      const v = obj[key];

      if(v != null && String(v).trim() !== ""){
        return String(v).trim();
      }
    }

    return "";
  }

  function readParam(name){
    try{
      const u = new URL(location.href);
      return String(u.searchParams.get(name) || "").trim();
    }catch(_){
      return "";
    }
  }

  function getGuardState(){
    try{
      return window.DIGIY_GUARD?.state || {};
    }catch(_){
      return {};
    }
  }

  function getGuardSession(){
    try{
      return window.DIGIY_GUARD?.getSession?.() || {};
    }catch(_){
      return {};
    }
  }

  function normalizeSessionCandidate(candidate, moduleName){
    if(!candidate || typeof candidate !== "object") return null;

    const sources = [
      candidate,
      candidate.session,
      candidate.state,
      candidate.data,
      candidate.payload,
      candidate.guard_state
    ].filter(Boolean);

    const out = {
      slug: "",
      phone: "",
      validated_at: "",
      module: moduleName,
      ok: false
    };

    for(const src of sources){
      if(!out.slug){
        out.slug = pick(src, [
          "slug",
          "last_slug",
          "place_slug",
          "workspace_slug",
          "room_slug",
          "pin_slug"
        ]);
      }

      if(!out.phone){
        out.phone = pick(src, [
          "phone",
          "owner_phone",
          "user_phone",
          "p_phone",
          "business_phone"
        ]);
      }

      if(!out.validated_at){
        out.validated_at = pick(src, [
          "validated_at",
          "validatedAt",
          "ts",
          "timestamp",
          "access_until",
          "expires_at"
        ]);
      }

      if(src.access === true || src.access_ok === true || src.ok === true || src.valid === true || src.authenticated === true){
        out.ok = true;
      }
    }

    out.slug = normalizeSlug(out.slug);
    out.phone = normalizePhone(out.phone);
    out.module = upper(out.module || moduleName);

    return out;
  }

  function readStoredSession(config){
    const moduleName = config.module;

    for(const key of config.sessionKeys){
      const parsed = parseJson(storageGet(key));
      const s = normalizeSessionCandidate(parsed, moduleName);

      if(s && (s.slug || s.phone || s.validated_at || s.ok)){
        return s;
      }
    }

    return normalizeSessionCandidate({}, moduleName) || {};
  }

  function getSession(config){
    const moduleName = config.module;

    const fromGuardState = normalizeSessionCandidate(getGuardState(), moduleName) || {};
    const fromGuardSession = normalizeSessionCandidate(getGuardSession(), moduleName) || {};
    const fromStorage = readStoredSession(config) || {};

    const querySlug = normalizeSlug(readParam("slug"));
    const queryPhone = normalizePhone(readParam("phone"));

    const slug =
      querySlug ||
      fromGuardState.slug ||
      fromGuardSession.slug ||
      fromStorage.slug ||
      firstStorage(config.slugKeys);

    const phone =
      queryPhone ||
      fromGuardState.phone ||
      fromGuardSession.phone ||
      fromStorage.phone ||
      firstStorage(config.phoneKeys);

    const validatedAt =
      fromGuardState.validated_at ||
      fromGuardSession.validated_at ||
      fromStorage.validated_at ||
      "";

    const access =
      !!(
        fromGuardState.ok ||
        fromGuardSession.ok ||
        fromStorage.ok ||
        (
          slug &&
          phone &&
          isFresh(validatedAt, config.sessionMaxAgeMs)
        )
      );

    return {
      module: moduleName,
      slug: normalizeSlug(slug),
      phone: normalizePhone(phone),
      validated_at: validatedAt,
      access,
      access_ok: access
    };
  }

  function firstStorage(keys){
    for(const key of keys || []){
      const v = storageGet(key);

      if(v) return String(v).trim();
    }

    return "";
  }

  function cleanVisibleUrl(config, slug){
    try{
      const u = new URL(location.href);
      let changed = false;

      config.sensitiveKeys.forEach(key => {
        if(u.searchParams.has(key)){
          u.searchParams.delete(key);
          changed = true;
        }
      });

      const currentSlug = normalizeSlug(u.searchParams.get("slug") || slug || "");

      if(currentSlug && isSensitiveSlug(currentSlug) && u.searchParams.has("slug")){
        u.searchParams.delete("slug");
        changed = true;
      }

      if(changed){
        history.replaceState({}, document.title, u.pathname + u.search + u.hash);
      }
    }catch(_){}
  }

  function persistSession(config, session){
    if(!session) return;

    if(session.slug){
      config.slugKeys.forEach(key => {
        storageSet(key, session.slug, isSensitiveSlug(session.slug));
      });
    }

    if(session.phone){
      config.phoneKeys.forEach(key => {
        storageSet(key, session.phone, true);
      });
    }
  }

  async function waitGuard(){
    try{
      const guard = window.DIGIY_GUARD;

      if(!guard) return {};

      if(typeof guard.ready === "function"){
        const out = guard.ready({
          redirect: false,
          preserve_validation: true,
          allow_soft_session: true
        });

        if(out && typeof out.then === "function"){
          await out;
        }
      }else if(guard.ready && typeof guard.ready.then === "function"){
        await guard.ready;
      }

      return getGuardSession() || getGuardState() || {};
    }catch(e){
      console.warn("[DIGIY BRIDGE] guard ignored:", e?.message || e);
      return {};
    }
  }

  function getSb(){
    if(STATE.sb?.rpc || STATE.sb?.from) return STATE.sb;

    try{
      if(window.DIGIY_GUARD?.getSb?.()){
        STATE.sb = window.DIGIY_GUARD.getSb();
        return STATE.sb;
      }
    }catch(_){}

    if(!window.supabase?.createClient){
      return null;
    }

    const url =
      window.DIGIY_SUPABASE_URL ||
      STATE.config?.supabaseUrl ||
      "";

    const key =
      window.DIGIY_SUPABASE_ANON ||
      window.DIGIY_SUPABASE_ANON_KEY ||
      STATE.config?.supabaseAnonKey ||
      "";

    if(!url || !key) return null;

    STATE.sb = window.supabase.createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    return STATE.sb;
  }

  async function rpcTry(names, args){
    const sb = getSb();
    if(!sb?.rpc) return null;

    for(const name of names || []){
      try{
        const { data, error } = await sb.rpc(name, args || {});

        if(!error && data != null){
          return data;
        }

        if(error){
          console.warn("[DIGIY BRIDGE] rpc ignored:", name, error.message || error);
        }
      }catch(e){
        console.warn("[DIGIY BRIDGE] rpc exception:", name, e?.message || e);
      }
    }

    return null;
  }

  function normalizeReservation(row){
    const checkin =
      ymd(row.checkin) ||
      ymd(row.date_in) ||
      ymd(row.start_date) ||
      ymd(row.arrival) ||
      "";

    const checkout =
      ymd(row.checkout) ||
      ymd(row.date_out) ||
      ymd(row.end_date) ||
      ymd(row.departure) ||
      "";

    return {
      id: String(row.id || row.reference || row.ref || Math.random()).trim(),
      module: upper(row.module || STATE.config?.module || ""),
      slug: normalizeSlug(row.slug || row.room_slug || row.pin_slug || row.place_slug || ""),
      room: String(row.room_name || row.nom || row.title || row.name || "Objet").trim(),
      client: String(row.client_name || row.client || row.name || "Client").trim(),
      phone: normalizePhone(row.phone || row.client_phone || ""),
      checkin,
      checkout,
      amount: Number(row.amount_total || row.amount || row.total || row.price || 0) || 0,
      status: lower(row.status || row.state || "confirmed"),
      payment_status: lower(row.payment_status || row.pay || "due"),
      source: lower(row.source || "digiy"),
      raw: row
    };
  }

  function normalizeAvailability(row){
    const date =
      ymd(row.date) ||
      ymd(row.day) ||
      ymd(row.date_day) ||
      ymd(row.availability_date) ||
      "";

    const status = lower(
      row.status ||
      row.state ||
      row.etat ||
      row.availability ||
      row.disponibilite ||
      ""
    );

    const closed =
      row.is_closed === true ||
      row.closed === true ||
      row.is_blocked === true ||
      row.blocked === true ||
      status.includes("closed") ||
      status.includes("ferme") ||
      status.includes("bloque") ||
      status.includes("blocked");

    const booked =
      row.is_booked === true ||
      row.booked === true ||
      row.is_reserved === true ||
      row.reserved === true ||
      row.is_occupied === true ||
      row.occupied === true ||
      status.includes("book") ||
      status.includes("occup") ||
      status.includes("reserve");

    const price =
      Number(
        row.price_night ||
        row.price_nuit ||
        row.price ||
        row.tarif ||
        row.amount ||
        0
      ) || 0;

    return {
      id: String(row.id || row.reference || date || Math.random()).trim(),
      module: upper(row.module || STATE.config?.module || ""),
      slug: normalizeSlug(row.slug || row.room_slug || row.pin_slug || row.place_slug || row.logement_slug || ""),
      date,
      closed,
      booked,
      price,
      status,
      note: String(row.note || row.label || row.comment || "").trim(),
      raw: row
    };
  }

  async function loadReservations(config, session){
    const slug = session.slug;

    if(!slug) return [];

    const data = await rpcTry(config.reservationRpcs, {
      p_slug: slug,
      slug: slug,
      p_module: config.module,
      module: config.module
    });

    let rows = [];

    if(Array.isArray(data)){
      rows = data;
    }else if(Array.isArray(data?.reservations)){
      rows = data.reservations;
    }else if(Array.isArray(data?.rows)){
      rows = data.rows;
    }else if(Array.isArray(data?.data)){
      rows = data.data;
    }

    return rows.map(normalizeReservation);
  }

  async function loadAvailability(config, session, range){
    const slug = session.slug;

    if(!slug) return [];

    const start = ymd(range?.start || addDays(todayYmd(), -2));
    const end = ymd(range?.end || addDays(todayYmd(), 30));

    let rows = [];

    const rpcData = await rpcTry(config.availabilityRpcs, {
      p_slug: slug,
      slug: slug,
      p_start: start,
      p_end: end,
      start,
      end,
      p_module: config.module,
      module: config.module
    });

    if(Array.isArray(rpcData)){
      rows = rpcData;
    }else if(Array.isArray(rpcData?.days)){
      rows = rpcData.days;
    }else if(Array.isArray(rpcData?.rows)){
      rows = rpcData.rows;
    }else if(Array.isArray(rpcData?.data)){
      rows = rpcData.data;
    }

    if(!rows.length){
      const sb = getSb();

      for(const tableCfg of config.availabilityTables || []){
        try{
          const table = tableCfg.table;
          const slugCol = tableCfg.slugCol || "slug";
          const dateCol = tableCfg.dateCol || "date";

          const { data, error } = await sb
            .from(table)
            .select("*")
            .eq(slugCol, slug)
            .gte(dateCol, start)
            .lte(dateCol, end);

          if(!error && Array.isArray(data)){
            rows = data;
            break;
          }

          if(error){
            console.warn("[DIGIY BRIDGE] availability table ignored:", table, error.message || error);
          }
        }catch(e){
          console.warn("[DIGIY BRIDGE] availability table exception:", e?.message || e);
        }
      }
    }

    return rows.map(normalizeAvailability).filter(r => r.date);
  }

  function isPending(resa){
    const s = lower(resa.status);
    return s.includes("pending") || s.includes("attente") || s.includes("wait") || s.includes("new");
  }

  function isCancelled(resa){
    const s = lower(resa.status);
    return s.includes("cancel") || s.includes("annul");
  }

  function isPaid(resa){
    const s = lower(resa.payment_status);
    return s === "paid" || s === "succeeded" || s === "confirmed" || s === "ok";
  }

  function makeSummary(payload){
    const today = payload.today || todayYmd();
    const reservations = payload.reservations || [];
    const availability = payload.availability || [];

    const activeReservations = reservations.filter(r => !isCancelled(r));

    const arrivalsToday = activeReservations.filter(r => r.checkin === today);
    const departuresToday = activeReservations.filter(r => r.checkout === today);
    const pending = activeReservations.filter(isPending);
    const due = activeReservations.filter(r => !isPaid(r));

    const closedToday = availability.filter(a => a.date === today && a.closed);
    const bookedToday = availability.filter(a => a.date === today && a.booked);

    const closedSoon = availability
      .filter(a => a.closed && a.date >= today && a.date <= addDays(today, 10))
      .sort((a,b) => a.date.localeCompare(b.date));

    const priceSpecials = availability
      .filter(a => a.price > 0 && a.date >= today && a.date <= addDays(today, 10))
      .sort((a,b) => a.date.localeCompare(b.date));

    return {
      module: payload.module,
      slug: payload.slug,
      today,
      counts: {
        reservations: activeReservations.length,
        arrivalsToday: arrivalsToday.length,
        departuresToday: departuresToday.length,
        pending: pending.length,
        due: due.length,
        closedToday: closedToday.length,
        bookedToday: bookedToday.length,
        closedSoon: closedSoon.length,
        priceSpecials: priceSpecials.length
      },
      arrivalsToday,
      departuresToday,
      pending,
      due,
      closedToday,
      bookedToday,
      closedSoon,
      priceSpecials
    };
  }

  function signalKey(config){
    return `DIGIY_${config.module}_PRO_SIGNALS`;
  }

  function readSignals(config){
    try{
      const raw = localStorage.getItem(signalKey(config)) || "[]";
      const rows = JSON.parse(raw);
      return Array.isArray(rows) ? rows : [];
    }catch(_){
      return [];
    }
  }

  function writeSignals(config, rows){
    try{
      localStorage.setItem(signalKey(config), JSON.stringify((rows || []).slice(-80)));
    }catch(_){}
  }

  function addSignal(config, signal){
    const rows = readSignals(config);

    const item = {
      id: signal.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      module: config.module,
      type: signal.type || "info",
      source: signal.source || "bridge",
      label: signal.label || signal.message || "Indication DIGIY",
      message: signal.message || signal.label || "Indication DIGIY",
      href: signal.href || "",
      slug: signal.slug || "",
      created_at: signal.created_at || nowIso()
    };

    const key = lower(`${item.type}:${item.source}:${item.label}:${item.href}`);

    const filtered = rows.filter(r => {
      const k = lower(`${r.type}:${r.source}:${r.label || r.message}:${r.href}`);
      return k !== key;
    });

    filtered.push(item);
    writeSignals(config, filtered);

    return item;
  }

  function syncSignalsFromSummary(config, summary){
    if(!summary) return [];

    const added = [];

    if(summary.counts.pending > 0){
      added.push(addSignal(config, {
        type: "pending",
        source: "reservations",
        label: `${summary.counts.pending} demande(s) à confirmer`,
        href: "./reservations.html"
      }));
    }

    if(summary.counts.due > 0){
      added.push(addSignal(config, {
        type: "payment",
        source: "reservations",
        label: `${summary.counts.due} paiement(s) à encaisser`,
        href: "./reservations.html"
      }));
    }

    if(summary.counts.closedToday > 0){
      added.push(addSignal(config, {
        type: "planning",
        source: "availability",
        label: `Fermeture active aujourd’hui`,
        href: "./planning.html"
      }));
    }

    if(summary.closedSoon && summary.closedSoon.length){
      const first = summary.closedSoon[0];

      added.push(addSignal(config, {
        type: "planning",
        source: "availability",
        label: `Fermeture prévue le ${first.date}`,
        href: "./planning.html"
      }));
    }

    return added;
  }

  function buildUrl(config, path, extra){
    let u;

    try{
      u = new URL(path, location.href);
    }catch(_){
      u = new URL("./", location.href);
    }

    config.sensitiveKeys.forEach(key => u.searchParams.delete(key));

    const session = getSession(config);

    if(session.slug && !isSensitiveSlug(session.slug)){
      u.searchParams.set("slug", session.slug);
    }else{
      u.searchParams.delete("slug");
    }

    Object.entries(extra || {}).forEach(([key, value]) => {
      if(value == null || String(value).trim() === "") return;
      if(config.sensitiveKeys.includes(key)) return;
      u.searchParams.set(key, String(value).trim());
    });

    return u.pathname + u.search + u.hash;
  }

  function defaultConfig(input){
    const moduleName = upper(input?.module || window.DIGIY_MODULE || "DIGIY");

    const lowerModule = moduleName.toLowerCase();

    return {
      module: moduleName,

      sessionMaxAgeMs: input?.sessionMaxAgeMs || DEFAULT_SESSION_MAX_AGE_MS,

      sensitiveKeys: input?.sensitiveKeys || DEFAULT_SENSITIVE_KEYS,

      sessionKeys: input?.sessionKeys || [
        `digiy_${lowerModule}_session`,
        `digiy_${lowerModule}_guard_session`,
        `DIGIY_${moduleName}_SESSION`,
        `DIGIY_${moduleName}_SESSION_V2`,
        `digiy_session_${lowerModule}`,
        `DIGIY_SESSION_${moduleName}`,
        "digiy_guard_session",
        "DIGIY_SESSION",
        "digiy_session"
      ],

      slugKeys: input?.slugKeys || [
        `digiy_${lowerModule}_last_slug`,
        `digiy_${lowerModule}_slug`,
        `DIGIY_${moduleName}_SLUG`,
        "digiy_last_slug",
        "DIGIY_SLUG"
      ],

      phoneKeys: input?.phoneKeys || [
        `digiy_${lowerModule}_phone`,
        `digiy_${lowerModule}_last_phone`,
        `DIGIY_${moduleName}_PHONE`,
        "digiy_phone",
        "DIGIY_PHONE"
      ],

      reservationRpcs: input?.reservationRpcs || [],

      availabilityRpcs: input?.availabilityRpcs || [],

      availabilityTables: input?.availabilityTables || [],

      supabaseUrl: input?.supabaseUrl || window.DIGIY_SUPABASE_URL || "",

      supabaseAnonKey: input?.supabaseAnonKey || window.DIGIY_SUPABASE_ANON || window.DIGIY_SUPABASE_ANON_KEY || ""
    };
  }

  async function init(input){
    const config = defaultConfig(input || {});
    STATE.config = config;

    await waitGuard();

    const session = getSession(config);

    persistSession(config, session);
    cleanVisibleUrl(config, session.slug);

    return {
      config,
      session,
      module: config.module,
      slug: session.slug,
      phone: session.phone,
      access: session.access
    };
  }

  async function load(input){
    const config = STATE.config || defaultConfig(input || {});
    STATE.config = config;

    await waitGuard();

    const session = getSession(config);

    persistSession(config, session);
    cleanVisibleUrl(config, session.slug);

    const today = todayYmd();

    const range = {
      start: input?.start || addDays(today, -2),
      end: input?.end || addDays(today, 30)
    };

    const [reservations, availability] = await Promise.all([
      loadReservations(config, session),
      loadAvailability(config, session, range)
    ]);

    const payload = {
      module: config.module,
      slug: session.slug,
      phone: session.phone,
      access: session.access,
      today,
      range,
      reservations,
      availability,
      signals: readSignals(config)
    };

    payload.summary = makeSummary(payload);
    payload.addedSignals = syncSignalsFromSummary(config, payload.summary);
    payload.signals = readSignals(config);

    STATE.lastLoad = payload;

    window.dispatchEvent(new CustomEvent("digiy:bridge:loaded", {
      detail: payload
    }));

    return payload;
  }

  window.DIGIY_BRIDGE = {
    init,
    load,
    getState: () => STATE.lastLoad,
    getSession: () => STATE.config ? getSession(STATE.config) : null,
    getSb,
    rpcTry,
    readSignals: () => STATE.config ? readSignals(STATE.config) : [],
    addSignal: (signal) => STATE.config ? addSignal(STATE.config, signal) : null,
    buildUrl: (path, extra) => STATE.config ? buildUrl(STATE.config, path, extra) : path,
    utils: {
      ymd,
      todayYmd,
      addDays,
      normalizeSlug,
      normalizePhone,
      isSensitiveSlug
    }
  };
})();
