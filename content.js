// content.js — Ambient Blur + scoped transparency + robust hide/show
(() => {
  const REINJECT_CLEANUP_KEY = "__AETHER_CONTENT_CLEANUP__";
  try {
    const previousCleanup = window[REINJECT_CLEANUP_KEY];
    if (typeof previousCleanup === "function") {
      previousCleanup();
    }
  } catch (e) {
    console.warn("Aether: Previous content cleanup failed", e);
  }

  try {
    const ID = "cgpt-ambient-bg";
    const STYLE_ID = "cgpt-ambient-styles";
    const QS_BUTTON_ID = "cgpt-qs-btn";
    const QS_PANEL_ID = "cgpt-qs-panel";
    const HTML_CLASS = "cgpt-ambient-on";
    const READY_CLASS = "cgpt-ambient-ready";
    const LIGHT_CLASS = "cgpt-light-mode";
    const ANIMATIONS_DISABLED_CLASS = "cgpt-animations-disabled";
    const BG_ANIM_DISABLED_CLASS = "cgpt-bg-anim-disabled";
    const CLEAR_APPEARANCE_CLASS = "cgpt-appearance-clear";
    const AETHER_SURFACE_ATTR = "data-aether-surface";
    const AETHER_GLASS_ATTR = "data-aether-glass";
    const FORCED_WIDE_COMPOSER_ATTR = "data-aether-force-wide-composer";
    const COMPOSER_TARGET_WIDTH_VAR = "--aether-composer-target-width";
    let settings = {};
    let lastDetectedTheme = null;
    let lastAppliedThemeState = null;
    let taggedSurfaceNodes = new Set();

    const HIDE_LIMIT_CLASS = "cgpt-hide-gpt5-limit";
    const HIDE_UPGRADE_CLASS = "cgpt-hide-upgrade";
    const HIDE_SORA_CLASS = "cgpt-hide-sora";
    const HIDE_GPTS_CLASS = "cgpt-hide-gpts";
    const HIDE_SHOPPING_CLASS = "cgpt-hide-shopping";
    const HIDE_TODAYS_PULSE_CLASS = "cgpt-hide-todays-pulse";
    const RESEARCH_CARD_CLASS = "cgpt-aether-research-card";
    const RESEARCH_CARD_OPEN_CLASS = "cgpt-aether-research-card-open";
    const CANVAS_SURFACE_CLASS = "cgpt-aether-canvas-surface";
    const TIMESTAMP_KEY = "gpt5LimitHitTimestamp";
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const MIN_BG_BLUR = 0;
    const MAX_BG_BLUR = 150;
    const MIN_CONTENT_WIDTH = 70;
    const MAX_CONTENT_WIDTH = 100;
    const DESKTOP_COMPOSER_FIX_MIN_VIEWPORT = 900;
    const COMPACT_COMPOSER_MAX_WIDTH = 480;
    const COMPOSER_SIDE_GUTTER_PX = 32;
    const COMPOSER_DESKTOP_MAX_WIDTH_PX = 1024;

    // Named timing constants
    const TRANSITION_DURATION_MS = 800;
    const STORAGE_FLUSH_DELAY_MS = 300;
    const BLUR_SAVE_DELAY_MS = 120;
    const SETTINGS_REFRESH_DELAY_MS = 50;
    const CRITICAL_CHECK_DELAY_MS = 50;
    const OTHER_CHECK_DELAY_MS = 150;
    const UI_READY_TIMEOUT_MS = 15000;

    let refreshTimeout = null;
    let initialDomReadyHandler = null;
    let storageChangeHandler = null;
    let visibilityChangeHandler = null;
    let windowFocusHandler = null;
    let windowResizeHandler = null;
    let popstateHandler = null;
    let quickAddInteractionHandler = null;
    let quickAddPromotionTimers = [];
    let runtimeMessageHandler = null;
    let originalPushState = null;
    let originalReplaceState = null;
    let uiReadyObserver = null;
    let domObserver = null;
    let themeObserver = null;
    let bodyObserver = null;
    let uiReadyTimeout = null;
    let observersStarted = false;
    let qsDocumentClickBound = false;
    let qsDocumentClickHandler = null;
    let qsDocumentKeydownBound = false;
    let qsDocumentKeydownHandler = null;
    let applyStylesDomReadyHandler = null;
    let showBgDomReadyHandler = null;
    let qsInitDomReadyHandler = null;
    let composerLayoutFrame = null;

    const getExtensionUrl = (path) => {
      try {
        return chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "";
      } catch {
        return "";
      }
    };

    const EXTENSION_BASE_URL = getExtensionUrl("");
    if (!EXTENSION_BASE_URL) return;
    const sharedUtils = globalThis.AetherShared;
    if (!sharedUtils) {
      throw new Error("Aether: shared utilities failed to load in content context.");
    }
    const {
      getDefaultSettings,
      sanitizeBackgroundScaling,
      escapeHtml,
      clampBackgroundBlur,
      sanitizeContentWidth,
      getBackgroundPresets,
      getBackgroundPresetUrl,
      resolveBackgroundPresetIdFromUrl,
    } = sharedUtils;
    settings = getDefaultSettings();
    const sanitizeBackgroundUrl = (url) => sharedUtils.sanitizeBackgroundUrl(url, EXTENSION_BASE_URL);

    const getBackgroundPresetResolvedUrl = (presetId) => getBackgroundPresetUrl(presetId, getExtensionUrl);
    const resolveBackgroundPresetId = (url) => resolveBackgroundPresetIdFromUrl(url, getExtensionUrl);
    const BACKGROUND_PRESETS = getBackgroundPresets(getExtensionUrl);

    const DEFAULT_BG_URL = getBackgroundPresetResolvedUrl("spaceBlueGalaxy");
    const GPT5_ANIMATED_KEY = getBackgroundPresetResolvedUrl("__gpt5_animated__");
    const JET_KEY = getBackgroundPresetResolvedUrl("jet");
    const AURORA_KEY = getBackgroundPresetResolvedUrl("aurora");
    const SUNSET_KEY = getBackgroundPresetResolvedUrl("sunset");
    const OCEAN_KEY = getBackgroundPresetResolvedUrl("ocean");

    const QUICK_SETTINGS_BG_PRESET_LABELS = Object.freeze({
      default: "Default",
      auroraClassic: "Aurora Classic",
      __gpt5_animated__: "Animated",
      jet: "Jet",
      aurora: "Aurora",
      sunset: "Sunset",
      ocean: "Ocean",
      grokHorizon: "Horizon",
      grokBlanco: "Grok White",
      grokDarko: "Grok Dark",
      grokCeleste: "Grok Green",
      spaceBlueGalaxy: "Galaxy",
      spaceCosmicPurple: "Cosmic",
      spaceDeepNebula: "Deep Nebula",
      spaceMilkyWay: "Milky Way",
      spaceMilkyWayBlue: "Milky Way Blue",
      spaceMilkyWayRidge: "Milky Way Ridge",
      spaceOrionNebula: "Orion",
      spacePillarsCreation: "Pillars",
      spaceNebulaViolet: "Purple Nebula",
      spacePurpleStarsAlt: "Purple Stars",
      spaceNebulaPurpleBlue: "Nebula Purple Blue",
      spaceStarsPurple: "Stars Purple",
    });
    const QUICK_SETTINGS_BG_ANIMATED_IDS = Object.freeze(["__gpt5_animated__", "aurora", "sunset", "ocean"]);
    const QUICK_SETTINGS_BG_PRESETS = Object.freeze(
      BACKGROUND_PRESETS.filter((preset) =>
        Object.prototype.hasOwnProperty.call(QUICK_SETTINGS_BG_PRESET_LABELS, preset.id)
      ).map((preset) =>
        Object.freeze({
          key: preset.id,
          url: preset.url,
          label: QUICK_SETTINGS_BG_PRESET_LABELS[preset.id],
          animated: QUICK_SETTINGS_BG_ANIMATED_IDS.includes(preset.id),
          thumb: preset.id === "default" ? DEFAULT_BG_URL : !preset.isSpecial && preset.url ? preset.url : "",
        })
      )
    );

    // Group DOM selectors for easier maintenance. Fragile selectors are noted.
    const SELECTORS = {
      GPT5_LIMIT_POPUP: 'div[class*="text-token-text-primary"]',
      UPGRADE_MENU_ITEM: "a.__menu-item", // In user profile menu
      UPGRADE_TOP_BUTTON_CONTAINER: ".start-1\\/2.absolute", // Fragile: top-center button on free plan
      UPGRADE_PROFILE_BUTTON_TRAILING_ICON:
        ':is([data-testid="accounts-profile-button"], [data-testid="profile-button"]) .__menu-item-trailing-btn',
      UPGRADE_SIDEBAR_BUTTON: "div.gap-1\\.5.__menu-item.group", // Fragile: sidebar button
      UPGRADE_TINY_SIDEBAR_ICON: "#stage-sidebar-tiny-bar > div:nth-of-type(4)", // Fragile: depends on element order
      UPGRADE_SETTINGS_ROW_CONTAINER: "div.py-2.border-b", // Container for settings row
      UPGRADE_BOTTOM_BANNER: 'div[role="button"]', // Bottom "Upgrade your plan" banner
      SORA_BUTTON_ID: "sora", // Use with getElementById
      SORA_BUTTON: 'a[href="/sora"], a[href^="/sora"], [data-testid*="sora"]',
      GPTS_BUTTON: 'a[href="/gpts"], a[href^="/gpts"], [data-testid="explore-gpts-button"]',
      SHOPPING_BUTTON: 'div[role="menuitemradio"].group.__menu-item', // Shopping research button - more specific selector
      TODAYS_PULSE_CONTAINER: "a", // Container for Today's pulse - will need text matching
      PROFILE_BUTTON: '[data-testid="accounts-profile-button"], [data-testid="profile-button"]',
    };

    // --- Cached DOM element lookups ---
    const _elementCache = new Map();
    const getCachedElement = (selector) => {
      const cached = _elementCache.get(selector);
      if (cached && cached.isConnected) return cached;
      const el = document.querySelector(selector);
      if (el) _elementCache.set(selector, el);
      else _elementCache.delete(selector);
      return el;
    };
    const getCachedElementById = (id) => {
      const cached = _elementCache.get(`#${id}`);
      if (cached && cached.isConnected) return cached;
      const el = document.getElementById(id);
      if (el) _elementCache.set(`#${id}`, el);
      else _elementCache.delete(`#${id}`);
      return el;
    };

    const debounce = (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };

    const toggleClassForElements = (elements, className, force) => {
      elements.forEach((el) => {
        if (el) el.classList.toggle(className, force);
      });
    };

    const normalizeText = (value) =>
      String(value ?? "")
        .toLowerCase()
        .replace(/[’']/g, "'")
        .replace(/\s+/g, " ")
        .trim();

    const isElementVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const clearForcedWideComposer = (form) => {
      if (!(form instanceof HTMLElement)) return;
      form.removeAttribute(FORCED_WIDE_COMPOSER_ATTR);
      form.style.removeProperty(COMPOSER_TARGET_WIDTH_VAR);
    };

    const clearTaggedSurfaceNode = (node) => {
      node.removeAttribute(AETHER_SURFACE_ATTR);
      node.removeAttribute(AETHER_GLASS_ATTR);
    };

    const tagSurfaceNode = (nextTaggedNodes, node, surface, glass = "raised") => {
      if (!(node instanceof Element) || !node.isConnected) return;
      node.setAttribute(AETHER_SURFACE_ATTR, surface);
      if (glass) {
        node.setAttribute(AETHER_GLASS_ATTR, glass);
      } else {
        node.removeAttribute(AETHER_GLASS_ATTR);
      }
      nextTaggedNodes.add(node);
    };

    const commitTaggedSurfaceNodes = (nextTaggedNodes) => {
      taggedSurfaceNodes.forEach((node) => {
        if (!nextTaggedNodes.has(node) && node.isConnected) {
          clearTaggedSurfaceNode(node);
        }
      });
      taggedSurfaceNodes = nextTaggedNodes;
    };

    const PULSE_PHRASES = ["today's pulse", "todays pulse", "pulso de hoy", "pulse", "pulso"];
    const SHOPPING_ATTRS = ["aria-label", "data-aria-label", "data-testid", "data-track"];
    const SHOPPING_PHRASES = ["shopping research", "shopping"];
    const GPT5_LIMIT_PHRASES = [
      "you've reached the gpt-5 limit",
      "youve reached the gpt-5 limit",
      "has alcanzado el limite de gpt-5",
      "has alcanzado el límite de gpt-5",
    ];
    const UPGRADE_KEYWORD_PHRASES = ["upgrade", "actualizar", "mejorar"];
    const UPGRADE_BANNER_PHRASES = ["upgrade your plan", "actualiza tu plan", "mejora tu plan"];
    const UPGRADE_SETTINGS_TITLE_PHRASES = [
      "get chatgpt plus",
      "get chatgpt go",
      "obten chatgpt plus",
      "obtén chatgpt plus",
      "obten chatgpt go",
      "obtén chatgpt go",
    ];

    const matchesPulseText = (value) => {
      const text = normalizeText(value);
      if (!text) return false;
      return PULSE_PHRASES.some((phrase) => text.includes(phrase));
    };

    const matchesShoppingText = (value) => {
      const text = normalizeText(value);
      if (!text) return false;
      return SHOPPING_PHRASES.some((phrase) => text.includes(phrase));
    };

    const CANVAS_ACTION_SETS = [
      ["copy", "edit", "download"],
      ["copiar", "editar", "descargar"],
    ];

    // Quick add menu labels (fragile: text-based matching on ChatGPT UI)
    const QUICK_ADD_MENU_HINTS = ["add photos", "add files", "create image", "deep research", "agent mode"];
    const QUICK_ADD_MORE_LABELS = ["more", "mas"];
    const QUICK_ADD_TOP_PRIORITY_HINT_GROUPS = [
      ["deep research", "investigacion profunda", "investigación profunda"],
      ["github"],
    ];
    const QUICK_ADD_PROMOTED_HINTS = [
      "canvas",
      "deep research",
      "github",
      "lienzo",
      "investigacion profunda",
      "investigación profunda",
    ];
    // Submenu-only connectors cannot be triggered reliably from synthetic click
    // forwarding, so do not inject shortcut proxies into the root quick-add menu.
    const QUICK_ADD_PROXY_ITEMS = [];
    const QUICK_ADD_PROXY_ICON_PATHS = {
      github:
        '<path fill="currentColor" d="M10 2C5.58 2 2 5.66 2 10.17c0 3.61 2.29 6.67 5.47 7.75.4.08.55-.18.55-.39 0-.19-.01-.82-.01-1.49-2.01.38-2.53-.5-2.69-.95-.09-.23-.48-.95-.82-1.14-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.03.08-2.15 0 0 .67-.22 2.2.84a7.35 7.35 0 0 1 4.01 0c1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.94.08 2.15.51.57.82 1.29.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.25.54.73.54 1.47 0 1.06-.01 1.91-.01 2.17 0 .21.15.47.55.39A8.2 8.2 0 0 0 18 10.17C18 5.66 14.42 2 10 2z"/>',
    };
    const QUICK_ADD_SUBMENU_HINTS = [
      "study and learn",
      "web search",
      "canvas",
      "deep research",
      "github",
      "hugging face",
      "quizzes",
      "shopping research",
      "vercel",
      "your year with chatgpt",
      "google drive",
      "notion",
      "explore apps",
    ];
    const RESEARCH_CARD_BANNER_TOKENS = ["research completed in", "citations", "searches"];
    const RESEARCH_CARD_CONTENT_TOKENS = ["executive summary"];
    const RESEARCH_FULLSCREEN_TOKENS = ["full screen", "fullscreen", "expand", "maximize"];
    const RESEARCH_CARD_CONTAINER_SELECTOR = "div, section, article, main";
    const RESEARCH_EMBED_IFRAME_SELECTOR = [
      'iframe[title*="deep-research" i]',
      'iframe[title*="deep research" i]',
      'iframe[title*="research" i]',
      'iframe[src*="connector_openai_deep_research" i]',
      'iframe[src*="deep_research" i]',
      'iframe[src*="deep-research" i]',
      'iframe[src*="research.web-sandbox.oaisusercontent.com" i]',
    ].join(", ");
    const RESEARCH_CONTROL_SELECTOR = [
      '[aria-label*="download" i]',
      '[data-testid*="download" i]',
      '[title*="download" i]',
      '[aria-label*="full" i]',
      '[aria-label*="expand" i]',
      '[aria-label*="maximize" i]',
      '[data-testid*="full" i]',
      '[data-testid*="expand" i]',
      '[title*="full" i]',
      '[title*="expand" i]',
    ].join(", ");
    const RESEARCH_REPORT_MARKER_SELECTOR = [
      '[data-testid*="research" i]',
      '[data-testid*="artifact" i]',
      '[id*="research" i]',
      '[id*="artifact" i]',
      '[class*="research" i]',
      '[class*="artifact" i]',
    ].join(", ");
    const RESEARCH_DIALOG_SELECTOR = [
      'div[role="dialog"][data-testid*="deep-research" i]',
      'div[role="dialog"][data-testid*="research-report" i]',
      'div[role="dialog"][data-testid*="artifact-viewer" i]',
      'div[role="dialog"][id*="deep-research" i]',
      'div[role="dialog"][class*="deep-research" i]',
      'div[role="dialog"]:has(button[aria-label*="download" i]):has(button[aria-label*="share" i])',
      'div[role="dialog"]:has(button[aria-label*="download" i]):has(button[aria-label*="close" i])',
    ].join(", ");
    const RESEARCH_VIEWER_HOST_SELECTOR = [
      RESEARCH_DIALOG_SELECTOR,
      'main[data-testid*="deep-research" i]',
      'div[data-testid*="deep-research" i]',
      'section[data-testid*="deep-research" i]',
      'article[data-testid*="deep-research" i]',
      'main[data-testid*="research-report" i]',
      'div[data-testid*="research-report" i]',
      'section[data-testid*="research-report" i]',
      'article[data-testid*="research-report" i]',
    ].join(", ");
    const RESEARCH_OVERLAY_HOST_SELECTOR =
      '.no-scrollbar.fixed.start-0.end-0.top-0.bottom-0.z-50:has(iframe[title="internal://deep-research"])';
    const RESEARCH_HOME_SELECTOR = ".deep-research-app";
    const RESEARCH_HOME_CARD_SELECTOR =
      '.deep-research-app article[class*="bg-token-bg-primary"][class*="min-h-[245px]"][class*="rounded-[30px]"]';
    const RESEARCH_AGENDA_ITEM_SELECTOR =
      '.deep-research-app section button[class*="hover:bg-token-bg-tertiary"][class*="rounded-xl"]';

    const THEME_LIGHT_TOKENS = ["light", "theme-light", "light-theme"];
    const THEME_DARK_TOKENS = ["dark", "theme-dark", "dark-theme"];
    const THEME_ATTRS = ["data-theme", "data-color-scheme", "data-theme-mode"];
    // Accent colors control both UI accents and user message bubble styling
    const ACCENT_COLORS = {
      none: { gradient: "none", glowDark: "none", glowLight: "none", solid: "#2563eb" },
      pink: {
        gradient: "var(--gradient-pink)",
        glowDark: "var(--glow-pink)",
        glowLight: "var(--glow-pink-light)",
        solid: "#f093fb",
      },
      purple: {
        gradient: "var(--gradient-purple)",
        glowDark: "var(--glow-purple)",
        glowLight: "var(--glow-purple-light)",
        solid: "#667eea",
      },
      blue: {
        gradient: "var(--gradient-blue)",
        glowDark: "var(--glow-blue)",
        glowLight: "var(--glow-blue-light)",
        solid: "#4facfe",
      },
      primary: {
        gradient: "var(--gradient-primary)",
        glowDark: "var(--glow-purple)",
        glowLight: "var(--glow-purple-light)",
        solid: "#667eea",
      },
    };

    const getThemeFromString = (value) => {
      const text = normalizeText(value);
      if (!text) return null;
      const hasLight = THEME_LIGHT_TOKENS.some((token) => text.includes(token));
      const hasDark = THEME_DARK_TOKENS.some((token) => text.includes(token));
      if (hasLight && !hasDark) return "light";
      if (hasDark && !hasLight) return "dark";
      return null;
    };

    const getThemeFromElement = (el) => {
      if (!el) return null;
      const hasLightClass = THEME_LIGHT_TOKENS.some((token) => el.classList?.contains(token));
      const hasDarkClass = THEME_DARK_TOKENS.some((token) => el.classList?.contains(token));
      if (hasLightClass && !hasDarkClass) return "light";
      if (hasDarkClass && !hasLightClass) return "dark";

      for (const attr of THEME_ATTRS) {
        const token = getThemeFromString(el.getAttribute(attr));
        if (token) return token;
      }
      return null;
    };

    const detectThemeFromElements = (elements) => {
      for (const el of elements) {
        const token = getThemeFromElement(el);
        if (token) return token;
      }
      return null;
    };

    const isLightTheme = () => {
      const html = document.documentElement;
      const body = document.body;
      const primaryTheme = detectThemeFromElements([html, body]);
      if (primaryTheme) return primaryTheme === "light";

      const rootTheme = detectThemeFromElements([
        getCachedElementById("__next"),
        getCachedElementById("root"),
        getCachedElement("main"),
      ]);
      if (rootTheme) return rootTheme === "light";

      const attrEl = document.querySelector("[data-theme],[data-color-scheme],[data-theme-mode]");
      const attrTheme = getThemeFromElement(attrEl);
      if (attrTheme) return attrTheme === "light";

      // Use matchMedia as a cheaper alternative to getComputedStyle(html).colorScheme
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return true;
      }

      return false;
    };

    const findPulseContainer = (el) => {
      if (!el) return null;
      if (el.closest?.('article[data-testid^="conversation-turn-"], .group\\/conversation-turn')) {
        return null;
      }
      let node = el;
      for (let i = 0; i < 6 && node; i += 1) {
        if (node.matches?.("a, button, [role='button'], [role='link']")) {
          return node;
        }
        if (node.classList?.contains("cursor-pointer")) return node;
        node = node.parentElement;
      }
      return null;
    };

    const findPulseTextElements = () => {
      // Scope to sidebar nav where "Today's Pulse" actually appears
      const nav = document.querySelector("nav");
      if (!nav) return [];
      const matches = [];

      const containers = nav.querySelectorAll("div, span, a, p");
      for (const el of containers) {
        if (el.children.length === 0) {
          // Only check leaf nodes with text
          const text = el.textContent;
          if (matchesPulseText(text)) {
            matches.push(el);
          }
        }
      }

      return matches;
    };

    // Use AetherI18n for language detection (ChatGPT language priority)
    const getMessage = (key, substitutions) => {
      try {
        // Try AetherI18n first (supports ChatGPT language detection)
        if (window.AetherI18n?.getMessage) {
          const text = window.AetherI18n.getMessage(key, substitutions);
          if (text && text !== key) return text;
        }

        // Fallback to Chrome's built-in i18n
        if (chrome?.i18n?.getMessage && chrome.runtime?.id) {
          const text = chrome.i18n.getMessage(key, substitutions);
          if (text) return text;
        }
      } catch (e) {
        const errMessage = String(e?.message || "").toLowerCase();
        if (!errMessage.includes("extension context invalidated")) {
          console.error("Aether Extension Error:", e);
        }
        return key; // Fallback to key if context is lost
      }
      return key;
    };

    const t = (key, substitutions) => escapeHtml(getMessage(key, substitutions));

    function manageGpt5LimitPopup() {
      const popup = document.querySelector(SELECTORS.GPT5_LIMIT_POPUP);
      const popupText = normalizeText(popup?.textContent || "");
      if (popup && !GPT5_LIMIT_PHRASES.some((phrase) => popupText.includes(phrase))) return;
      if (!settings.hideGpt5Limit) {
        if (popup) popup.classList.remove(HIDE_LIMIT_CLASS);
        return;
      }
      if (!chrome?.runtime?.id) return;
      if (popup) {
        chrome.storage.local.get([TIMESTAMP_KEY], (result) => {
          if (chrome.runtime.lastError) {
            console.error("Aether Extension Error (manageGpt5LimitPopup):", chrome.runtime.lastError.message);
            return;
          }
          if (!result[TIMESTAMP_KEY]) {
            chrome.storage.local.set({ [TIMESTAMP_KEY]: Date.now() }, () => {
              if (chrome.runtime.lastError) {
                console.error("Aether Extension Error (manageGpt5LimitPopup):", chrome.runtime.lastError.message);
              }
            });
          } else if (Date.now() - result[TIMESTAMP_KEY] > FIVE_MINUTES_MS) {
            popup.classList.add(HIDE_LIMIT_CLASS);
          }
        });
      } else {
        chrome.storage.local.remove([TIMESTAMP_KEY], () => {
          if (chrome.runtime.lastError) {
            console.error("Aether Extension Error (manageGpt5LimitPopup):", chrome.runtime.lastError.message);
          }
        });
      }
    }

    function manageUpgradeButtons() {
      if (!settings.hideUpgradeButtons) {
        document.querySelectorAll(`.${HIDE_UPGRADE_CLASS}`).forEach((el) => el.classList.remove(HIDE_UPGRADE_CLASS));
        return;
      }

      const upgradeElements = [];

      const panelButton = Array.from(document.querySelectorAll(SELECTORS.UPGRADE_MENU_ITEM)).find((el) =>
        UPGRADE_KEYWORD_PHRASES.some((phrase) => normalizeText(el.textContent || "").includes(phrase))
      );
      upgradeElements.push(panelButton);

      const topButtonContainer = document.querySelector(SELECTORS.UPGRADE_TOP_BUTTON_CONTAINER);
      upgradeElements.push(topButtonContainer);

      const profileButtonUpgrade = document.querySelector(SELECTORS.UPGRADE_PROFILE_BUTTON_TRAILING_ICON);
      upgradeElements.push(profileButtonUpgrade);

      const newSidebarUpgradeButton = Array.from(document.querySelectorAll(SELECTORS.UPGRADE_SIDEBAR_BUTTON)).find(
        (el) => UPGRADE_KEYWORD_PHRASES.some((phrase) => normalizeText(el.textContent || "").includes(phrase))
      );
      upgradeElements.push(newSidebarUpgradeButton);

      const tinySidebarUpgradeIcon = document.querySelector(SELECTORS.UPGRADE_TINY_SIDEBAR_ICON);
      upgradeElements.push(tinySidebarUpgradeIcon);

      const bottomBannerUpgrade = Array.from(document.querySelectorAll(SELECTORS.UPGRADE_BOTTOM_BANNER)).find((el) =>
        UPGRADE_BANNER_PHRASES.some((phrase) => normalizeText(el.textContent || "").includes(phrase))
      );
      if (bottomBannerUpgrade) {
        // The element to hide is the parent container of the button.
        upgradeElements.push(bottomBannerUpgrade.parentElement);
      }

      const allSettingRows = document.querySelectorAll(SELECTORS.UPGRADE_SETTINGS_ROW_CONTAINER);
      for (const row of allSettingRows) {
        const rowText = normalizeText(row.textContent || "");
        const hasUpgradeTitle = UPGRADE_SETTINGS_TITLE_PHRASES.some((phrase) => rowText.includes(phrase));
        const hasUpgradeButton = Array.from(row.querySelectorAll("button")).some((btn) =>
          UPGRADE_KEYWORD_PHRASES.some((phrase) => normalizeText(btn.textContent || "").includes(phrase))
        );

        if (hasUpgradeTitle && hasUpgradeButton) {
          upgradeElements.push(row);
        }
      }

      toggleClassForElements(upgradeElements.filter(Boolean), HIDE_UPGRADE_CLASS, settings.hideUpgradeButtons);
    }

    function manageSidebarButtons() {
      manageSidebarButtonsQuick();
      manageTodaysPulse();
    }

    function manageSidebarButtonsQuick() {
      const soraTargets = [
        document.getElementById(SELECTORS.SORA_BUTTON_ID),
        ...Array.from(document.querySelectorAll(SELECTORS.SORA_BUTTON)),
      ];
      toggleClassForElements(
        Array.from(new Set(soraTargets.filter(Boolean))),
        HIDE_SORA_CLASS,
        settings.hideSoraButton
      );

      const gptsTargets = Array.from(document.querySelectorAll(SELECTORS.GPTS_BUTTON));
      toggleClassForElements(
        Array.from(new Set(gptsTargets.filter(Boolean))),
        HIDE_GPTS_CLASS,
        settings.hideGptsButton
      );
      manageShoppingButton();
    }

    function manageShoppingButton() {
      if (!settings.hideShoppingButton) {
        document.querySelectorAll(`.${HIDE_SHOPPING_CLASS}`).forEach((el) => {
          el.classList.remove(HIDE_SHOPPING_CLASS);
          el.removeAttribute("data-aether-shopping-processed");
        });
        return;
      }

      const candidates = document.querySelectorAll(
        `${SELECTORS.SHOPPING_BUTTON}, [role="menuitemradio"], [role="menuitem"]`
      );
      candidates.forEach((el) => {
        if (!el) return;
        if (matchesShoppingText(el.textContent)) {
          el.classList.add(HIDE_SHOPPING_CLASS);
          return;
        }
        for (const attr of SHOPPING_ATTRS) {
          if (matchesShoppingText(el.getAttribute(attr))) {
            el.classList.add(HIDE_SHOPPING_CLASS);
            return;
          }
        }
      });
    }

    function manageTodaysPulse() {
      if (!settings.hideTodaysPulse) {
        document
          .querySelectorAll(`.${HIDE_TODAYS_PULSE_CLASS}`)
          .forEach((el) => el.classList.remove(HIDE_TODAYS_PULSE_CLASS));
        return;
      }

      const targets = new Set();
      const textMatches = findPulseTextElements();
      textMatches.forEach((el) => {
        const container = findPulseContainer(el);
        if (container) targets.add(container);
      });

      if (targets.size === 0) {
        const attrMatches = Array.from(
          document.querySelectorAll("[aria-label],[href],[data-testid],[data-track]")
        ).filter((el) => {
          const attrs = ["aria-label", "href", "data-testid", "data-track"];
          return attrs.some((attr) =>
            String(el.getAttribute(attr) || "")
              .toLowerCase()
              .includes("pulse")
          );
        });
        attrMatches.forEach((el) => {
          const container = findPulseContainer(el);
          if (container) targets.add(container);
        });
      }

      toggleClassForElements(Array.from(targets), HIDE_TODAYS_PULSE_CLASS, true);
    }

    function getMenuItems(menu, includeHidden = false) {
      if (!menu) return [];
      const items = Array.from(
        menu.querySelectorAll('[role="menuitemradio"], [role="menuitem"], button, [data-radix-collection-item]')
      );
      const menuIsRoleMenu = menu.matches?.('[role="menu"]');
      return items.filter((el) => {
        if (!(includeHidden || isElementVisible(el))) return false;
        const closestRoleMenu = el.closest('[role="menu"]');
        if (menuIsRoleMenu) {
          return closestRoleMenu === menu;
        }
        if (closestRoleMenu) {
          return menu.contains(closestRoleMenu);
        }
        return menu.contains(el);
      });
    }

    function getMenuItemLabel(el) {
      return normalizeText(el?.getAttribute("aria-label") || el?.textContent || "");
    }

    function menuHasLabel(menu, labelHints, includeHidden = false) {
      if (!menu) return false;
      const labels = getMenuItems(menu, includeHidden).map(getMenuItemLabel);
      return labels.some((label) => labelHints.some((hint) => label.includes(hint)));
    }

    function findMenuItem(menu, labelHints, includeHidden = false) {
      const items = getMenuItems(menu, includeHidden);
      return items.find((item) => labelHints.some((hint) => getMenuItemLabel(item).includes(hint))) || null;
    }

    function isQuickAddMenu(menu) {
      if (!menuHasLabel(menu, QUICK_ADD_MORE_LABELS)) return false;
      return menuHasLabel(menu, QUICK_ADD_MENU_HINTS);
    }

    function isQuickAddSubmenu(menu, includeHidden = false) {
      return menuHasLabel(menu, QUICK_ADD_SUBMENU_HINTS, includeHidden);
    }

    function safeInsertMenuItem(targetContainer, item, preferredAnchor, fallbackAnchor) {
      if (!targetContainer || !item) return;
      const anchor =
        (preferredAnchor && preferredAnchor.parentElement === targetContainer && preferredAnchor) ||
        (fallbackAnchor && fallbackAnchor.parentElement === targetContainer && fallbackAnchor) ||
        null;
      if (anchor) {
        targetContainer.insertBefore(item, anchor);
      } else {
        targetContainer.appendChild(item);
      }
    }

    function hasStableUiAnchor() {
      return !!(
        getCachedElement(SELECTORS.PROFILE_BUTTON) ||
        document.querySelector("#prompt-textarea") ||
        document.querySelector(
          '[data-testid="composer-submit-button"], [data-testid="send-button"], [data-testid="fruitjuice-send-button"], #composer-submit-button'
        ) ||
        document.querySelector('article[data-testid^="conversation-turn-"]')
      );
    }

    function clearSuppressedQuickAddItems() {
      document.querySelectorAll('[data-cgpt-quick-add-suppressed="1"]').forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("aria-hidden");
        el.removeAttribute("data-cgpt-quick-add-suppressed");
      });
    }

    function clearQuickAddProxyItems() {
      document.querySelectorAll('[data-cgpt-quick-add-proxy="1"]').forEach((el) => {
        el.remove();
      });
    }

    function setMenuItemLabel(item, label) {
      if (!item || !label) return;
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      let targetNode = null;
      let longestLength = 0;
      let node;
      while ((node = walker.nextNode())) {
        const text = String(node.textContent || "").trim();
        if (!text) continue;
        if (text.length > longestLength) {
          longestLength = text.length;
          targetNode = node;
        }
      }
      if (targetNode) {
        targetNode.textContent = label;
      } else {
        item.textContent = label;
      }
      item.setAttribute("aria-label", label);
    }

    function findQuickAddSourceItem(labelHints) {
      if (!labelHints?.length) return null;
      const selectors = [
        '[data-testid="deep-research-sidebar-item"]',
        '[data-testid*="deep-research"]',
        '[data-testid*="github"]',
        '[role="menuitemradio"]',
        '[role="menuitem"]',
        "button",
        "[data-radix-collection-item]",
        "a[data-sidebar-item]",
        "a[href]",
        "div.__menu-item",
      ];
      const seen = new Set();
      const candidates = [];
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          candidates.push(el);
        });
      });
      return (
        candidates.find((el) => {
          if (el.dataset?.cgptQuickAddProxy === "1") return false;
          const label = getMenuItemLabel(el);
          if (!label) return false;
          return labelHints.some((hint) => label.includes(hint));
        }) || null
      );
    }

    function resolveQuickAddProxyIconSvg(key, labelHints) {
      const sourceItem = findQuickAddSourceItem(labelHints);
      const sourceSvg = sourceItem?.querySelector(".icon svg, svg.icon");
      if (sourceSvg) return sourceSvg.outerHTML;

      const fallbackPath = QUICK_ADD_PROXY_ICON_PATHS[key];
      if (!fallbackPath) return null;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon">${fallbackPath}</svg>`;
    }

    function triggerQuickAddSubmenuAction(mainMenu, labelHints) {
      if (!mainMenu || !labelHints?.length) return;
      const moreItem = findMenuItem(mainMenu, QUICK_ADD_MORE_LABELS, true);
      if (!moreItem) return;

      moreItem.click();

      const deadline = Date.now() + 1200;
      const trySelect = () => {
        const menus = Array.from(
          new Set(
            Array.from(
              document.querySelectorAll(
                '[role="menu"], [data-radix-popper-content-wrapper], .popover[role="dialog"], .popover'
              )
            )
          )
        );
        for (const menu of menus) {
          const candidate = findMenuItem(menu, labelHints, true);
          if (!candidate || candidate === moreItem || candidate.dataset.cgptQuickAddProxy === "1") continue;
          candidate.click();
          return;
        }
        if (Date.now() < deadline) {
          setTimeout(trySelect, 40);
        }
      };
      setTimeout(trySelect, 20);
    }

    function makeQuickAddProxyItem(templateItem, label, key, labelHints, mainMenu) {
      if (!templateItem || !label || !key || !labelHints?.length || !mainMenu) return null;
      const proxy = templateItem.cloneNode(true);
      proxy.dataset.cgptQuickAddProxy = "1";
      proxy.dataset.cgptQuickAddProxyKey = key;
      proxy.removeAttribute("id");
      proxy.removeAttribute("data-radix-collection-item");
      setMenuItemLabel(proxy, label);
      proxy.querySelector(".trailing")?.remove();
      const iconContainer = proxy.querySelector(".icon");
      const iconSvgMarkup = resolveQuickAddProxyIconSvg(key, labelHints);
      if (iconContainer && iconSvgMarkup) {
        iconContainer.innerHTML = iconSvgMarkup;
      }
      proxy.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          triggerQuickAddSubmenuAction(mainMenu, labelHints);
        },
        true
      );
      return proxy;
    }

    function ensureQuickAddProxyItems(mainMenu, moreItem) {
      if (!mainMenu || !moreItem) return;
      const targetContainer =
        moreItem.parentElement && mainMenu.contains(moreItem.parentElement) ? moreItem.parentElement : null;
      if (!targetContainer) return;

      const templateItem =
        getMenuItems(mainMenu, true).find(
          (item) => item && item !== moreItem && item.dataset.cgptQuickAddProxy !== "1"
        ) || null;
      if (!templateItem) return;

      QUICK_ADD_PROXY_ITEMS.forEach((proxyDef) => {
        const realItem = findMenuItem(mainMenu, proxyDef.hints, true);
        if (realItem && realItem.dataset.cgptQuickAddProxy !== "1") return;

        const existingProxy = Array.from(targetContainer.querySelectorAll('[data-cgpt-quick-add-proxy="1"]')).find(
          (item) => item.dataset.cgptQuickAddProxyKey === proxyDef.key
        );
        if (existingProxy) return;

        const proxy = makeQuickAddProxyItem(templateItem, proxyDef.label, proxyDef.key, proxyDef.hints, mainMenu);
        if (!proxy) return;
        safeInsertMenuItem(targetContainer, proxy, moreItem);
      });
    }

    function moveQuickAddPriorityItemsToTop(mainMenu, moreItem) {
      if (!mainMenu) return;
      const items = getMenuItems(mainMenu, true);
      if (!items.length) return;

      const targetContainer =
        moreItem?.parentElement && mainMenu.contains(moreItem.parentElement) ? moreItem.parentElement : null;
      if (!targetContainer) return;

      const pinnedItems = [];
      QUICK_ADD_TOP_PRIORITY_HINT_GROUPS.forEach((hintGroup) => {
        const item = items.find((candidate) => {
          const label = getMenuItemLabel(candidate);
          if (!label) return false;
          return hintGroup.some((hint) => label.includes(hint));
        });
        if (item && mainMenu.contains(item) && !pinnedItems.includes(item)) {
          pinnedItems.push(item);
        }
      });
      if (!pinnedItems.length) return;

      const anchor = getMenuItems(mainMenu, true).find(
        (item) => item && item.parentElement === targetContainer && item !== moreItem && !pinnedItems.includes(item)
      );
      if (!anchor) return;

      pinnedItems.forEach((item) => {
        if (!item || !mainMenu.contains(item)) return;
        safeInsertMenuItem(targetContainer, item, anchor, moreItem);
      });
    }

    function promoteQuickAddMenuItems() {
      clearSuppressedQuickAddItems();
      clearQuickAddProxyItems();

      const allMenus = Array.from(
        new Set(
          Array.from(
            document.querySelectorAll(
              '[role="menu"], [data-radix-popper-content-wrapper], .popover[role="dialog"], .popover'
            )
          )
        )
      );
      const visibleMenus = allMenus.filter(isElementVisible);
      if (!visibleMenus.length) return;

      const mainMenu = visibleMenus.find(isQuickAddMenu);
      if (!mainMenu) return;

      const moreItem = findMenuItem(mainMenu, QUICK_ADD_MORE_LABELS);
      if (!moreItem) return;
      const targetContainer =
        moreItem.parentElement && mainMenu.contains(moreItem.parentElement) ? moreItem.parentElement : null;
      if (!targetContainer) return;

      const sourceMenus = allMenus.filter((menu) => menu !== mainMenu && isQuickAddSubmenu(menu, true));
      const mainLabels = new Set(getMenuItems(mainMenu, true).map(getMenuItemLabel).filter(Boolean));
      const seenLabels = new Set();
      const promoted = [];

      if (sourceMenus.length) {
        sourceMenus.forEach((sourceMenu) => {
          getMenuItems(sourceMenu, true).forEach((item) => {
            if (!item || item === moreItem) return;
            const label = getMenuItemLabel(item);
            if (!label) return;
            if (QUICK_ADD_MORE_LABELS.some((hint) => label.includes(hint))) return;
            if (!QUICK_ADD_PROMOTED_HINTS.some((hint) => label.includes(hint))) return;
            if (mainLabels.has(label) || seenLabels.has(label)) return;
            const priority = QUICK_ADD_PROMOTED_HINTS.findIndex((hint) => label.includes(hint));
            promoted.push({ item, label, priority: priority >= 0 ? priority : Number.MAX_SAFE_INTEGER });
            seenLabels.add(label);
          });
        });
      }

      promoted
        .sort((a, b) => a.priority - b.priority)
        .forEach(({ item, label }) => {
          item.dataset.cgptPromoted = "connector";
          if (!item || !mainMenu.contains(item)) return;
          safeInsertMenuItem(targetContainer, item, moreItem, null);
          mainLabels.add(label);
        });

      const promotedLabels = new Set(promoted.map(({ label }) => label).filter(Boolean));
      if (promotedLabels.size) {
        sourceMenus.forEach((sourceMenu) => {
          getMenuItems(sourceMenu, true).forEach((item) => {
            if (!item || targetContainer.contains(item)) return;
            const label = getMenuItemLabel(item);
            if (!label || !promotedLabels.has(label)) return;
            item.dataset.cgptQuickAddSuppressed = "1";
            item.setAttribute("aria-hidden", "true");
            item.style.setProperty("display", "none", "important");
          });
        });
      }

      ensureQuickAddProxyItems(mainMenu, moreItem);
      moveQuickAddPriorityItemsToTop(mainMenu, moreItem);
    }

    function clearQuickAddPromotionTimers() {
      quickAddPromotionTimers.forEach((timerId) => clearTimeout(timerId));
      quickAddPromotionTimers = [];
    }

    function queueQuickAddPromotion() {
      clearQuickAddPromotionTimers();
      [0, 60, 180].forEach((delay) => {
        const timerId = setTimeout(() => {
          promoteQuickAddMenuItems();
          quickAddPromotionTimers = quickAddPromotionTimers.filter((id) => id !== timerId);
        }, delay);
        quickAddPromotionTimers.push(timerId);
      });
    }

    function shouldTriggerQuickAddPromotionFromEventTarget(target) {
      if (!(target instanceof Element)) return false;
      if (target.closest('#composer-plus-btn, [data-testid="composer-plus-btn"]')) return true;

      const menuItem = target.closest(
        '[role="menuitemradio"], [role="menuitem"], button, [data-radix-collection-item], .__menu-item'
      );
      if (!menuItem) return false;

      const label = getMenuItemLabel(menuItem);
      if (!label) return false;
      return (
        QUICK_ADD_MORE_LABELS.some((hint) => label.includes(hint)) ||
        QUICK_ADD_MENU_HINTS.some((hint) => label.includes(hint)) ||
        QUICK_ADD_PROMOTED_HINTS.some((hint) => label.includes(hint))
      );
    }

    function textIncludesAllTokens(value, tokens) {
      const text = normalizeText(value);
      if (!text) return false;
      return tokens.every((token) => text.includes(token));
    }

    function nodeHasFullscreenControl(root) {
      if (!root) return false;
      const controls = root.querySelectorAll("[aria-label], [data-testid], [title]");
      for (const control of controls) {
        const labels = [
          control.getAttribute("aria-label"),
          control.getAttribute("data-testid"),
          control.getAttribute("title"),
        ];
        const combined = labels.map((value) => normalizeText(value)).join(" ");
        if (!combined) continue;
        if (RESEARCH_FULLSCREEN_TOKENS.some((token) => combined.includes(token))) {
          return true;
        }
      }
      return false;
    }

    function isValidResearchCardContainer(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
      if (node.querySelector('form[data-type="unified-composer"]')) return false;
      if (!node.closest("#thread, #main")) return false;
      if (!isElementVisible(node)) return false;

      const rect = node.getBoundingClientRect();
      const maxAllowedHeight = Math.max(window.innerHeight * 1.8, 2200);
      return (
        rect.width >= 480 &&
        rect.height >= 220 &&
        rect.width <= window.innerWidth * 1.2 &&
        rect.height <= maxAllowedHeight
      );
    }

    function scoreResearchCard(node) {
      const rect = node.getBoundingClientRect();
      const text = normalizeText(node.textContent);
      const hasBanner = RESEARCH_CARD_BANNER_TOKENS.every((token) => text.includes(token));
      const hasSummary = text.includes("executive summary");
      const hasHeading = !!node.querySelector("h1, h2, h3");
      const hasResearchIframe = !!node.querySelector(RESEARCH_EMBED_IFRAME_SELECTOR);
      const hasEmbeddedSurface = !!node.querySelector("iframe, canvas, video, object, embed");
      const interactiveCount = node.querySelectorAll("button, [role='button'], a[href]").length;
      const hasFullscreen = nodeHasFullscreenControl(node);

      let score = 0;
      if (hasBanner) score -= 90;
      if (hasSummary) score -= 70;
      if (hasHeading) score -= 20;
      if (hasResearchIframe) score -= 80;
      if (hasEmbeddedSurface) score -= 18;
      if (hasFullscreen) score -= 18;
      score -= Math.min(interactiveCount, 8) * 3;

      const targetWidth = Math.min(window.innerWidth * 0.86, 1220);
      score += Math.abs(rect.width - targetWidth) / 14;
      score += Math.abs(rect.height - 430) / 16;
      return score;
    }

    function tagResearchCardNode(taggedCards, node) {
      if (!(node instanceof Element)) return false;
      node.classList.add(RESEARCH_CARD_CLASS);
      taggedCards.add(node);
      return true;
    }

    function syncResearchCardState(node) {
      if (!(node instanceof Element)) return;
      const hasOpenResearchOverlay =
        !!node.querySelector(RESEARCH_EMBED_IFRAME_SELECTOR) && !!node.querySelector(RESEARCH_OVERLAY_HOST_SELECTOR);
      node.classList.toggle(RESEARCH_CARD_OPEN_CLASS, hasOpenResearchOverlay);
    }

    function findBestResearchCardAncestor(startNode, maxDepth = 34) {
      let node = startNode?.closest(RESEARCH_CARD_CONTAINER_SELECTOR) || null;
      let depth = 0;
      let bestNode = null;
      let bestScore = Number.POSITIVE_INFINITY;

      while (node && depth < maxDepth) {
        if (isValidResearchCardContainer(node)) {
          const score = scoreResearchCard(node) + depth * 0.8;
          if (score < bestScore) {
            bestScore = score;
            bestNode = node;
          }
          if (bestScore <= -55) break;
        }
        node = node.parentElement;
        depth += 1;
      }

      return bestNode;
    }

    function tagBestResearchCardAncestor(taggedCards, startNode, maxDepth = 34) {
      return tagResearchCardNode(taggedCards, findBestResearchCardAncestor(startNode, maxDepth));
    }

    function tagResearchCardCandidates(taggedCards, selector, maxDepth) {
      document.querySelectorAll(selector).forEach((node) => {
        tagBestResearchCardAncestor(taggedCards, node, maxDepth);
      });
    }

    function getResearchBannerNodes() {
      return Array.from(document.querySelectorAll("div, span, p")).filter((node) => {
        if (!isElementVisible(node)) return false;
        const text = normalizeText(node.textContent);
        if (!text || text.length > 280) return false;
        return RESEARCH_CARD_BANNER_TOKENS.every((token) => text.includes(token));
      });
    }

    function findBestResearchBannerCard(banner) {
      const bannerRect = banner.getBoundingClientRect();
      const scope = banner.closest("article, section, main, #thread") || document;
      let bestNode = null;
      let bestScore = Number.POSITIVE_INFINITY;

      scope.querySelectorAll(RESEARCH_CARD_CONTAINER_SELECTOR).forEach((candidate) => {
        if (!isValidResearchCardContainer(candidate)) return;
        const rect = candidate.getBoundingClientRect();
        const delta = rect.top - bannerRect.bottom;
        if (delta < -30 || delta > 380) return;
        const score = scoreResearchCard(candidate) + delta * 0.45;
        if (score < bestScore) {
          bestScore = score;
          bestNode = candidate;
        }
      });

      return bestNode;
    }

    function tagResearchBannerCards(taggedCards) {
      getResearchBannerNodes().forEach((banner) => {
        if (tagBestResearchCardAncestor(taggedCards, banner, 26)) return;
        tagResearchCardNode(taggedCards, findBestResearchBannerCard(banner));
      });
    }

    function syncResearchCardClasses(taggedCards) {
      document.querySelectorAll(`.${RESEARCH_CARD_CLASS}`).forEach((node) => {
        if (!taggedCards.has(node)) {
          node.classList.remove(RESEARCH_CARD_CLASS);
          node.classList.remove(RESEARCH_CARD_OPEN_CLASS);
          return;
        }
        syncResearchCardState(node);
      });
    }

    function markResearchReportCards() {
      const taggedCards = new Set();
      tagResearchCardCandidates(taggedCards, RESEARCH_EMBED_IFRAME_SELECTOR, 24);
      tagResearchCardCandidates(taggedCards, RESEARCH_CONTROL_SELECTOR, 36);

      if (taggedCards.size === 0) {
        tagResearchCardCandidates(taggedCards, RESEARCH_REPORT_MARKER_SELECTOR, 36);
      }
      if (taggedCards.size === 0) {
        tagResearchBannerCards(taggedCards);
      }
      if (taggedCards.size === 0) {
        const contentAnchors = Array.from(document.querySelectorAll("h1, h2, h3, div, p, span")).filter((node) =>
          textIncludesAllTokens(node.textContent, RESEARCH_CARD_CONTENT_TOKENS)
        );
        contentAnchors.forEach((anchor) => {
          tagBestResearchCardAncestor(taggedCards, anchor, 24);
        });
      }

      syncResearchCardClasses(taggedCards);
    }

    function hasCanvasActionHeader(node) {
      if (!node) return false;
      const headerText = normalizeText(node.querySelector(".sticky")?.textContent || "");
      if (!headerText) return false;
      return CANVAS_ACTION_SETS.some((tokens) => textIncludesAllTokens(headerText, tokens));
    }

    function markCanvasSurfaces() {
      const taggedSurfaces = new Set();
      const turnRoots = document.querySelectorAll(
        'article[data-testid^="conversation-turn-"], .group\\/conversation-turn'
      );

      turnRoots.forEach((turn) => {
        const candidates = turn.querySelectorAll(
          '[id^="textdoc-message-"], .popover[class*="bg-token-bg-primary"], .popover[class*="bg-token-main-surface"]'
        );
        candidates.forEach((node) => {
          if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.querySelector('form[data-type="unified-composer"]')) return;
          if (!isElementVisible(node)) return;

          const rect = node.getBoundingClientRect();
          if (rect.width < 320 || rect.height < 220) return;

          const isKnownTextdoc = String(node.id || "").startsWith("textdoc-message-");
          if (!isKnownTextdoc && !hasCanvasActionHeader(node)) return;

          node.classList.add(CANVAS_SURFACE_CLASS);
          taggedSurfaces.add(node);
        });
      });

      document.querySelectorAll(`.${CANVAS_SURFACE_CLASS}`).forEach((node) => {
        if (!taggedSurfaces.has(node)) {
          node.classList.remove(CANVAS_SURFACE_CLASS);
        }
      });
    }

    const tagVisibleNodes = (nextTaggedNodes, nodes, surface, glass = "raised") => {
      nodes.forEach((node) => {
        if (!isElementVisible(node)) return;
        tagSurfaceNode(nextTaggedNodes, node, surface, glass);
      });
    };

    const isResearchDialogNode = (node) => {
      if (!(node instanceof Element)) return false;
      if (node.matches?.(RESEARCH_DIALOG_SELECTOR)) return true;
      return !!node.querySelector(RESEARCH_EMBED_IFRAME_SELECTOR);
    };

    const tagResearchSurfaceNodes = (nextTaggedNodes) => {
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(`.${RESEARCH_CARD_CLASS}`), "research-viewer");
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(RESEARCH_VIEWER_HOST_SELECTOR), "research-viewer");
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(RESEARCH_OVERLAY_HOST_SELECTOR), "research-overlay");
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(RESEARCH_HOME_SELECTOR), "research-home");
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(RESEARCH_HOME_CARD_SELECTOR), "research-card");
      tagVisibleNodes(
        nextTaggedNodes,
        document.querySelectorAll(RESEARCH_AGENDA_ITEM_SELECTOR),
        "research-agenda-item",
        "interactive"
      );
    };

    const tagDialogNodes = (nextTaggedNodes) => {
      const dialogs = document.querySelectorAll(
        '.popover[role="dialog"], div[role="dialog"], [data-testid="stage-thread-flyout"]'
      );
      dialogs.forEach((node) => {
        if (!isElementVisible(node)) return;
        if (node.matches?.('[data-testid="stage-thread-flyout"]')) {
          tagSurfaceNode(nextTaggedNodes, node, "activity-flyout", "raised");
          return;
        }
        if (isResearchDialogNode(node)) {
          tagSurfaceNode(nextTaggedNodes, node, "research-viewer", "raised");
          return;
        }
        const surface = node.querySelector('input#search, input[type="search"]') ? "search-panel" : "dialog";
        tagSurfaceNode(nextTaggedNodes, node, surface, surface === "search-panel" ? "interactive" : "raised");
      });
    };

    function markSemanticSurfaces() {
      const nextTaggedNodes = new Set();
      tagVisibleNodes(
        nextTaggedNodes,
        document.querySelectorAll('[data-testid="stage-thread-flyout"], section[data-testid="screen-threadFlyOut"]'),
        "activity-flyout"
      );
      tagResearchSurfaceNodes(nextTaggedNodes);
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(`.${CANVAS_SURFACE_CLASS}`), "canvas-surface");
      tagVisibleNodes(
        nextTaggedNodes,
        document.querySelectorAll('[role="tooltip"], .bg-black[data-state*="open"]'),
        "tooltip"
      );
      tagDialogNodes(nextTaggedNodes);
      tagVisibleNodes(
        nextTaggedNodes,
        document.querySelectorAll('.popover[data-radix-menu-content], [role="menu"]'),
        "menu",
        "interactive"
      );
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll('[role="listbox"]'), "listbox", "interactive");
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll('[role="alert"], [role="status"]'), "toast");
      tagVisibleNodes(
        nextTaggedNodes,
        document.querySelectorAll(
          'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"] :is(button, a)[class*="rounded-full"]:is([class*="bg-token-bg-"], [class*="bg-token-main-surface"], .bg-black)'
        ),
        "source-chip",
        "interactive"
      );
      commitTaggedSurfaceNodes(nextTaggedNodes);
    }

    // Project/home shells occasionally mount the desktop composer as fit-content;
    // re-measure after SPA mutations and pin a sane width before the user refreshes.
    function syncComposerLayout() {
      const widenedForms = new Set();

      if (window.innerWidth < DESKTOP_COMPOSER_FIX_MIN_VIEWPORT) {
        document
          .querySelectorAll(`form[data-type="unified-composer"][${FORCED_WIDE_COMPOSER_ATTR}]`)
          .forEach(clearForcedWideComposer);
        return;
      }

      document.querySelectorAll('form[data-type="unified-composer"]').forEach((form) => {
        if (!(form instanceof HTMLElement) || !form.isConnected) return;
        if (!form.querySelector("#prompt-textarea, .ProseMirror, textarea")) {
          clearForcedWideComposer(form);
          return;
        }
        if (
          form.closest(
            '[role="dialog"], [data-testid="stage-thread-flyout"], section[data-testid="screen-threadFlyOut"], #stage-slideover-sidebar'
          )
        ) {
          return;
        }

        const rect = form.getBoundingClientRect();
        const hasProjectTrigger = !!document.querySelector('button[data-testid="project-modal-trigger"]');
        const isUnexpectedlyCompact =
          rect.width > 0 && rect.width < Math.min(COMPACT_COMPOSER_MAX_WIDTH, window.innerWidth * 0.5);
        if (!(hasProjectTrigger || isUnexpectedlyCompact)) {
          clearForcedWideComposer(form);
          return;
        }

        const widthCandidates = [
          form.closest("#thread-bottom-container"),
          document.getElementById("thread-bottom-container"),
          form.closest("main"),
          document.querySelector("main"),
        ]
          .filter((node) => node instanceof HTMLElement)
          .map((node) => node.getBoundingClientRect().width)
          .filter((width) => Number.isFinite(width) && width > COMPACT_COMPOSER_MAX_WIDTH);

        const containerWidth = widthCandidates[0] || window.innerWidth;
        const targetWidth = Math.min(
          COMPOSER_DESKTOP_MAX_WIDTH_PX,
          window.innerWidth - COMPOSER_SIDE_GUTTER_PX,
          containerWidth - COMPOSER_SIDE_GUTTER_PX
        );

        if (!Number.isFinite(targetWidth) || targetWidth <= COMPACT_COMPOSER_MAX_WIDTH) {
          clearForcedWideComposer(form);
          return;
        }

        widenedForms.add(form);
        form.setAttribute(FORCED_WIDE_COMPOSER_ATTR, "1");
        form.style.setProperty(COMPOSER_TARGET_WIDTH_VAR, `${Math.round(targetWidth)}px`);
      });

      document.querySelectorAll(`form[data-type="unified-composer"][${FORCED_WIDE_COMPOSER_ATTR}]`).forEach((form) => {
        if (!widenedForms.has(form)) {
          clearForcedWideComposer(form);
        }
      });
    }

    function queueComposerLayoutSync() {
      if (composerLayoutFrame) {
        cancelAnimationFrame(composerLayoutFrame);
      }
      composerLayoutFrame = requestAnimationFrame(() => {
        composerLayoutFrame = null;
        syncComposerLayout();
      });
    }

    function ensureAppOnTop() {
      const app =
        getCachedElementById("__next") ||
        getCachedElementById("root") ||
        getCachedElement("main") ||
        document.body.firstElementChild;
      if (!app) return;
      const cs = getComputedStyle(app);
      if (cs.position === "static") app.style.position = "relative";
      if (!app.style.zIndex || parseInt(app.style.zIndex || "0", 10) < 0) app.style.zIndex = "0";
    }

    function makeBgNode() {
      const wrap = document.createElement("div");
      wrap.id = ID;
      wrap.setAttribute("aria-hidden", "true");
      Object.assign(wrap.style, {
        position: "fixed",
        inset: "0",
        zIndex: "-1",
        pointerEvents: "none",
      });

      const createLayerContent = () => `
      <div class="animated-bg">
        <div class="blob"></div><div class="blob"></div><div class="blob"></div>
      </div>
      <video playsinline autoplay muted loop></video>
      <picture>
        <source type="image/webp" srcset="">
        <img alt="" aria-hidden="true" sizes="100vw" loading="eager" fetchpriority="high" src="" srcset="">
      </picture>
    `;

      wrap.innerHTML = `
      <div class="media-layer active" data-layer-id="a">${createLayerContent()}</div>
      <div class="media-layer" data-layer-id="b">${createLayerContent()}</div>
      <div class="haze"></div>
      <div class="overlay"></div>
    `;
      return wrap;
    }

    let activeLayerId = "a";
    let isTransitioning = false;
    let currentBackgroundUrl = null;
    const backgroundTransitionQueue = [];
    let backgroundTransitionTimer = null;

    const normalizeBackgroundUrl = (rawUrl) => {
      let url = rawUrl;
      const sanitizedUrl = sanitizeBackgroundUrl(url || "");
      if (sanitizedUrl !== url) {
        url = sanitizedUrl;
        settings.customBgUrl = sanitizedUrl;
        if (chrome?.storage?.sync?.set) {
          chrome.storage.sync.set({ customBgUrl: sanitizedUrl });
        }
      }
      return url || "";
    };

    const enqueueBackgroundTransition = (url) => {
      const nextUrl = url || "";
      const lastQueued = backgroundTransitionQueue[backgroundTransitionQueue.length - 1];
      if (lastQueued === nextUrl) return;
      if (!isTransitioning && backgroundTransitionQueue.length === 0 && nextUrl === currentBackgroundUrl) return;
      backgroundTransitionQueue.push(nextUrl);
    };

    const drainBackgroundTransitionQueue = () => {
      if (isTransitioning || backgroundTransitionQueue.length === 0) return;
      const nextUrl = backgroundTransitionQueue.shift();
      updateBackgroundImage(nextUrl);
    };

    function updateBackgroundImage(requestedUrl = settings.customBgUrl) {
      const bgNode = getCachedElementById(ID);
      if (!bgNode) return;

      const url = normalizeBackgroundUrl(requestedUrl);
      if (isTransitioning) {
        enqueueBackgroundTransition(url);
        return;
      }
      if (url === currentBackgroundUrl) return;

      const inactiveLayerId = activeLayerId === "a" ? "b" : "a";
      const activeLayer = bgNode.querySelector(`.media-layer[data-layer-id="${activeLayerId}"]`);
      const inactiveLayer = bgNode.querySelector(`.media-layer[data-layer-id="${inactiveLayerId}"]`);

      if (!activeLayer || !inactiveLayer) return;
      isTransitioning = true;

      // --- Prepare inactive layer for new content ---
      inactiveLayer.classList.remove("gpt5-active");
      inactiveLayer.classList.remove("jet-active");
      inactiveLayer.classList.remove("aurora-active");
      inactiveLayer.classList.remove("sunset-active");
      inactiveLayer.classList.remove("ocean-active");
      const inactiveImg = inactiveLayer.querySelector("img");
      const inactiveSource = inactiveLayer.querySelector("source");
      const inactiveVideo = inactiveLayer.querySelector("video");

      const transitionToInactive = () => {
        inactiveLayer.classList.add("active");
        activeLayer.classList.remove("active");
        activeLayerId = inactiveLayerId;
        if (backgroundTransitionTimer) {
          clearTimeout(backgroundTransitionTimer);
        }
        backgroundTransitionTimer = setTimeout(() => {
          backgroundTransitionTimer = null;
          isTransitioning = false;
          currentBackgroundUrl = url;
          drainBackgroundTransitionQueue();
        }, TRANSITION_DURATION_MS);
      };

      // --- Handle different background types ---
      if (url === GPT5_ANIMATED_KEY) {
        inactiveLayer.classList.add("gpt5-active");
        transitionToInactive();
        return;
      }

      if (url === JET_KEY) {
        inactiveLayer.classList.add("jet-active");
        transitionToInactive();
        return;
      }

      if (url === AURORA_KEY) {
        inactiveLayer.classList.add("aurora-active");
        transitionToInactive();
        return;
      }

      if (url === SUNSET_KEY) {
        inactiveLayer.classList.add("sunset-active");
        transitionToInactive();
        return;
      }

      if (url === OCEAN_KEY) {
        inactiveLayer.classList.add("ocean-active");
        transitionToInactive();
        return;
      }

      const defaultWebpSrcset = DEFAULT_BG_URL ? `${DEFAULT_BG_URL} 1x` : "";
      const defaultImgSrc = DEFAULT_BG_URL;
      const videoExtensions = [".mp4", ".webm", ".ogv"];

      const applyMedia = (mediaUrl) => {
        const isVideo =
          videoExtensions.some((ext) => mediaUrl.toLowerCase().includes(ext)) || mediaUrl.startsWith("data:video");
        inactiveImg.style.display = isVideo ? "none" : "block";
        inactiveVideo.style.display = isVideo ? "block" : "none";

        const mediaEl = isVideo ? inactiveVideo : inactiveImg;
        const eventType = isVideo ? "loadeddata" : "load";

        const onMediaReady = () => {
          transitionToInactive();
          mediaEl.removeEventListener(eventType, onMediaReady);
          mediaEl.removeEventListener("error", onMediaReady);
        };

        mediaEl.addEventListener(eventType, onMediaReady, { once: true });
        mediaEl.addEventListener("error", onMediaReady, { once: true });

        if (isVideo) {
          inactiveVideo.src = mediaUrl;
          inactiveVideo.load();
          inactiveVideo.play().catch((_e) => {});
          inactiveImg.src = "";
          inactiveImg.srcset = "";
          inactiveSource.srcset = "";
        } else {
          inactiveImg.src = mediaUrl;
          inactiveImg.srcset = "";
          inactiveSource.srcset = "";
          inactiveVideo.src = "";
        }
      };

      const applyDefault = () => {
        inactiveImg.style.display = "block";
        inactiveVideo.style.display = "none";
        inactiveVideo.src = "";

        const onMediaReady = () => {
          transitionToInactive();
          inactiveImg.removeEventListener("load", onMediaReady);
          inactiveImg.removeEventListener("error", onMediaReady);
        };
        inactiveImg.addEventListener("load", onMediaReady, { once: true });
        inactiveImg.addEventListener("error", onMediaReady, { once: true });

        inactiveImg.src = defaultImgSrc;
        inactiveImg.srcset = defaultWebpSrcset;
        inactiveSource.srcset = defaultWebpSrcset;
      };

      if (url) {
        applyMedia(url);
      } else {
        applyDefault();
      }
    }

    const getClampedBlurValue = (rawValue) =>
      clampBackgroundBlur(rawValue, { min: MIN_BG_BLUR, max: MAX_BG_BLUR, fallback: 60 });
    const getClampedContentWidthValue = (rawValue) =>
      Number.parseInt(
        sanitizeContentWidth(rawValue, { min: MIN_CONTENT_WIDTH, max: MAX_CONTENT_WIDTH, fallback: 95 }),
        10
      );

    function applyCustomStyles() {
      const ensureAndApply = () => {
        let styleNode = document.getElementById(STYLE_ID);
        if (!styleNode) {
          styleNode = document.createElement("style");
          styleNode.id = STYLE_ID;
          (document.head || document.documentElement || document.body)?.appendChild(styleNode);
        }
        const clampedBlur = getClampedBlurValue(settings.backgroundBlur);
        const blurPx = `${clampedBlur}px`;
        const clampedContentWidth = getClampedContentWidthValue(settings.contentWidth);
        const contentWidthPercent = `${clampedContentWidth}%`;
        const scaling = sanitizeBackgroundScaling(settings.backgroundScaling);
        const newContent = `
        :root {
          --cgpt-thread-content-width: ${contentWidthPercent};
        }
        #${ID} {
          --cgpt-bg-blur-radius: ${blurPx};
          opacity: 0;
          transition: opacity 500ms ease-in-out;
        }
        #${ID}.bg-visible {
          opacity: 1;
        }
        #${ID} img, #${ID} video {
          object-fit: ${scaling};
        }
        .${BG_ANIM_DISABLED_CLASS} #${ID} {
            transition: none !important;
        }
      `;
        if (styleNode.textContent !== newContent) {
          styleNode.textContent = newContent;
        }
      };
      if (!document.head && !document.body) {
        if (!applyStylesDomReadyHandler) {
          applyStylesDomReadyHandler = () => {
            applyStylesDomReadyHandler = null;
            ensureAndApply();
          };
          document.addEventListener("DOMContentLoaded", applyStylesDomReadyHandler, {
            once: true,
          });
        }
        return;
      }
      ensureAndApply();
    }

    let qsInitScheduled = false;

    // Debounced storage writer to prevent quota errors
    let storageWriteQueue = {};
    let storageWriteTimer = null;
    const flushStorageQueue = () => {
      storageWriteTimer = null;
      if (Object.keys(storageWriteQueue).length === 0) return;
      const batch = storageWriteQueue;
      storageWriteQueue = {};
      if (chrome?.storage?.sync?.set) {
        chrome.storage.sync.set(batch, () => {
          if (chrome.runtime.lastError) {
            console.error("Aether: Storage write failed:", chrome.runtime.lastError.message);
            // Re-queue failed writes for retry
            Object.assign(storageWriteQueue, batch);
            storageWriteTimer = setTimeout(flushStorageQueue, 1000);
          }
        });
      }
    };
    const queueStorageWrite = (key, value) => {
      storageWriteQueue[key] = value;
      if (storageWriteTimer) clearTimeout(storageWriteTimer);
      storageWriteTimer = setTimeout(flushStorageQueue, STORAGE_FLUSH_DELAY_MS);
    };

    function setupQuickSettingsToggles(settings) {
      const toggleConfig = [
        { id: "qs-hideUpgradeButtons", key: "hideUpgradeButtons" },
        { id: "qs-hideGptsButton", key: "hideGptsButton" },
        { id: "qs-hideTodaysPulse", key: "hideTodaysPulse" },
        { id: "qs-hideShoppingButton", key: "hideShoppingButton" },
        { id: "qs-blurChatHistory", key: "blurChatHistory" },
      ];

      toggleConfig.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) {
          el.checked = !!settings[key];
          if (!el.dataset.cgptToggleBound) {
            el.addEventListener("change", () => {
              queueStorageWrite(key, el.checked);
            });
            el.dataset.cgptToggleBound = "true";
          }
        }
      });
    }

    function manageQuickSettingsUI() {
      if (!document.body) {
        if (!qsInitScheduled) {
          qsInitScheduled = true;
          qsInitDomReadyHandler = () => {
            qsInitScheduled = false;
            qsInitDomReadyHandler = null;
            manageQuickSettingsUI();
          };
          document.addEventListener("DOMContentLoaded", qsInitDomReadyHandler, { once: true });
        }
        return;
      }
      let btn = document.getElementById(QS_BUTTON_ID);
      let panel = document.getElementById(QS_PANEL_ID);

      const openPanel = () => {
        const activePanel = document.getElementById(QS_PANEL_ID);
        if (activePanel) {
          activePanel.setAttribute("data-state", "open");
          activePanel.setAttribute("aria-hidden", "false");
          const activeButton = document.getElementById(QS_BUTTON_ID);
          if (activeButton) activeButton.setAttribute("aria-expanded", "true");
          if (typeof activePanel.focus === "function") {
            activePanel.focus({ preventScroll: true });
          }
        }
      };

      const closePanel = (restoreFocus = false) => {
        const activePanel = document.getElementById(QS_PANEL_ID);
        if (activePanel) {
          activePanel.setAttribute("data-state", "closing");
          activePanel.setAttribute("aria-hidden", "true");
          const activeButton = document.getElementById(QS_BUTTON_ID);
          if (activeButton) {
            activeButton.setAttribute("aria-expanded", "false");
            if (restoreFocus && typeof activeButton.focus === "function") {
              activeButton.focus({ preventScroll: true });
            }
          }
        }
      };

      const ensurePanel = () => {
        if (!panel) {
          panel = document.createElement("div");
          panel.id = QS_PANEL_ID;
          document.body.appendChild(panel);
        }

        if (!panel.hasAttribute("data-state")) {
          panel.setAttribute("data-state", "closed");
        }
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "false");
        panel.setAttribute("aria-label", getMessage("quickSettingsButtonTitle"));
        panel.setAttribute("aria-hidden", panel.getAttribute("data-state") === "open" ? "false" : "true");
        panel.setAttribute("tabindex", "-1");

        if (!panel.dataset.qsAnimBound) {
          panel.addEventListener("animationend", (e) => {
            const target = e.currentTarget;
            if (e.animationName === "qs-panel-close" && target.getAttribute("data-state") === "closing") {
              target.setAttribute("data-state", "closed");
            }
          });
          panel.dataset.qsAnimBound = "true";
        }
      };

      const syncAppearanceButtons = () => {
        if (!panel) return;
        panel.querySelectorAll("[data-appearance]").forEach((btn) => {
          const isActive = (settings.appearance || "dimmed") === btn.dataset.appearance;
          btn.classList.toggle("active", isActive);
          btn.setAttribute("aria-pressed", String(isActive));
        });
      };

      const syncThemeButtons = () => {
        if (!panel) return;
        panel.querySelectorAll("[data-theme]").forEach((btn) => {
          const isActive = (settings.theme || "auto") === btn.dataset.theme;
          btn.classList.toggle("active", isActive);
          btn.setAttribute("aria-pressed", String(isActive));
        });
      };

      const syncBackgroundTiles = () => {
        if (!panel) return;
        const normalizedUrl = sanitizeBackgroundUrl(settings.customBgUrl || "");
        const activePresetId = resolveBackgroundPresetId(normalizedUrl);
        panel.querySelectorAll(".qs-bg-tile").forEach((tile) => {
          tile.classList.toggle("active", tile.dataset.bgKey === activePresetId);
        });
      };

      const syncBlurControls = () => {
        if (!panel) return;
        const blurSlider = panel.querySelector("#qs-blur-slider");
        const blurValue = panel.querySelector("#qs-blur-value");
        if (!blurSlider || !blurValue) return;
        const currentBlur = getClampedBlurValue(settings.backgroundBlur);
        blurSlider.min = String(MIN_BG_BLUR);
        blurSlider.max = String(MAX_BG_BLUR);
        blurSlider.value = String(currentBlur);
        blurValue.textContent = String(currentBlur);
      };

      const syncContentWidthControls = () => {
        if (!panel) return;
        const widthSlider = panel.querySelector("#qs-content-width-slider");
        const widthValue = panel.querySelector("#qs-content-width-value");
        if (!widthSlider || !widthValue) return;
        const currentWidth = getClampedContentWidthValue(settings.contentWidth);
        widthSlider.min = String(MIN_CONTENT_WIDTH);
        widthSlider.max = String(MAX_CONTENT_WIDTH);
        widthSlider.value = String(currentWidth);
        widthValue.textContent = String(currentWidth);
      };

      if (!btn) {
        btn = document.createElement("button");
        btn.id = QS_BUTTON_ID;
        btn.title = getMessage("quickSettingsButtonTitle");
        btn.setAttribute("aria-label", getMessage("quickSettingsButtonTitle"));
        btn.setAttribute("aria-haspopup", "dialog");
        btn.setAttribute("aria-controls", QS_PANEL_ID);
        btn.setAttribute("aria-expanded", "false");
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5A3.5 3.5 0 0 1 15.5 12A3.5 3.5 0 0 1 12 15.5M19.43 12.98C19.47 12.65 19.5 12.33 19.5 12S19.47 11.35 19.43 11L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.96 19.05 5.05L16.56 6.05C16.04 5.66 15.5 5.32 14.87 5.07L14.5 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.5 2.42L9.13 5.07C8.5 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11C4.53 11.35 4.5 11.67 4.5 12S4.53 12.65 4.57 12.98L2.46 14.63C2.27 14.78 2.21 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.04 4.95 18.95L7.44 17.94C7.96 18.34 8.5 18.68 9.13 18.93L9.5 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.5 21.58L14.87 18.93C15.5 18.68 16.04 18.34 16.56 17.94L19.05 18.95C19.27 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98Z"></path></svg>`;
        document.body.appendChild(btn);

        ensurePanel();

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const activePanel = document.getElementById(QS_PANEL_ID);
          if (!activePanel) return;
          const state = activePanel.getAttribute("data-state");
          if (state === "closed") {
            openPanel();
          } else if (state === "open") {
            closePanel(true);
          }
        });

        if (!qsDocumentClickBound) {
          qsDocumentClickHandler = (e) => {
            const activePanel = document.getElementById(QS_PANEL_ID);
            if (activePanel && !activePanel.contains(e.target) && activePanel.getAttribute("data-state") === "open") {
              closePanel();
            }
          };
          document.addEventListener("click", qsDocumentClickHandler);
          qsDocumentClickBound = true;
        }
        if (!qsDocumentKeydownBound) {
          qsDocumentKeydownHandler = (e) => {
            if (e.key !== "Escape") return;
            const activePanel = document.getElementById(QS_PANEL_ID);
            if (activePanel && activePanel.getAttribute("data-state") === "open") {
              e.preventDefault();
              closePanel(true);
            }
          };
          document.addEventListener("keydown", qsDocumentKeydownHandler);
          qsDocumentKeydownBound = true;
        }
      } else {
        ensurePanel();
      }

      if (panel.getAttribute("data-initialized") === "true") {
        setupQuickSettingsToggles(settings);
        // Sync UI state when already initialized
        syncAppearanceButtons();
        syncThemeButtons();
        syncBackgroundTiles();
        syncBlurControls();
        syncContentWidthControls();
        return;
      }
      panel.setAttribute("data-initialized", "true");

      panel.innerHTML = `
      <div class="qs-section-title">${t("quickSettingsSectionVisibility")}</div>

      <div class="qs-row" data-setting="hideUpgradeButtons">
          <label>${t("quickSettingsLabelHideUpgradeButtons")}</label>
          <label class="switch"><input type="checkbox" id="qs-hideUpgradeButtons"><span class="track"><span class="thumb"></span></span></label>
      </div>
      <div class="qs-row" data-setting="hideGptsButton">
          <label>${t("quickSettingsLabelHideGptsButton")}</label>
          <label class="switch"><input type="checkbox" id="qs-hideGptsButton"><span class="track"><span class="thumb"></span></span></label>
      </div>
      <div class="qs-row" data-setting="hideTodaysPulse">
          <label>${t("quickSettingsLabelHideTodaysPulse")}</label>
          <label class="switch"><input type="checkbox" id="qs-hideTodaysPulse"><span class="track"><span class="thumb"></span></span></label>
      </div>
      <div class="qs-row" data-setting="hideShoppingButton">
          <label>${t("quickSettingsLabelHideShoppingButton")}</label>
          <label class="switch"><input type="checkbox" id="qs-hideShoppingButton"><span class="track"><span class="thumb"></span></span></label>
      </div>
      <div class="qs-row" data-setting="blurChatHistory">
          <label>${t("quickSettingsLabelStreamerMode")}</label>
          <label class="switch"><input type="checkbox" id="qs-blurChatHistory"><span class="track"><span class="thumb"></span></span></label>
      </div>
      <div class="qs-row" data-setting="appearance">
          <label>${t("quickSettingsLabelGlassStyle")}</label>
          <div class="qs-pill-group" role="group" aria-label="${t("quickSettingsLabelGlassStyle")}">
            <button type="button" class="qs-pill" data-appearance="clear">${t("glassAppearanceOptionClear")}</button>
            <button type="button" class="qs-pill" data-appearance="dimmed">${t("glassAppearanceOptionDimmed")}</button>
          </div>
      </div>
      <div class="qs-row" data-setting="theme">
          <label>${t("quickSettingsLabelTheme")}</label>
          <div class="qs-pill-group" role="group" aria-label="${t("quickSettingsLabelTheme")}">
            <button type="button" class="qs-pill" data-theme="auto">${t("themeOptionAuto")}</button>
            <button type="button" class="qs-pill" data-theme="light">${t("themeOptionLight")}</button>
            <button type="button" class="qs-pill" data-theme="dark">${t("themeOptionDark")}</button>
          </div>
      </div>
      <div class="qs-section-title">${t("quickSettingsLabelBackground")}</div>
      <div class="qs-row qs-bg-row" data-setting="background">
          <div class="qs-bg-grid" id="qs-bg-grid"></div>
      </div>
      <div class="qs-row qs-blur-row" data-setting="blur">
          <label>${t("labelBlur")}</label>
          <div class="qs-range-control">
            <input type="range" id="qs-blur-slider" min="${MIN_BG_BLUR}" max="${MAX_BG_BLUR}" step="1" />
            <span id="qs-blur-value">60</span><span class="qs-blur-unit">px</span>
          </div>
      </div>
      <div class="qs-row qs-content-width-row" data-setting="contentWidth">
          <label>${t("quickSettingsLabelContentWidth")}</label>
          <div class="qs-range-control">
            <input
              type="range"
              id="qs-content-width-slider"
              min="${MIN_CONTENT_WIDTH}"
              max="${MAX_CONTENT_WIDTH}"
              step="1"
            />
            <span id="qs-content-width-value">95</span><span class="qs-blur-unit">%</span>
          </div>
      </div>
    `;

      setupQuickSettingsToggles(settings);

      const appearanceButtons = Array.from(panel.querySelectorAll("[data-appearance]"));
      syncAppearanceButtons();
      appearanceButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const value = btn.dataset.appearance;
          queueStorageWrite("appearance", value);
        });
      });

      // Theme toggle buttons
      const themeButtons = Array.from(panel.querySelectorAll("[data-theme]"));
      syncThemeButtons();
      themeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const value = btn.dataset.theme;
          queueStorageWrite("theme", value);
        });
      });

      // Background preset grid
      const bgGrid = document.getElementById("qs-bg-grid");
      if (bgGrid) {
        const activeBgPresetId = resolveBackgroundPresetId(sanitizeBackgroundUrl(settings.customBgUrl || ""));

        bgGrid.innerHTML = QUICK_SETTINGS_BG_PRESETS.map((preset) => {
          const isActive = activeBgPresetId === preset.key;
          const classes = ["qs-bg-tile", isActive ? "active" : "", preset.animated ? "is-animated" : ""]
            .filter(Boolean)
            .join(" ");
          const thumbStyle = preset.thumb ? ` style="--qs-bg-thumb: url('${escapeHtml(preset.thumb)}');"` : "";
          return `
        <button type="button" class="${classes}" data-bg-key="${preset.key}" data-bg-url="${escapeHtml(preset.url)}"${thumbStyle}>
          <span class="qs-bg-label">${escapeHtml(preset.label)}</span>
        </button>
      `;
        }).join("");

        bgGrid.querySelectorAll(".qs-bg-tile").forEach((tile) => {
          tile.addEventListener("click", () => {
            const nextUrl = sanitizeBackgroundUrl(tile.dataset.bgUrl || "");
            if (nextUrl !== settings.customBgUrl) {
              settings.customBgUrl = nextUrl;
              updateBackgroundImage(nextUrl);
            }
            queueStorageWrite("customBgUrl", nextUrl);
            bgGrid.querySelectorAll(".qs-bg-tile").forEach((t) => t.classList.remove("active"));
            tile.classList.add("active");
          });
        });
        syncBackgroundTiles();
      }

      // Blur slider control
      const blurSlider = document.getElementById("qs-blur-slider");
      const blurValue = document.getElementById("qs-blur-value");
      if (blurSlider && blurValue) {
        const currentBlur = getClampedBlurValue(settings.backgroundBlur);
        blurSlider.min = String(MIN_BG_BLUR);
        blurSlider.max = String(MAX_BG_BLUR);
        blurSlider.value = String(currentBlur);
        blurValue.textContent = String(currentBlur);

        let blurRaf = null;
        let pendingBlur = null;
        let blurSaveTimer = null;
        let pendingSaveValue = null;

        const applyBlurValue = (value) => {
          if (value === settings.backgroundBlur) return;
          settings.backgroundBlur = value;
          applyCustomStyles();
        };

        const scheduleBlurApply = (value) => {
          pendingBlur = value;
          if (blurRaf) return;
          blurRaf = requestAnimationFrame(() => {
            blurRaf = null;
            if (pendingBlur !== null) {
              applyBlurValue(pendingBlur);
            }
          });
        };

        const flushBlurSave = () => {
          if (pendingSaveValue === null) return;
          const valueToSave = pendingSaveValue;
          pendingSaveValue = null;
          if (chrome?.storage?.sync?.set) {
            chrome.storage.sync.set({ backgroundBlur: valueToSave });
          }
        };

        const scheduleBlurSave = (value) => {
          pendingSaveValue = value;
          if (blurSaveTimer) return;
          blurSaveTimer = setTimeout(() => {
            blurSaveTimer = null;
            flushBlurSave();
          }, BLUR_SAVE_DELAY_MS);
        };

        blurSlider.addEventListener("input", () => {
          const newBlur = getClampedBlurValue(blurSlider.value);
          if (blurSlider.value !== String(newBlur)) {
            blurSlider.value = String(newBlur);
          }
          blurValue.textContent = String(newBlur);
          const stringBlur = String(newBlur);
          scheduleBlurApply(stringBlur);
          scheduleBlurSave(stringBlur);
        });

        blurSlider.addEventListener("change", () => {
          const newBlur = getClampedBlurValue(blurSlider.value);
          if (blurSlider.value !== String(newBlur)) {
            blurSlider.value = String(newBlur);
          }
          blurValue.textContent = String(newBlur);
          if (blurSaveTimer) {
            clearTimeout(blurSaveTimer);
            blurSaveTimer = null;
          }
          pendingSaveValue = String(newBlur);
          flushBlurSave();
        });
      }

      // Content width slider control
      const contentWidthSlider = document.getElementById("qs-content-width-slider");
      const contentWidthValue = document.getElementById("qs-content-width-value");
      if (contentWidthSlider && contentWidthValue) {
        const currentContentWidth = getClampedContentWidthValue(settings.contentWidth);
        contentWidthSlider.min = String(MIN_CONTENT_WIDTH);
        contentWidthSlider.max = String(MAX_CONTENT_WIDTH);
        contentWidthSlider.value = String(currentContentWidth);
        contentWidthValue.textContent = String(currentContentWidth);

        let widthRaf = null;
        let pendingWidth = null;
        let widthSaveTimer = null;
        let pendingWidthSaveValue = null;

        const applyContentWidthValue = (value) => {
          if (value === settings.contentWidth) return;
          settings.contentWidth = value;
          applyCustomStyles();
        };

        const scheduleContentWidthApply = (value) => {
          pendingWidth = value;
          if (widthRaf) return;
          widthRaf = requestAnimationFrame(() => {
            widthRaf = null;
            if (pendingWidth !== null) {
              applyContentWidthValue(pendingWidth);
            }
          });
        };

        const flushContentWidthSave = () => {
          if (pendingWidthSaveValue === null) return;
          const valueToSave = pendingWidthSaveValue;
          pendingWidthSaveValue = null;
          if (chrome?.storage?.sync?.set) {
            chrome.storage.sync.set({ contentWidth: valueToSave });
          }
        };

        const scheduleContentWidthSave = (value) => {
          pendingWidthSaveValue = value;
          if (widthSaveTimer) return;
          widthSaveTimer = setTimeout(() => {
            widthSaveTimer = null;
            flushContentWidthSave();
          }, BLUR_SAVE_DELAY_MS);
        };

        contentWidthSlider.addEventListener("input", () => {
          const newWidth = getClampedContentWidthValue(contentWidthSlider.value);
          if (contentWidthSlider.value !== String(newWidth)) {
            contentWidthSlider.value = String(newWidth);
          }
          contentWidthValue.textContent = String(newWidth);
          const stringWidth = String(newWidth);
          scheduleContentWidthApply(stringWidth);
          scheduleContentWidthSave(stringWidth);
        });

        contentWidthSlider.addEventListener("change", () => {
          const newWidth = getClampedContentWidthValue(contentWidthSlider.value);
          if (contentWidthSlider.value !== String(newWidth)) {
            contentWidthSlider.value = String(newWidth);
          }
          contentWidthValue.textContent = String(newWidth);
          if (widthSaveTimer) {
            clearTimeout(widthSaveTimer);
            widthSaveTimer = null;
          }
          pendingWidthSaveValue = String(newWidth);
          flushContentWidthSave();
        });
      }
    }

    function applyRootFlags() {
      const isUiVisible = hasStableUiAnchor();
      document.documentElement.classList.toggle(HTML_CLASS, isUiVisible);
      document.documentElement.classList.toggle(READY_CLASS, isUiVisible);
      document.documentElement.classList.toggle(ANIMATIONS_DISABLED_CLASS, !!settings.disableAnimations);
      document.documentElement.classList.toggle(BG_ANIM_DISABLED_CLASS, !!settings.disableBgAnimation);
      document.documentElement.classList.toggle(CLEAR_APPEARANCE_CLASS, settings.appearance === "clear");

      document.documentElement.classList.toggle("cgpt-blur-chat-history", !!settings.blurChatHistory);

      const applyLightMode = settings.theme === "light" || (settings.theme === "auto" && isLightTheme());

      // Optimization: Only proceed if state has actually changed or if it's the first run
      const themeState = `${isUiVisible}-${!!settings.blurChatHistory}-${applyLightMode}-${settings.appearance}-${settings.accentColor}`;
      if (lastAppliedThemeState === themeState) return;
      lastAppliedThemeState = themeState;
      document.documentElement.classList.toggle(LIGHT_CLASS, applyLightMode);
      applyAccentColor(applyLightMode);

      try {
        const detectedTheme = applyLightMode ? "light" : "dark";
        if (detectedTheme !== lastDetectedTheme && chrome?.runtime?.id && chrome?.storage?.local) {
          lastDetectedTheme = detectedTheme;
          chrome.storage.local.set({ detectedTheme }, () => {
            if (chrome.runtime.lastError) {
              console.error("Aether Extension Error (applyRootFlags):", chrome.runtime.lastError.message);
            }
          });
        }
      } catch (e) {
        const errMessage = String(e?.message || "").toLowerCase();
        if (!errMessage.includes("extension context invalidated")) {
          console.error("Aether Extension Error:", e);
        }
      }
    }

    function applyAccentColor(applyLightMode) {
      const choice = settings.accentColor || "none";
      const config = ACCENT_COLORS[choice] || ACCENT_COLORS.none;
      const root = document.documentElement;

      if (choice === "none") {
        // Remove accent color styling
        root.classList.remove("cgpt-accent-active");
        root.style.removeProperty("--accent-gradient");
        root.style.removeProperty("--accent-glow");
        root.style.removeProperty("--cgpt-accent-color");
        // Remove user bubble gradient styling
        root.style.removeProperty("--user-bubble-gradient");
        root.style.removeProperty("--user-bubble-glow");
        root.style.removeProperty("--user-bubble-border");
      } else {
        // Apply accent color styling
        root.classList.add("cgpt-accent-active");
        root.style.setProperty("--accent-gradient", config.gradient);
        root.style.setProperty("--accent-glow", config.glowDark);
        root.style.setProperty("--cgpt-accent-color", config.solid);
        // Apply user bubble gradient styling
        root.style.setProperty("--user-bubble-gradient", config.gradient);
        root.style.setProperty("--user-bubble-glow", applyLightMode ? config.glowLight : config.glowDark);
        root.style.setProperty("--user-bubble-border", "transparent");
      }
    }

    function showBg() {
      let node = getCachedElementById(ID);
      if (!node) {
        node = makeBgNode();
        const add = () => {
          document.body.prepend(node);
          ensureAppOnTop();
          applyCustomStyles();
          updateBackgroundImage(); // Initial background set
          setTimeout(() => node.classList.add("bg-visible"), SETTINGS_REFRESH_DELAY_MS);
        };
        if (document.body) add();
        else if (!showBgDomReadyHandler) {
          showBgDomReadyHandler = () => {
            showBgDomReadyHandler = null;
            add();
          };
          document.addEventListener("DOMContentLoaded", showBgDomReadyHandler, { once: true });
        }
      } else {
        node.classList.add("bg-visible");
        updateBackgroundImage();
      }
    }

    function applyAllSettings() {
      showBg();
      manageQuickSettingsUI();
      applyRootFlags();
      applyCustomStyles();
      updateBackgroundImage();
      queueComposerLayoutSync();

      // Avoid applying heavy UI restyling while ChatGPT is still mounting;
      // this prevents refresh-time visual artifacts on skeleton placeholders.
      if (!document.documentElement.classList.contains(READY_CLASS)) return;

      manageGpt5LimitPopup();
      manageUpgradeButtons();
      manageSidebarButtons();
      promoteQuickAddMenuItems();
      markCanvasSurfaces();
      markResearchReportCards();
      markSemanticSurfaces();
    }

    function applyImmediateTuningPatch(patch) {
      if (!patch || typeof patch !== "object") return false;

      let didUpdateStyles = false;

      if (Object.prototype.hasOwnProperty.call(patch, "backgroundBlur")) {
        const nextBlur = String(getClampedBlurValue(patch.backgroundBlur));
        if (nextBlur !== settings.backgroundBlur) {
          settings.backgroundBlur = nextBlur;
          didUpdateStyles = true;
        }
        const blurSlider = document.getElementById("qs-blur-slider");
        const blurValue = document.getElementById("qs-blur-value");
        if (blurSlider && blurValue) {
          blurSlider.value = nextBlur;
          blurValue.textContent = nextBlur;
        }
      }

      if (Object.prototype.hasOwnProperty.call(patch, "backgroundScaling")) {
        const nextScaling = sanitizeBackgroundScaling(patch.backgroundScaling);
        if (nextScaling !== settings.backgroundScaling) {
          settings.backgroundScaling = nextScaling;
          didUpdateStyles = true;
        }
      }

      if (Object.prototype.hasOwnProperty.call(patch, "contentWidth")) {
        const nextContentWidth = String(getClampedContentWidthValue(patch.contentWidth));
        if (nextContentWidth !== settings.contentWidth) {
          settings.contentWidth = nextContentWidth;
          didUpdateStyles = true;
        }
        const contentWidthSlider = document.getElementById("qs-content-width-slider");
        const contentWidthValue = document.getElementById("qs-content-width-value");
        if (contentWidthSlider && contentWidthValue) {
          contentWidthSlider.value = nextContentWidth;
          contentWidthValue.textContent = nextContentWidth;
        }
      }

      if (Object.prototype.hasOwnProperty.call(patch, "customBgUrl")) {
        const nextCustomBgUrl = sanitizeBackgroundUrl(patch.customBgUrl || "");
        if (nextCustomBgUrl !== settings.customBgUrl) {
          settings.customBgUrl = nextCustomBgUrl;
          updateBackgroundImage(nextCustomBgUrl);
        }
      }

      if (didUpdateStyles) {
        applyCustomStyles();
      }
      return didUpdateStyles;
    }

    const cleanupRuntimeBindings = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
      if (storageWriteTimer) {
        clearTimeout(storageWriteTimer);
        storageWriteTimer = null;
      }
      if (uiReadyTimeout) {
        clearTimeout(uiReadyTimeout);
        uiReadyTimeout = null;
      }
      if (composerLayoutFrame) {
        cancelAnimationFrame(composerLayoutFrame);
        composerLayoutFrame = null;
      }
      if (uiReadyObserver) {
        uiReadyObserver.disconnect();
        uiReadyObserver = null;
      }
      if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
      }
      if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
      }
      if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
      }
      if (visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", visibilityChangeHandler);
        visibilityChangeHandler = null;
      }
      if (windowFocusHandler) {
        window.removeEventListener("focus", windowFocusHandler);
        windowFocusHandler = null;
      }
      if (windowResizeHandler) {
        window.removeEventListener("resize", windowResizeHandler);
        windowResizeHandler = null;
      }
      if (popstateHandler) {
        window.removeEventListener("popstate", popstateHandler);
        popstateHandler = null;
      }
      if (quickAddInteractionHandler) {
        document.removeEventListener("click", quickAddInteractionHandler, true);
        quickAddInteractionHandler = null;
      }
      clearQuickAddPromotionTimers();
      if (qsDocumentClickHandler) {
        document.removeEventListener("click", qsDocumentClickHandler);
        qsDocumentClickHandler = null;
        qsDocumentClickBound = false;
      }
      if (qsDocumentKeydownHandler) {
        document.removeEventListener("keydown", qsDocumentKeydownHandler);
        qsDocumentKeydownHandler = null;
        qsDocumentKeydownBound = false;
      }
      if (initialDomReadyHandler) {
        document.removeEventListener("DOMContentLoaded", initialDomReadyHandler);
        initialDomReadyHandler = null;
      }
      if (applyStylesDomReadyHandler) {
        document.removeEventListener("DOMContentLoaded", applyStylesDomReadyHandler);
        applyStylesDomReadyHandler = null;
      }
      if (showBgDomReadyHandler) {
        document.removeEventListener("DOMContentLoaded", showBgDomReadyHandler);
        showBgDomReadyHandler = null;
      }
      if (qsInitDomReadyHandler) {
        document.removeEventListener("DOMContentLoaded", qsInitDomReadyHandler);
        qsInitDomReadyHandler = null;
      }
      qsInitScheduled = false;
      if (storageChangeHandler && chrome?.storage?.onChanged?.removeListener) {
        chrome.storage.onChanged.removeListener(storageChangeHandler);
        storageChangeHandler = null;
      }
      if (runtimeMessageHandler && chrome?.runtime?.onMessage?.removeListener) {
        chrome.runtime.onMessage.removeListener(runtimeMessageHandler);
        runtimeMessageHandler = null;
      }
      if (originalPushState) {
        history.pushState = originalPushState;
        originalPushState = null;
      }
      if (originalReplaceState) {
        history.replaceState = originalReplaceState;
        originalReplaceState = null;
      }
      const qsButton = document.getElementById(QS_BUTTON_ID);
      if (qsButton) qsButton.remove();
      const qsPanel = document.getElementById(QS_PANEL_ID);
      if (qsPanel) qsPanel.remove();
      const bgNode = document.getElementById(ID);
      if (bgNode) bgNode.remove();
      const styleNode = document.getElementById(STYLE_ID);
      if (styleNode) styleNode.remove();
      document.documentElement.classList.remove(
        HTML_CLASS,
        READY_CLASS,
        LIGHT_CLASS,
        ANIMATIONS_DISABLED_CLASS,
        BG_ANIM_DISABLED_CLASS,
        CLEAR_APPEARANCE_CLASS,
        "cgpt-blur-chat-history",
        "cgpt-tab-hidden",
        "cgpt-accent-active"
      );
      document.documentElement.style.removeProperty("--accent-gradient");
      document.documentElement.style.removeProperty("--accent-glow");
      document.documentElement.style.removeProperty("--cgpt-accent-color");
      document.documentElement.style.removeProperty("--user-bubble-gradient");
      document.documentElement.style.removeProperty("--user-bubble-glow");
      document.documentElement.style.removeProperty("--user-bubble-border");
      taggedSurfaceNodes.forEach((node) => {
        if (node.isConnected) {
          clearTaggedSurfaceNode(node);
        }
      });
      taggedSurfaceNodes.clear();
      document
        .querySelectorAll(`form[data-type="unified-composer"][${FORCED_WIDE_COMPOSER_ATTR}]`)
        .forEach(clearForcedWideComposer);
      _elementCache.clear();
      lastAppliedThemeState = null;
      lastDetectedTheme = null;
      if (backgroundTransitionTimer) {
        clearTimeout(backgroundTransitionTimer);
        backgroundTransitionTimer = null;
      }
      backgroundTransitionQueue.length = 0;
      currentBackgroundUrl = null;
      activeLayerId = "a";
      isTransitioning = false;
      observersStarted = false;
    };

    function startObservers() {
      if (observersStarted) return;
      observersStarted = true;

      // Performance: Pause animations and video when tab is not visible.
      visibilityChangeHandler = () => {
        const bgNode = getCachedElementById(ID);
        document.documentElement.classList.toggle("cgpt-tab-hidden", document.hidden);
        if (!bgNode) return;

        const videos = bgNode.querySelectorAll("video");
        videos.forEach((video) => {
          if (document.hidden) {
            video.pause();
          } else if (video.style.display !== "none") {
            // Only play if it's supposed to be playing
            video.play().catch((_e) => {
              /* Autoplay might be blocked by browser policies */
            });
          }
        });
      };
      document.addEventListener("visibilitychange", visibilityChangeHandler, { passive: true });

      uiReadyTimeout = setTimeout(() => {
        if (uiReadyObserver) {
          uiReadyObserver.disconnect();
          uiReadyObserver = null;
        }
        uiReadyTimeout = null;
        applyAllSettings();
      }, UI_READY_TIMEOUT_MS);

      uiReadyObserver = new MutationObserver((mutations, obs) => {
        const stableUiElement = getCachedElement(SELECTORS.PROFILE_BUTTON);
        if (stableUiElement) {
          if (uiReadyTimeout) {
            clearTimeout(uiReadyTimeout);
            uiReadyTimeout = null;
          }
          applyAllSettings();
          obs.disconnect();
          uiReadyObserver = null;
        }
      });

      uiReadyObserver.observe(document.body, { childList: true, subtree: true });

      windowFocusHandler = applyAllSettings;
      window.addEventListener("focus", windowFocusHandler, { passive: true });
      windowResizeHandler = queueComposerLayoutSync;
      window.addEventListener("resize", windowResizeHandler, { passive: true });
      let lastUrl = location.href;
      const checkUrl = () => {
        if (location.href === lastUrl) return;
        lastUrl = location.href;
        applyAllSettings();
      };
      popstateHandler = checkUrl;
      window.addEventListener("popstate", popstateHandler, { passive: true });

      if (!originalPushState) {
        originalPushState = history.pushState;
      }
      if (!originalReplaceState) {
        originalReplaceState = history.replaceState;
      }
      history.pushState = function (...args) {
        originalPushState.apply(this, args);
        setTimeout(checkUrl, 0);
      };
      history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        setTimeout(checkUrl, 0);
      };

      quickAddInteractionHandler = (event) => {
        if (!shouldTriggerQuickAddPromotionFromEventTarget(event.target)) return;
        queueQuickAddPromotion();
      };
      document.addEventListener("click", quickAddInteractionHandler, true);

      const debouncedOtherChecks = debounce(() => {
        manageGpt5LimitPopup();
        manageTodaysPulse();
        manageSidebarButtonsQuick();
        markCanvasSurfaces();
        markResearchReportCards();
        markSemanticSurfaces();
        queueComposerLayoutSync();
      }, OTHER_CHECK_DELAY_MS);

      const debouncedCriticalChecks = debounce(() => {
        manageUpgradeButtons();
        attachThemeObservers();
      }, CRITICAL_CHECK_DELAY_MS);

      // This observer handles all dynamic UI changes.
      domObserver = new MutationObserver(() => {
        // Run the critical checks on a short debounce to avoid layout thrashing during streaming
        debouncedCriticalChecks();
        // Run the less-critical checks on a longer debounce timer.
        debouncedOtherChecks();
      });

      domObserver.observe(document.body, { childList: true, subtree: true });

      themeObserver = new MutationObserver(() => {
        if (settings.theme === "auto") applyRootFlags();
      });
      const themeObserverOptions = {
        attributes: true,
        attributeFilter: ["class", "data-theme", "data-color-scheme", "data-theme-mode"],
      };
      const observedThemeNodes = new Set();
      const observeThemeNode = (node) => {
        if (!node || observedThemeNodes.has(node)) return;
        observedThemeNodes.add(node);
        themeObserver.observe(node, themeObserverOptions);
      };
      const attachThemeObservers = () => {
        observeThemeNode(document.documentElement);
        observeThemeNode(document.body);
        observeThemeNode(getCachedElementById("__next"));
        observeThemeNode(getCachedElementById("root"));
        observeThemeNode(getCachedElement("main"));
      };

      attachThemeObservers();

      if (!document.body) {
        bodyObserver = new MutationObserver(() => {
          if (document.body) {
            attachThemeObservers();
            bodyObserver.disconnect();
            bodyObserver = null;
          }
        });
        bodyObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      }
    }

    const getWelcomeScreenHTML = () => `
    <div id="aurora-welcome-notification">
        <div class="welcome-card">
            <button id="welcome-close-btn" class="welcome-close" aria-label="Close">×</button>
            <h2 class="welcome-title">${t("welcomeTitle")}</h2>
            <p class="welcome-text">${t("welcomeDescription")}</p>
            <button id="welcome-settings-btn" class="welcome-btn">${t("actionTitle")}</button>
        </div>
    </div>
  `;

    function showWelcomeScreen() {
      const welcomeNode = document.createElement("div");
      welcomeNode.innerHTML = getWelcomeScreenHTML();
      if (welcomeNode.firstElementChild) {
        document.body.appendChild(welcomeNode.firstElementChild);
      }

      const notification = document.getElementById("aurora-welcome-notification");
      const closeBtn = document.getElementById("welcome-close-btn");
      const settingsBtn = document.getElementById("welcome-settings-btn");

      const dismissWelcome = () => {
        chrome.storage.sync.set({ hasSeenWelcomeScreen: true }, () => {
          if (chrome.runtime.lastError) {
            console.error("Aether Extension Error (Welcome Dismiss):", chrome.runtime.lastError.message);
            return;
          }
          if (notification) {
            notification.classList.add("dismissed");
            setTimeout(() => notification.remove(), 300);
          }
        });
      };

      if (closeBtn) {
        closeBtn.addEventListener("click", dismissWelcome);
      }

      if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
          chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
          dismissWelcome();
        });
      }
    }

    // --- NEW: Initialization and Robust Settings Listener ---
    if (chrome?.runtime?.sendMessage) {
      // This function will be our single point of entry for processing settings updates.
      let welcomeScreenChecked = false;

      if (!runtimeMessageHandler && chrome?.runtime?.onMessage?.addListener) {
        runtimeMessageHandler = (request, _sender, sendResponse) => {
          if (request?.type !== "AETHER_APPLY_TUNING_PATCH") return;
          const didApply = applyImmediateTuningPatch(request.patch || {});
          sendResponse?.({ ok: true, applied: didApply });
        };
        chrome.runtime.onMessage.addListener(runtimeMessageHandler);
      }

      const refreshSettingsAndApply = () => {
        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (freshSettings) => {
            if (chrome.runtime.lastError) {
              console.error("Aether Extension Error: Could not refresh settings.", chrome.runtime.lastError.message);
              return;
            }

            // Check if the welcome screen should be shown, but only once.
            if (!welcomeScreenChecked) {
              if (!freshSettings.hasSeenWelcomeScreen) {
                showWelcomeScreen();
              }
              welcomeScreenChecked = true; // Mark as checked for this session.
            }

            // Update the global settings object with the fresh, authoritative state.
            settings = freshSettings;
            // Apply all visual changes based on the new settings.
            applyAllSettings();
          });
        }, SETTINGS_REFRESH_DELAY_MS);
      };

      // Initialize i18n system with ChatGPT language detection
      (async () => {
        try {
          if (window.AetherI18n?.initialize) {
            await window.AetherI18n.initialize();
            const detectedLocale = window.AetherI18n.getDetectedLocale();
            console.log(`Aether: Language system initialized with locale: ${detectedLocale}`);
          }
        } catch (e) {
          console.warn("Aether: Could not initialize i18n system, using browser default:", e);
        }
      })();

      // Initial load when the script first runs.
      if (document.readyState === "loading") {
        initialDomReadyHandler = () => {
          initialDomReadyHandler = null;
          refreshSettingsAndApply();
          startObservers();
        };
        document.addEventListener("DOMContentLoaded", initialDomReadyHandler, { once: true });
      } else {
        refreshSettingsAndApply();
        startObservers();
      }

      storageChangeHandler = (changes, area) => {
        if (area === "sync") {
          const changedKeys = Object.keys(changes);
          const backgroundKeys = ["customBgUrl", "backgroundBlur", "backgroundScaling", "contentWidth"];
          const tuningKeys = ["backgroundBlur", "backgroundScaling", "contentWidth"];
          const isOnlyTuningChange = changedKeys.length > 0 && changedKeys.every((key) => tuningKeys.includes(key));
          const isOnlyNonBackgroundChange = changedKeys.every((key) => !backgroundKeys.includes(key));

          if (isOnlyTuningChange) {
            const tuningPatch = {};
            tuningKeys.forEach((key) => {
              if (!Object.prototype.hasOwnProperty.call(changes, key)) return;
              tuningPatch[key] = changes[key].newValue;
            });
            applyImmediateTuningPatch(tuningPatch);
            return;
          }

          if (isOnlyNonBackgroundChange && changedKeys.length > 0) {
            // Lightweight update for non-background settings
            chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (freshSettings) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Aether Extension Error: Could not refresh settings for lightweight update.",
                  chrome.runtime.lastError.message
                );
                return;
              }
              settings = freshSettings;

              // Apply only the necessary, non-background updates
              applyRootFlags();
              manageGpt5LimitPopup();
              manageUpgradeButtons();
              manageSidebarButtons();
              manageQuickSettingsUI();
              markSemanticSurfaces();
            });
          } else {
            // Full refresh for background changes or mixed changes
            refreshSettingsAndApply();
          }
        }
      };
      chrome.storage.onChanged.addListener(storageChangeHandler);
    }

    window[REINJECT_CLEANUP_KEY] = cleanupRuntimeBindings;
  } catch (e) {
    const errMessage = String(e?.message || "").toLowerCase();
    if (errMessage.includes("extension context invalidated")) {
      return;
    }
    console.error("Aether: Content bootstrap failed", e);
    throw e;
  }
})();
