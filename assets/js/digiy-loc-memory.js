/*
  DIGIYLYFE — Mémoire locale LOC
  Module : LOC / Je loue
  Rôle : garder brouillons, réservations, fermetures, prix, notes et session
  sans bloquer Supabase. Local robuste d'abord, Supabase ensuite.
*/
(function(){
  "use strict";

  const ROOT = "DIGIY_LOC_MEMORY_V1";
  const MODULE = "LOC";

  const LEGACY = {
    slug: ["digiy_loc_slug", "digiy_loc_last_slug", "LOC_LAST_SLUG", "loc_slug"],
    phone: ["digiy_loc_phone", "loc_phone", "LOC_PHONE", "owner_phone"],
    bookings: ["digiy_loc_bookings", "digiy_loc_reservations", "loc_bookings_cache"],
    closures: ["digiy_loc_closures", "digiy_loc_closed_days", "loc_closed_days"],
    prices: ["digiy_loc_prices", "loc_prices_cache"],
    notes: ["digiy_loc_notes", "digiy_loc_oreille_notes"],
    draft: ["digiy_loc_draft", "digiy_loc_booking_draft", "loc_prefiche_draft"]
  };

  function safeStorage(kind){
    try{
      const s = kind === "session" ? window.sessionStorage : window.localStorage;
      const k = ROOT + "_TEST";
      s.setItem(k, "1");
      s.removeItem(k);
      return s;
    }catch(_){ return null; }
  }

  const local = safeStorage("local");
  const session = safeStorage("session");

  function readRaw(key){
    try{ return (session && session.getItem(key)) || (local && local.getItem(key)) || ""; }
    catch(_){ return ""; }
  }

  function writeRaw(key, value, opts){
    const target = opts && opts.session ? session : local;
    if(!target) return false;
    try{ target.setItem(key, String(value ?? "")); return true; }
    catch(_){ return false; }
  }

  function removeRaw(key){
    try{ if(local) local.removeItem(key); }catch(_){}
    try{ if(session) session.removeItem(key); }catch(_){}
  }

  function readJson(key, fallback){
    const raw = readRaw(key);
    if(!raw) return fallback;
    try{ return JSON.parse(raw) ?? fallback; }catch(_){ return fallback; }
  }

  function writeJson(key, value, opts){
    try{ return writeRaw(key, JSON.stringify(value), opts); }
    catch(_){ return false; }
  }

  function normSlug(value){
    return String(value || "").trim().toLowerCase()
      .replace(/\s+/g,"-")
      .replace(/[^a-z0-9-]/g,"")
      .replace(/-+/g,"-")
      .replace(/^-|-$/g,"");
  }

  function normPhone(value){
    const digits = String(value || "").replace(/[^\d]/g,"");
    if(!digits) return "";
    if(digits.startsWith("221") && digits.length === 12) return digits;
    if(digits.length === 9) return "221" + digits;
    return digits.slice(0,15);
  }

  function ymd(value){
    if(!value) return "";
    const s = String(value).slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function first(keys){
    for(const key of keys){
      const value = readRaw(key);
      if(String(value || "").trim()) return String(value).trim();
    }
    return "";
  }

  function sessionHint(){
    let bridge = {};
    try{
      if(window.DIGIY_MODULE_BRIDGE && typeof window.DIGIY_MODULE_BRIDGE.readSession === "function"){
        bridge = window.DIGIY_MODULE_BRIDGE.readSession() || {};
      }else if(window.DIGIY_MODULE_BRIDGE && typeof window.DIGIY_MODULE_BRIDGE.getSession === "function"){
        bridge = window.DIGIY_MODULE_BRIDGE.getSession() || {};
      }
    }catch(_){}

    return {
      module: MODULE,
      slug: normSlug(bridge.slug || bridge.workspace_slug || first(LEGACY.slug)),
      phone: normPhone(bridge.phone || bridge.tel || first(LEGACY.phone))
    };
  }

  function rememberSession(data){
    const input = data || {};
    const slug = normSlug(input.slug || input.workspace_slug || "");
    const phone = normPhone(input.phone || input.tel || "");

    if(slug){
      writeRaw("digiy_loc_slug", slug);
      writeRaw("digiy_loc_last_slug", slug);
    }

    if(phone){
      writeRaw("digiy_loc_phone", phone);
      writeRaw("loc_phone", phone);
    }

    return sessionHint();
  }

  function loadDraft(){
    return readJson(ROOT + "_draft", null) || readJson("digiy_loc_draft", {});
  }

  function saveDraft(draft){
    const payload = { ...(draft || {}), updated_at: new Date().toISOString() };
    writeJson(ROOT + "_draft", payload);
    writeJson("digiy_loc_draft", payload);
    return payload;
  }

  function clearDraft(){
    removeRaw(ROOT + "_draft");
    removeRaw("digiy_loc_draft");
    removeRaw("digiy_loc_booking_draft");
    removeRaw("loc_prefiche_draft");
    return true;
  }

  function listBookings(){
    const modern = readJson(ROOT + "_bookings", null);
    if(Array.isArray(modern)) return modern;
    for(const key of LEGACY.bookings){
      const rows = readJson(key, null);
      if(Array.isArray(rows)) return rows;
    }
    return [];
  }

  function saveBookings(items){
    const arr = Array.isArray(items) ? items : [];
    writeJson(ROOT + "_bookings", arr.slice(-500));
    writeJson("digiy_loc_bookings", arr.slice(-500));
    return arr;
  }

  function upsertBooking(booking){
    const item = { id: booking?.id || booking?.booking_id || ("loc_booking_" + Date.now()), ...booking, local_saved_at: new Date().toISOString() };
    const arr = listBookings().filter(x => String(x?.id || x?.booking_id) !== String(item.id));
    arr.unshift(item);
    saveBookings(arr);
    return item;
  }

  function listClosures(){
    const modern = readJson(ROOT + "_closures", null);
    if(Array.isArray(modern)) return modern;
    for(const key of LEGACY.closures){
      const rows = readJson(key, null);
      if(Array.isArray(rows)) return rows;
    }
    return [];
  }

  function saveClosures(items){
    const arr = Array.isArray(items) ? items : [];
    writeJson(ROOT + "_closures", arr.slice(-1000));
    writeJson("digiy_loc_closures", arr.slice(-1000));
    return arr;
  }

  function addClosure(date, meta){
    const day = ymd(date);
    if(!day) return null;
    const item = { date: day, ...(meta || {}), created_at: new Date().toISOString() };
    const arr = listClosures().filter(x => ymd(x?.date || x?.day) !== day);
    arr.push(item);
    saveClosures(arr);
    return item;
  }

  function isClosedDate(date){
    const day = ymd(date);
    if(!day) return false;
    return listClosures().some(x => ymd(x?.date || x?.day) === day);
  }

  function prices(){
    const modern = readJson(ROOT + "_prices", null);
    if(Array.isArray(modern) || (modern && typeof modern === "object")) return modern;
    for(const key of LEGACY.prices){
      const rows = readJson(key, null);
      if(rows) return rows;
    }
    return [];
  }

  function savePrices(value){
    writeJson(ROOT + "_prices", value || []);
    writeJson("digiy_loc_prices", value || []);
    return value || [];
  }

  function notes(){
    const modern = readJson(ROOT + "_notes", null);
    if(Array.isArray(modern)) return modern;
    for(const key of LEGACY.notes){
      const rows = readJson(key, null);
      if(Array.isArray(rows)) return rows;
    }
    return [];
  }

  function addNote(text, meta){
    const note = { id:"loc_note_" + Date.now(), text:String(text || "").trim(), meta: meta || {}, created_at:new Date().toISOString() };
    if(!note.text) return null;
    const arr = notes();
    arr.unshift(note);
    writeJson(ROOT + "_notes", arr.slice(0,200));
    writeJson("digiy_loc_notes", arr.slice(0,200));
    return note;
  }

  function clearLocal(){
    [ROOT + "_draft", ROOT + "_bookings", ROOT + "_closures", ROOT + "_prices", ROOT + "_notes"].forEach(removeRaw);
    return true;
  }

  window.DIGIY_LOC_MEMORY = {
    version:"loc-memory-v1-20260521",
    sessionHint,
    rememberSession,
    loadDraft,
    saveDraft,
    clearDraft,
    listBookings,
    saveBookings,
    upsertBooking,
    listClosures,
    saveClosures,
    addClosure,
    isClosedDate,
    prices,
    savePrices,
    notes,
    addNote,
    clearLocal
  };
})();
