// background.js - Single Source of Truth for settings

const getExtensionUrl = (path) => (chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "");
const EXTENSION_BASE_URL = getExtensionUrl("");
const isAllowedBackgroundUrl = (url) => {
  if (!url) return true;
  if (
    url === "__gpt5_animated__" ||
    url === "__local__" ||
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

chrome.runtime.onInstalled.addListener((details) => {
  // --- NEW LOGIC ---
  if (details.reason === "install") {
    // This is a fresh installation.
    // Set the defaults directly, ignoring anything that might be in storage.
    chrome.storage.sync.set(DEFAULTS, () => {
      console.log("Aether Extension: First install, defaults set.");
    });
  } else if (details.reason === "update") {
    // This is an update.
    // Merge existing settings with any new defaults that have been added.
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      const sanitizedUrl = sanitizeBackgroundUrl(settings.customBgUrl || "");
      if (sanitizedUrl !== settings.customBgUrl) {
        settings.customBgUrl = sanitizedUrl;
      }
      chrome.storage.sync.set(settings, () => {
        console.log("Aether Extension: Updated, settings preserved and merged.");
      });
    });
  }
});

// Listen for requests from other parts of the extension (popup, content script).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_SETTINGS") {
    // Retrieve settings, applying defaults for any that are missing.
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      const sanitizedUrl = sanitizeBackgroundUrl(settings.customBgUrl || "");
      if (sanitizedUrl !== settings.customBgUrl) {
        settings.customBgUrl = sanitizedUrl;
        chrome.storage.sync.set({ customBgUrl: sanitizedUrl });
      }
      sendResponse(settings);
    });
    // Return true to indicate that the response will be sent asynchronously.
    return true;
  }
  if (request.type === "GET_DEFAULTS") {
    sendResponse(DEFAULTS);
    return true;
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
