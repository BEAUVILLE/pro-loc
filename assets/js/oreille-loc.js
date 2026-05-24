/* ==========================================================================
   DIGIYLYFE — OREILLE LOC / JE LOUE V1
   Fichier : assets/js/oreille-loc.js
   Version : 2026-05-24 · demande + réservation + disponibilité + prix + message
   Dépendance : assets/js/oreille-metier-core.js

   Doctrine :
   L’Oreille écoute.
   DIGIY formule.
   Le propriétaire valide.
   LOC range.
   Aucune réservation, disponibilité, prix, acompte ou promesse client n’est confirmé automatiquement.
   ========================================================================== */

(function () {
  "use strict";

  var VERSION = "oreille-loc-v1-20260524";

  var LOC_GUIDE =
    "Bienvenue dans Oreille LOC DIGIYLYFE. Ici, le propriétaire peut parler ou cliquer pour préparer une demande de location, une réponse client, une disponibilité, un tarif, un acompte, une arrivée, un départ ou une note logement. LOC aide à préciser le client, le téléphone, le logement, les dates, le nombre de nuits, le prix proposé, l’acompte, le solde, le canal de paiement et le message WhatsApp. Mais LOC ne confirme jamais seule une réservation, une disponibilité, un prix, un paiement ou une promesse client. Le propriétaire vérifie, modifie et valide. L’Oreille prépare. DIGIY formule. Le propriétaire valide. LOC range. Le terrain garde la main.";

  var LOC_TEMPLATES = [
    "📩 Nouvelle demande logement — client · téléphone · dates · nombre de nuits · logement souhaité.",
    "🗓️ Disponibilité à vérifier — date d’arrivée · date de départ · logement · statut ouvert ou bloqué.",
    "💰 Prix à proposer — logement · dates · nuits · tarif · acompte · solde.",
    "🌊 Acompte Wave — montant · client · téléphone · logement · preuve à vérifier.",
    "📲 Message WhatsApp client — remercier · confirmer que la demande est reçue · préciser les infos manquantes.",
    "🏠 Arrivée client — nom · heure · logement · consignes · contact terrain.",
    "🚪 Départ client — nom · heure · état du logement · solde ou caution à vérifier.",
    "🧹 Note ménage / préparation — logement · date · tâche · personne chargée.",
    "⚠️ Brouillon LOC — garder la trace sans confirmer réservation, prix ou paiement."
  ];

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function core() {
    return window.DigiyOreilleMetier || null;
  }

  function normalize(value) {
    var c = core();
    if (c && c.normalizeText) return c.normalizeText(value);
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function lower(value) {
    return normalize(value).toLowerCase();
  }

  function extractPhone(text) {
    var clean = normalize(text);
    var explicit = clean.match(/(?:tel|tél|telephone|téléphone|phone|whatsapp|wa|numéro|numero)\s*[:\-]?\s*((?:\+?\d[\d\s().-]{6,}\d))/i);
    if (explicit && explicit[1]) return normalize(explicit[1]);
    var any = clean.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
    return any ? normalize(any[0]) : "";
  }

  function extractField(text, labels) {
    var clean = normalize(text);
    for (var i = 0; i < labels.length; i += 1) {
      var label = labels[i];
      var re = new RegExp(
        "(?:^|[\\s;,.|—-])" + label + "\\s*[:\\-]?\\s*([^;|\\n]+?)(?=\\s+(?:client|nom|tel|tél|telephone|téléphone|whatsapp|wa|logement|maison|villa|appartement|studio|chambre|arrivée|arrivee|départ|depart|date|nuits|nuit|prix|tarif|montant|acompte|solde|caution|paiement|wave|preuve|message|statut|ménage|menage|heure)\\s*[:\\-]|$)",
        "i"
      );
      var match = clean.match(re);
      if (match && match[1]) return normalize(match[1]);
    }
    return "";
  }

  function extractClientName(text) {
    var explicit = extractField(text, ["client", "nom", "personne"]);
    if (explicit) return explicit;
    var clean = normalize(text);
    var match = clean.match(/\b(?:client|pour|avec|madame|monsieur|m\.|mme)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]{1,45})/i);
    if (match && match[1]) {
      return normalize(match[1]).replace(/\b(?:tel|tél|telephone|téléphone|logement|date|arrivée|arrivee|départ|depart|prix|tarif|wave)\b.*$/i, "").trim();
    }
    return "";
  }

  function extractLodging(text) {
    var explicit = extractField(text, ["logement", "maison", "villa", "appartement", "studio", "chambre", "bien"]);
    if (explicit) return explicit;
    var clean = normalize(text);
    var match = clean.match(/\b(villa|maison|appartement|studio|chambre|logement)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s'.-]{0,50})/i);
    if (match) return normalize(match[0]).replace(/\b(?:date|prix|tarif|client|tel|wave)\b.*$/i, "").trim();
    return "";
  }

  function extractDateByLabel(text, labels) {
    return extractField(text, labels);
  }

  function extractDates(text) {
    var arrival = extractDateByLabel(text, ["arrivée", "arrivee", "date arrivée", "date arrivee", "checkin", "check-in"]);
    var departure = extractDateByLabel(text, ["départ", "depart", "date départ", "date depart", "checkout", "check-out"]);
    var clean = normalize(text);
    var range = clean.match(/\b(?:du|entre)\s+([^;,.]+?)\s+(?:au|jusqu(?:'|’)au|et)\s+([^;,.]+?)(?:\s|$)/i);
    if (range) {
      if (!arrival) arrival = normalize(range[1]);
      if (!departure) departure = normalize(range[2]);
    }
    var natural = clean.match(/\b(aujourd'hui|demain|après-demain|apres-demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/i);
    if (!arrival && natural) arrival = natural[1];
    return { arrival: arrival || "", departure: departure || "" };
  }

  function extractNights(text) {
    var explicit = extractField(text, ["nuits", "nuit", "nombre de nuits"]);
    if (explicit) return explicit;
    var match = normalize(text).match(/\b(\d{1,3})\s*(nuits?|jours?)\b/i);
    return match ? match[1] + " " + match[2] : "";
  }

  function extractMoneyByLabel(text, labels) {
    var explicit = extractField(text, labels);
    if (explicit) return explicit;
    return "";
  }

  function extractFirstMoney(text) {
    var match = normalize(text).match(/\b(\d[\d\s.,]*)\s*(fcfa|f\s*cfa|xof|cfa|€|eur|euro|euros|f)\b/i);
    if (match && match[1]) return normalize(match[1] + " " + (match[2] || ""));
    return "";
  }

  function extractPrice(text) {
    return extractMoneyByLabel(text, ["prix", "tarif", "montant", "total"]) || extractFirstMoney(text);
  }

  function extractDeposit(text) {
    return extractMoneyByLabel(text, ["acompte", "avance", "réservation", "reservation"]);
  }

  function extractBalance(text) {
    return extractMoneyByLabel(text, ["solde", "reste", "reste à payer", "reste a payer"]);
  }

  function extractPaymentMode(text) {
    var explicit = extractField(text, ["paiement", "mode", "mode paiement"]);
    if (explicit) return explicit;
    var t = lower(text);
    if (/wave|wav/.test(t)) return "Wave";
    if (/cash|espèce|espece|liquide/.test(t)) return "cash";
    if (/orange money|om\b/.test(t)) return "Orange Money";
    if (/virement|banque|carte|mobile money/.test(t)) return "autre";
    return "";
  }

  function guessIntent(text) {
    var t = lower(text);
    if (/acompte|avance|wave|paiement|payé|paye|reçu|recu|solde|caution/.test(t)) return "paiement à vérifier";
    if (/disponible|disponibilité|disponibilite|bloquer|fermer|ouvrir|planning|date/.test(t)) return "disponibilité à vérifier";
    if (/prix|tarif|montant|proposer|devis|nuits|nuit/.test(t)) return "prix à proposer";
    if (/arrivée|arrivee|check.?in/.test(t)) return "arrivée à préparer";
    if (/départ|depart|check.?out/.test(t)) return "départ à préparer";
    if (/ménage|menage|nettoyage|préparer|preparer/.test(t)) return "préparation logement";
    if (/whatsapp|message|répondre|repondre|sms/.test(t)) return "message client";
    if (/réservation|reservation|demande|client|louer|location/.test(t)) return "demande location";
    return "brouillon LOC";
  }

  function buildDraft(text) {
    var clean = normalize(text);
    var dates = extractDates(clean);
    return {
      module: "LOC",
      original: clean,
      intent: guessIntent(clean),
      client_name: extractClientName(clean),
      client_phone: extractPhone(clean),
      lodging: extractLodging(clean),
      arrival: dates.arrival,
      departure: dates.departure,
      nights: extractNights(clean),
      price: extractPrice(clean),
      deposit: extractDeposit(clean),
      balance: extractBalance(clean),
      payment_mode: extractPaymentMode(clean)
    };
  }

  function missingFields(draft) {
    var missing = [];
    if (!draft.client_name) missing.push("client");
    if (!draft.client_phone) missing.push("téléphone");
    if (!draft.lodging) missing.push("logement");
    if (!draft.arrival) missing.push("date d’arrivée");
    if (!draft.departure && /réservation|reservation|prix|tarif|nuits|nuit|départ|depart/.test(lower(draft.original))) missing.push("date de départ");
    if (!draft.price && /prix|tarif|montant|acompte|paiement|wave/.test(lower(draft.original))) missing.push("prix/montant");
    if (!draft.payment_mode && /paiement|payé|paye|acompte|wave|cash|solde/.test(lower(draft.original))) missing.push("mode de paiement");
    return missing;
  }

  function formatLine(label, value) {
    return value ? "\n- " + label + " : " + value : "";
  }

  function formulateLoc(text) {
    var clean = normalize(text);
    if (!clean) return "LOC · Note vide : préciser la demande logement avant validation.";

    var d = buildDraft(clean);
    var missing = missingFields(d);

    var out =
      "LOC · " + d.intent.toUpperCase() + "\n" +
      "Brouillon préparé à partir de : " + clean +
      formatLine("Client", d.client_name) +
      formatLine("Téléphone", d.client_phone) +
      formatLine("Logement", d.lodging) +
      formatLine("Arrivée", d.arrival) +
      formatLine("Départ", d.departure) +
      formatLine("Nuits", d.nights) +
      formatLine("Prix / montant", d.price) +
      formatLine("Acompte", d.deposit) +
      formatLine("Solde", d.balance) +
      formatLine("Paiement", d.payment_mode);

    if (missing.length) {
      out += "\nÀ compléter avant validation : " + missing.join(", ") + ".";
    }

    out += "\nÀ vérifier par le propriétaire avant envoi ou rangement. Aucune réservation, disponibilité, prix, acompte ou promesse client n’est confirmé automatiquement.";
    return out;
  }

  function buildSaveExtra(text) {
    var d = buildDraft(text);
    return {
      loc_draft: d,
      status: "draft",
      warning: "Brouillon LOC : validation humaine obligatoire avant réservation, prix, disponibilité ou paiement."
    };
  }

  ready(function () {
    var c = core();
    var target = document.querySelector("#digiy-oreille-loc") || document.querySelector("#digiy-oreille-metier") || document.querySelector("[data-digiy-oreille]");

    if (!c || !target) {
      console.warn("[DIGIY LOC] Core ou cible Oreille manquant.");
      return;
    }

    var instance = c.mount({
      module: "LOC",
      title: "Oreille LOC",
      subtitle: "Demande · dates · logement · prix · acompte · message client · note terrain.",
      storagePrefix: "DIGIY_OREILLE_METIER",
      target: target,
      guideText: LOC_GUIDE,
      templates: LOC_TEMPLATES,
      formulate: formulateLoc,
      buildSaveExtra: buildSaveExtra
    });

    window.DIGIY_OREILLE_LOC = {
      version: VERSION,
      instance: instance,
      buildDraft: buildDraft,
      formulate: formulateLoc,
      missingFields: missingFields
    };
  });
})();