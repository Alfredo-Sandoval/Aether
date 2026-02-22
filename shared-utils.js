// shared-utils.js - Shared pure utilities across extension contexts (background/content/popup)
(() => {
  const UI_BOUNDS = Object.freeze({
    MIN_BG_BLUR: 0,
    MAX_BG_BLUR: 150,
    MIN_CONTENT_WIDTH: 70,
    MAX_CONTENT_WIDTH: 100,
  });

  const BACKGROUND_KEYS = Object.freeze({
    JET_KEY: "__jet__",
    AURORA_KEY: "__aurora__",
    SUNSET_KEY: "__sunset__",
    OCEAN_KEY: "__ocean__",
    SUPER_STARS_KEY: "__super_stars__",
    LEGACY_GROK_SIGNUP_KEY: "__grok_signup__",
  });

  const BACKGROUND_ASSET_PATHS = Object.freeze({
    DEFAULT_BG: "Aether/blue-galaxy.webp",
    GROK_HORIZON: "Aether/grok-4.webp",
    GROK_BLANCO: "Aether/grok_blanco.webp",
    GROK_BLANCO_LEGACY: "Aether/grok_white.png",
    GROK_DARKO: "Aether/grok_darko.png",
    GROK_CELESTE: "Aether/grok_verde.png",
    AURORA_CLASSIC: "Aether/aurora-classic.webp",
    SPACE_BLUE_GALAXY: "Aether/blue-galaxy.webp",
    SPACE_COSMIC_PURPLE: "Aether/cosmic-purple.webp",
    SPACE_DEEP_NEBULA: "Aether/deep-space-nebula.webp",
    SPACE_MILKY_WAY: "Aether/milky-way-galaxy.webp",
    SPACE_NEBULA_PURPLE_BLUE: "Aether/nebula-purple-blue.webp",
    SPACE_STARS_PURPLE: "Aether/space-stars-purple.webp",
    SPACE_ORION_NEBULA: "Aether/space-orion-nebula-nasa.webp",
    SPACE_PILLARS_CREATION: "Aether/space-pillars-creation-jwst.webp",
    SPACE_MILKYWAY_BLUE: "Aether/space-milkyway-blue-pexels.webp",
    SPACE_MILKYWAY_RIDGE: "Aether/space-milkyway-ridge-pexels.webp",
    SPACE_PURPLE_NEBULA_UNSPLASH: "Aether/space-purple-nebula-unsplash.webp",
    SPACE_PURPLE_STARS_PEXELS: "Aether/space-purple-stars-pexels.webp",
  });

  const DEFAULT_BG_SPECIAL_KEYS = Object.freeze([
    "__gpt5_animated__",
    "__jet__",
    "__aurora__",
    "__sunset__",
    "__ocean__",
    "__super_stars__",
    "__grok_signup__",
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

  const resolveBackgroundAssets = (getExtensionUrl) => {
    if (typeof getExtensionUrl !== "function") {
      throw new TypeError("Aether: resolveBackgroundAssets requires a getExtensionUrl(path) function.");
    }
    return Object.freeze({
      DEFAULT_BG_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.DEFAULT_BG),
      GROK_HORIZON_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.GROK_HORIZON),
      GROK_BLANCO_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.GROK_BLANCO),
      GROK_BLANCO_LEGACY_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.GROK_BLANCO_LEGACY),
      GROK_DARKO_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.GROK_DARKO),
      GROK_CELESTE_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.GROK_CELESTE),
      AURORA_CLASSIC_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.AURORA_CLASSIC),
      SPACE_BLUE_GALAXY_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_BLUE_GALAXY),
      SPACE_COSMIC_PURPLE_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_COSMIC_PURPLE),
      SPACE_DEEP_NEBULA_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_DEEP_NEBULA),
      SPACE_MILKY_WAY_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_MILKY_WAY),
      SPACE_NEBULA_PURPLE_BLUE_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_NEBULA_PURPLE_BLUE),
      SPACE_STARS_PURPLE_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_STARS_PURPLE),
      SPACE_ORION_NEBULA_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_ORION_NEBULA),
      SPACE_PILLARS_CREATION_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_PILLARS_CREATION),
      SPACE_MILKYWAY_BLUE_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_MILKYWAY_BLUE),
      SPACE_MILKYWAY_RIDGE_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_MILKYWAY_RIDGE),
      SPACE_PURPLE_NEBULA_UNSPLASH_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_PURPLE_NEBULA_UNSPLASH),
      SPACE_PURPLE_STARS_PEXELS_URL: getExtensionUrl(BACKGROUND_ASSET_PATHS.SPACE_PURPLE_STARS_PEXELS),
    });
  };

  const createBackgroundPresetRegistry = (getExtensionUrl) => {
    const assets = resolveBackgroundAssets(getExtensionUrl);
    const { JET_KEY, AURORA_KEY, SUNSET_KEY, OCEAN_KEY, SUPER_STARS_KEY, LEGACY_GROK_SIGNUP_KEY } = BACKGROUND_KEYS;
    const {
      DEFAULT_BG_URL,
      GROK_HORIZON_URL,
      GROK_BLANCO_URL,
      GROK_BLANCO_LEGACY_URL,
      GROK_DARKO_URL,
      GROK_CELESTE_URL,
      AURORA_CLASSIC_URL,
      SPACE_BLUE_GALAXY_URL,
      SPACE_COSMIC_PURPLE_URL,
      SPACE_DEEP_NEBULA_URL,
      SPACE_MILKY_WAY_URL,
      SPACE_NEBULA_PURPLE_BLUE_URL,
      SPACE_STARS_PURPLE_URL,
      SPACE_ORION_NEBULA_URL,
      SPACE_PILLARS_CREATION_URL,
      SPACE_MILKYWAY_BLUE_URL,
      SPACE_MILKYWAY_RIDGE_URL,
      SPACE_PURPLE_NEBULA_UNSPLASH_URL,
      SPACE_PURPLE_STARS_PEXELS_URL,
    } = assets;

    const PRESET_TO_URL = new Map([
      ["default", ""],
      ["blue", DEFAULT_BG_URL],
      ["__gpt5_animated__", "__gpt5_animated__"],
      ["jet", JET_KEY],
      ["auroraClassic", AURORA_CLASSIC_URL],
      ["aurora", AURORA_KEY],
      ["sunset", SUNSET_KEY],
      ["ocean", OCEAN_KEY],
      ["superStars", SUPER_STARS_KEY],
      ["grokHorizon", GROK_HORIZON_URL],
      ["grokBlanco", GROK_BLANCO_URL],
      ["grokDarko", GROK_DARKO_URL],
      ["grokCeleste", GROK_CELESTE_URL],
      ["spaceBlueGalaxy", SPACE_BLUE_GALAXY_URL],
      ["spaceCosmicPurple", SPACE_COSMIC_PURPLE_URL],
      ["spaceDeepNebula", SPACE_DEEP_NEBULA_URL],
      ["spaceMilkyWay", SPACE_MILKY_WAY_URL],
      ["spaceMilkyWayBlue", SPACE_MILKYWAY_BLUE_URL],
      ["spaceMilkyWayRidge", SPACE_MILKYWAY_RIDGE_URL],
      ["spaceNebulaPurpleBlue", SPACE_NEBULA_PURPLE_BLUE_URL],
      ["spaceStarsPurple", SPACE_STARS_PURPLE_URL],
      ["spaceNebulaViolet", SPACE_PURPLE_NEBULA_UNSPLASH_URL],
      ["spacePurpleStarsAlt", SPACE_PURPLE_STARS_PEXELS_URL],
      ["spaceOrionNebula", SPACE_ORION_NEBULA_URL],
      ["spacePillarsCreation", SPACE_PILLARS_CREATION_URL],
    ]);

    const URL_TO_PRESET = new Map();
    for (const [preset, url] of PRESET_TO_URL) {
      URL_TO_PRESET.set(url, preset);
    }
    URL_TO_PRESET.set(GROK_BLANCO_LEGACY_URL, "grokBlanco");
    URL_TO_PRESET.set(LEGACY_GROK_SIGNUP_KEY, "superStars");

    return {
      ...assets,
      ...BACKGROUND_KEYS,
      PRESET_TO_URL,
      URL_TO_PRESET,
    };
  };

  const sharedApi = Object.freeze({
    UI_BOUNDS,
    BACKGROUND_KEYS,
    BACKGROUND_ASSET_PATHS,
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
    resolveBackgroundAssets,
    createBackgroundPresetRegistry,
  });

  globalThis.AetherShared = Object.freeze({
    ...(globalThis.AetherShared || {}),
    ...sharedApi,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalThis.AetherShared;
  }
})();
