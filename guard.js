/* ============================================================
   DIGIYLYFE · LOC GUARD · MODE SECOURS STOP MOTEUR
   À poser dans : pro-loc/guard.js

   Rôle :
   - Stopper les blocages Supabase / ABOS / VPS sur LOC.
   - Ne jamais cacher la page.
   - Ne jamais rediriger automatiquement.
   - Laisser les boutons fonctionner.
   - Garder une API DIGIY_GUARD compatible pour les anciennes pages.
   ============================================================ */

(function () {
  "use strict";

  const MODULE = "LOC";
  const VERSION = "loc-guard-stop-moteur-20260522";
  const TTL_MS = 8 * 60 * 60 * 1000;

  function now() {
    return Date.now();
  }

  function sessionPayload(extra) {
    return {
      module: MODULE,
      access: true,
      access_ok: true,
      pin_session_ok: true,
      local_mode: true,
      stop_moteur: true,
      verified: true,
      verified_at: now(),
      validated_at: new Date().toISOString(),
      access_until: now() + TTL_MS,
      expires_at: now() + TTL_MS,
      version: VERSION,
      ...(extra || {})
    };
  }

  function safeJson(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function getStoredSession() {
    const keys = [
      "DIGIY_LOC_SESSION",
      "DIGIY_LOC_PIN_SESSION",
      "DIGIY_SESSION_LOC",
      "digiy_loc_session",
      "digiy_guard_session",
      "DIGIY_SESSION",
      "digiy_session",
      "DIGIY_ACCESS",
      "DIGIY_PIN_SESSION"
    ];

    for (const key of keys) {
      try {
        const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
        const obj = safeJson(raw);
        if (obj && typeof obj === "object") {
          return {
            ...sessionPayload(),
            ...obj,
            module: MODULE,
            access: true,
            access_ok: true,
            pin_session_ok: true,
            local_mode: true,
            stop_moteur: true
          };
        }
      } catch (_) {}
    }

    return sessionPayload();
  }

  function saveSession(payload) {
    const s = {
      ...sessionPayload(),
      ...(payload || {}),
      module: MODULE,
      access: true,
      access_ok: true,
      pin_session_ok: true,
      local_mode: true,
      stop_moteur: true
    };

    const body = JSON.stringify(s);

    [
      "DIGIY_LOC_SESSION",
      "DIGIY_LOC_PIN_SESSION",
      "DIGIY_SESSION_LOC",
      "digiy_loc_session",
      "DIGIY_ACCESS",
      "DIGIY_PIN_SESSION"
    ].forEach((key) => {
      try {
        sessionStorage.setItem(key, body);
      } catch (_) {}
    });

    return s;
  }

  function cleanVisibleUrl() {
    const sensitive = [
      "phone",
      "tel",
      "p_phone",
      "owner_phone",
      "owner_id",
      "slug",
      "loc_phone",
      "loc_tel",
      "business_phone",
      "whatsapp",
      "pin",
      "pin4",
      "token",
      "session_token",
      "module",
      "return",
      "redirect",
      "redirect_url",
      "url",
      "from"
    ];

    try {
      const url = new URL(location.href);
      let changed = false;

      sensitive.forEach((key) => {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      });

      if (changed) {
        history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      }
    } catch (_) {}
  }

  function showPage() {
    try {
      document.documentElement.style.visibility = "visible";
      document.documentElement.style.opacity = "1";

      if (document.body) {
        document.body.style.visibility = "visible";
        document.body.style.opacity = "1";
        document.body.removeAttribute("aria-hidden");
      }
    } catch (_) {}
  }

  async function ready() {
    cleanVisibleUrl();
    showPage();
    const s = saveSession(getStoredSession());
    window.DIGIY_LOC_SESSION = s;
    return s;
  }

  function getSession() {
    return getStoredSession();
  }

  function isAuthenticated() {
    return true;
  }

  function hasAccess() {
    return true;
  }

  async function checkAccess() {
    return true;
  }

  async function loginWithPin(phone, pin) {
    const s = saveSession({
      phone: String(phone || "").replace(/\D/g, ""),
      pin_ok: true,
      login_mode: "stop_moteur"
    });

    return {
      ok: true,
      access: true,
      access_ok: true,
      session: s
    };
  }

  function requireSession() {
    return true;
  }

  function logout(target) {
    [
      "DIGIY_LOC_SESSION",
      "DIGIY_LOC_PIN_SESSION",
      "DIGIY_SESSION_LOC",
      "digiy_loc_session",
      "DIGIY_ACCESS",
      "DIGIY_PIN_SESSION"
    ].forEach((key) => {
      try {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      } catch (_) {}
    });

    if (target) {
      location.href = target;
    }
  }

  function clearAll() {
    logout();
  }

  function getSb() {
    return null;
  }

  window.DIGIY_GUARD = {
    version: VERSION,
    module: MODULE,
    state: sessionPayload(),
    ready,
    getSession,
    isAuthenticated,
    hasAccess,
    checkAccess,
    loginWithPin,
    requireSession,
    logout,
    clearAll,
    getSb
  };

  cleanVisibleUrl();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showPage, { once: true });
  } else {
    showPage();
  }

  setTimeout(showPage, 300);
  setTimeout(showPage, 900);

  console.info("[DIGIY LOC] guard stop moteur actif", VERSION);
})();
