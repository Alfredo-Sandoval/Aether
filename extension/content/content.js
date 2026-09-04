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
    const HOME_LANDING_CLASS = "cgpt-home-landing-shell";
    const ANIMATIONS_DISABLED_CLASS = "cgpt-animations-disabled";
    const BG_ANIM_DISABLED_CLASS = "cgpt-bg-anim-disabled";
    const AETHER_SURFACE_ATTR = "data-aether-surface";
    const AETHER_GLASS_ATTR = "data-aether-glass";
    const FORCED_WIDE_COMPOSER_ATTR = "data-aether-force-wide-composer";
    const COMPOSER_TARGET_WIDTH_VAR = "--aether-composer-target-width";
    let settings = {};
    let hasLoadedSettingsSnapshot = false;
    let lastAppliedRootState = null;

    const HIDE_LIMIT_CLASS = "cgpt-hide-gpt5-limit";
    const HIDE_UPGRADE_CLASS = "cgpt-hide-upgrade";
    // Class and setting names remain stable so existing synced preferences keep
    // working after ChatGPT replaced Sora/GPTs/Pulse with Images/Plugins/Maps.
    const HIDE_SORA_CLASS = "cgpt-hide-sora";
    const HIDE_GPTS_CLASS = "cgpt-hide-gpts";
    const HIDE_SHOPPING_CLASS = "cgpt-hide-shopping";
    const HIDE_TODAYS_PULSE_CLASS = "cgpt-hide-todays-pulse";
    const RESEARCH_CARD_CLASS = "cgpt-aether-research-card";
    const RESEARCH_CARD_OPEN_CLASS = "cgpt-aether-research-card-open";
    const CANVAS_SURFACE_CLASS = "cgpt-aether-canvas-surface";
    const TIMESTAMP_KEY = "gpt5LimitHitTimestamp";
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const DESKTOP_COMPOSER_FIX_MIN_VIEWPORT = 900;
    const COMPACT_COMPOSER_MAX_WIDTH = 480;
    const COMPOSER_SIDE_GUTTER_PX = 32;
    const COMPOSER_DESKTOP_MAX_WIDTH_PX = 1024;
    const TRANSITION_DURATION_MS = 800;
    const STORAGE_FLUSH_DELAY_MS = 300;
    const SETTINGS_REFRESH_DELAY_MS = 50;
    const CRITICAL_CHECK_DELAY_MS = 50;
    const OTHER_CHECK_DELAY_MS = 150;
    const UI_READY_TIMEOUT_MS = 15000;
    const UI_READY_SETTLE_DELAY_MS = 300;
    const QS_CLOSE_STATE_TIMEOUT_MS = 320;
    const SETTINGS_RECOVERY_DELAYS_MS = Object.freeze([200, 500, 1000, 2000]);
    const HOME_COMPOSER_BLUR_DELAYS_MS = Object.freeze([0, 150, 450]);

    let refreshTimeout = null;
    let settingsRefreshGeneration = 0;
    let settingsRetryTimer = null;
    let settingsRecoveryAttempt = 0;
    let refreshSettingsAndApply = () => {};
    let quickAddPromotionTimers = [];
    let uiReadyObserver = null;
    let domObserver = null;
    let uiReadyTimeout = null;
    let uiReadySettleTimer = null;
    let observersStarted = false;
    let showBgDomReadyHandler = null;
    let backgroundRevealTimer = null;
    let composerLayoutFrame = null;
    let surfaceTagsFrame = null;
    let homeComposerUserInteracted = false;
    let homeComposerBlurTimers = [];
    let homeComposerBlurScheduledForUrl = "";
    let runtimeCleanupCallbacks = [];

    // Every listener, timer, observer, and module registers its own disposal at
    // the point of acquisition; cleanupRuntimeBindings only flushes this registry
    // and resets page-level DOM state.
    const registerRuntimeCleanup = (callback) => {
      runtimeCleanupCallbacks.push(callback);
    };

    const flushRuntimeCleanupCallbacks = () => {
      const callbacks = runtimeCleanupCallbacks;
      runtimeCleanupCallbacks = [];
      callbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.warn("Aether: Cleanup callback failed", error);
        }
      });
    };

    const addManagedEventListener = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      registerRuntimeCleanup(() => target.removeEventListener(type, handler, options));
    };

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
    const runtimeClient = globalThis.AetherRuntimeClient;
    const sidebarToolsFactory = globalThis.AetherContentSidebarTools;
    const researchToolsFactory = globalThis.AetherContentResearchTools;
    const backgroundMediaFactory = globalThis.AetherBackgroundMedia;
    const surfaceTaggingFactory = globalThis.AetherSurfaceTagging;
    const refractiveGlassFactory = globalThis.AetherRefractiveGlass;
    const welcomeScreenFactory = globalThis.AetherWelcomeScreen;
    const settingsControlsFactory = globalThis.AetherSettingsControls;
    const quickSettingsFactory = globalThis.AetherQuickSettings;
    if (!sharedUtils) {
      throw new Error("Aether: shared utilities failed to load in content context.");
    }
    if (!runtimeClient) {
      throw new Error("Aether: runtime client failed to load in content context.");
    }
    if (!sidebarToolsFactory?.createSidebarTools) {
      throw new Error("Aether: content sidebar tools failed to load in content context.");
    }
    if (!researchToolsFactory?.createResearchSurfaceTools) {
      throw new Error("Aether: content research tools failed to load in content context.");
    }
    if (!backgroundMediaFactory?.createBackgroundMediaEngine) {
      throw new Error("Aether: background media engine failed to load in content context.");
    }
    if (!surfaceTaggingFactory?.createSurfaceTagging) {
      throw new Error("Aether: surface tagging failed to load in content context.");
    }
    if (!refractiveGlassFactory?.ensureRefractiveGlassFilter) {
      throw new Error("Aether: refractive glass filter failed to load in content context.");
    }
    if (!welcomeScreenFactory?.createWelcomeScreen) {
      throw new Error("Aether: welcome screen failed to load in content context.");
    }
    if (!settingsControlsFactory?.createRangeControlBinding) {
      throw new Error("Aether: settings controls failed to load in content context.");
    }
    if (!quickSettingsFactory?.createQuickSettingsPanel) {
      throw new Error("Aether: quick settings failed to load in content context.");
    }
    refractiveGlassFactory.ensureRefractiveGlassFilter(document);
    registerRuntimeCleanup(() => refractiveGlassFactory.removeRefractiveGlassFilter(document));
    const {
      getDefaultSettings,
      SETTING_BOUNDS,
      POPUP_BACKGROUND_PRESET_OPTIONS,
      sanitizeBackgroundScaling,
      sanitizeSettingsPayload,
      escapeHtml,
      clampBackgroundBlur,
      sanitizeContentWidth,
      DEFAULT_BACKGROUND_PRESET_ID,
      getBackgroundPresets,
      getBackgroundPresetUrl,
      resolveBackgroundPresetIdFromUrl,
      normalizeUiText,
      matchesShoppingResearchValue,
      GPT5_LIMIT_PHRASES,
      QUICK_ADD_MENU_HINTS,
      QUICK_ADD_MORE_LABELS,
      QUICK_ADD_PROMOTED_HINTS,
      QUICK_ADD_TOP_PRIORITY_HINT_GROUPS,
      SEARCH_PANEL_HINTS,
      isSettingsSurfaceDescriptor,
      isProjectSurfaceDescriptor,
      isProfileMenuSurfaceDescriptor,
      isModelPickerSurfaceDescriptor,
      isUpgradeSettingsDescriptor,
      shouldHideUpgradeSurface,
    } = sharedUtils;
    const { isTransientRuntimeError, sendRuntimeMessage, requestSettingsUpdate } = runtimeClient;
    // Derive slider bounds from the shared sanitizer so content and background stay on one source of truth.
    const MIN_BG_BLUR = SETTING_BOUNDS.backgroundBlur.min;
    const MAX_BG_BLUR = SETTING_BOUNDS.backgroundBlur.max;
    const MIN_CONTENT_WIDTH = SETTING_BOUNDS.contentWidth.min;
    const MAX_CONTENT_WIDTH = SETTING_BOUNDS.contentWidth.max;
    settings = getDefaultSettings();
    const sanitizeBackgroundUrl = (url) => sharedUtils.sanitizeBackgroundUrl(url, EXTENSION_BASE_URL);
    const getSettingsSanitizerBase = () =>
      settings && Object.keys(settings).length > 0 ? settings : getDefaultSettings();
    const isAuthoritativeSettingsSource = (source) =>
      typeof source !== "string" || !source.startsWith("ephemeral-defaults:");
    const clearSettingsRecoveryTimer = () => {
      if (settingsRetryTimer) {
        clearTimeout(settingsRetryTimer);
        settingsRetryTimer = null;
      }
    };
    const scheduleSettingsRecovery = () => {
      if (settingsRecoveryAttempt >= SETTINGS_RECOVERY_DELAYS_MS.length) return;
      clearSettingsRecoveryTimer();
      const delay = SETTINGS_RECOVERY_DELAYS_MS[settingsRecoveryAttempt];
      settingsRecoveryAttempt += 1;
      settingsRetryTimer = setTimeout(() => {
        settingsRetryTimer = null;
        refreshSettingsAndApply({ delayMs: 0, allowRetry: true });
      }, delay);
    };
    registerRuntimeCleanup(() => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
      clearSettingsRecoveryTimer();
    });
    const loadSettingsSnapshot = async () => {
      const response = await sendRuntimeMessage({ type: "GET_SETTINGS" });
      if (!response || typeof response !== "object" || !Object.prototype.hasOwnProperty.call(response, "settings")) {
        throw new Error("Runtime settings response did not include a settings payload.");
      }
      const source = response?.status?.source || "runtime";
      if (!isAuthoritativeSettingsSource(source)) {
        const hydrationError = new Error(`Settings hydration was not authoritative (${source})`);
        hydrationError.needsRuntimeRecovery = true;
        throw hydrationError;
      }
      const rawSettings = response.settings;
      const { sanitized } = sanitizeSettingsPayload(rawSettings, {
        baseSettings: getSettingsSanitizerBase(),
        extensionBaseUrl: EXTENSION_BASE_URL,
      });
      return { settings: sanitized, source, needsRuntimeRecovery: false };
    };

    const getBackgroundPresetResolvedUrl = (presetId) => getBackgroundPresetUrl(presetId, getExtensionUrl);
    const resolveBackgroundPresetId = (url) => resolveBackgroundPresetIdFromUrl(url, getExtensionUrl);
    const BACKGROUND_PRESETS = getBackgroundPresets(getExtensionUrl);

    const DEFAULT_BG_URL = getBackgroundPresetResolvedUrl(DEFAULT_BACKGROUND_PRESET_ID);
    const GPT5_ANIMATED_KEY = getBackgroundPresetResolvedUrl("__gpt5_animated__");
    const JET_KEY = getBackgroundPresetResolvedUrl("jet");
    const AURORA_KEY = getBackgroundPresetResolvedUrl("aurora");
    const SUNSET_KEY = getBackgroundPresetResolvedUrl("sunset");
    const OCEAN_KEY = getBackgroundPresetResolvedUrl("ocean");
    const DEFAULT_BG_THUMB_URL =
      BACKGROUND_PRESETS.find((preset) => preset.id === DEFAULT_BACKGROUND_PRESET_ID)?.thumbnailUrl || "";

    const QUICK_SETTINGS_BG_PRESET_LABEL_KEYS = Object.freeze(
      POPUP_BACKGROUND_PRESET_OPTIONS.filter((option) => option.labelKey).reduce((acc, option) => {
        acc[option.value] = option.labelKey;
        return acc;
      }, {})
    );
    const QUICK_SETTINGS_BG_ANIMATED_IDS = Object.freeze(["__gpt5_animated__", "aurora", "sunset", "ocean"]);
    const QUICK_SETTINGS_BG_PRESETS = Object.freeze(
      BACKGROUND_PRESETS.filter((preset) =>
        Object.prototype.hasOwnProperty.call(QUICK_SETTINGS_BG_PRESET_LABEL_KEYS, preset.id)
      ).map((preset) =>
        Object.freeze({
          key: preset.id,
          url: preset.url,
          labelKey: QUICK_SETTINGS_BG_PRESET_LABEL_KEYS[preset.id],
          animated: QUICK_SETTINGS_BG_ANIMATED_IDS.includes(preset.id),
          thumb: preset.id === "default" ? DEFAULT_BG_THUMB_URL : preset.thumbnailUrl,
          defaultBlur: preset.defaultBlur,
        })
      )
    );

    // Prefer stable roles and data attributes; ChatGPT utility classes churn across releases.
    const SELECTORS = {
      GPT5_LIMIT_POPUP: 'div[class*="text-token-text-primary"]',
      UPGRADE_PROFILE_BUTTON_TRAILING_ICON:
        ':is([data-testid="accounts-profile-button"], [data-testid="profile-button"]) .__menu-item-trailing-btn',
      SORA_BUTTON_ID: "sidebar-item-images",
      SORA_BUTTON:
        'a[href="/images"], a[href^="/images/"], [data-testid="sidebar-item-images"], [data-testid="images-button"]',
      GPTS_BUTTON:
        'a[href="/plugins"], a[href^="/plugins/"], [data-testid="sidebar-item-plugins"], [data-testid="plugins-button"]',
      MAPS_BUTTON: 'a[href="/maps"], a[href^="/maps/"], [data-testid="sidebar-item-maps"], [data-testid="maps-button"]',
      PROFILE_BUTTON: '[data-testid="accounts-profile-button"], [data-testid="profile-button"]',
    };
    const UPGRADE_INTERACTIVE_SELECTOR = [
      "a[href]",
      "button",
      '[role="button"]',
      '[role="menuitem"]',
      '[role="menuitemradio"]',
      "[aria-label]",
      "[title]",
      "[data-testid]",
    ].join(", ");

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
      let timeout = null;
      const executedFunction = (...args) => {
        const later = () => {
          timeout = null;
          func(...args);
        };
        if (timeout !== null) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
      executedFunction.cancel = () => {
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
      };
      return executedFunction;
    };

    const toggleClassForElements = (elements, className, force) => {
      elements.forEach((el) => {
        if (el) el.classList.toggle(className, force);
      });
    };

    const normalizeText = normalizeUiText;

    const isElementVisible = (el) => {
      if (!el) return false;
      const computedStyle = window.getComputedStyle(el);
      if (computedStyle.display === "none") return false;
      if (computedStyle.visibility === "hidden" || computedStyle.visibility === "collapse") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const SHOPPING_ATTRS = ["aria-label", "data-aria-label", "data-testid", "data-track"];
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
    const RESEARCH_REPORT_MARKER_SELECTOR = [
      '[data-testid*="research" i]',
      '[data-testid*="artifact" i]',
      '[id*="research" i]',
      '[id*="artifact" i]',
      '[class*="research" i]',
      '[class*="artifact" i]',
    ].join(", ");
    const RESEARCH_DIALOG_SELECTOR = 'div[role="dialog"]';
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
    const RESEARCH_HOME_SELECTOR = ".deep-research-app";
    const ACTIVITY_FLYOUT_SELECTOR = [
      '[data-testid="stage-thread-flyout"]',
      'section[data-testid="screen-threadFlyOut"]',
      '[aria-label*="reasoning details" i]',
    ].join(", ");

    const { manageSidebarButtons, manageSidebarButtonsQuick, manageTodaysPulse } =
      sidebarToolsFactory.createSidebarTools({
        document,
        getSettings: () => settings,
        selectors: SELECTORS,
        hideSoraClass: HIDE_SORA_CLASS,
        hideGptsClass: HIDE_GPTS_CLASS,
        hideShoppingClass: HIDE_SHOPPING_CLASS,
        hideTodaysPulseClass: HIDE_TODAYS_PULSE_CLASS,
        shoppingAttrs: SHOPPING_ATTRS,
        toggleClassForElements,
        matchesShoppingResearchValue,
      });

    const {
      markResearchReportCards,
      markCanvasSurfaces,
      getResearchOverlayHostNodes,
      getResearchHomeCardNodes,
      getResearchAgendaItemNodes,
      isResearchDialogNode,
      getClosedResearchViewerNodes,
    } = researchToolsFactory.createResearchSurfaceTools({
      document,
      window,
      Node,
      Element,
      normalizeText,
      isElementVisible,
      matchesResearchBannerText: sharedUtils.matchesResearchBannerText,
      matchesResearchContentText: sharedUtils.matchesResearchContentText,
      matchesResearchFullscreenText: sharedUtils.matchesResearchFullscreenText,
      matchesCanvasActionHeaderText: sharedUtils.matchesCanvasActionHeaderText,
      isResearchDialogDescriptor: sharedUtils.isResearchDialogDescriptor,
      isResearchCardRootShellDescriptor: sharedUtils.isResearchCardRootShellDescriptor,
      composerSelector: 'form[data-type="unified-composer"]',
      researchCardClass: RESEARCH_CARD_CLASS,
      researchCardOpenClass: RESEARCH_CARD_OPEN_CLASS,
      canvasSurfaceClass: CANVAS_SURFACE_CLASS,
      researchCardContainerSelector: RESEARCH_CARD_CONTAINER_SELECTOR,
      researchEmbedIframeSelector: RESEARCH_EMBED_IFRAME_SELECTOR,
      researchReportMarkerSelector: RESEARCH_REPORT_MARKER_SELECTOR,
      researchDialogSelector: RESEARCH_DIALOG_SELECTOR,
      researchHomeSelector: RESEARCH_HOME_SELECTOR,
    });

    const surfaceTagging = surfaceTaggingFactory.createSurfaceTagging({
      document,
      window,
      normalizeText: normalizeUiText,
      isElementVisible,
      isSettingsSurfaceDescriptor,
      isProjectSurfaceDescriptor,
      isProfileMenuSurfaceDescriptor,
      isModelPickerSurfaceDescriptor,
      isResearchDialogNode,
      getClosedResearchViewerNodes,
      getResearchOverlayHostNodes,
      getResearchHomeCardNodes,
      getResearchAgendaItemNodes,
      getProfileButton: () => getCachedElement(SELECTORS.PROFILE_BUTTON),
      searchPanelHints: SEARCH_PANEL_HINTS,
      surfaceAttr: AETHER_SURFACE_ATTR,
      glassAttr: AETHER_GLASS_ATTR,
      activityFlyoutSelector: ACTIVITY_FLYOUT_SELECTOR,
      researchViewerHostSelector: RESEARCH_VIEWER_HOST_SELECTOR,
      researchHomeSelector: RESEARCH_HOME_SELECTOR,
      canvasSurfaceClass: CANVAS_SURFACE_CLASS,
    });
    registerRuntimeCleanup(() => surfaceTagging.clearAllTags());

    const clearForcedWideComposer = (form) => {
      if (!(form instanceof HTMLElement)) return;
      form.removeAttribute(FORCED_WIDE_COMPOSER_ATTR);
      form.style.removeProperty(COMPOSER_TARGET_WIDTH_VAR);
    };

    const ACCENT_COLORS = {
      none: { gradient: "none", glowDark: "none", solid: "#2563eb" },
      pink: {
        gradient: "var(--gradient-pink)",
        glowDark: "var(--glow-pink)",
        solid: "#f093fb",
      },
      purple: {
        gradient: "var(--gradient-purple)",
        glowDark: "var(--glow-purple)",
        solid: "#667eea",
      },
      blue: {
        gradient: "var(--gradient-blue)",
        glowDark: "var(--glow-blue)",
        solid: "#4facfe",
      },
      primary: {
        gradient: "var(--gradient-primary)",
        glowDark: "var(--glow-purple)",
        solid: "#667eea",
      },
    };

    const getMessage = (key, substitutions) => {
      try {
        if (window.AetherI18n?.getMessage) {
          const text = window.AetherI18n.getMessage(key, substitutions);
          if (text && text !== key) return text;
        }

        if (chrome?.i18n?.getMessage && chrome.runtime?.id) {
          const text = chrome.i18n.getMessage(key, substitutions);
          if (text) return text;
        }
      } catch (e) {
        const errMessage = String(e?.message || "").toLowerCase();
        if (!errMessage.includes("extension context invalidated")) {
          console.error("Aether Extension Error:", e);
        }
        return key;
      }
      return key;
    };

    const t = (key, substitutions) => escapeHtml(getMessage(key, substitutions));

    const welcomeScreen = welcomeScreenFactory.createWelcomeScreen({
      document,
      translate: t,
      requestSettingsUpdate,
      openPopup: () => {
        void sendRuntimeMessage({ type: "OPEN_POPUP" }).catch(() => {});
      },
    });
    registerRuntimeCleanup(() => welcomeScreen.destroy());

    function findGpt5LimitPopup() {
      // The selector keys off a common utility class, so scan all matches for the
      // limit phrasing instead of trusting whichever node happens to come first.
      for (const candidate of document.querySelectorAll(SELECTORS.GPT5_LIMIT_POPUP)) {
        const text = candidate.textContent || "";
        if (text.length > 600) continue;
        const normalized = normalizeText(text);
        if (GPT5_LIMIT_PHRASES.some((phrase) => normalized.includes(phrase))) {
          return candidate;
        }
      }
      return null;
    }

    function manageGpt5LimitPopup() {
      if (!settings.hideGpt5Limit) {
        document.querySelectorAll(`.${HIDE_LIMIT_CLASS}`).forEach((el) => el.classList.remove(HIDE_LIMIT_CLASS));
        return;
      }
      if (!chrome?.runtime?.id) return;
      const popup = findGpt5LimitPopup();
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

    function buildUpgradeDescriptor(el, overrides = {}) {
      return {
        text: el?.textContent || "",
        ariaLabel: el?.getAttribute?.("aria-label") || "",
        title: el?.getAttribute?.("title") || "",
        dataTestId: el?.getAttribute?.("data-testid") || "",
        href: el?.getAttribute?.("href") || "",
        id: el?.id || "",
        className: typeof el?.className === "string" ? el.className : "",
        role: el?.getAttribute?.("role") || "",
        tagName: el?.tagName || "",
        withinSidebar:
          "withinSidebar" in overrides
            ? overrides.withinSidebar
            : !!el?.closest?.('nav, aside, [data-testid*="sidebar" i], [id*="sidebar" i]'),
        withinProfileMenu:
          "withinProfileMenu" in overrides
            ? overrides.withinProfileMenu
            : !!el?.closest?.('[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]'),
        ...overrides,
      };
    }

    function findUpgradeSettingsRow(el) {
      let node = el?.parentElement || null;
      for (let depth = 0; node && depth < 5; depth += 1) {
        if (
          isUpgradeSettingsDescriptor(
            buildUpgradeDescriptor(el, { text: node.textContent || "", withinSettings: true })
          )
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    function findCompactHideContainer(el) {
      let node = el;
      let bestNode = el;
      for (let depth = 0; node && depth < 4; depth += 1) {
        const text = normalizeText(node.textContent || "");
        if (text && text.length <= 280) {
          bestNode = node;
        }
        node = node.parentElement;
      }
      return bestNode;
    }

    function resolveUpgradeHideTarget(el) {
      const settingsRow = findUpgradeSettingsRow(el);
      if (settingsRow) return settingsRow;
      const descriptor = buildUpgradeDescriptor(el);
      if (descriptor.withinSidebar || descriptor.withinProfileMenu) return el;
      return findCompactHideContainer(el);
    }

    function findUpgradeInteractiveElements() {
      const matches = [];
      const seen = new Set();
      document.querySelectorAll(UPGRADE_INTERACTIVE_SELECTOR).forEach((el) => {
        if (!(el instanceof Element) || seen.has(el)) return;
        seen.add(el);
        // String matching first: assume the ancestor flags are true, which can
        // only widen the match set, so a miss here is a definitive miss and the
        // expensive closest() and layout-forcing visibility checks are skipped.
        if (!shouldHideUpgradeSurface(buildUpgradeDescriptor(el, { withinSidebar: true, withinProfileMenu: true }))) {
          return;
        }
        if (!shouldHideUpgradeSurface(buildUpgradeDescriptor(el))) return;
        // Elements we already hid fail the visibility check while remaining
        // legitimate targets, so keep them without re-measuring.
        const isHiddenByUs = !!el.closest(`.${HIDE_UPGRADE_CLASS}`);
        if (!isHiddenByUs && !isElementVisible(el)) return;
        matches.push(el);
      });
      return matches;
    }

    function manageUpgradeButtons() {
      if (!settings.hideUpgradeButtons) {
        document.querySelectorAll(`.${HIDE_UPGRADE_CLASS}`).forEach((el) => el.classList.remove(HIDE_UPGRADE_CLASS));
        return;
      }

      const upgradeTargets = new Set();
      findUpgradeInteractiveElements().forEach((el) => {
        const target = resolveUpgradeHideTarget(el);
        if (target) upgradeTargets.add(target);
      });

      const profileButtonUpgrade = document.querySelector(SELECTORS.UPGRADE_PROFILE_BUTTON_TRAILING_ICON);
      if (profileButtonUpgrade) {
        upgradeTargets.add(profileButtonUpgrade);
      }

      // Diff against the currently hidden set instead of unhide-all/re-hide, so
      // a steady-state pass performs no class churn at all.
      document.querySelectorAll(`.${HIDE_UPGRADE_CLASS}`).forEach((el) => {
        if (!upgradeTargets.has(el)) el.classList.remove(HIDE_UPGRADE_CLASS);
      });
      upgradeTargets.forEach((el) => el.classList.add(HIDE_UPGRADE_CLASS));
      if (isSurfaceDebugEnabled()) {
        console.debug(`Aether debug: hiding ${upgradeTargets.size} upgrade surface(s).`);
      }
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
        document.querySelector('[data-testid^="conversation-turn-"]')
      );
    }

    function syncReadyClass(isUiVisible) {
      const root = document.documentElement;
      if (!isUiVisible) {
        if (uiReadySettleTimer) {
          clearTimeout(uiReadySettleTimer);
          uiReadySettleTimer = null;
        }
        root.classList.remove(READY_CLASS);
        return;
      }
      if (root.classList.contains(READY_CLASS) || uiReadySettleTimer) return;
      uiReadySettleTimer = setTimeout(() => {
        uiReadySettleTimer = null;
        if (hasStableUiAnchor()) {
          root.classList.add(READY_CLASS);
        }
      }, UI_READY_SETTLE_DELAY_MS);
    }
    registerRuntimeCleanup(() => {
      if (uiReadySettleTimer) {
        clearTimeout(uiReadySettleTimer);
        uiReadySettleTimer = null;
      }
    });

    function isHomeLandingShell() {
      if (location.pathname !== "/") return false;
      if (document.querySelector('[data-testid^="conversation-turn-"]')) return false;
      return !!document.querySelector('form[data-type="unified-composer"]');
    }

    function clearHomeComposerBlurTimers() {
      homeComposerBlurTimers.forEach((timer) => clearTimeout(timer));
      homeComposerBlurTimers = [];
    }
    registerRuntimeCleanup(clearHomeComposerBlurTimers);

    function blurHomeLandingComposerIfAutofocused() {
      if (homeComposerUserInteracted) return false;
      if (!document.documentElement.classList.contains(HOME_LANDING_CLASS)) return false;
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) return false;
      const composer = activeElement.closest?.('form[data-type="unified-composer"]');
      if (!(composer instanceof HTMLElement)) return false;
      if (!activeElement.matches('#prompt-textarea, .ProseMirror, textarea, [role="textbox"]')) return false;
      activeElement.blur();
      return true;
    }

    function scheduleHomeLandingComposerBlur() {
      if (!document.documentElement.classList.contains(HOME_LANDING_CLASS)) {
        homeComposerBlurScheduledForUrl = "";
        clearHomeComposerBlurTimers();
        return;
      }
      if (homeComposerUserInteracted) return;
      if (homeComposerBlurScheduledForUrl === location.href) return;
      homeComposerBlurScheduledForUrl = location.href;
      clearHomeComposerBlurTimers();
      HOME_COMPOSER_BLUR_DELAYS_MS.forEach((delayMs) => {
        const timer = setTimeout(() => {
          homeComposerBlurTimers = homeComposerBlurTimers.filter((value) => value !== timer);
          blurHomeLandingComposerIfAutofocused();
        }, delayMs);
        homeComposerBlurTimers.push(timer);
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

      moveQuickAddPriorityItemsToTop(mainMenu, moreItem);
    }

    function clearQuickAddPromotionTimers() {
      quickAddPromotionTimers.forEach((timerId) => clearTimeout(timerId));
      quickAddPromotionTimers = [];
    }
    registerRuntimeCleanup(clearQuickAddPromotionTimers);

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

    // Some desktop shells occasionally mount the composer as fit-content.
    // Re-measure after SPA mutations and pin a sane width only when it
    // actually collapses, rather than when unrelated project controls exist.
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
        const isUnexpectedlyCompact =
          rect.width > 0 && rect.width < Math.min(COMPACT_COMPOSER_MAX_WIDTH, window.innerWidth * 0.5);
        if (!isUnexpectedlyCompact) {
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
    registerRuntimeCleanup(() => {
      if (composerLayoutFrame) {
        cancelAnimationFrame(composerLayoutFrame);
        composerLayoutFrame = null;
      }
    });

    // Debug mode: run `localStorage.AETHER_DEBUG_SURFACES = "1"` (or set
    // `window.AETHER_DEBUG_SURFACES = true`) in the ChatGPT tab console to
    // outline every tagged surface with its name, reveal elements the hide
    // heuristics targeted, and log tag counts on each refresh.
    const SURFACE_DEBUG_FLAG = "AETHER_DEBUG_SURFACES";
    const DEBUG_STYLE_ID = "cgpt-aether-debug-styles";
    const isSurfaceDebugEnabled = () => {
      try {
        return window.AETHER_DEBUG_SURFACES === true || localStorage.getItem(SURFACE_DEBUG_FLAG) === "1";
      } catch {
        return false;
      }
    };
    const ensureSurfaceDebugStyles = (enabled) => {
      const existing = document.getElementById(DEBUG_STYLE_ID);
      if (!enabled) {
        existing?.remove();
        return;
      }
      if (existing) return;
      const style = document.createElement("style");
      style.id = DEBUG_STYLE_ID;
      style.textContent = `
        [${AETHER_SURFACE_ATTR}] {
          outline: 1px dashed rgba(255, 0, 128, 0.8) !important;
          outline-offset: -1px !important;
        }
        [${AETHER_SURFACE_ATTR}]::before {
          content: attr(${AETHER_SURFACE_ATTR});
          position: absolute;
          z-index: 2147483647;
          background: rgba(255, 0, 128, 0.9);
          color: #fff;
          font: 10px/1.4 monospace;
          padding: 0 4px;
          pointer-events: none;
        }
        .${HIDE_UPGRADE_CLASS}, .${HIDE_SORA_CLASS}, .${HIDE_GPTS_CLASS}, .${HIDE_SHOPPING_CLASS}, .${HIDE_TODAYS_PULSE_CLASS}, .${HIDE_LIMIT_CLASS} {
          display: revert !important;
          visibility: visible !important;
          opacity: 0.6 !important;
          outline: 2px solid rgba(255, 64, 64, 0.9) !important;
        }
      `;
      document.documentElement.appendChild(style);
    };
    registerRuntimeCleanup(() => document.getElementById(DEBUG_STYLE_ID)?.remove());

    function refreshSurfaceTags() {
      markCanvasSurfaces();
      markResearchReportCards();
      surfaceTagging.markSemanticSurfaces();
      const debugEnabled = isSurfaceDebugEnabled();
      ensureSurfaceDebugStyles(debugEnabled);
      if (debugEnabled) {
        console.debug("Aether debug: surface tags", surfaceTagging.getTagSummary());
      }
    }

    function queueSurfaceTagsRefresh() {
      if (surfaceTagsFrame !== null) return;
      surfaceTagsFrame = requestAnimationFrame(() => {
        surfaceTagsFrame = null;
        refreshSurfaceTags();
      });
    }
    registerRuntimeCleanup(() => {
      if (surfaceTagsFrame !== null) {
        cancelAnimationFrame(surfaceTagsFrame);
        surfaceTagsFrame = null;
      }
    });

    function isResearchHomeMutation(mutation) {
      const target = mutation.target;
      if (target instanceof Element && target.closest?.(RESEARCH_HOME_SELECTOR)) return true;
      return Array.from(mutation.addedNodes).some((node) => {
        if (!(node instanceof Element)) return false;
        return !!(
          node.matches?.(RESEARCH_HOME_SELECTOR) ||
          node.closest?.(RESEARCH_HOME_SELECTOR) ||
          node.querySelector?.(RESEARCH_HOME_SELECTOR)
        );
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

    // Cross-fade engine for the ambient backdrop; sanitizes URLs itself, and every
    // ingestion path persists sanitized values, so rendering never writes settings.
    const backgroundMedia = backgroundMediaFactory.createBackgroundMediaEngine({
      document,
      nodeId: ID,
      sanitizeUrl: sanitizeBackgroundUrl,
      transitionDurationMs: TRANSITION_DURATION_MS,
      defaultUrl: DEFAULT_BG_URL,
      specialLayerClasses: {
        [GPT5_ANIMATED_KEY]: "gpt5-active",
        [JET_KEY]: "jet-active",
        [AURORA_KEY]: "aurora-active",
        [SUNSET_KEY]: "sunset-active",
        [OCEAN_KEY]: "ocean-active",
      },
    });

    const updateBackgroundImage = (requestedUrl = settings.customBgUrl) => backgroundMedia.update(requestedUrl);
    registerRuntimeCleanup(() => {
      if (backgroundRevealTimer !== null) {
        clearTimeout(backgroundRevealTimer);
        backgroundRevealTimer = null;
      }
      backgroundMedia.getNode()?.remove();
      backgroundMedia.reset();
    });

    const getClampedBlurValue = (rawValue) =>
      clampBackgroundBlur(rawValue, { min: MIN_BG_BLUR, max: MAX_BG_BLUR, fallback: 60 });
    const getClampedContentWidthValue = (rawValue) =>
      Number.parseInt(
        sanitizeContentWidth(rawValue, { min: MIN_CONTENT_WIDTH, max: MAX_CONTENT_WIDTH, fallback: 95 }),
        10
      );

    function applyCustomStyles() {
      const root = document.documentElement;
      if (!root) return;
      const clampedBlur = getClampedBlurValue(settings.backgroundBlur);
      const clampedContentWidth = getClampedContentWidthValue(settings.contentWidth);
      root.style.setProperty("--cgpt-thread-content-width", `${clampedContentWidth}%`);
      root.style.setProperty("--cgpt-bg-blur-radius", `${clampedBlur}px`);
      root.style.setProperty("--cgpt-bg-object-fit", sanitizeBackgroundScaling(settings.backgroundScaling));
    }

    // Batch rapid slider changes so the background worker remains the only sync-storage writer.
    let storageWriteQueue = {};
    let storageWriteTimer = null;
    let storageWriteInFlight = false;
    let storageWriteDisposed = false;
    const scheduleStorageFlush = (delayMs) => {
      if (storageWriteDisposed) return;
      if (storageWriteTimer !== null) clearTimeout(storageWriteTimer);
      storageWriteTimer = setTimeout(flushStorageQueue, delayMs);
    };
    const flushStorageQueue = () => {
      storageWriteTimer = null;
      if (storageWriteDisposed || storageWriteInFlight || Object.keys(storageWriteQueue).length === 0) return;
      const batch = storageWriteQueue;
      storageWriteQueue = {};
      if (chrome?.runtime?.sendMessage) {
        storageWriteInFlight = true;
        void requestSettingsUpdate(batch)
          .then(() => {
            storageWriteInFlight = false;
            if (Object.keys(storageWriteQueue).length > 0) {
              scheduleStorageFlush(STORAGE_FLUSH_DELAY_MS);
            }
          })
          .catch((error) => {
            storageWriteInFlight = false;
            const errMsg = error?.message || String(error);
            if (isTransientRuntimeError(errMsg) && !storageWriteDisposed) {
              storageWriteQueue = { ...batch, ...storageWriteQueue };
              scheduleStorageFlush(1000);
              return;
            }
            console.error("Aether: Storage write failed:", errMsg);
            if (Object.keys(storageWriteQueue).length > 0) {
              scheduleStorageFlush(STORAGE_FLUSH_DELAY_MS);
            }
          });
      }
    };
    const queueStorageWrite = (key, value) => {
      storageWriteQueue[key] = value;
      scheduleStorageFlush(STORAGE_FLUSH_DELAY_MS);
    };
    registerRuntimeCleanup(() => {
      storageWriteDisposed = true;
      if (storageWriteTimer !== null) {
        clearTimeout(storageWriteTimer);
        storageWriteTimer = null;
      }
      storageWriteQueue = {};
    });

    const quickSettings = quickSettingsFactory.createQuickSettingsPanel({
      document,
      window,
      controls: settingsControlsFactory,
      translate: t,
      getMessage,
      getSettings: () => settings,
      presets: QUICK_SETTINGS_BG_PRESETS,
      resolvePresetIdFromUrl: resolveBackgroundPresetId,
      sanitizeBackgroundUrl,
      clampBlur: getClampedBlurValue,
      clampContentWidth: getClampedContentWidthValue,
      minBlur: MIN_BG_BLUR,
      maxBlur: MAX_BG_BLUR,
      minContentWidth: MIN_CONTENT_WIDTH,
      maxContentWidth: MAX_CONTENT_WIDTH,
      queueStorageWrite: (key, value) => queueStorageWrite(key, value),
      applyTuningPatch: (patch) => applyImmediateTuningPatch(patch),
      openFullSettings: () => {
        void sendRuntimeMessage({ type: "OPEN_POPUP" }).catch(() => {});
      },
      buttonId: QS_BUTTON_ID,
      panelId: QS_PANEL_ID,
      closeStateTimeoutMs: QS_CLOSE_STATE_TIMEOUT_MS,
    });
    registerRuntimeCleanup(() => quickSettings.destroy());

    function applyRootFlags() {
      const isUiVisible = hasStableUiAnchor();
      document.documentElement.classList.toggle(HTML_CLASS, isUiVisible);
      document.documentElement.classList.remove("cgpt-appearance-clear");
      syncReadyClass(isUiVisible);
      document.documentElement.classList.toggle(HOME_LANDING_CLASS, isUiVisible && isHomeLandingShell());
      document.documentElement.classList.toggle(ANIMATIONS_DISABLED_CLASS, !!settings.disableAnimations);
      document.documentElement.classList.toggle(BG_ANIM_DISABLED_CLASS, !!settings.disableBgAnimation);

      document.documentElement.classList.toggle("cgpt-blur-chat-history", !!settings.blurChatHistory);

      const rootState = `${isUiVisible}-${!!settings.blurChatHistory}-${settings.accentColor}`;
      if (lastAppliedRootState === rootState) return;
      lastAppliedRootState = rootState;
      applyAccentColor();
    }

    function applyAccentColor() {
      const choice = settings.accentColor || "none";
      const config = ACCENT_COLORS[choice] || ACCENT_COLORS.none;
      const root = document.documentElement;

      if (choice === "none") {
        root.classList.remove("cgpt-accent-active");
        root.style.removeProperty("--accent-gradient");
        root.style.removeProperty("--accent-glow");
        root.style.removeProperty("--cgpt-accent-color");
        root.style.removeProperty("--user-bubble-gradient");
        root.style.removeProperty("--user-bubble-glow");
        root.style.removeProperty("--user-bubble-border");
      } else {
        root.classList.add("cgpt-accent-active");
        root.style.setProperty("--accent-gradient", config.gradient);
        root.style.setProperty("--accent-glow", config.glowDark);
        root.style.setProperty("--cgpt-accent-color", config.solid);
        root.style.setProperty("--user-bubble-gradient", config.gradient);
        root.style.setProperty("--user-bubble-glow", config.glowDark);
        root.style.setProperty("--user-bubble-border", "transparent");
      }
    }

    function showBg() {
      let node = backgroundMedia.getNode();
      if (!node) {
        node = backgroundMedia.createNode();
        const add = () => {
          document.body.prepend(node);
          ensureAppOnTop();
          applyCustomStyles();
          updateBackgroundImage();
          if (backgroundRevealTimer !== null) clearTimeout(backgroundRevealTimer);
          backgroundRevealTimer = setTimeout(() => {
            backgroundRevealTimer = null;
            backgroundMedia.setNodeVisible(true);
          }, SETTINGS_REFRESH_DELAY_MS);
        };
        if (document.body) add();
        else if (!showBgDomReadyHandler) {
          showBgDomReadyHandler = () => {
            showBgDomReadyHandler = null;
            add();
          };
          addManagedEventListener(document, "DOMContentLoaded", showBgDomReadyHandler, { once: true });
        }
      } else {
        backgroundMedia.setNodeVisible(true);
        updateBackgroundImage();
      }
    }

    function applyAllSettings() {
      if (!hasLoadedSettingsSnapshot) return;
      showBg();
      quickSettings.manage();
      applyRootFlags();
      applyCustomStyles();
      updateBackgroundImage();
      queueComposerLayoutSync();
      scheduleHomeLandingComposerBlur();

      // Avoid applying heavy UI restyling while ChatGPT is still mounting;
      // this prevents refresh-time visual artifacts on skeleton placeholders.
      if (!document.documentElement.classList.contains(READY_CLASS)) return;

      manageGpt5LimitPopup();
      manageUpgradeButtons();
      manageSidebarButtons();
      promoteQuickAddMenuItems();
      refreshSurfaceTags();
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
      quickSettings.syncTuningControls(patch);
      return didUpdateStyles;
    }

    const cleanupRuntimeBindings = () => {
      settingsRefreshGeneration += 1;
      flushRuntimeCleanupCallbacks();
      const styleNode = document.getElementById(STYLE_ID);
      if (styleNode) styleNode.remove();
      document.documentElement.classList.remove(
        HTML_CLASS,
        READY_CLASS,
        HOME_LANDING_CLASS,
        ANIMATIONS_DISABLED_CLASS,
        BG_ANIM_DISABLED_CLASS,
        "cgpt-blur-chat-history",
        "cgpt-tab-hidden",
        "cgpt-appearance-clear",
        "cgpt-accent-active"
      );
      document.documentElement.style.removeProperty("--accent-gradient");
      document.documentElement.style.removeProperty("--accent-glow");
      document.documentElement.style.removeProperty("--cgpt-accent-color");
      document.documentElement.style.removeProperty("--user-bubble-gradient");
      document.documentElement.style.removeProperty("--user-bubble-glow");
      document.documentElement.style.removeProperty("--user-bubble-border");
      document
        .querySelectorAll(`form[data-type="unified-composer"][${FORCED_WIDE_COMPOSER_ATTR}]`)
        .forEach(clearForcedWideComposer);
      _elementCache.clear();
      lastAppliedRootState = null;
      hasLoadedSettingsSnapshot = false;
      observersStarted = false;
      showBgDomReadyHandler = null;
      homeComposerUserInteracted = false;
      homeComposerBlurScheduledForUrl = "";
    };

    function startObservers() {
      if (observersStarted) return;
      observersStarted = true;
      registerRuntimeCleanup(() => {
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
      });
      let lastUrl = location.href;
      const checkUrl = () => {
        if (location.href === lastUrl) return false;
        lastUrl = location.href;
        homeComposerUserInteracted = false;
        homeComposerBlurScheduledForUrl = "";
        clearHomeComposerBlurTimers();
        applyAllSettings();
        return true;
      };

      // Pause hidden-tab media to avoid burning CPU while ChatGPT keeps the page alive in the background.
      addManagedEventListener(
        document,
        "visibilitychange",
        () => {
          document.documentElement.classList.toggle("cgpt-tab-hidden", document.hidden);
          if (!document.hidden) {
            checkUrl();
          }
          backgroundMedia.syncMediaPlayback(document.hidden);
        },
        { passive: true }
      );

      const homeComposerInteractionHandler = () => {
        homeComposerUserInteracted = true;
        clearHomeComposerBlurTimers();
      };
      addManagedEventListener(document, "pointerdown", homeComposerInteractionHandler, true);
      addManagedEventListener(document, "keydown", homeComposerInteractionHandler, true);

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

      addManagedEventListener(
        window,
        "focus",
        () => {
          if (!checkUrl()) {
            applyAllSettings();
          }
        },
        { passive: true }
      );
      addManagedEventListener(window, "resize", queueComposerLayoutSync, { passive: true });
      addManagedEventListener(
        window,
        "popstate",
        () => {
          checkUrl();
        },
        { passive: true }
      );

      addManagedEventListener(
        document,
        "click",
        (event) => {
          if (!shouldTriggerQuickAddPromotionFromEventTarget(event.target)) return;
          queueQuickAddPromotion();
        },
        true
      );

      const debouncedOtherChecks = debounce(() => {
        manageGpt5LimitPopup();
        manageTodaysPulse();
        manageSidebarButtonsQuick();
        queueSurfaceTagsRefresh();
        queueComposerLayoutSync();
      }, OTHER_CHECK_DELAY_MS);

      const debouncedCriticalChecks = debounce(() => {
        manageUpgradeButtons();
      }, CRITICAL_CHECK_DELAY_MS);
      registerRuntimeCleanup(() => {
        debouncedCriticalChecks.cancel();
        debouncedOtherChecks.cancel();
      });

      domObserver = new MutationObserver((mutations) => {
        if (mutations.some(isResearchHomeMutation)) {
          queueSurfaceTagsRefresh();
        }
        checkUrl();
        debouncedCriticalChecks();
        debouncedOtherChecks();
      });

      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (chrome?.runtime?.sendMessage) {
      let welcomeScreenChecked = false;
      const applyLightweightSettingsRefresh = (freshSettings) => {
        settings = freshSettings;
        hasLoadedSettingsSnapshot = true;
        applyRootFlags();
        manageGpt5LimitPopup();
        manageUpgradeButtons();
        manageSidebarButtons();
        quickSettings.manage();
        refreshSurfaceTags();
      };

      if (chrome?.runtime?.onMessage?.addListener) {
        const runtimeMessageHandler = (request, _sender, sendResponse) => {
          if (request?.type === "AETHER_APPLY_TUNING_PATCH") {
            const didApply = applyImmediateTuningPatch(request.patch || {});
            sendResponse?.({ ok: true, applied: didApply });
            return;
          }
          if (request?.type === "AETHER_SHOW_WELCOME") {
            sendResponse?.({ ok: welcomeScreen.show() });
            return;
          }
        };
        chrome.runtime.onMessage.addListener(runtimeMessageHandler);
        registerRuntimeCleanup(() => {
          chrome?.runtime?.onMessage?.removeListener?.(runtimeMessageHandler);
        });
      }

      refreshSettingsAndApply = ({ delayMs = SETTINGS_REFRESH_DELAY_MS, allowRetry = true } = {}) => {
        const requestGeneration = ++settingsRefreshGeneration;
        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(async () => {
          refreshTimeout = null;
          try {
            const snapshot = await loadSettingsSnapshot();
            if (requestGeneration !== settingsRefreshGeneration) return;

            if (!snapshot.needsRuntimeRecovery) {
              settingsRecoveryAttempt = 0;
              clearSettingsRecoveryTimer();
            } else if (snapshot.needsRuntimeRecovery && allowRetry) {
              scheduleSettingsRecovery();
            }

            if (!welcomeScreenChecked) {
              if (!snapshot.settings.hasSeenWelcomeScreen) {
                welcomeScreen.show();
              }
              welcomeScreenChecked = true;
            }

            settings = snapshot.settings;
            hasLoadedSettingsSnapshot = true;
            // Apply all visual changes only after the settings snapshot is hydrated.
            applyAllSettings();
          } catch (error) {
            if (requestGeneration !== settingsRefreshGeneration) return;
            console.error("Aether Extension Error: Could not refresh settings.", error.message);
            if (allowRetry && (error.needsRuntimeRecovery || isTransientRuntimeError(error.message))) {
              scheduleSettingsRecovery();
            }
          }
        }, delayMs);
      };

      (async () => {
        try {
          if (window.AetherI18n?.initialize) {
            await window.AetherI18n.initialize();
          }
        } catch (e) {
          console.warn("Aether: Could not initialize i18n system, using browser default:", e);
        }
      })();

      if (document.readyState === "loading") {
        addManagedEventListener(
          document,
          "DOMContentLoaded",
          () => {
            refreshSettingsAndApply();
            startObservers();
          },
          { once: true }
        );
      } else {
        refreshSettingsAndApply();
        startObservers();
      }

      const storageChangeHandler = (changes, area) => {
        if (area === "sync") {
          const requestGeneration = ++settingsRefreshGeneration;
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
            void loadSettingsSnapshot()
              .then((snapshot) => {
                if (requestGeneration !== settingsRefreshGeneration) return;
                applyLightweightSettingsRefresh(snapshot.settings);
                if (!snapshot.needsRuntimeRecovery) {
                  settingsRecoveryAttempt = 0;
                  clearSettingsRecoveryTimer();
                  return;
                }
                if (snapshot.needsRuntimeRecovery) {
                  scheduleSettingsRecovery();
                }
              })
              .catch((error) => {
                if (requestGeneration !== settingsRefreshGeneration) return;
                console.error(
                  "Aether Extension Error: Could not refresh settings for lightweight update.",
                  error.message
                );
                if (error.needsRuntimeRecovery || isTransientRuntimeError(error.message)) {
                  scheduleSettingsRecovery();
                }
              });
          } else {
            refreshSettingsAndApply();
          }
        }
      };
      chrome.storage.onChanged.addListener(storageChangeHandler);
      registerRuntimeCleanup(() => {
        chrome?.storage?.onChanged?.removeListener?.(storageChangeHandler);
      });
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
