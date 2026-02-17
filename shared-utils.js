// shared-utils.js - Shared pure utilities across extension contexts (background/content/popup)
(() => {
  const BACKGROUND_PRESET_DEFINITIONS = Object.freeze([
    Object.freeze({ id: "default", value: "" }),
    Object.freeze({ id: "auroraClassic", path: "Aether/aurora-classic.webp" }),
    Object.freeze({ id: "__gpt5_animated__", value: "__gpt5_animated__", isSpecial: true }),
    Object.freeze({ id: "jet", value: "__jet__", isSpecial: true }),
    Object.freeze({ id: "aurora", value: "__aurora__", isSpecial: true }),
    Object.freeze({ id: "sunset", value: "__sunset__", isSpecial: true }),
    Object.freeze({ id: "ocean", value: "__ocean__", isSpecial: true }),
    Object.freeze({ id: "grokHorizon", path: "Aether/grok-4.webp" }),
    Object.freeze({ id: "grokBlanco", path: "Aether/grok_blanco.webp" }),
    Object.freeze({ id: "grokDarko", path: "Aether/grok_darko.png" }),
    Object.freeze({ id: "grokCeleste", path: "Aether/grok_verde.png" }),
    Object.freeze({ id: "spaceBlueGalaxy", path: "Aether/blue-galaxy.webp" }),
    Object.freeze({ id: "spaceCosmicPurple", path: "Aether/cosmic-purple.webp" }),
    Object.freeze({ id: "spaceDeepNebula", path: "Aether/deep-space-nebula.webp" }),
    Object.freeze({ id: "spaceMilkyWay", path: "Aether/milky-way-galaxy.webp" }),
    Object.freeze({ id: "spaceMilkyWayBlue", path: "Aether/space-milkyway-blue-pexels.webp" }),
    Object.freeze({ id: "spaceMilkyWayRidge", path: "Aether/space-milkyway-ridge-pexels.webp" }),
    Object.freeze({ id: "spaceOrionNebula", path: "Aether/space-orion-nebula-nasa.webp" }),
    Object.freeze({ id: "spacePillarsCreation", path: "Aether/space-pillars-creation-jwst.webp" }),
    Object.freeze({ id: "spaceNebulaViolet", path: "Aether/space-purple-nebula-unsplash.webp" }),
    Object.freeze({ id: "spacePurpleStarsAlt", path: "Aether/space-purple-stars-pexels.webp" }),
    Object.freeze({ id: "spaceNebulaPurpleBlue", path: "Aether/nebula-purple-blue.webp" }),
    Object.freeze({ id: "spaceStarsPurple", path: "Aether/space-stars-purple.webp" }),
  ]);

  const DEFAULT_BG_SPECIAL_KEYS = Object.freeze(
    BACKGROUND_PRESET_DEFINITIONS.filter((preset) => preset.isSpecial).map((preset) => preset.value)
  );

  const getExtensionUrlResolver = (getExtensionUrl) => (typeof getExtensionUrl === "function" ? getExtensionUrl : () => "");

  const resolveBackgroundPresetId = (rawPresetId) => {
    if (rawPresetId === null || rawPresetId === undefined || rawPresetId === "") return "default";
    return String(rawPresetId);
  };

  const resolvePresetUrl = (preset, getExtensionUrl) => {
    if (typeof preset.path === "string") return getExtensionUrl(preset.path);
    return preset.value || "";
  };

  const buildBackgroundPresetLookup = (getExtensionUrl) => {
    const resolveExtensionUrl = getExtensionUrlResolver(getExtensionUrl);
    const presets = BACKGROUND_PRESET_DEFINITIONS.map((preset) =>
      Object.freeze({
        id: preset.id,
        url: resolvePresetUrl(preset, resolveExtensionUrl),
        isSpecial: !!preset.isSpecial,
      })
    );
    const presetById = new Map();
    const presetIdByUrl = new Map();

    presets.forEach((preset) => {
      presetById.set(preset.id, preset);
      if (!presetIdByUrl.has(preset.url)) {
        presetIdByUrl.set(preset.url, preset.id);
      }
    });

    return { presets, presetById, presetIdByUrl };
  };

  const getBackgroundPresets = (getExtensionUrl) => buildBackgroundPresetLookup(getExtensionUrl).presets;

  const getBackgroundPresetUrl = (presetId, getExtensionUrl) => {
    const canonicalPresetId = resolveBackgroundPresetId(presetId);
    const { presetById } = buildBackgroundPresetLookup(getExtensionUrl);
    return presetById.get(canonicalPresetId)?.url || "";
  };

  const resolveBackgroundPresetIdFromUrl = (url, getExtensionUrl) => {
    const normalizedUrl = String(url ?? "");
    const { presetIdByUrl } = buildBackgroundPresetLookup(getExtensionUrl);
    return presetIdByUrl.get(normalizedUrl) || null;
  };

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
    getBackgroundPresets,
    getBackgroundPresetUrl,
    resolveBackgroundPresetIdFromUrl,
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
