/* ==========================================================================
   DIGIYLYFE — OREILLE MÉTIER CORE
   Fichier : assets/js/oreille-metier-core.js
   Version : 2026-05-24 · core commun léger

   Doctrine :
   L’Oreille écoute.
   DIGIY formule.
   Le pro valide.
   Le logiciel range.
   Rien n’est confirmé automatiquement.
   ========================================================================== */

(function () {
  "use strict";

  var VERSION = "oreille-metier-core-20260524-loc";

  var DEFAULT_CONFIG = {
    module: "LOC",
    title: "Oreille Métier",
    subtitle: "Le pro parle ou clique. DIGIY formule. Le pro valide. Le logiciel range.",
    storagePrefix: "DIGIY_OREILLE_METIER",
    target: "#digiy-oreille-metier",
    guideText:
      "Bienvenue dans Oreille Métier DIGIYLYFE. Le professionnel peut parler, choisir une phrase prête, modifier le texte, copier vers WhatsApp ou ranger une note locale. L’Oreille ne décide jamais seule. Elle ne confirme pas un paiement, une réservation, un prix, une disponibilité, un stock, une course ou une promesse client. L’Oreille écoute. DIGIY formule. Le pro valide. Le logiciel range.",
    templates: [
      "Nouvelle demande client : nom, téléphone, date, besoin et détail à préciser.",
      "Message prêt : vérifier les informations avant de copier ou envoyer.",
      "Note brouillon : garder la trace sans confirmer automatiquement."
    ],
    formulate: null,
    buildSaveExtra: null
  };

  function assign(target) {
    target = target || {};
    for (var i = 1; i < arguments.length; i += 1) {
      var source = arguments[i] || {};
      Object.keys(source).forEach(function (key) {
        target[key] = source[key];
      });
    }
    return target;
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function nowLabel() {
    try {
      return new Date().toLocaleString("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_err) {
      return String(new Date());
    }
  }

  function storageKey(config) {
    var moduleName = String((config && config.module) || "LOC")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_");
    var prefix = String((config && config.storagePrefix) || DEFAULT_CONFIG.storagePrefix);
    return prefix + "_" + moduleName + "_NOTES_V1";
  }

  function safeJsonParse(raw, fallback) {
    try {
      var parsed = JSON.parse(raw);
      return parsed || fallback;
    } catch (_err) {
      return fallback;
    }
  }

  function getNotes(config) {
    var raw = "";
    try {
      raw = localStorage.getItem(storageKey(config)) || "";
    } catch (_err) {
      return [];
    }
    var parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function setNotes(config, notes) {
    try {
      localStorage.setItem(storageKey(config), JSON.stringify((notes || []).slice(0, 80)));
    } catch (_err) {}
  }

  function clearNotes(config) {
    try {
      localStorage.removeItem(storageKey(config));
    } catch (_err) {}
  }

  function saveNote(config, text, extra) {
    var clean = normalizeText(text);
    if (!clean) return null;

    var notes = getNotes(config);
    var note = assign({
      id: "note_" + Date.now(),
      module: String((config && config.module) || "LOC").toUpperCase(),
      text: clean,
      date: nowLabel(),
      source: "oreille-metier",
      status: "draft"
    }, extra || {});

    notes.unshift(note);
    setNotes(config, notes);
    return note;
  }

  function createToast() {
    var existing = document.getElementById("digiyOreilleToast");
    if (existing) return existing;

    var toast = document.createElement("div");
    toast.id = "digiyOreilleToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.style.position = "fixed";
    toast.style.left = "50%";
    toast.style.bottom = "20px";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    toast.style.background = "#062612";
    toast.style.color = "#f0fff5";
    toast.style.padding = "12px 16px";
    toast.style.borderRadius = "999px";
    toast.style.boxShadow = "0 16px 36px rgba(0,0,0,.25)";
    toast.style.fontWeight = "900";
    toast.style.opacity = "0";
    toast.style.pointerEvents = "none";
    toast.style.transition = ".2s ease";
    toast.style.zIndex = "99999";
    toast.style.maxWidth = "min(92vw,620px)";
    toast.style.textAlign = "center";
    document.body.appendChild(toast);
    return toast;
  }

  function showToast(message) {
    var toast = createToast();
    toast.textContent = message;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
    }, 2200);
  }

  function loadVoices(callback) {
    if (!("speechSynthesis" in window)) {
      callback([]);
      return;
    }
    var voices = window.speechSynthesis.getVoices();
    if (voices && voices.length) {
      callback(voices);
      return;
    }
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      voices = window.speechSynthesis.getVoices();
      if ((voices && voices.length) || tries > 12) {
        window.clearInterval(timer);
        callback(voices || []);
      }
    }, 120);
  }

  function speak(text, options) {
    if (!("speechSynthesis" in window)) {
      showToast("Lecture vocale non disponible ici");
      return false;
    }
    var clean = normalizeText(text);
    if (!clean) {
      showToast("Rien à lire");
      return false;
    }
    window.speechSynthesis.cancel();
    loadVoices(function (voices) {
      var utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = (options && options.lang) || "fr-FR";
      utterance.rate = (options && options.rate) || 0.86;
      utterance.pitch = (options && options.pitch) || 1.02;
      utterance.volume = (options && options.volume) || 1;
      var preferred = voices.find(function (v) {
        return /fr/i.test(v.lang || "") && /Google|Thomas|Daniel|Amelie|Audrey|Pauline/i.test(v.name || "");
      }) || voices.find(function (v) {
        return /fr/i.test(v.lang || "");
      }) || voices[0];
      if (preferred) utterance.voice = preferred;
      utterance.onstart = function () { showToast("DIGIY parle"); };
      utterance.onend = function () { showToast("Lecture terminée"); };
      utterance.onerror = function () { showToast("Lecture interrompue"); };
      window.speechSynthesis.speak(utterance);
    });
    return true;
  }

  function stopVoice() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      showToast("Lecture arrêtée");
      return true;
    }
    return false;
  }

  function canListen() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function listen(options) {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Micro non supporté ici");
      if (options && typeof options.onError === "function") options.onError(new Error("SpeechRecognition not supported"));
      return null;
    }

    stopVoice();
    var recognition = new SpeechRecognition();
    recognition.lang = (options && options.lang) || "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = false;
    var finalText = "";

    recognition.onstart = function () {
      showToast("Oreille ouverte");
      if (options && typeof options.onStart === "function") options.onStart();
    };

    recognition.onresult = function (event) {
      var interim = "";
      for (var i = event.resultIndex; i < event.results.length; i += 1) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript + " ";
        else interim += transcript;
      }
      var text = normalizeText(finalText + interim);
      if (options && typeof options.onText === "function") options.onText(text);
    };

    recognition.onerror = function (event) {
      showToast("Micro interrompu");
      if (options && typeof options.onError === "function") options.onError(event);
    };

    recognition.onend = function () {
      if (options && typeof options.onEnd === "function") options.onEnd(normalizeText(finalText));
    };

    recognition.start();
    return recognition;
  }

  async function copy(text) {
    var clean = normalizeText(text);
    if (!clean) {
      showToast("Rien à copier");
      return false;
    }

    try {
      await navigator.clipboard.writeText(clean);
      showToast("Copié");
      return true;
    } catch (_err) {
      var area = document.createElement("textarea");
      area.value = clean;
      area.setAttribute("readonly", "readonly");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.focus();
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (_copyErr) { ok = false; }
      document.body.removeChild(area);
      showToast(ok ? "Copie tentée" : "Copie impossible ici");
      return ok;
    }
  }

  function defaultFormulate(text, config) {
    var clean = normalizeText(text);
    var moduleName = String((config && config.module) || "LOC").toUpperCase();
    if (!clean) return moduleName + " · Note vide : préciser la demande avant validation.";
    return moduleName + " · Note métier : " + clean + " À vérifier, modifier et valider par le pro avant envoi ou rangement.";
  }

  function formulate(text, config) {
    if (config && typeof config.formulate === "function") {
      return config.formulate(text, config);
    }
    return defaultFormulate(text, config);
  }

  function injectStyles() {
    if (document.getElementById("digiyOreilleStyles")) return;
    var style = document.createElement("style");
    style.id = "digiyOreilleStyles";
    style.textContent =
      ".digiy-oreille-box{border:1px solid rgba(24,32,20,.14);border-radius:26px;padding:16px;background:#fff8e8;box-shadow:0 16px 34px rgba(0,0,0,.18);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#182014}" +
      ".digiy-oreille-box *{box-sizing:border-box}" +
      ".digiy-oreille-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}" +
      ".digiy-oreille-head strong{display:block;font-size:1.4rem;line-height:1.05;letter-spacing:-.04em}" +
      ".digiy-oreille-head span{display:block;margin-top:4px;color:#635b45;font-weight:850;line-height:1.35}" +
      ".digiy-oreille-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}" +
      ".digiy-oreille-actions button,.digiy-oreille-template{border:1px solid rgba(24,32,20,.12);border-radius:999px;padding:11px 14px;font-weight:950;cursor:pointer;background:#fff7df;color:#182014;box-shadow:0 8px 20px rgba(32,24,8,.08)}" +
      ".digiy-oreille-actions .primary{background:linear-gradient(135deg,#0f6b42,#134f38);color:#fff}" +
      ".digiy-oreille-actions .gold{background:linear-gradient(135deg,#f8dd80,#d6a63a);color:#2a2108}" +
      ".digiy-oreille-actions .dark{background:#11170f;color:#fff}" +
      ".digiy-oreille-status{border-radius:18px;background:#062612;color:#d8ffe8;padding:12px 14px;font-weight:900;line-height:1.35;margin:10px 0}" +
      ".digiy-oreille-text{width:100%;min-height:150px;resize:vertical;border-radius:20px;border:1px solid rgba(24,32,20,.14);padding:14px;font:inherit;font-weight:800;line-height:1.45;background:#fffdf5;color:#182014;outline:none}" +
      ".digiy-oreille-text:focus{border-color:rgba(15,107,66,.55);box-shadow:0 0 0 4px rgba(15,107,66,.09)}" +
      ".digiy-oreille-templates,.digiy-oreille-notes{display:grid;gap:9px;margin-top:10px}" +
      ".digiy-oreille-template{border-radius:18px;text-align:left;line-height:1.35;box-shadow:none;background:#fffdf4}" +
      ".digiy-oreille-template:hover{background:#fff4cc;border-color:rgba(214,166,58,.65)}" +
      ".digiy-oreille-note{border-radius:18px;padding:12px;background:#fffdf4;border:1px solid rgba(24,32,20,.14);font-weight:800;line-height:1.35}" +
      ".digiy-oreille-note b{display:block;margin-bottom:4px}" +
      ".digiy-oreille-note small{display:block;color:#635b45;font-weight:850;margin-top:7px}" +
      "@media(max-width:560px){.digiy-oreille-actions button{width:100%}.digiy-oreille-box{padding:13px;border-radius:22px}}";
    document.head.appendChild(style);
  }

  function renderNotes(container, config) {
    if (!container) return;
    var notes = getNotes(config);
    container.innerHTML = "";
    if (!notes.length) {
      var empty = document.createElement("div");
      empty.className = "digiy-oreille-note";
      empty.innerHTML = "<b>Aucune note rangée</b><span>Teste une phrase, puis clique sur Ranger.</span>";
      container.appendChild(empty);
      return;
    }
    notes.forEach(function (note) {
      var div = document.createElement("div");
      div.className = "digiy-oreille-note";
      div.innerHTML = "<b>" + escapeHtml(note.module || config.module || "LOC") + "</b><div>" + escapeHtml(note.text) + "</div><small>" + escapeHtml(note.date || "") + "</small>";
      container.appendChild(div);
    });
  }

  function mount(userConfig) {
    var config = assign({}, DEFAULT_CONFIG, userConfig || {});
    var target = typeof config.target === "string" ? document.querySelector(config.target) : config.target;
    if (!target) target = document.querySelector("#digiy-oreille-metier,[data-digiy-oreille]");
    if (!target) return null;

    injectStyles();
    target.innerHTML =
      '<section class="digiy-oreille-box" aria-label="' + escapeHtml(config.title) + '">' +
      '<div class="digiy-oreille-head"><div><strong>🎙️ ' + escapeHtml(config.title) + '</strong><span>' + escapeHtml(config.subtitle) + '</span></div></div>' +
      '<div class="digiy-oreille-actions">' +
      '<button type="button" class="primary" data-action="listen">🎙️ Parler</button>' +
      '<button type="button" class="gold" data-action="formulate">✨ Formuler</button>' +
      '<button type="button" data-action="copy">📋 Copier</button>' +
      '<button type="button" data-action="save">🗂️ Ranger</button>' +
      '<button type="button" data-action="guide">🎧 Guide</button>' +
      '<button type="button" class="dark" data-action="stop">⏹ Stop</button>' +
      '</div>' +
      '<div class="digiy-oreille-status" data-role="status">Oreille prête. Le pro parle ou clique, DIGIY formule.</div>' +
      '<textarea class="digiy-oreille-text" data-role="text" aria-label="Texte Oreille Métier">' + escapeHtml((config.templates && config.templates[0]) || "") + '</textarea>' +
      '<div class="digiy-oreille-templates" data-role="templates"></div>' +
      '<div class="digiy-oreille-notes" data-role="notes"></div>' +
      '</section>';

    var status = target.querySelector('[data-role="status"]');
    var textArea = target.querySelector('[data-role="text"]');
    var templatesBox = target.querySelector('[data-role="templates"]');
    var notesBox = target.querySelector('[data-role="notes"]');

    function setStatus(message) {
      if (status) status.textContent = message;
    }
    function refreshNotes() {
      renderNotes(notesBox, config);
    }

    (config.templates || []).forEach(function (template) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "digiy-oreille-template";
      btn.textContent = template;
      btn.addEventListener("click", function () {
        textArea.value = template;
        setStatus("Phrase prête chargée. Le pro peut modifier avant de copier ou ranger.");
      });
      templatesBox.appendChild(btn);
    });

    target.addEventListener("click", function (event) {
      var actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      var action = actionEl.getAttribute("data-action");

      if (action === "listen") {
        listen({
          onStart: function () { setStatus("Oreille ouverte. Parle naturellement, puis vérifie le texte."); },
          onText: function (txt) { textArea.value = txt; },
          onEnd: function () { setStatus("Parole captée. Clique sur Formuler pour préparer une note métier."); },
          onError: function () { setStatus("Micro indisponible ou interrompu. Utilise les phrases prêtes."); }
        });
      }

      if (action === "formulate") {
        textArea.value = formulate(textArea.value, config);
        setStatus("Texte formulé. Le pro doit relire, modifier et valider.");
        showToast("Formulé");
      }

      if (action === "copy") {
        copy(textArea.value).then(function () {
          setStatus("Texte copié. Tu peux le coller dans WhatsApp, SMS ou une fiche métier.");
        });
      }

      if (action === "save") {
        var extra = {};
        if (typeof config.buildSaveExtra === "function") {
          extra = config.buildSaveExtra(textArea.value, config) || {};
        }
        var saved = saveNote(config, textArea.value, extra);
        if (saved) {
          refreshNotes();
          setStatus("Note rangée localement. Le pro garde la main.");
          showToast("Note rangée");
        } else {
          showToast("Rien à ranger");
        }
      }

      if (action === "guide") speak(config.guideText);
      if (action === "stop") stopVoice();
    });

    refreshNotes();
    return { config: config, target: target, refreshNotes: refreshNotes, getText: function () { return textArea.value; }, setText: function (v) { textArea.value = normalizeText(v); } };
  }

  window.DigiyOreilleMetier = {
    version: VERSION,
    mount: mount,
    init: mount,
    speak: speak,
    stopVoice: stopVoice,
    listen: listen,
    canListen: canListen,
    copy: copy,
    normalizeText: normalizeText,
    escapeHtml: escapeHtml,
    formulate: formulate,
    saveNote: saveNote,
    getNotes: getNotes,
    setNotes: setNotes,
    clearNotes: clearNotes,
    showToast: showToast
  };

  if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = function () {};
})();