// background.js - Single Source of Truth for settings

if (typeof importScripts === "function") {
  importScripts("shared-utils.js");
}

const sharedUtils = globalThis.AetherShared;
if (!sharedUtils) {
  throw new Error("Aether: shared utilities failed to load in background context.");
}

const {
  sanitizeBackgroundUrl: sharedSanitizeBackgroundUrl,
  sanitizeBackgroundBlur: sharedSanitizeBackgroundBlur,
  sanitizeBackgroundScaling,
} = sharedUtils;

const getExtensionUrl = (path) => (chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "");
const EXTENSION_BASE_URL = getExtensionUrl("");
const sanitizeBackgroundUrl = (url) => sharedSanitizeBackgroundUrl(url, EXTENSION_BASE_URL);
const sanitizeBackgroundBlur = (rawValue) =>
  sharedSanitizeBackgroundBlur(rawValue, {
    min: 0,
    max: 150,
    fallback: 60,
  });

const DEFAULTS = {
  theme: "auto",
  appearance: "dimmed",
  hideGpt5Limit: false,
  hideUpgradeButtons: false,
  disableAnimations: false,
  disableBgAnimation: false,

  customBgUrl: "__jet__",
  backgroundBlur: "60",
  backgroundScaling: "cover",
  hideGptsButton: false,
  hideSoraButton: false,
  hideTodaysPulse: false,
  hideShoppingButton: true,
  hasSeenWelcomeScreen: false,
  blurChatHistory: false,
  accentColor: "none",
};

const sanitizeSettingsPayload = (rawSettings) => {
  const merged = { ...DEFAULTS, ...rawSettings };
  const sanitized = { ...merged };
  sanitized.customBgUrl = sanitizeBackgroundUrl(merged.customBgUrl || "");
  sanitized.backgroundBlur = sanitizeBackgroundBlur(merged.backgroundBlur);
  sanitized.backgroundScaling = sanitizeBackgroundScaling(merged.backgroundScaling);

  const patch = {};
  if (sanitized.customBgUrl !== merged.customBgUrl) {
    patch.customBgUrl = sanitized.customBgUrl;
  }
  if (sanitized.backgroundBlur !== String(merged.backgroundBlur ?? "")) {
    patch.backgroundBlur = sanitized.backgroundBlur;
  }
  if (sanitized.backgroundScaling !== merged.backgroundScaling) {
    patch.backgroundScaling = sanitized.backgroundScaling;
  }

  return { sanitized, patch };
};

const persistSanitizedPatch = (patch) => {
  if (Object.keys(patch).length === 0) return;
  chrome.storage.sync.set(patch);
};

// --- Settings cache for instant responses ---
let settingsCache = null;
let localCache = {};

// Pre-cache settings on service worker startup
chrome.storage.sync.get(DEFAULTS, (result) => {
  if (chrome.runtime.lastError) {
    console.error("Aether: Failed to pre-cache settings:", chrome.runtime.lastError.message);
    settingsCache = { ...DEFAULTS };
    return;
  }
  const { sanitized, patch } = sanitizeSettingsPayload(result);
  settingsCache = sanitized;
  persistSanitizedPatch(patch);
});

chrome.storage.local.get(["detectedTheme"], (result) => {
  if (!chrome.runtime.lastError && result) {
    localCache = result;
  }
});

// Keep cache in sync with storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    if (!settingsCache) {
      settingsCache = { ...DEFAULTS };
    }
    const patch = {};
    for (const key in changes) {
      const rawValue = changes[key].newValue;
      let nextValue = rawValue;

      if (key === "customBgUrl") {
        nextValue = sanitizeBackgroundUrl(rawValue || "");
      } else if (key === "backgroundBlur") {
        nextValue = sanitizeBackgroundBlur(rawValue);
      } else if (key === "backgroundScaling") {
        nextValue = sanitizeBackgroundScaling(rawValue);
      }

      settingsCache[key] = nextValue;
      if (nextValue !== rawValue) {
        patch[key] = nextValue;
      }
    }
    persistSanitizedPatch(patch);
  }
  if (area === "local") {
    for (const key in changes) {
      if (changes[key].newValue === undefined) {
        delete localCache[key];
      } else {
        localCache[key] = changes[key].newValue;
      }
    }
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // This is a fresh installation.
    // Set the defaults directly, ignoring anything that might be in storage.
    chrome.storage.sync.set(DEFAULTS, () => {
      if (chrome.runtime.lastError) {
        console.error("Aether: Failed to set defaults on install:", chrome.runtime.lastError.message);
        return;
      }
      settingsCache = { ...DEFAULTS };
      console.log("Aether Extension: First install, defaults set.");
    });
  } else if (details.reason === "update") {
    // This is an update.
    // Merge existing settings with any new defaults that have been added.
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      if (chrome.runtime.lastError) {
        console.error("Aether: Failed to read settings on update:", chrome.runtime.lastError.message);
        return;
      }
      const { sanitized } = sanitizeSettingsPayload(settings);
      chrome.storage.sync.set(sanitized, () => {
        if (chrome.runtime.lastError) {
          console.error("Aether: Failed to write settings on update:", chrome.runtime.lastError.message);
          return;
        }
        settingsCache = { ...sanitized };
        console.log("Aether Extension: Updated, settings preserved and merged.");
      });
    });
  }
});

// Listen for requests from other parts of the extension (popup, content script).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_SETTINGS") {
    // Respond from cache if available (synchronous, zero-latency)
    if (settingsCache) {
      sendResponse({ ...settingsCache });
      return false; // Synchronous response
    }
    // Fallback to storage read if cache isn't ready yet
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      if (chrome.runtime.lastError) {
        console.error("Aether: Failed to read settings:", chrome.runtime.lastError.message);
        sendResponse(DEFAULTS);
        return;
      }
      const { sanitized, patch } = sanitizeSettingsPayload(settings);
      settingsCache = { ...sanitized };
      persistSanitizedPatch(patch);
      sendResponse(sanitized);
    });
    return true;
  }
  if (request.type === "GET_SETTINGS_FULL") {
    // Returns sync settings + local data in one call (for popup zero-latency load)
    const respond = (syncSettings) => {
      sendResponse({
        settings: syncSettings,
        defaults: DEFAULTS,
        local: { ...localCache },
      });
    };
    if (settingsCache) {
      respond({ ...settingsCache });
      return false;
    }
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      if (chrome.runtime.lastError) {
        console.error("Aether: Failed to read settings:", chrome.runtime.lastError.message);
        respond({ ...DEFAULTS });
        return;
      }
      const { sanitized, patch } = sanitizeSettingsPayload(settings);
      settingsCache = { ...sanitized };
      persistSanitizedPatch(patch);
      respond(sanitized);
    });
    return true;
  }
  if (request.type === "GET_DEFAULTS") {
    sendResponse(DEFAULTS);
    return false;
  }
  if (request.type === "OPEN_POPUP") {
    try {
      if (chrome.action?.openPopup) {
        chrome.action.openPopup().catch(() => {
          chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
        });
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
      }
    } catch (_err) {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    }
    return true;
  }
});
