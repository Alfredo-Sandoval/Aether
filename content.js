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
  const SIDEBAR_NAV_ACTIVE_CLASS = "cgpt-sidebar-nav-active";
  let settings = {};
  let lastDetectedTheme = null;
  let lastAppliedThemeState = null;

  const HIDE_LIMIT_CLASS = "cgpt-hide-gpt5-limit";
  const HIDE_UPGRADE_CLASS = "cgpt-hide-upgrade";
  const HIDE_SORA_CLASS = "cgpt-hide-sora";
  const HIDE_GPTS_CLASS = "cgpt-hide-gpts";
  const HIDE_SHOPPING_CLASS = "cgpt-hide-shopping";
  const HIDE_TODAYS_PULSE_CLASS = "cgpt-hide-todays-pulse";
  const RESEARCH_CARD_CLASS = "cgpt-aether-research-card";
  const CANVAS_SURFACE_CLASS = "cgpt-aether-canvas-surface";
  const TIMESTAMP_KEY = "gpt5LimitHitTimestamp";
  const FIVE_MINUTES_MS = 5 * 60 * 1000;

  // Named timing constants
  const TRANSITION_DURATION_MS = 800;
  const STORAGE_FLUSH_DELAY_MS = 300;
  const BLUR_SAVE_DELAY_MS = 120;
  const SETTINGS_REFRESH_DELAY_MS = 50;
  const CRITICAL_CHECK_DELAY_MS = 50;
  const OTHER_CHECK_DELAY_MS = 150;
  const SIDEBAR_NAV_ACTIVE_HOLD_MS = 650;
  const SIDEBAR_UI_SCAN_COOLDOWN_MS = 900;
  const HEAVY_SCAN_COOLDOWN_MS = 2500;
  const HEAVY_SCAN_IDLE_TIMEOUT_MS = 900;
  const ENABLE_STRUCTURAL_SCANS = false;
  const ENABLE_MUTATION_UI_SCANS = false;
  const UI_READY_TIMEOUT_MS = 15000;

  let refreshTimeout = null;
  let initialDomReadyHandler = null;
  let storageChangeHandler = null;
  let visibilityChangeHandler = null;
  let windowFocusHandler = null;
  let popstateHandler = null;
  let quickAddInteractionHandler = null;
  let sidebarNavInteractionHandler = null;
  let sidebarNavActiveTimer = null;
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
  let applyStylesDomReadyHandler = null;
  let showBgDomReadyHandler = null;
  const sidebarUiScanState = {
    upgrade: { href: "", ranAt: 0 },
    sidebar: { href: "", ranAt: 0 },
    pulse: { href: "", ranAt: 0 },
  };
  const heavyScanState = {
    research: { href: "", ranAt: 0, scheduled: false, idleHandle: null, timeoutHandle: null },
    canvas: { href: "", ranAt: 0, scheduled: false, idleHandle: null, timeoutHandle: null },
  };

  const getExtensionUrl = (path) => (chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "");

  const EXTENSION_BASE_URL = getExtensionUrl("");
  const sharedUtils = globalThis.AetherShared;
  if (!sharedUtils) {
    throw new Error("Aether: shared utilities failed to load in content context.");
  }
  const {
    sanitizeBackgroundScaling,
    escapeHtml,
    clampBackgroundBlur,
    sanitizeContentWidth,
    UI_BOUNDS,
    createBackgroundPresetRegistry,
  } = sharedUtils;
  const sanitizeBackgroundUrl = (url) => sharedUtils.sanitizeBackgroundUrl(url, EXTENSION_BASE_URL);

  const { MIN_BG_BLUR, MAX_BG_BLUR, MIN_CONTENT_WIDTH, MAX_CONTENT_WIDTH } = UI_BOUNDS;

  const {
    JET_KEY,
    AURORA_KEY,
    SUNSET_KEY,
    OCEAN_KEY,
    SUPER_STARS_KEY,
    LEGACY_GROK_SIGNUP_KEY,
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
  } = createBackgroundPresetRegistry(getExtensionUrl);

  // Group DOM selectors for easier maintenance. Fragile selectors are noted.
  const SELECTORS = {
    GPT5_LIMIT_POPUP: 'div[class*="text-token-text-primary"]',
    UPGRADE_MENU_ITEM: "a.__menu-item", // In user profile menu
    UPGRADE_TOP_BUTTON_CONTAINER: ".start-1\\/2.absolute", // Fragile: top-center button on free plan
    UPGRADE_PROFILE_BUTTON_TRAILING_ICON:
      ':is([data-testid="accounts-profile-button"], [data-testid="profile-button"]) .__menu-item-trailing-btn',
    UPGRADE_SIDEBAR_BUTTON: "div.gap-1\\.5.__menu-item.group", // Fragile: sidebar button
    UPGRADE_TINY_SIDEBAR_ICON: "#stage-sidebar-tiny-bar", // Tiny-rail container; locate upgrade item semantically
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

  const clearSidebarNavActiveFlag = () => {
    if (sidebarNavActiveTimer) {
      clearTimeout(sidebarNavActiveTimer);
      sidebarNavActiveTimer = null;
    }
    document.documentElement.classList.remove(SIDEBAR_NAV_ACTIVE_CLASS);
  };

  const activateSidebarNavPerformanceMode = () => {
    document.documentElement.classList.add(SIDEBAR_NAV_ACTIVE_CLASS);
    if (sidebarNavActiveTimer) {
      clearTimeout(sidebarNavActiveTimer);
    }
    sidebarNavActiveTimer = setTimeout(() => {
      sidebarNavActiveTimer = null;
      document.documentElement.classList.remove(SIDEBAR_NAV_ACTIVE_CLASS);
    }, SIDEBAR_NAV_ACTIVE_HOLD_MS);
  };

  const shouldEnableSidebarNavPerformanceMode = (target) => {
    if (!(target instanceof Element)) return false;
    return !!target.closest('#stage-slideover-sidebar #history > a.group.__menu-item.hoverable[href^="/c/"]');
  };

  const shouldSkipSidebarUiScan = (state, force = false) => {
    const now = performance.now();
    const href = location.pathname;
    if (!force && state.href === href && now - state.ranAt < SIDEBAR_UI_SCAN_COOLDOWN_MS) {
      return true;
    }
    state.href = href;
    state.ranAt = now;
    return false;
  };

  const clearScheduledHeavyScan = (state) => {
    if (!state) return;
    if (state.idleHandle !== null && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(state.idleHandle);
    }
    if (state.timeoutHandle !== null) {
      clearTimeout(state.timeoutHandle);
    }
    state.idleHandle = null;
    state.timeoutHandle = null;
    state.scheduled = false;
  };

  const scheduleHeavyScan = (state, task, force = false) => {
    if (!ENABLE_STRUCTURAL_SCANS) return;
    if (!state || typeof task !== "function") return;
    const now = performance.now();
    const href = location.pathname;
    if (!force && state.href === href && now - state.ranAt < HEAVY_SCAN_COOLDOWN_MS) return;
    if (state.scheduled) return;

    const runTask = () => {
      state.scheduled = false;
      state.idleHandle = null;
      state.timeoutHandle = null;
      state.href = location.pathname;
      state.ranAt = performance.now();
      task();
    };

    const runWhenReady = () => {
      if (document.documentElement.classList.contains(SIDEBAR_NAV_ACTIVE_CLASS)) {
        state.timeoutHandle = setTimeout(runWhenReady, 120);
        return;
      }
      if (typeof window.requestIdleCallback === "function") {
        state.idleHandle = window.requestIdleCallback(runTask, { timeout: HEAVY_SCAN_IDLE_TIMEOUT_MS });
      } else {
        state.timeoutHandle = setTimeout(runTask, 60);
      }
    };

    state.scheduled = true;
    runWhenReady();
  };

  const normalizeText = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ")
      .trim();

  const getChatContentRoot = () =>
    document.getElementById("thread") || document.getElementById("main") || document.body;

  const isElementVisible = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
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
  const QUICK_ADD_PROXY_ITEMS = [
    {
      key: "deep-research",
      label: "Deep research",
      hints: ["deep research", "investigacion profunda", "investigación profunda"],
    },
    {
      key: "github",
      label: "GitHub",
      hints: ["github"],
    },
  ];
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
  const isExtensionContextInvalidatedError = (error) =>
    String(error?.message || "")
      .toLowerCase()
      .includes("extension context invalidated");

  const getMessage = (key, substitutions) => {
    if (window.AetherI18n?.getMessage) {
      try {
        const text = window.AetherI18n.getMessage(key, substitutions);
        if (text && text !== key) return text;
      } catch (e) {
        if (isExtensionContextInvalidatedError(e)) {
          return key;
        }
        throw e;
      }
    }

    if (chrome?.i18n?.getMessage && chrome.runtime?.id) {
      try {
        const text = chrome.i18n.getMessage(key, substitutions);
        if (text) return text;
      } catch (e) {
        if (isExtensionContextInvalidatedError(e)) {
          return key;
        }
        throw e;
      }
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

  function manageUpgradeButtons(force = false) {
    if (shouldSkipSidebarUiScan(sidebarUiScanState.upgrade, force)) return;
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

    const newSidebarUpgradeButton = Array.from(document.querySelectorAll(SELECTORS.UPGRADE_SIDEBAR_BUTTON)).find((el) =>
      UPGRADE_KEYWORD_PHRASES.some((phrase) => normalizeText(el.textContent || "").includes(phrase))
    );
    upgradeElements.push(newSidebarUpgradeButton);

    const tinySidebarUpgradeIcon = Array.from(
      document.querySelectorAll(
        `${SELECTORS.UPGRADE_TINY_SIDEBAR_ICON} .__menu-item, ${SELECTORS.UPGRADE_TINY_SIDEBAR_ICON} a, ${SELECTORS.UPGRADE_TINY_SIDEBAR_ICON} [role="button"]`
      )
    ).find((el) => {
      const text = normalizeText(el.textContent || "");
      const aria = normalizeText(el.getAttribute("aria-label") || "");
      const title = normalizeText(el.getAttribute("title") || "");
      const href = normalizeText(el.getAttribute("href") || "");
      return (
        UPGRADE_KEYWORD_PHRASES.some(
          (phrase) => text.includes(phrase) || aria.includes(phrase) || title.includes(phrase)
        ) ||
        href.includes("upgrade") ||
        href.includes("plan")
      );
    });
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

  function manageSidebarButtons(force = false) {
    manageSidebarButtonsQuick(force);
    manageTodaysPulse(force);
  }

  function manageSidebarButtonsQuick(force = false) {
    if (shouldSkipSidebarUiScan(sidebarUiScanState.sidebar, force)) return;
    if (!settings.hideSoraButton && !settings.hideGptsButton && !settings.hideShoppingButton) {
      document.querySelectorAll(`.${HIDE_SORA_CLASS}`).forEach((el) => el.classList.remove(HIDE_SORA_CLASS));
      document.querySelectorAll(`.${HIDE_GPTS_CLASS}`).forEach((el) => el.classList.remove(HIDE_GPTS_CLASS));
      document.querySelectorAll(`.${HIDE_SHOPPING_CLASS}`).forEach((el) => {
        el.classList.remove(HIDE_SHOPPING_CLASS);
        el.removeAttribute("data-aether-shopping-processed");
      });
      return;
    }

    const soraTargets = [
      document.getElementById(SELECTORS.SORA_BUTTON_ID),
      ...Array.from(document.querySelectorAll(SELECTORS.SORA_BUTTON)),
    ];
    toggleClassForElements(Array.from(new Set(soraTargets.filter(Boolean))), HIDE_SORA_CLASS, settings.hideSoraButton);

    const gptsTargets = Array.from(document.querySelectorAll(SELECTORS.GPTS_BUTTON));
    toggleClassForElements(Array.from(new Set(gptsTargets.filter(Boolean))), HIDE_GPTS_CLASS, settings.hideGptsButton);
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

  function manageTodaysPulse(force = false) {
    if (shouldSkipSidebarUiScan(sidebarUiScanState.pulse, force)) return;
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

  function markResearchReportCards() {
    const scopeRoot = getChatContentRoot();
    if (!scopeRoot) return;
    const hasResearchSignal =
      !!scopeRoot.querySelector(
        'iframe[src*="deep_research" i], iframe[src*="deep-research" i], [data-testid*="research" i], [id*="research" i], [class*="research" i], [data-testid*="artifact" i], [id*="artifact" i], [class*="artifact" i]'
      ) || !!scopeRoot.querySelector(`.${RESEARCH_CARD_CLASS}`);
    if (!hasResearchSignal) return;
    const taggedCards = new Set();
    const CARD_CONTAINER_SELECTOR = "div, section, article, main";
    const RESEARCH_EMBED_IFRAME_SELECTOR = [
      'iframe[title*="deep-research" i]',
      'iframe[title*="deep research" i]',
      'iframe[title*="research" i]',
      'iframe[src*="connector_openai_deep_research" i]',
      'iframe[src*="deep_research" i]',
      'iframe[src*="deep-research" i]',
      'iframe[src*="research.web-sandbox.oaisusercontent.com" i]',
    ].join(", ");
    const CONTROL_SELECTOR = [
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
    const REPORT_MARKER_SELECTOR = [
      '[data-testid*="research" i]',
      '[data-testid*="artifact" i]',
      '[id*="research" i]',
      '[id*="artifact" i]',
      '[class*="research" i]',
      '[class*="artifact" i]',
    ].join(", ");

    const isValidCardContainer = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
      if (node.id === "thread" || node.id === "main" || node.id === "thread-bottom-container") return false;
      if (node.classList?.contains("composer-parent")) return false;
      if (node.classList?.contains("group/thread")) return false;
      if (node.querySelector('form[data-type="unified-composer"]')) return false;
      if (!node.closest("#thread, #main")) return false;
      if (!isElementVisible(node)) return false;

      const rect = node.getBoundingClientRect();
      const minAllowedWidth = Math.max(220, Math.min(window.innerWidth * 0.28, 340));
      const maxAllowedWidth = Math.min(window.innerWidth * 0.88, 980);
      const minAllowedHeight = 110;
      const maxAllowedHeight = Math.min(window.innerHeight * 0.72, 780);
      return (
        rect.width >= minAllowedWidth &&
        rect.height >= minAllowedHeight &&
        rect.width <= maxAllowedWidth &&
        rect.height <= maxAllowedHeight
      );
    };

    const scoreCard = (node) => {
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

      const targetWidth = Math.min(Math.max(window.innerWidth * 0.34, 340), 640);
      const targetHeight = Math.min(Math.max(window.innerHeight * 0.23, 170), 360);
      score += Math.abs(rect.width - targetWidth) / 12;
      score += Math.abs(rect.height - targetHeight) / 14;
      return score;
    };

    const tagBestAncestor = (startNode, maxDepth = 34) => {
      let node = startNode?.closest(CARD_CONTAINER_SELECTOR) || null;
      let depth = 0;
      let bestNode = null;
      let bestScore = Number.POSITIVE_INFINITY;

      while (node && depth < maxDepth) {
        if (isValidCardContainer(node)) {
          const score = scoreCard(node) + depth * 0.8;
          if (score < bestScore) {
            bestScore = score;
            bestNode = node;
          }
          if (bestScore <= -55) break;
        }
        node = node.parentElement;
        depth += 1;
      }

      if (!bestNode) return false;
      bestNode.classList.add(RESEARCH_CARD_CLASS);
      taggedCards.add(bestNode);
      return true;
    };

    // Primary path for embedded deep-research viewers rendered as iframes.
    scopeRoot.querySelectorAll(RESEARCH_EMBED_IFRAME_SELECTOR).forEach((frame) => {
      tagBestAncestor(frame, 24);
    });

    scopeRoot.querySelectorAll(CONTROL_SELECTOR).forEach((control) => {
      tagBestAncestor(control, 36);
    });

    if (taggedCards.size === 0) {
      scopeRoot.querySelectorAll(REPORT_MARKER_SELECTOR).forEach((marker) => {
        tagBestAncestor(marker, 36);
      });
    }

    if (taggedCards.size === 0) {
      const bannerNodes = Array.from(scopeRoot.querySelectorAll("div, span, p")).filter((node) => {
        if (!isElementVisible(node)) return false;
        const text = normalizeText(node.textContent);
        if (!text) return false;
        if (!RESEARCH_CARD_BANNER_TOKENS.every((token) => text.includes(token))) return false;
        return text.length <= 280;
      });

      bannerNodes.forEach((banner) => {
        if (tagBestAncestor(banner, 26)) return;

        const bannerRect = banner.getBoundingClientRect();
        const scope = banner.closest("article, section, main, #thread") || scopeRoot;
        let bestNode = null;
        let bestScore = Number.POSITIVE_INFINITY;

        scope.querySelectorAll(CARD_CONTAINER_SELECTOR).forEach((candidate) => {
          if (!isValidCardContainer(candidate)) return;
          const rect = candidate.getBoundingClientRect();
          const delta = rect.top - bannerRect.bottom;
          if (delta < -30 || delta > 380) return;
          const score = scoreCard(candidate) + delta * 0.45;
          if (score < bestScore) {
            bestScore = score;
            bestNode = candidate;
          }
        });

        if (bestNode) {
          bestNode.classList.add(RESEARCH_CARD_CLASS);
          taggedCards.add(bestNode);
        }
      });
    }

    if (taggedCards.size === 0) {
      const contentAnchors = Array.from(scopeRoot.querySelectorAll("h1, h2, h3, div, p, span")).filter((node) =>
        textIncludesAllTokens(node.textContent, RESEARCH_CARD_CONTENT_TOKENS)
      );
      contentAnchors.forEach((anchor) => {
        tagBestAncestor(anchor, 24);
      });
    }

    scopeRoot.querySelectorAll(`.${RESEARCH_CARD_CLASS}`).forEach((node) => {
      if (!taggedCards.has(node)) {
        node.classList.remove(RESEARCH_CARD_CLASS);
      }
    });
  }

  function hasCanvasActionHeader(node) {
    if (!node) return false;
    const headerText = normalizeText(node.querySelector(".sticky")?.textContent || "");
    if (!headerText) return false;
    return CANVAS_ACTION_SETS.some((tokens) => textIncludesAllTokens(headerText, tokens));
  }

  function markCanvasSurfaces() {
    const scopeRoot = getChatContentRoot();
    if (!scopeRoot) return;
    const hasCanvasSignal =
      !!scopeRoot.querySelector(
        '[id^="textdoc-message-"], .popover[class*="bg-token-bg-primary"], .popover[class*="bg-token-main-surface"]'
      ) || !!scopeRoot.querySelector(`.${CANVAS_SURFACE_CLASS}`);
    if (!hasCanvasSignal) return;
    const taggedSurfaces = new Set();
    const turnRoots = scopeRoot.querySelectorAll(
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

    scopeRoot.querySelectorAll(`.${CANVAS_SURFACE_CLASS}`).forEach((node) => {
      if (!taggedSurfaces.has(node)) {
        node.classList.remove(CANVAS_SURFACE_CLASS);
      }
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
        <canvas class="super-stars-canvas" aria-hidden="true"></canvas>
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
    if (url === "__neural__") {
      url = "";
      settings.customBgUrl = "";
      try {
        if (chrome?.storage?.sync?.set) {
          chrome.storage.sync.set({ customBgUrl: "" });
        }
      } catch (e) {
        if (
          !String(e?.message || "")
            .toLowerCase()
            .includes("extension context invalidated")
        ) {
          console.warn("Aether Extension Warning (neural bg cleanup):", e);
        }
      }
    }
    if (url === LEGACY_GROK_SIGNUP_KEY) {
      url = SUPER_STARS_KEY;
    }
    if (url === GROK_BLANCO_LEGACY_URL) {
      url = GROK_BLANCO_URL;
    }

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

  const SUPER_STARS_CANVAS_SELECTOR = ".media-layer.super-stars-active.active .super-stars-canvas";
  const MAX_SUPER_STARS_DPR = 2;
  const SUPER_STARS_COUNT = 19;
  const superStarsRenderStates = new Map();
  let superStarsRafId = null;

  const createSeededRandom = (seedValue) => {
    let seed = seedValue >>> 0;
    return () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  };

  const buildSuperStars = (seedValue) => {
    const rand = createSeededRandom(seedValue);
    const stars = [];
    for (let i = 0; i < SUPER_STARS_COUNT; i += 1) {
      const isPrimaryCluster = i < Math.round(SUPER_STARS_COUNT * 0.85);
      const xNorm = isPrimaryCluster ? 0.56 + Math.pow(rand(), 0.35) * 0.4 : 0.38 + rand() * 0.5;
      const yNorm = isPrimaryCluster ? 0.58 + rand() * 0.3 : 0.48 + rand() * 0.4;
      stars.push({
        xNorm,
        yNorm,
        radius: 0.5 + rand() * 0.95,
        alpha: 0.42 + rand() * 0.48,
        phase: rand() * Math.PI * 2,
        speed: 0.55 + rand() * 1.15,
      });
    }
    return stars;
  };

  const getSuperStarsState = (canvas) => {
    const existing = superStarsRenderStates.get(canvas);
    if (existing) return existing;
    const layerId = canvas.closest(".media-layer")?.dataset.layerId || "a";
    const seed = layerId === "a" ? 1942 : 7129;
    const created = {
      stars: buildSuperStars(seed),
      width: 0,
      height: 0,
      dpr: 1,
    };
    superStarsRenderStates.set(canvas, created);
    return created;
  };

  const resizeSuperStarsCanvas = (canvas, state) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_SUPER_STARS_DPR);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (state.width === width && state.height === height && state.dpr === dpr) return;
    state.width = width;
    state.height = height;
    state.dpr = dpr;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  };

  const drawSuperStarsCanvas = (canvas, state, nowSeconds, animate) => {
    resizeSuperStarsCanvas(canvas, state);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height, dpr } = state;
    ctx.clearRect(0, 0, width, height);

    const glowX = width * 0.84;
    const glowY = height * 0.73;
    const glowRadius = Math.max(width, height) * 0.46;
    const glowGradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
    glowGradient.addColorStop(0, "rgba(178, 208, 245, 0.24)");
    glowGradient.addColorStop(0.35, "rgba(117, 149, 194, 0.11)");
    glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, width, height);

    state.stars.forEach((star) => {
      const twinkle = animate ? 0.66 + 0.34 * Math.sin(nowSeconds * star.speed + star.phase) : 0.84;
      const alpha = Math.max(0.08, Math.min(1, star.alpha * twinkle));
      const x = star.xNorm * width;
      const y = star.yNorm * height;
      const radius = star.radius * dpr;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius * 2.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(184, 214, 255, ${(alpha * 0.26).toFixed(3)})`;
      ctx.fill();
    });
  };

  const stopSuperStarsAnimation = () => {
    if (superStarsRafId !== null) {
      cancelAnimationFrame(superStarsRafId);
      superStarsRafId = null;
    }
  };

  const getSuperStarsCanvases = (bgNode) => {
    if (!bgNode) return [];
    return Array.from(bgNode.querySelectorAll(SUPER_STARS_CANVAS_SELECTOR));
  };

  const drawSuperStarsFrame = () => {
    superStarsRafId = null;
    const bgNode = getCachedElementById(ID);
    if (!bgNode) {
      stopSuperStarsAnimation();
      return;
    }

    const canvases = getSuperStarsCanvases(bgNode);
    if (canvases.length === 0) {
      stopSuperStarsAnimation();
      return;
    }

    const activeSet = new Set(canvases);
    for (const [canvas] of superStarsRenderStates) {
      if (!canvas.isConnected || !activeSet.has(canvas)) {
        superStarsRenderStates.delete(canvas);
      }
    }

    const animate = !document.hidden && !settings.disableBgAnimation;
    const nowSeconds = performance.now() / 1000;
    canvases.forEach((canvas) => {
      const state = getSuperStarsState(canvas);
      drawSuperStarsCanvas(canvas, state, nowSeconds, animate);
    });

    if (animate) {
      superStarsRafId = requestAnimationFrame(drawSuperStarsFrame);
    }
  };

  const syncSuperStarsRenderer = (bgNode = getCachedElementById(ID)) => {
    if (!bgNode) {
      stopSuperStarsAnimation();
      return;
    }
    const canvases = getSuperStarsCanvases(bgNode);
    if (canvases.length === 0) {
      stopSuperStarsAnimation();
      return;
    }
    drawSuperStarsFrame();
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
    inactiveLayer.classList.remove("super-stars-active");
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
      syncSuperStarsRenderer(bgNode);
    };

    // --- Handle different background types ---
    if (url === "__gpt5_animated__") {
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

    if (url === SUPER_STARS_KEY || url === LEGACY_GROK_SIGNUP_KEY) {
      inactiveLayer.classList.add("super-stars-active");
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

  const quickSettingsApi = globalThis.AetherContentQuickSettings;
  if (!quickSettingsApi?.createQuickSettingsController) {
    throw new Error("Aether: quick settings UI module failed to load in content context.");
  }

  const quickSettingsController = quickSettingsApi.createQuickSettingsController({
    QS_BUTTON_ID,
    QS_PANEL_ID,
    MIN_BG_BLUR,
    MAX_BG_BLUR,
    MIN_CONTENT_WIDTH,
    MAX_CONTENT_WIDTH,
    STORAGE_FLUSH_DELAY_MS,
    BLUR_SAVE_DELAY_MS,
    DEFAULT_BG_URL,
    GROK_HORIZON_URL,
    GROK_BLANCO_URL,
    GROK_BLANCO_LEGACY_URL,
    GROK_DARKO_URL,
    GROK_CELESTE_URL,
    AURORA_CLASSIC_URL,
    JET_KEY,
    AURORA_KEY,
    SUNSET_KEY,
    OCEAN_KEY,
    SUPER_STARS_KEY,
    LEGACY_GROK_SIGNUP_KEY,
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
    getSettings: () => settings,
    getMessage,
    t,
    escapeHtml,
    sanitizeBackgroundUrl,
    getClampedBlurValue,
    getClampedContentWidthValue,
    applyCustomStyles,
    updateBackgroundImage,
  });

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
    const themeState = `${isUiVisible}-${!!settings.blurChatHistory}-${applyLightMode}-${settings.appearance}-${settings.accentColor}-${!!settings.disableBgAnimation}`;
    if (lastAppliedThemeState === themeState) {
      syncSuperStarsRenderer();
      return;
    }
    lastAppliedThemeState = themeState;
    document.documentElement.classList.toggle(LIGHT_CLASS, applyLightMode);
    applyAccentColor(applyLightMode);
    syncSuperStarsRenderer();

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
    quickSettingsController.manage();
    applyRootFlags();
    applyCustomStyles();
    updateBackgroundImage();

    // Avoid applying heavy UI restyling while ChatGPT is still mounting;
    // this prevents refresh-time visual artifacts on skeleton placeholders.
    if (!document.documentElement.classList.contains(READY_CLASS)) return;

    manageGpt5LimitPopup();
    manageUpgradeButtons(true);
    manageSidebarButtons(true);
    promoteQuickAddMenuItems();
    scheduleHeavyScan(heavyScanState.canvas, markCanvasSurfaces, true);
    scheduleHeavyScan(heavyScanState.research, markResearchReportCards, true);
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
    quickSettingsController.teardown();
    if (uiReadyTimeout) {
      clearTimeout(uiReadyTimeout);
      uiReadyTimeout = null;
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
    if (popstateHandler) {
      window.removeEventListener("popstate", popstateHandler);
      popstateHandler = null;
    }
    if (quickAddInteractionHandler) {
      document.removeEventListener("click", quickAddInteractionHandler, true);
      quickAddInteractionHandler = null;
    }
    if (sidebarNavInteractionHandler) {
      document.removeEventListener("pointerdown", sidebarNavInteractionHandler, true);
      sidebarNavInteractionHandler = null;
    }
    clearSidebarNavActiveFlag();
    clearScheduledHeavyScan(heavyScanState.canvas);
    clearScheduledHeavyScan(heavyScanState.research);
    clearQuickAddPromotionTimers();
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
      SIDEBAR_NAV_ACTIVE_CLASS,
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
    _elementCache.clear();
    lastAppliedThemeState = null;
    lastDetectedTheme = null;
    if (backgroundTransitionTimer) {
      clearTimeout(backgroundTransitionTimer);
      backgroundTransitionTimer = null;
    }
    stopSuperStarsAnimation();
    superStarsRenderStates.clear();
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
      syncSuperStarsRenderer(bgNode);
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

    sidebarNavInteractionHandler = (event) => {
      if (!shouldEnableSidebarNavPerformanceMode(event.target)) return;
      activateSidebarNavPerformanceMode();
    };
    document.addEventListener("pointerdown", sidebarNavInteractionHandler, true);

    const debouncedOtherChecks = debounce(() => {
      manageGpt5LimitPopup();
      manageTodaysPulse();
      manageSidebarButtonsQuick();
      scheduleHeavyScan(heavyScanState.canvas, markCanvasSurfaces);
      scheduleHeavyScan(heavyScanState.research, markResearchReportCards);
    }, OTHER_CHECK_DELAY_MS);

    const debouncedCriticalChecks = debounce(() => {
      manageUpgradeButtons();
      attachThemeObservers();
    }, CRITICAL_CHECK_DELAY_MS);

    if (ENABLE_MUTATION_UI_SCANS) {
      // This observer handles dynamic UI changes.
      domObserver = new MutationObserver(() => {
        // Run the critical checks on a short debounce to avoid layout thrashing during streaming
        debouncedCriticalChecks();
        // Run the less-critical checks on a longer debounce timer.
        debouncedOtherChecks();
      });

      domObserver.observe(document.body, { childList: true, subtree: true });
    }

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
          let didUpdateStyles = false;
          if (changes.backgroundBlur) {
            const nextBlurRaw = changes.backgroundBlur.newValue;
            const clampedBlur = String(getClampedBlurValue(nextBlurRaw));
            if (clampedBlur !== settings.backgroundBlur) {
              settings.backgroundBlur = clampedBlur;
              didUpdateStyles = true;
            }
          }
          if (changes.backgroundScaling) {
            const nextScalingRaw = changes.backgroundScaling.newValue;
            const nextScaling = sanitizeBackgroundScaling(nextScalingRaw);
            if (nextScaling !== settings.backgroundScaling) {
              settings.backgroundScaling = nextScaling;
              didUpdateStyles = true;
            }
          }
          if (changes.contentWidth) {
            const nextContentWidthRaw = changes.contentWidth.newValue;
            const nextContentWidth = String(getClampedContentWidthValue(nextContentWidthRaw));
            if (nextContentWidth !== settings.contentWidth) {
              settings.contentWidth = nextContentWidth;
              didUpdateStyles = true;
            }
          }
          if (didUpdateStyles) {
            applyCustomStyles();
          }

          const blurSlider = document.getElementById("qs-blur-slider");
          const blurValue = document.getElementById("qs-blur-value");
          if (blurSlider && blurValue && changes.backgroundBlur) {
            const currentBlur = String(getClampedBlurValue(settings.backgroundBlur));
            blurSlider.value = currentBlur;
            blurValue.textContent = currentBlur;
          }
          const contentWidthSlider = document.getElementById("qs-content-width-slider");
          const contentWidthValue = document.getElementById("qs-content-width-value");
          if (contentWidthSlider && contentWidthValue && changes.contentWidth) {
            const currentWidth = String(getClampedContentWidthValue(settings.contentWidth));
            contentWidthSlider.value = currentWidth;
            contentWidthValue.textContent = currentWidth;
          }
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
            manageUpgradeButtons(true);
            manageSidebarButtons(true);
            quickSettingsController.manage();
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
})();
