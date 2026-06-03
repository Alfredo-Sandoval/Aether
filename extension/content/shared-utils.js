(() => {
  const ACCENT_COLOR_VALUES = Object.freeze(["none", "pink", "purple", "blue", "primary"]);
  const BACKGROUND_SCALING_VALUES = Object.freeze(["contain", "cover"]);
  const DEFAULT_BACKGROUND_PRESET_ID = "infraredNoir";
  const DEFAULT_BACKGROUND_BLUR = 42;
  const SETTING_BOUNDS = Object.freeze({
    backgroundBlur: Object.freeze({ min: 0, max: 150, fallback: DEFAULT_BACKGROUND_BLUR }),
    contentWidth: Object.freeze({ min: 70, max: 100, fallback: 95 }),
  });
  const PULSE_PHRASES = Object.freeze(["today's pulse", "todays pulse", "pulso de hoy"]);
  const PULSE_TOKEN_GROUPS = Object.freeze([
    Object.freeze(["today", "pulse"]),
    Object.freeze(["todays", "pulse"]),
    Object.freeze(["pulso", "hoy"]),
  ]);
  const SHOPPING_RESEARCH_PHRASES = Object.freeze(["shopping research"]);
  const SHOPPING_RESEARCH_TOKEN_GROUPS = Object.freeze([Object.freeze(["shopping", "research"])]);
  const UPGRADE_KEYWORD_PHRASES = Object.freeze(["upgrade", "actualizar", "mejorar"]);
  const UPGRADE_SHORT_LABELS = Object.freeze(["upgrade", "actualizar", "mejorar"]);
  const UPGRADE_CONTEXT_PHRASES = Object.freeze([
    "upgrade your plan",
    "actualiza tu plan",
    "mejora tu plan",
    "chatgpt plus",
    "chatgpt go",
  ]);
  const UPGRADE_SETTINGS_TITLE_PHRASES = Object.freeze([
    "get chatgpt plus",
    "get chatgpt go",
    "obten chatgpt plus",
    "obten chatgpt go",
  ]);
  const UPGRADE_ROUTE_HINTS = Object.freeze(["upgrade", "plus", "subscription", "billing"]);
  const RESEARCH_CARD_BANNER_TOKENS = Object.freeze(["research completed in", "citations", "searches"]);
  const RESEARCH_CARD_CONTENT_TOKENS = Object.freeze(["executive summary"]);
  const RESEARCH_FULLSCREEN_TOKENS = Object.freeze(["full screen", "fullscreen", "expand", "maximize"]);
  const RESEARCH_DIALOG_HINTS = Object.freeze([
    "deep research",
    "research report",
    "artifact viewer",
    "artifact-viewer",
  ]);
  const SETTINGS_SURFACE_HINTS = Object.freeze([
    "settings",
    "appearance",
    "personalization",
    "customize chatgpt",
    "preferences",
    "configuracion",
    "configuración",
    "personalizacion",
    "personalización",
    "apariencia",
    "preferencias",
  ]);
  const PROJECT_SURFACE_HINTS = Object.freeze([
    "project",
    "projects",
    "new project",
    "project settings",
    "proyecto",
    "proyectos",
    "nuevo proyecto",
  ]);
  const PROFILE_MENU_SURFACE_HINTS = Object.freeze([
    "my plan",
    "customize chatgpt",
    "log out",
    "logout",
    "sign out",
    "profile",
    "account",
    "mi plan",
    "cerrar sesion",
    "cerrar sesión",
    "perfil",
    "cuenta",
  ]);
  const MODEL_PICKER_SURFACE_HINTS = Object.freeze([
    "model",
    "models",
    "legacy models",
    "choose model",
    "select model",
    "switch model",
    "modelo",
    "modelos",
    "elige modelo",
    "selecciona modelo",
  ]);
  const CANVAS_ACTION_SETS = Object.freeze([
    Object.freeze(["copy", "edit", "download"]),
    Object.freeze(["copiar", "editar", "descargar"]),
  ]);
  const SURFACE_ROUTE_TARGET_DEFINITIONS = Object.freeze([
    Object.freeze({
      id: "deep-research",
      phrases: Object.freeze(["deep research", "investigacion profunda"]),
    }),
    Object.freeze({
      id: "settings",
      exactLabels: Object.freeze(["settings", "configuracion", "configuración"]),
    }),
    Object.freeze({
      id: "personalization",
      exactLabels: Object.freeze(["personalization", "personalizacion", "personalización"]),
    }),
    Object.freeze({
      id: "legacy-models",
      phrases: Object.freeze(["legacy models", "modelos legacy", "modelos heredados"]),
    }),
    Object.freeze({
      id: "canvas",
      exactLabels: Object.freeze(["canvas", "lienzo"]),
    }),
    Object.freeze({
      id: "more",
      exactLabels: Object.freeze(["more", "mas"]),
    }),
    Object.freeze({
      id: "project",
      phrases: PROJECT_SURFACE_HINTS,
    }),
    Object.freeze({
      id: "profile",
      exactLabels: Object.freeze(["profile", "perfil", "account", "cuenta"]),
    }),
    Object.freeze({
      id: "model-picker",
      phrases: MODEL_PICKER_SURFACE_HINTS,
    }),
  ]);

  const BACKGROUND_PRESET_DEFINITIONS = Object.freeze([
    Object.freeze({
      id: "default",
      value: "",
      labelKey: "bgPresetOptionDefault",
      defaultBlur: DEFAULT_BACKGROUND_BLUR,
    }),
    Object.freeze({
      id: "auroraClassic",
      path: "assets/backgrounds/aurora-classic.webp",
      labelKey: "bgPresetOptionAuroraClassic",
      defaultBlur: 44,
    }),
    Object.freeze({
      id: "obsidianBloom",
      path: "assets/backgrounds/obsidian-bloom.webp",
      labelKey: "bgPresetOptionObsidianBloom",
      defaultBlur: 40,
    }),
    Object.freeze({
      id: "liquidSapphire",
      path: "assets/backgrounds/liquid-sapphire.webp",
      labelKey: "bgPresetOptionLiquidSapphire",
      defaultBlur: 40,
    }),
    Object.freeze({
      id: "velvetDusk",
      path: "assets/backgrounds/velvet-dusk.webp",
      labelKey: "bgPresetOptionVelvetDusk",
      defaultBlur: 42,
    }),
    Object.freeze({
      id: "arcticGlass",
      path: "assets/backgrounds/arctic-glass.webp",
      labelKey: "bgPresetOptionArcticGlass",
      defaultBlur: 36,
    }),
    Object.freeze({
      id: "neuralField",
      path: "assets/backgrounds/neural-field.webp",
      labelKey: "bgPresetOptionNeuralField",
      defaultBlur: 52,
    }),
    Object.freeze({
      id: "topographicMist",
      path: "assets/backgrounds/topographic-mist.webp",
      labelKey: "bgPresetOptionTopographicMist",
      defaultBlur: 52,
    }),
    Object.freeze({
      id: "infraredNoir",
      path: "assets/backgrounds/infrared-noir.webp",
      labelKey: "bgPresetOptionInfraredNoir",
      defaultBlur: DEFAULT_BACKGROUND_BLUR,
    }),
    Object.freeze({
      id: "emeraldDrift",
      path: "assets/backgrounds/emerald-drift.webp",
      labelKey: "bgPresetOptionEmeraldDrift",
      defaultBlur: 40,
    }),
    Object.freeze({
      id: "__gpt5_animated__",
      value: "__gpt5_animated__",
      isSpecial: true,
      labelKey: "bgPresetOptionGpt5Animated",
      defaultBlur: 48,
    }),
    Object.freeze({ id: "jet", value: "__jet__", isSpecial: true, labelKey: "bgPresetOptionJet", defaultBlur: 46 }),
    Object.freeze({
      id: "aurora",
      value: "__aurora__",
      isSpecial: true,
      labelKey: "bgPresetOptionAurora",
      defaultBlur: 44,
    }),
    Object.freeze({
      id: "sunset",
      value: "__sunset__",
      isSpecial: true,
      labelKey: "bgPresetOptionSunset",
      defaultBlur: 44,
    }),
    Object.freeze({
      id: "ocean",
      value: "__ocean__",
      isSpecial: true,
      labelKey: "bgPresetOptionOcean",
      defaultBlur: 42,
    }),
    Object.freeze({
      id: "spaceBlueGalaxy",
      path: "assets/backgrounds/blue-galaxy.webp",
      labelKey: "bgPresetOptionSpaceBlueGalaxy",
      defaultBlur: 60,
    }),
    Object.freeze({
      id: "spaceCosmicPurple",
      path: "assets/backgrounds/cosmic-purple.webp",
      labelKey: "bgPresetOptionSpaceCosmicPurple",
      defaultBlur: 58,
    }),
    Object.freeze({
      id: "spaceDeepNebula",
      path: "assets/backgrounds/deep-space-nebula.webp",
      labelKey: "bgPresetOptionSpaceDeepNebula",
      defaultBlur: 62,
    }),
    Object.freeze({
      id: "spaceMilkyWay",
      path: "assets/backgrounds/milky-way-galaxy.webp",
      labelKey: "bgPresetOptionSpaceMilkyWay",
      defaultBlur: 60,
    }),
    Object.freeze({
      id: "spaceMilkyWayBlue",
      path: "assets/backgrounds/space-milkyway-blue-pexels.webp",
      labelKey: "bgPresetOptionSpaceMilkyWayBlue",
      defaultBlur: 56,
    }),
    Object.freeze({
      id: "spaceMilkyWayRidge",
      path: "assets/backgrounds/space-milkyway-ridge-pexels.webp",
      labelKey: "bgPresetOptionSpaceMilkyWayRidge",
      defaultBlur: 56,
    }),
    Object.freeze({
      id: "spaceOrionNebula",
      path: "assets/backgrounds/space-orion-nebula-nasa.webp",
      labelKey: "bgPresetOptionSpaceOrionNebula",
      defaultBlur: 64,
    }),
    Object.freeze({
      id: "spacePillarsCreation",
      path: "assets/backgrounds/space-pillars-creation-jwst.webp",
      labelKey: "bgPresetOptionSpacePillarsCreation",
      defaultBlur: 66,
    }),
    Object.freeze({
      id: "spaceNebulaViolet",
      path: "assets/backgrounds/space-purple-nebula-unsplash.webp",
      labelKey: "bgPresetOptionSpaceNebulaViolet",
      defaultBlur: 60,
    }),
    Object.freeze({
      id: "spacePurpleStarsAlt",
      path: "assets/backgrounds/space-purple-stars-pexels.webp",
      labelKey: "bgPresetOptionSpacePurpleStarsAlt",
      defaultBlur: 72,
    }),
    Object.freeze({
      id: "spaceNebulaPurpleBlue",
      path: "assets/backgrounds/nebula-purple-blue.webp",
      labelKey: "bgPresetOptionSpaceNebulaPurpleBlue",
      defaultBlur: 60,
    }),
    Object.freeze({
      id: "spaceStarsPurple",
      path: "assets/backgrounds/space-stars-purple.webp",
      labelKey: "bgPresetOptionSpaceStarsPurple",
      defaultBlur: 68,
    }),
  ]);

  const POPUP_BACKGROUND_PRESET_OPTIONS = Object.freeze(
    BACKGROUND_PRESET_DEFINITIONS.map((preset) =>
      Object.freeze({
        value: preset.id,
        labelKey: preset.labelKey,
      })
    )
  );

  const POPUP_ACCENT_COLOR_OPTIONS = Object.freeze([
    Object.freeze({ value: "none", labelKey: "accentColorOptionNone" }),
    Object.freeze({ value: "pink", labelKey: "accentColorOptionPink", color: "#f093fb" }),
    Object.freeze({ value: "purple", labelKey: "accentColorOptionPurple", color: "#667eea" }),
    Object.freeze({ value: "blue", labelKey: "accentColorOptionBlue", color: "#4facfe" }),
    Object.freeze({ value: "primary", labelKey: "accentColorOptionIndigo", color: "#667eea" }),
  ]);

  const POPUP_BACKGROUND_SCALING_OPTIONS = Object.freeze([
    Object.freeze({ value: "contain", labelKey: "bgScalingOptionContain" }),
    Object.freeze({ value: "cover", labelKey: "bgScalingOptionCover" }),
  ]);

  const DEFAULT_SETTINGS = Object.freeze({
    hideGpt5Limit: false,
    hideUpgradeButtons: false,
    disableAnimations: false,
    disableBgAnimation: false,
    customBgUrl: "",
    backgroundBlur: String(DEFAULT_BACKGROUND_BLUR),
    contentWidth: String(SETTING_BOUNDS.contentWidth.fallback),
    backgroundScaling: "cover",
    hideGptsButton: false,
    hideSoraButton: false,
    hideTodaysPulse: false,
    hideShoppingButton: true,
    hasSeenWelcomeScreen: false,
    blurChatHistory: false,
    accentColor: "none",
  });

  const SETTINGS_KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS));
  const BOOLEAN_SETTING_KEYS = Object.freeze(SETTINGS_KEYS.filter((key) => typeof DEFAULT_SETTINGS[key] === "boolean"));
  const BOOLEAN_SETTING_KEY_SET = new Set(BOOLEAN_SETTING_KEYS);

  const DEFAULT_BG_SPECIAL_KEYS = Object.freeze(
    BACKGROUND_PRESET_DEFINITIONS.filter((preset) => preset.isSpecial).map((preset) => preset.value)
  );

  const getExtensionUrlResolver = (getExtensionUrl) =>
    typeof getExtensionUrl === "function" ? getExtensionUrl : () => "";

  const resolveBackgroundPresetId = (rawPresetId) => {
    if (rawPresetId === null || rawPresetId === undefined || rawPresetId === "") return "default";
    return String(rawPresetId);
  };

  const resolvePresetUrl = (preset, getExtensionUrl) => {
    if (typeof preset.path === "string") return getExtensionUrl(preset.path);
    return preset.value || "";
  };

  let _presetLookupCache = null;
  let _presetLookupCacheKey = null;
  const buildBackgroundPresetLookup = (getExtensionUrl) => {
    const resolveExtensionUrl = getExtensionUrlResolver(getExtensionUrl);
    // Preset metadata is immutable, so cache per URL resolver to avoid rebuilding maps on every settings sync.
    if (_presetLookupCache && _presetLookupCacheKey === resolveExtensionUrl) {
      return _presetLookupCache;
    }
    const presets = BACKGROUND_PRESET_DEFINITIONS.map((preset) =>
      Object.freeze({
        id: preset.id,
        url: resolvePresetUrl(preset, resolveExtensionUrl),
        isSpecial: !!preset.isSpecial,
        labelKey: preset.labelKey,
        defaultBlur: String(preset.defaultBlur ?? DEFAULT_BACKGROUND_BLUR),
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

    const result = { presets, presetById, presetIdByUrl };
    _presetLookupCache = result;
    _presetLookupCacheKey = resolveExtensionUrl;
    return result;
  };

  const getBackgroundPresets = (getExtensionUrl) => buildBackgroundPresetLookup(getExtensionUrl).presets;

  const getBackgroundPresetUrl = (presetId, getExtensionUrl) => {
    const canonicalPresetId = resolveBackgroundPresetId(presetId);
    const { presetById } = buildBackgroundPresetLookup(getExtensionUrl);
    return presetById.get(canonicalPresetId)?.url || "";
  };

  const getBackgroundPresetDefaultBlur = (presetId, getExtensionUrl) => {
    const canonicalPresetId = resolveBackgroundPresetId(presetId);
    const { presetById } = buildBackgroundPresetLookup(getExtensionUrl);
    return presetById.get(canonicalPresetId)?.defaultBlur || String(DEFAULT_BACKGROUND_BLUR);
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

  const clampBackgroundBlur = (rawValue, bounds = SETTING_BOUNDS.backgroundBlur) => clampInteger(rawValue, bounds);

  const sanitizeBackgroundBlur = (rawValue, bounds = SETTING_BOUNDS.backgroundBlur) =>
    String(clampBackgroundBlur(rawValue, bounds));

  const clampContentWidth = (rawValue, bounds = SETTING_BOUNDS.contentWidth) => clampInteger(rawValue, bounds);

  const sanitizeContentWidth = (rawValue, bounds = SETTING_BOUNDS.contentWidth) =>
    String(clampContentWidth(rawValue, bounds));

  const sanitizeEnum = (rawValue, allowedValues, fallback) => {
    const normalized = String(rawValue ?? "");
    return allowedValues.includes(normalized) ? normalized : fallback;
  };

  const sanitizeAccentColor = (rawValue) => sanitizeEnum(rawValue, ACCENT_COLOR_VALUES, DEFAULT_SETTINGS.accentColor);

  const sanitizeBackgroundScaling = (rawValue) =>
    sanitizeEnum(rawValue, BACKGROUND_SCALING_VALUES, DEFAULT_SETTINGS.backgroundScaling);

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
    if (extensionBaseUrl && url.startsWith(extensionBaseUrl)) return true;
    return false;
  };

  const sanitizeBackgroundUrl = (url, extensionBaseUrl = "", specialKeys = DEFAULT_BG_SPECIAL_KEYS) =>
    isAllowedBackgroundUrl(url, extensionBaseUrl, specialKeys) ? String(url ?? "") : "";

  const normalizeUiText = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[‘’']/g, "'")
      .replace(/\s+/g, " ")
      .trim();

  const normalizeUiMatchText = (value) => normalizeUiText(value).replace(/[_/:-]+/g, " ");

  const valueIncludesPhrase = (value, phrases) => {
    const text = normalizeUiMatchText(value);
    if (!text) return false;
    return phrases.some((phrase) => text.includes(phrase));
  };

  const valueIncludesTokenGroup = (value, tokenGroups) => {
    const text = normalizeUiMatchText(value);
    if (!text) return false;
    return tokenGroups.some((tokens) => tokens.every((token) => text.includes(token)));
  };

  const textIncludesAllTokens = (value, tokens) => {
    const text = normalizeUiMatchText(value);
    if (!text) return false;
    return tokens.every((token) => text.includes(token));
  };

  const getUpgradeSignalText = (descriptor = {}) =>
    normalizeUiMatchText(
      [
        descriptor.text,
        descriptor.ariaLabel,
        descriptor.title,
        descriptor.dataTestId,
        descriptor.href,
        descriptor.id,
        descriptor.className,
      ]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ")
    );

  const hasUpgradeRouteHint = (descriptor = {}) => {
    const hrefText = normalizeUiMatchText(descriptor.href);
    if (!hrefText) return false;
    return UPGRADE_ROUTE_HINTS.some((hint) => hrefText.includes(hint));
  };

  const hasUpgradeContextSignal = (signalText) => valueIncludesPhrase(signalText, UPGRADE_CONTEXT_PHRASES);

  const hasShortUpgradeLabel = (signalText) => {
    const normalized = normalizeUiMatchText(signalText);
    return UPGRADE_SHORT_LABELS.includes(normalized);
  };

  const isInteractiveUpgradeDescriptor = (descriptor = {}) => {
    const role = normalizeUiText(descriptor.role);
    const tagName = normalizeUiText(descriptor.tagName);
    if (tagName === "a" || tagName === "button") return true;
    return role.includes("button") || role.includes("menuitem") || role.includes("link");
  };

  const isUpgradeSettingsDescriptor = (descriptor = {}) => {
    if (descriptor.withinSettings !== true) return false;
    const signalText = getUpgradeSignalText(descriptor);
    if (!valueIncludesPhrase(signalText, UPGRADE_SETTINGS_TITLE_PHRASES)) return false;
    return (
      valueIncludesPhrase(signalText, UPGRADE_KEYWORD_PHRASES) ||
      hasUpgradeContextSignal(signalText) ||
      hasUpgradeRouteHint(descriptor)
    );
  };

  const shouldHideUpgradeSurface = (descriptor = {}) => {
    const signalText = getUpgradeSignalText(descriptor);
    if (!signalText) return false;
    if (hasUpgradeContextSignal(signalText)) return true;
    if (isUpgradeSettingsDescriptor(descriptor)) return true;
    if (!isInteractiveUpgradeDescriptor(descriptor)) return false;
    if (hasUpgradeRouteHint(descriptor)) return true;
    const inUpgradeContext = descriptor.withinSidebar === true || descriptor.withinProfileMenu === true;
    return inUpgradeContext && hasShortUpgradeLabel(signalText);
  };

  const matchesPulseTargetValue = (value) =>
    valueIncludesPhrase(value, PULSE_PHRASES) || valueIncludesTokenGroup(value, PULSE_TOKEN_GROUPS);

  const matchesShoppingResearchValue = (value) =>
    valueIncludesPhrase(value, SHOPPING_RESEARCH_PHRASES) ||
    valueIncludesTokenGroup(value, SHOPPING_RESEARCH_TOKEN_GROUPS);

  const matchesResearchBannerText = (value) => textIncludesAllTokens(value, RESEARCH_CARD_BANNER_TOKENS);

  const matchesResearchContentText = (value) => textIncludesAllTokens(value, RESEARCH_CARD_CONTENT_TOKENS);

  const matchesResearchFullscreenText = (value) => {
    const text = normalizeUiText(value);
    if (!text) return false;
    return RESEARCH_FULLSCREEN_TOKENS.some((token) => text.includes(token));
  };

  const matchesCanvasActionHeaderText = (value) =>
    CANVAS_ACTION_SETS.some((tokens) => textIncludesAllTokens(value, tokens));

  const getSurfaceDescriptorSignalText = (descriptor = {}) =>
    normalizeUiMatchText(
      [
        descriptor.text,
        descriptor.ariaLabel,
        descriptor.title,
        descriptor.dataTestId,
        descriptor.href,
        descriptor.id,
        descriptor.className,
      ]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ")
    );

  const getExplicitSurfaceDescriptorSignalText = (descriptor = {}) =>
    normalizeUiMatchText(
      [
        descriptor.ariaLabel,
        descriptor.title,
        descriptor.dataTestId,
        descriptor.href,
        descriptor.id,
        descriptor.className,
        descriptor.role,
      ]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ")
    );

  const isPrimaryAppShellDescriptor = (descriptor = {}) => {
    const tagName = normalizeUiText(descriptor.tagName);
    const id = normalizeUiText(descriptor.id);
    return tagName === "main" || id === "main" || id === "thread";
  };

  const isSettingsSurfaceDescriptor = (descriptor = {}) => {
    const signalText = getSurfaceDescriptorSignalText(descriptor);
    if (!signalText) return false;
    if (
      isPrimaryAppShellDescriptor(descriptor) &&
      !valueIncludesPhrase(getExplicitSurfaceDescriptorSignalText(descriptor), SETTINGS_SURFACE_HINTS)
    ) {
      return false;
    }
    return valueIncludesPhrase(signalText, SETTINGS_SURFACE_HINTS);
  };

  const isProjectSurfaceDescriptor = (descriptor = {}) => {
    const signalText = getSurfaceDescriptorSignalText(descriptor);
    if (!signalText) return false;
    return valueIncludesPhrase(signalText, PROJECT_SURFACE_HINTS);
  };

  const isProfileMenuSurfaceDescriptor = (descriptor = {}) => {
    const signalText = getSurfaceDescriptorSignalText(descriptor);
    if (!signalText) return false;
    return valueIncludesPhrase(signalText, PROFILE_MENU_SURFACE_HINTS);
  };

  const isModelPickerSurfaceDescriptor = (descriptor = {}) => {
    const signalText = getSurfaceDescriptorSignalText(descriptor);
    if (!signalText) return false;
    return valueIncludesPhrase(signalText, MODEL_PICKER_SURFACE_HINTS);
  };

  const classifySurfaceRouteTargetValue = (value) => {
    const text = normalizeUiMatchText(value);
    if (!text) return "";
    for (const definition of SURFACE_ROUTE_TARGET_DEFINITIONS) {
      if (definition.exactLabels?.includes(text)) {
        return definition.id;
      }
      if (definition.phrases && valueIncludesPhrase(text, definition.phrases)) {
        return definition.id;
      }
    }
    return "";
  };

  const isResearchDialogDescriptor = (descriptor = {}) => {
    const signalText = normalizeUiMatchText(
      [
        descriptor.text,
        descriptor.ariaLabel,
        descriptor.title,
        descriptor.dataTestId,
        descriptor.id,
        descriptor.className,
      ]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ")
    );
    if (!signalText) return false;
    return RESEARCH_DIALOG_HINTS.some((hint) => signalText.includes(hint));
  };

  const isResearchCardRootShellDescriptor = (descriptor = {}) => {
    const tagName = normalizeUiText(descriptor.tagName);
    const id = normalizeUiText(descriptor.id);
    return tagName === "html" || tagName === "body" || tagName === "main" || id === "main" || id === "thread";
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  const getDefaultSettings = () => ({ ...DEFAULT_SETTINGS });

  const pickKnownSettings = (rawSettings) => {
    const source = isPlainObject(rawSettings) ? rawSettings : {};
    const picked = {};
    SETTINGS_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        picked[key] = source[key];
      }
    });
    return picked;
  };

  const hasAnyKnownSetting = (rawSettings) => {
    const source = isPlainObject(rawSettings) ? rawSettings : {};
    for (const key of SETTINGS_KEYS) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return true;
      }
    }
    return false;
  };

  const sanitizeSettingsPayload = (rawSettings, options = {}) => {
    const { baseSettings = DEFAULT_SETTINGS, extensionBaseUrl = "", specialKeys = DEFAULT_BG_SPECIAL_KEYS } = options;
    const fallbackSettings = { ...DEFAULT_SETTINGS, ...pickKnownSettings(baseSettings) };
    const known = pickKnownSettings(rawSettings);
    const merged = { ...fallbackSettings, ...known };
    const sanitized = { ...fallbackSettings };

    SETTINGS_KEYS.forEach((key) => {
      if (BOOLEAN_SETTING_KEY_SET.has(key)) {
        sanitized[key] = coerceBooleanLike(merged[key], fallbackSettings[key]);
        return;
      }
      sanitized[key] = merged[key];
    });

    sanitized.accentColor = sanitizeAccentColor(merged.accentColor);
    sanitized.customBgUrl = sanitizeBackgroundUrl(merged.customBgUrl || "", extensionBaseUrl, specialKeys);
    sanitized.backgroundBlur = sanitizeBackgroundBlur(merged.backgroundBlur);
    sanitized.contentWidth = sanitizeContentWidth(merged.contentWidth);
    sanitized.backgroundScaling = sanitizeBackgroundScaling(merged.backgroundScaling);

    const patch = {};
    SETTINGS_KEYS.forEach((key) => {
      const mergedValue = merged[key];
      const sanitizedValue = sanitized[key];
      const normalizedMergedValue = typeof sanitizedValue === "string" ? String(mergedValue ?? "") : mergedValue;
      if (sanitizedValue !== normalizedMergedValue) {
        patch[key] = sanitizedValue;
      }
    });

    return { sanitized, patch };
  };

  const sharedApi = Object.freeze({
    ACCENT_COLOR_VALUES,
    BACKGROUND_SCALING_VALUES,
    DEFAULT_BACKGROUND_PRESET_ID,
    DEFAULT_BACKGROUND_BLUR,
    SETTING_BOUNDS,
    DEFAULT_SETTINGS,
    SETTINGS_KEYS,
    BOOLEAN_SETTING_KEYS,
    DEFAULT_BG_SPECIAL_KEYS,
    POPUP_BACKGROUND_PRESET_OPTIONS,
    POPUP_ACCENT_COLOR_OPTIONS,
    POPUP_BACKGROUND_SCALING_OPTIONS,
    getDefaultSettings,
    getBackgroundPresets,
    getBackgroundPresetUrl,
    getBackgroundPresetDefaultBlur,
    resolveBackgroundPresetIdFromUrl,
    clampInteger,
    clampBackgroundBlur,
    sanitizeBackgroundBlur,
    clampContentWidth,
    sanitizeContentWidth,
    sanitizeAccentColor,
    sanitizeBackgroundScaling,
    coerceBooleanLike,
    isAllowedBackgroundUrl,
    sanitizeBackgroundUrl,
    normalizeUiText,
    normalizeUiMatchText,
    valueIncludesPhrase,
    valueIncludesTokenGroup,
    textIncludesAllTokens,
    matchesPulseTargetValue,
    matchesShoppingResearchValue,
    matchesResearchBannerText,
    matchesResearchContentText,
    matchesResearchFullscreenText,
    matchesCanvasActionHeaderText,
    getSurfaceDescriptorSignalText,
    isSettingsSurfaceDescriptor,
    isProjectSurfaceDescriptor,
    isProfileMenuSurfaceDescriptor,
    isModelPickerSurfaceDescriptor,
    classifySurfaceRouteTargetValue,
    isResearchDialogDescriptor,
    isResearchCardRootShellDescriptor,
    isUpgradeSettingsDescriptor,
    shouldHideUpgradeSurface,
    escapeHtml,
    pickKnownSettings,
    hasAnyKnownSetting,
    sanitizeSettingsPayload,
  });

  globalThis.AetherShared = Object.freeze({
    ...(globalThis.AetherShared || {}),
    ...sharedApi,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalThis.AetherShared;
  }
})();
