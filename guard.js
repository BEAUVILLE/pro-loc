// guard-pro.js — PRO flow (slug-first) + fallback INSCRIPTION-PRO
(() => {
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const MODULE_CODE = "LOC";

  const qs = new URLSearchParams(location.search);
  const slug   = qs.get("slug")  || "";
  const phoneQ = qs.get("phone") || "";

  async function rpc(name, params) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: j };
  }

  async function resolvePhoneFromSlug(s) {
    const url = `${SUPABASE_URL}/rest/v1/digiy_subscriptions_public?select=phone,slug,module&slug=eq.${encodeURIComponent(s)}&limit=1`;
    const r = await fetch(url, {
      headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` }
    });
    const arr = await r.json().catch(() => []);
    if (!r.ok || !Array.isArray(arr) || !arr[0]?.phone) return "";
    return String(arr[0].phone);
  }

  function goInscription(phoneMaybe, slugMaybe){
    const u = new URL("https://inscription-pro.digiylyfe.com/");
    u.searchParams.set("module", MODULE_CODE);
    if(phoneMaybe) u.searchParams.set("phone", phoneMaybe);
    if(slugMaybe)  u.searchParams.set("slug", slugMaybe);
    location.replace(u.toString());
  }

  async function go() {
    let phone = phoneQ;

    if (!phone && slug) {
      phone = await resolvePhoneFromSlug(slug);
    }

    // rien -> inscription PRO
    if (!phone) return goInscription("", slug);

    // check access
    const res = await rpc("digiy_has_access", { p_phone: phone, p_module: MODULE_CODE });

    if (res.ok && res.data === true) return; // ✅ accès OK

    // ❌ pas accès -> inscription PRO
    return goInscription(phone, slug);
  }

  go();
})();
