/* global module */
// runtime-client.js - Shared extension runtime/settings messaging helpers
(() => {
  const getGlobal = () => {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    return {};
  };

  const root = getGlobal();

  const TRANSIENT_RUNTIME_ERROR_PATTERNS = Object.freeze([
    "no sw",
    "service worker",
    "extension context invalidated",
    "receiving end does not exist",
    "could not establish connection",
    "message port closed",
  ]);

  const normalizeErrorMessage = (value) => {
    if (value instanceof Error) return value.message || "";
    return String(value || "");
  };

  const isTransientRuntimeError = (value) => {
    const message = normalizeErrorMessage(value).toLowerCase();
    return TRANSIENT_RUNTIME_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
  };

  const hasRuntimeMessaging = () => Boolean(root.chrome?.runtime?.sendMessage);

  const sendRuntimeMessage = (payload) =>
    new Promise((resolve, reject) => {
      if (!hasRuntimeMessaging()) {
        reject(new Error("Runtime messaging is unavailable."));
        return;
      }

      root.chrome.runtime.sendMessage(payload, (response) => {
        if (root.chrome.runtime.lastError) {
          reject(new Error(root.chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });

  const updateSettings = async (patch, options = {}) => {
    const context =
      typeof options.context === "string" && options.context.trim() ? options.context.trim() : "settings update";
    const response = await sendRuntimeMessage({ type: "UPDATE_SETTINGS", patch });
    if (!response?.ok) {
      throw new Error(response?.error || `Failed to persist ${context}.`);
    }
    return response.settings || null;
  };

  const requestSettingsUpdate = (patch, options) => updateSettings(patch, options);

  const api = Object.freeze({
    TRANSIENT_RUNTIME_ERROR_PATTERNS,
    normalizeErrorMessage,
    isTransientRuntimeError,
    hasRuntimeMessaging,
    sendRuntimeMessage,
    updateSettings,
    requestSettingsUpdate,
  });

  root.AetherRuntimeClient = Object.freeze({
    ...(root.AetherRuntimeClient || {}),
    ...api,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.AetherRuntimeClient;
  }
})();
