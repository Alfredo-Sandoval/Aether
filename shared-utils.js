// shared-utils.js - Shared pure utilities across extension contexts (background/content/popup)
(() => {
  const DEFAULT_BG_SPECIAL_KEYS = Object.freeze([
    "__gpt5_animated__",
    "__jet__",
    "__aurora__",
    "__sunset__",
    "__ocean__",
  ]);

  const clampInteger = (rawValue, { min = 0, max = 150, fallback = 0 } = {}) => {
    const parsed = Number.parseInt(rawValue ?? "", 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  const clampBackgroundBlur = (rawValue, { min = 0, max = 150, fallback = 60 } = {}) =>
    clampInteger(rawValue, { min, max, fallback });

  const sanitizeBackgroundBlur = (rawValue, { min = 0, max = 150, fallback = 60 } = {}) =>
    String(clampBackgroundBlur(rawValue, { min, max, fallback }));

  const clampContentWidth = (rawValue, { min = 70, max = 100, fallback = 95 } = {}) =>
    clampInteger(rawValue, { min, max, fallback });

  const sanitizeContentWidth = (rawValue, { min = 70, max = 100, fallback = 95 } = {}) =>
    String(clampContentWidth(rawValue, { min, max, fallback }));

  const sanitizeBackgroundScaling = (rawValue) => (rawValue === "contain" || rawValue === "cover" ? rawValue : "cover");

  const coerceBooleanLike = (rawValue, fallback = false) => {
    if (typeof rawValue === "boolean") return rawValue;
    if (typeof rawValue === "number") {
      if (rawValue === 1) return true;
      if (rawValue === 0) return false;
      return fallback;
    }
    if (typeof rawValue === "string") {
      const normalized = rawValue.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off", ""].includes(normalized)) return false;
      return fallback;
    }
    return fallback;
  };

  const isAllowedBackgroundUrl = (url, extensionBaseUrl = "", specialKeys = DEFAULT_BG_SPECIAL_KEYS) => {
    if (!url) return true;
    if (specialKeys.includes(url)) return true;
    if (url.startsWith("data:image/") || url.startsWith("data:video/")) return true;
    if (extensionBaseUrl && url.startsWith(extensionBaseUrl)) return true;
    return false;
  };

  const sanitizeBackgroundUrl = (url, extensionBaseUrl = "", specialKeys = DEFAULT_BG_SPECIAL_KEYS) =>
    isAllowedBackgroundUrl(url, extensionBaseUrl, specialKeys) ? url : "";

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const sharedApi = Object.freeze({
    DEFAULT_BG_SPECIAL_KEYS,
    clampInteger,
    clampBackgroundBlur,
    sanitizeBackgroundBlur,
    clampContentWidth,
    sanitizeContentWidth,
    sanitizeBackgroundScaling,
    coerceBooleanLike,
    isAllowedBackgroundUrl,
    sanitizeBackgroundUrl,
    escapeHtml,
  });

  globalThis.AetherShared = Object.freeze({
    ...(globalThis.AetherShared || {}),
    ...sharedApi,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalThis.AetherShared;
  }
})();
