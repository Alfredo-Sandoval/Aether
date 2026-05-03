(() => {
  const LOCALE_MAP = {
    en: "en",
    "en-US": "en",
    es: "es",
    "es-ES": "es",
  };

  let translationsCache = {};
  let detectedLocale = null;
  const DEBUG =
    globalThis.AETHER_DEBUG_I18N === true ||
    (() => {
      try {
        return localStorage.getItem("AETHER_DEBUG_I18N") === "1";
      } catch (_) {
        return false;
      }
    })();
  const debugLog = (...args) => {
    if (DEBUG) {
      console.log(...args);
    }
  };

  const normalizeMessageCatalog = (rawMessages) => {
    const translations = {};
    for (const [key, value] of Object.entries(rawMessages || {})) {
      if (value && typeof value.message === "string") {
        translations[key] = value.message;
      }
    }
    return translations;
  };

  function detectChatGPTLanguage() {
    try {
      const htmlLang = document.documentElement.lang;
      if (htmlLang) {
        debugLog("Aether: Detected ChatGPT language from HTML lang:", htmlLang);
        return htmlLang;
      }

      // Keep this allowlist explicit; scanning all localStorage keys has stalled Brave profiles with large stores.
      const localStorageKeys = ["i18nextLng", "chatgpt-locale", "oai-locale", "language", "locale", "userLanguage"];

      for (const key of localStorageKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          debugLog(`Aether: Detected ChatGPT language from localStorage[${key}]:`, value);
          return value;
        }
      }

      const metaLang =
        document.querySelector('meta[http-equiv="content-language"]')?.content ||
        document.querySelector('meta[name="language"]')?.content;
      if (metaLang && metaLang !== "en") {
        debugLog("Aether: Detected ChatGPT language from meta:", metaLang);
        return metaLang;
      }

      const langButton =
        document.querySelector('[data-testid="language-selector"]') ||
        document.querySelector('[aria-label*="language"]') ||
        document.querySelector('[aria-label*="Language"]');
      if (langButton) {
        const buttonText = langButton.textContent || langButton.getAttribute("aria-label") || "";
        if (buttonText.includes("Español") || buttonText.includes("Spanish")) return "es";
      }
    } catch (e) {
      console.warn("Aether: Could not detect ChatGPT language:", e);
    }

    debugLog("Aether: No ChatGPT language detected, will use browser language");
    return null;
  }

  function getBrowserLanguage() {
    try {
      if (chrome?.i18n?.getUILanguage) {
        return chrome.i18n.getUILanguage();
      }
    } catch (e) {
      console.warn("Aether: Could not get browser language:", e);
    }
    return navigator.language || navigator.userLanguage || "en";
  }

  function normalizeLocale(locale) {
    if (!locale) return "en";

    if (LOCALE_MAP[locale]) {
      return LOCALE_MAP[locale];
    }

    const langCode = locale.split("-")[0];
    if (LOCALE_MAP[langCode]) {
      return LOCALE_MAP[langCode];
    }

    return "en";
  }

  async function loadTranslations(locale) {
    const normalizedLocale = normalizeLocale(locale);

    if (translationsCache[normalizedLocale]) {
      return translationsCache[normalizedLocale];
    }

    try {
      if (!chrome?.runtime?.getURL) {
        throw new Error("Aether: chrome.runtime.getURL is unavailable for i18n loading.");
      }

      // Read bundled locale JSON directly so Chrome i18n and custom in-page labels share one catalog.
      const messagesUrl = chrome.runtime.getURL(`_locales/${normalizedLocale}/messages.json`);
      const response = await fetch(messagesUrl);

      if (!response.ok) {
        console.warn(`Aether: Could not load translations for ${normalizedLocale}, falling back to English`);
        if (normalizedLocale !== "en") {
          return loadTranslations("en");
        }
        translationsCache.en = translationsCache.en || {};
        return translationsCache.en;
      }

      const translations = normalizeMessageCatalog(await response.json());

      translationsCache[normalizedLocale] = translations;
      debugLog(`Aether: Loaded translations for ${normalizedLocale}`);
      return translations;
    } catch (e) {
      console.error(`Aether: Error loading translations for ${normalizedLocale}:`, e);
      if (normalizedLocale !== "en") {
        return loadTranslations("en");
      }
      translationsCache.en = translationsCache.en || {};
      return translationsCache.en;
    }
  }

  function getMessage(key, substitutions) {
    if (detectedLocale && translationsCache[detectedLocale]) {
      const message = translationsCache[detectedLocale][key];
      if (message) {
        if (substitutions) {
          if (typeof substitutions === "string") {
            return message.replaceAll("$1", substitutions);
          } else if (Array.isArray(substitutions)) {
            let result = message;
            substitutions.forEach((sub, index) => {
              result = result.replaceAll(`$${index + 1}`, sub);
            });
            return result;
          }
        }
        return message;
      }
    }

    try {
      if (chrome?.i18n?.getMessage && chrome.runtime?.id) {
        const text = chrome.i18n.getMessage(key, substitutions);
        if (text) return text;
      }
    } catch (e) {
      console.warn("Aether: Chrome i18n fallback failed:", e);
    }

    if (translationsCache.en?.[key]) {
      const message = translationsCache.en[key];
      if (substitutions) {
        if (typeof substitutions === "string") {
          return message.replaceAll("$1", substitutions);
        }
        if (Array.isArray(substitutions)) {
          let result = message;
          substitutions.forEach((sub, index) => {
            result = result.replaceAll(`$${index + 1}`, sub);
          });
          return result;
        }
      }
      return message;
    }

    return key;
  }

  async function initializeI18n() {
    // ChatGPT often fills the html lang attribute during late hydration, so wait briefly before choosing a locale.
    if (document.readyState !== "complete") {
      await new Promise((resolve) => {
        if (document.readyState === "complete") {
          resolve();
        } else {
          window.addEventListener("load", resolve, { once: true });
          setTimeout(resolve, 1000);
        }
      });
    }

    let chatgptLang = detectChatGPTLanguage();
    const browserLang = getBrowserLanguage();

    if (!chatgptLang) {
      debugLog("Aether: No ChatGPT language detected, waiting 500ms and retrying...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      chatgptLang = detectChatGPTLanguage();
    }

    const preferredLang = chatgptLang || browserLang;
    detectedLocale = normalizeLocale(preferredLang);

    debugLog(
      `Aether: Language detection - ChatGPT: ${
        chatgptLang || "not detected"
      }, Browser: ${browserLang}, Using: ${detectedLocale}`
    );

    await loadTranslations(detectedLocale);

    if (detectedLocale !== "en") {
      await loadTranslations("en");
    }

    return detectedLocale;
  }

  async function recheckLanguage() {
    const newChatGPTLang = detectChatGPTLanguage();
    const newLocale = normalizeLocale(newChatGPTLang || getBrowserLanguage());

    if (newLocale !== detectedLocale) {
      debugLog(`Aether: Language changed from ${detectedLocale} to ${newLocale}`);
      detectedLocale = newLocale;
      await loadTranslations(detectedLocale);
      return true;
    }
    return false;
  }

  window.AetherI18n = {
    initialize: initializeI18n,
    getMessage: getMessage,
    getDetectedLocale: () => detectedLocale,
    detectChatGPTLanguage: detectChatGPTLanguage,
    recheckLanguage: recheckLanguage,
    getBrowserLanguage: getBrowserLanguage,
    debugLanguageDetection: () => {
      console.log("=== Aether Language Detection Debug ===");
      console.log("HTML lang attribute:", document.documentElement.lang);
      console.log("Browser language:", getBrowserLanguage());
      console.log("ChatGPT language:", detectChatGPTLanguage());
      console.log("Current detected locale:", detectedLocale);
      const languageStorageKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes("lang") || key.includes("locale") || key.includes("i18n"))) {
          languageStorageKeys.push(key);
        }
      }
      console.log("Language-related localStorage keys:", languageStorageKeys);
      console.log("=======================================");
    },
  };
})();
