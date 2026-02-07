// background.js - Single Source of Truth for settings

const getExtensionUrl = (path) => (chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "");
const EXTENSION_BASE_URL = getExtensionUrl("");
// [SYNC: isAllowedBackgroundUrl] — Keep in sync with content.js, popup.js
const isAllowedBackgroundUrl = (url) => {
  if (!url) return true;
  if (
    url === "__gpt5_animated__" ||
    url === "__jet__" ||
    url === "__aurora__" ||
    url === "__sunset__" ||
    url === "__ocean__"
  )
    return true;
  if (url.startsWith("data:image/") || url.startsWith("data:video/")) return true;
  if (EXTENSION_BASE_URL && url.startsWith(EXTENSION_BASE_URL)) return true;
  return false;
};
// [SYNC: sanitizeBackgroundUrl] — Keep in sync with content.js, popup.js
const sanitizeBackgroundUrl = (url) => (isAllowedBackgroundUrl(url) ? url : "");

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
  settingsCache = { ...DEFAULTS, ...result };
});

chrome.storage.local.get(["detectedTheme"], (result) => {
  if (!chrome.runtime.lastError && result) {
    localCache = result;
  }
});

// Keep cache in sync with storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && settingsCache) {
    for (const key in changes) {
      settingsCache[key] = changes[key].newValue;
    }
  }
  if (area === "local") {
    for (const key in changes) {
      localCache[key] = changes[key].newValue;
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
      const sanitizedUrl = sanitizeBackgroundUrl(settings.customBgUrl || "");
      if (sanitizedUrl !== settings.customBgUrl) {
        settings.customBgUrl = sanitizedUrl;
      }
      chrome.storage.sync.set(settings, () => {
        if (chrome.runtime.lastError) {
          console.error("Aether: Failed to write settings on update:", chrome.runtime.lastError.message);
          return;
        }
        settingsCache = { ...DEFAULTS, ...settings };
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
      const cached = { ...settingsCache };
      const sanitizedUrl = sanitizeBackgroundUrl(cached.customBgUrl || "");
      if (sanitizedUrl !== cached.customBgUrl) {
        cached.customBgUrl = sanitizedUrl;
        settingsCache.customBgUrl = sanitizedUrl;
        chrome.storage.sync.set({ customBgUrl: sanitizedUrl });
      }
      sendResponse(cached);
      return false; // Synchronous response
    }
    // Fallback to storage read if cache isn't ready yet
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      if (chrome.runtime.lastError) {
        console.error("Aether: Failed to read settings:", chrome.runtime.lastError.message);
        sendResponse(DEFAULTS);
        return;
      }
      const sanitizedUrl = sanitizeBackgroundUrl(settings.customBgUrl || "");
      if (sanitizedUrl !== settings.customBgUrl) {
        settings.customBgUrl = sanitizedUrl;
        chrome.storage.sync.set({ customBgUrl: sanitizedUrl });
      }
      settingsCache = { ...settings };
      sendResponse(settings);
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
      const cached = { ...settingsCache };
      const sanitizedUrl = sanitizeBackgroundUrl(cached.customBgUrl || "");
      if (sanitizedUrl !== cached.customBgUrl) {
        cached.customBgUrl = sanitizedUrl;
        settingsCache.customBgUrl = sanitizedUrl;
        chrome.storage.sync.set({ customBgUrl: sanitizedUrl });
      }
      respond(cached);
      return false;
    }
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      if (chrome.runtime.lastError) {
        console.error("Aether: Failed to read settings:", chrome.runtime.lastError.message);
        respond({ ...DEFAULTS });
        return;
      }
      settingsCache = { ...settings };
      respond(settings);
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
