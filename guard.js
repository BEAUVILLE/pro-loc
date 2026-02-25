// guard-pro.js — DIGIY PRO Gate (slug-first, via public view)
(() => {
  const SUPABASE_URL  = "https://XXXX.supabase.co";
  const SUPABASE_ANON = "XXXX_ANON_KEY";

  const MODULE_CODE = "LOC"; // change per module

  const qs = new URLSearchParams(location.search);
  const slug = (qs.get("slug") || "").trim();
  const phoneQ = (qs.get("phone") || "").trim();

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

  async function getPhoneFromSlug(slugValue) {
    const url =
      `${SUPABASE_URL}/rest/v1/digiy_subscriptions_public` +
      `?select=phone,module,slug` +
      `&slug=eq.${encodeURIComponent(slugValue)}` +
      `&module=eq.${encodeURIComponent(MODULE_CODE)}` +
      `&limit=1`;

    const r = await fetch(url, {
      headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` }
    });
    const j = await r.json().catch(() => ([]));
    if (!r.ok || !Array.isArray(j) || !j.length) return "";
    return (j[0].phone || "").trim();
  }

  function goABOS(phone) {
    const u = new URL("https://beauville.github.io/abos/");
    u.searchParams.set("module", MODULE_CODE);
    if (phone) u.searchParams.set("phone", phone);
    window.location.href = u.toString();
  }

  async function main() {
    let phone = phoneQ;

    if (!phone && slug) {
      phone = await getPhoneFromSlug(slug);
    }

    if (!phone) {
      goABOS("");
      return;
    }

    const res = await rpc("digiy_has_access", { p_phone: phone, p_module: MODULE_CODE });
    if (res.ok && res.data === true) return;

    goABOS(phone);
  }

  main();
})();
