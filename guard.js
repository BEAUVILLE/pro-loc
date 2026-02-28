// guard-pro.js — DIGIY PRO access gate (slug-first) -> commencer-a-payer
(() => {
  "use strict";

  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  // ✅ À CHANGER PAR MODULE
  const MODULE_CODE = "LOC"; // ex: DRIVER, LOC, RESTO, POS, RESA, BUILD, EXPLORE, FRET_CHAUF, FRET_CLIENT

  const PAY_URL = "https://commencer-a-payer.digiylyfe.com/";

  const qs = new URLSearchParams(location.search);
  const slugQ  = (qs.get("slug")  || "").trim();
  const phoneQ = (qs.get("phone") || "").trim();

  function normPhone(p) {
    const d = String(p || "").replace(/[^\d]/g, "");
    return d.length >= 9 ? d : "";
  }

  function normSlug(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function rpc(name, params) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const j = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data: j };
  }

  async function resolvePhoneFromSlug(slug) {
    const s = normSlug(slug);
    if (!s) return "";

    // ✅ view publique minimaliste: phone + module + slug
    const url =
      `${SUPABASE_URL}/rest/v1/digiy_subscriptions_public` +
      `?select=phone,slug,module&slug=eq.${encodeURIComponent(s)}&limit=1`;

    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const arr = await r.json().catch(() => []);
    if (!r.ok || !Array.isArray(arr) || !arr[0]?.phone) return "";
    return String(arr[0].phone);
  }

  function goPay({ phone, slug }) {
    const u = new URL(PAY_URL);
    u.searchParams.set("module", MODULE_CODE);

    const p = normPhone(phone);
    const s = normSlug(slug);

    if (p) u.searchParams.set("phone", p);
    if (s) u.searchParams.set("slug", s);

    // ✅ return = page actuelle
    u.searchParams.set("return", location.href);

    location.replace(u.toString());
  }

  async function go() {
    const slug = normSlug(slugQ);
    let phone = normPhone(phoneQ);

    // slug-first : si pas de phone, on résout via slug
    if (!phone && slug) {
      phone = normPhone(await resolvePhoneFromSlug(slug));
    }

    // rien -> commencer-a-payer direct
    if (!phone) return goPay({ phone: "", slug });

    // check access (backend truth)
    const res = await rpc("digiy_has_access", { p_phone: phone, p_module: MODULE_CODE });

    // digiy_has_access renvoie boolean true/false
    if (res.ok && res.data === true) return; // ✅ accès OK

    // pas accès -> payer
    return goPay({ phone, slug });
  }

  go().catch(() => {
    // en cas de réseau down : on renvoie vers payer (safe)
    goPay({ phone: phoneQ, slug: slugQ });
  });
})();
