// guard.js — DIGIY Universal Access Gate
(() => {
  const SUPABASE_URL  = "https://XXXX.supabase.co";
  const SUPABASE_ANON = "XXXX_ANON_KEY";

  // ⚠️ À fixer par module
  const MODULE_CODE = "LOC"; // ex: LOC / DRIVER / RESTO / POS

  const qs = new URLSearchParams(location.search);
  const phone = qs.get("phone") || "";

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

  async function go() {
    if (!phone) {
      // Pas de phone -> renvoie vers ABOS (l’utilisateur choisira)
      window.location.href = "https://beauville.github.io/abos/?module=" + encodeURIComponent(MODULE_CODE);
      return;
    }

    const res = await rpc("digiy_has_access", { p_phone: phone, p_module: MODULE_CODE });

    if (res.ok && res.data === true) return; // ✅ accès OK

    // ❌ pas d’accès -> ABOS
    window.location.href =
      "https://beauville.github.io/abos/?module=" + encodeURIComponent(MODULE_CODE) +
      "&phone=" + encodeURIComponent(phone);
  }

  go();
})();
