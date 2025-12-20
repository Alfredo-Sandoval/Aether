// background.js - Single Source of Truth for settings

const DEFAULTS = {
  theme: "auto",
  appearance: "dimmed",
  hideGpt5Limit: false,
  hideUpgradeButtons: false,
  disableAnimations: false,
  disableBgAnimation: false,
  focusMode: false,
  customBgUrl: "__jet__",
  backgroundBlur: "60",
  backgroundScaling: "cover",
  hideGptsButton: false,
  hideSoraButton: false,
  hideTodaysPulse: false,
  hideShoppingButton: true,
  hasSeenWelcomeScreen: false,
  blurChatHistory: false,
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
