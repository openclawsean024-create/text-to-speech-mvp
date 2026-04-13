// ============================================================
// Lightweight i18n for TTS MVP — no dependencies, no bundler
// ============================================================
(function(global) {
  'use strict';

  const STORAGE_KEY = 'tts-lang';
  const DEFAULT_LANG = 'zh';

  // Embedded translations (populated by inline <script> in index.html)
  let translations = { zh: {}, en: {} };
  let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;

  // ── Public API ──────────────────────────────────────────────
  function t(key, params) {
    const val = translations[currentLang] && translations[currentLang][key];
    if (val === undefined) return key;
    if (typeof val !== 'string') return String(val);
    return interpolate(val, params);
  }

  function locale() { return currentLang; }

  function setLocale(lang, skipApply) {
    if (lang !== 'zh' && lang !== 'en') return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    if (!skipApply) applyI18n();
    // Dispatch event for components that need to react
    window.dispatchEvent(new CustomEvent('localeChanged', { detail: { lang } }));
  }

  // ── Interpolation ───────────────────────────────────────────
  function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, function(_, k) {
      return params[k] !== undefined ? params[k] : '{' + k + '}';
    });
  }

  // ── Apply translations to the DOM ───────────────────────────
  function applyI18n() {
    document.body.setAttribute('data-lang', currentLang);

    // Toggle inline i18n-zh / i18n-en spans
    document.querySelectorAll('[i18n-zh]').forEach(function(el) {
      el.style.display = currentLang === 'zh' ? '' : 'none';
    });
    document.querySelectorAll('[i18n-en]').forEach(function(el) {
      el.style.display = currentLang === 'en' ? '' : 'none';
    });

    // Toggle lang-zh / lang-en attributes on buttons (for button labels)
    document.querySelectorAll('[lang-zh]').forEach(function(el) {
      el.style.display = currentLang === 'zh' ? '' : 'none';
    });
    document.querySelectorAll('[lang-en]').forEach(function(el) {
      el.style.display = currentLang === 'en' ? '' : 'none';
    });

    // Update data-i18n elements (placeholder + text via translations object)
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var val = translations[currentLang] && translations[currentLang][key];
      if (val !== undefined) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // Fallback: always update #chunkPreview placeholder text directly
    // (covers case where refreshPreview() recreated innerHTML after applyI18n ran)
    var chunkPreviewInner = document.querySelector('#chunkPreview .chunk-preview-empty');
    if (chunkPreviewInner) {
      var noHistoryVal = translations[currentLang] && translations[currentLang]['noHistory'];
      if (noHistoryVal !== undefined) chunkPreviewInner.textContent = noHistoryVal;
    }

    // Update lang toggle buttons
    var btnEn = document.getElementById('langEn');
    var btnZh = document.getElementById('langZh');
    if (btnEn) btnEn.classList.toggle('active', currentLang === 'en');
    if (btnZh) btnZh.classList.toggle('active', currentLang === 'zh');

    // Re-apply dynamic texts that are not controlled by data-i18n
    applyDynamicTexts();
  }

  // ── Update dynamic / runtime strings ────────────────────────
  function applyDynamicTexts() {
    // Chunk preview placeholder — set data-i18n attr so applyI18n can find it next time
    var chunkPreview = document.getElementById('chunkPreview');
    if (chunkPreview) {
      var inner = chunkPreview.querySelector('.chunk-preview-empty');
      if (!inner) {
        inner = document.createElement('div');
        inner.className = 'chunk-preview-empty';
        chunkPreview.appendChild(inner);
      }
      inner.setAttribute('data-i18n', 'noHistory');
      inner.textContent = translations[currentLang] && translations[currentLang]['noHistory'] || '';
    }

    // History empty state — update the noHistory element directly
    var histList = document.getElementById('historyList');
    if (histList) {
      var noHistEl = histList.querySelector('[data-i18n="noHistory"]');
      if (noHistEl) {
        noHistEl.textContent = translations[currentLang] && translations[currentLang]['noHistory'] || '';
      }
    }

    // Refresh voice grid labels (names/langs are static in HTML, skip)
    // Refresh mode toggle status msg if visible
    // API key placeholder
    var apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput) {
      apiKeyInput.placeholder = t('engine.apiKeyPlaceholder');
    }

    // Engine notes
    updateEngineNotes();
  }

  function updateEngineNotes() {
    var notes = {
      openai:     t('engine.openai.note'),
      elevenlabs: t('engine.elevenlabs.note'),
      kokoro:     t('engine.kokoro.note'),
    };
    var engineVoicesText = document.getElementById('engineVoicesText');
    var engineVoicesNote = document.getElementById('engineVoicesNote');
    if (engineVoicesText) engineVoicesText.innerHTML = notes[currentEngine] || '';
    if (engineVoicesNote && currentMode === 'api') engineVoicesNote.style.display = 'block';
  }

  // ── Legacy helper exposed for inline onclick / setLang ────
  // Keep setLang as a global alias so existing onclick="setLang('en')" still works
  global.setLang = function(lang) { setLocale(lang); };

  // Expose i18n globally
  global.i18n = {
    t: t,
    locale: locale,
    setLocale: setLocale,
    load: function(zh, en) {
      translations.zh = zh;
      translations.en = en;
    }
  };

  // Expose currentLang globally so inline scripts can use translations[currentLang]
  Object.defineProperty(global, 'currentLang', {
    get: function() { return currentLang; },
    configurable: true
  });

  // Current engine/plan for updateEngineNotes
  var currentEngine = 'openai';
  var currentMode = 'browser';
  global.i18n.updateEngineContext = function(engine, mode) {
    currentEngine = engine || currentEngine;
    currentMode = mode || currentMode;
    updateEngineNotes();
  };

})(window);
