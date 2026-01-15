// routes/loc-pulse-send.js
import express from "express";

const router = express.Router();

/**
 * ENV attendues:
 * - LOC_PULSE_API_KEY        (clé attendue côté API)
 * - DIGIY_ENV               (prod|staging|dev) optionnel
 *
 * NOTE: pas de Supabase ici si tu veux rester "send-only".
 * L'outbox (claim/status) = côté worker VPS avec SERVICE_ROLE.
 */

function getReqId(req) {
  return req.headers["x-request-id"] || cryptoRandomId();
}

function cryptoRandomId() {
  try {
    // node >= 16
    return globalThis.crypto?.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function requireApiKey(req) {
  const expected = process.env.LOC_PULSE_API_KEY || "";
  if (!expected) return { ok: false, code: 500, error: "LOC_PULSE_API_KEY missing on API" };

  const got = (req.headers["x-api-key"] || "").toString().trim();
  if (!got || got !== expected) return { ok: false, code: 401, error: "Invalid API key" };

  return { ok: true };
}

function normalizePhone(phone) {
  if (!phone) return "";
  let p = String(phone).trim();
  // Nettoyage basique
  p = p.replace(/\s+/g, "");
  // Optionnel: si tu veux forcer +221
  // if (!p.startsWith("+") && p.length === 9) p = "+221" + p;
  return p;
}

function validateBody(body) {
  const errors = [];
  const channel = (body?.channel || "").toString().trim(); // "whatsapp" | "sms"
  const phone = normalizePhone(body?.phone);
  const business_code = (body?.business_code || "").toString().trim();
  const pulse_kind = (body?.pulse_kind || "").toString().trim();
  const payload = body?.payload ?? {};

  if (!channel) errors.push("channel required");
  if (!["whatsapp", "sms"].includes(channel)) errors.push("channel must be whatsapp|sms");

  if (!phone) errors.push("phone required");
  if (!business_code) errors.push("business_code required");
  if (!pulse_kind) errors.push("pulse_kind required");

  // message: soit direct, soit dans payload.message
  const message =
    (body?.message || payload?.message || "").toString().trim();

  if (!message) errors.push("message required (body.message or payload.message)");

  // optionnels utiles
  const reservation_id = body?.reservation_id || payload?.reservation_id || null;
  const outbox_id = body?.outbox_id || payload?.outbox_id || null;

  return {
    ok: errors.length === 0,
    errors,
    clean: {
      channel,
      phone,
      business_code,
      pulse_kind,
      message,
      payload,
      reservation_id,
      outbox_id,
    },
  };
}

/**
 * POST /loc/pulse/send
 * Appelé par le worker VPS (loc-pulse) quand un outbox est claim.
 *
 * Body minimal:
 * {
 *   "channel":"whatsapp",
 *   "phone":"+22177...",
 *   "business_code":"SALY01",
 *   "pulse_kind":"J-1",
 *   "message":"Rappel ...",
 *   "payload":{...},
 *   "outbox_id":"uuid-optional",
 *   "reservation_id":"uuid-optional"
 * }
 */
router.post("/send", async (req, res) => {
  const rid = getReqId(req);

  // Auth API key
  const k = requireApiKey(req);
  if (!k.ok) {
    return res.status(k.code).json({ ok: false, request_id: rid, error: k.error });
  }

  // Validate
  const v = validateBody(req.body);
  if (!v.ok) {
    return res.status(400).json({
      ok: false,
      request_id: rid,
      error: "Invalid payload",
      details: v.errors,
    });
  }

  const { channel, phone, business_code, pulse_kind, message, payload, outbox_id, reservation_id } = v.clean;

  try {
    /**
     * Ici tu branches ton provider WhatsApp/SMS.
     * - WhatsApp: Meta Cloud API, Twilio, Gupshup, etc.
     * - SMS: Orange, Twilio, etc.
     *
     * Pour l’instant je mets un "stub" qui simule l’envoi.
     * Remplace sendWhatsApp/sendSMS par tes intégrations.
     */
    let provider_result = null;

    if (channel === "whatsapp") {
      provider_result = await sendWhatsApp({ phone, message, business_code, pulse_kind, payload });
    } else if (channel === "sms") {
      provider_result = await sendSMS({ phone, message, business_code, pulse_kind, payload });
    }

    return res.json({
      ok: true,
      request_id: rid,
      sent: true,
      channel,
      phone,
      business_code,
      pulse_kind,
      outbox_id: outbox_id || null,
      reservation_id: reservation_id || null,
      provider_result,
      env: process.env.DIGIY_ENV || "prod",
    });
  } catch (e) {
    console.error("[loc-pulse-send] error", rid, e);
    return res.status(502).json({
      ok: false,
      request_id: rid,
      error: e?.message || "Send failed",
    });
  }
});

/* ---------------------------
   PROVIDER STUBS (à remplacer)
--------------------------- */

async function sendWhatsApp({ phone, message }) {
  // TODO: intégration Meta/Twilio/etc
  // Ici on simule
  return {
    provider: "stub",
    to: phone,
    message_id: `wa_${Date.now()}`,
    status: "queued",
    preview: message.slice(0, 120),
  };
}

async function sendSMS({ phone, message }) {
  // TODO: intégration SMS provider
  return {
    provider: "stub",
    to: phone,
    message_id: `sms_${Date.now()}`,
    status: "queued",
    preview: message.slice(0, 120),
  };
}

export default router;

