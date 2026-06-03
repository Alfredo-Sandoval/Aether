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
    const DESKTOP_COMPOSER_FIX_MIN_VIEWPORT = 900;
    const COMPACT_COMPOSER_MAX_WIDTH = 480;
    const COMPOSER_SIDE_GUTTER_PX = 32;
    const COMPOSER_DESKTOP_MAX_WIDTH_PX = 1024;
    const SEARCH_PANEL_HINTS = Object.freeze([
      "search chats",
      "search chat",
      "chat history",
      "conversation history",
      "search conversations",
      "buscar chats",
      "historial de chats",
      "historial de chat",
    ]);
    const PROJECT_SHELL_PATH_PATTERN = /\/projects?(?:\/|$)/;

    const TRANSITION_DURATION_MS = 800;
    const STORAGE_FLUSH_DELAY_MS = 300;
    const BLUR_SAVE_DELAY_MS = 120;
    const SETTINGS_REFRESH_DELAY_MS = 50;
    const CRITICAL_CHECK_DELAY_MS = 50;
    const OTHER_CHECK_DELAY_MS = 150;
    const UI_READY_TIMEOUT_MS = 15000;
    const UI_READY_SETTLE_DELAY_MS = 300;
    const QS_CLOSE_STATE_TIMEOUT_MS = 320;
    const SETTINGS_RECOVERY_DELAYS_MS = Object.freeze([200, 500, 1000, 2000]);
    const HOME_COMPOSER_BLUR_DELAYS_MS = Object.freeze([0, 150, 450]);

    let refreshTimeout = null;
    let settingsRetryTimer = null;
    let settingsRecoveryAttempt = 0;
    let refreshSettingsAndApply = () => {};
    let initialDomReadyHandler = null;
    let storageChangeHandler = null;
    let visibilityChangeHandler = null;
    let windowFocusHandler = null;
    let windowResizeHandler = null;
    let popstateHandler = null;
    let quickAddInteractionHandler = null;
    let quickAddPromotionTimers = [];
    let runtimeMessageHandler = null;
    let uiReadyObserver = null;
    let domObserver = null;
    let uiReadyTimeout = null;
    let uiReadySettleTimer = null;
    let observersStarted = false;
    let qsDocumentClickBound = false;
    let qsDocumentClickHandler = null;
    let qsDocumentKeydownBound = false;
    let qsDocumentKeydownHandler = null;
    let applyStylesDomReadyHandler = null;
    let showBgDomReadyHandler = null;
    let qsInitDomReadyHandler = null;
    let qsCloseTimer = null;
    let composerLayoutFrame = null;
    let surfaceTagsFrame = null;
    let homeComposerInteractionHandler = null;
    let homeComposerUserInteracted = false;
    let homeComposerBlurTimers = [];
    let homeComposerBlurScheduledForUrl = "";
    let runtimeCleanupCallbacks = [];

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
      getBackgroundPresetDefaultBlur,
      resolveBackgroundPresetIdFromUrl,
      normalizeUiText,
      matchesPulseTargetValue,
      matchesShoppingResearchValue,
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

    const getBackgroundPresetResolvedBlur = (presetId) => getBackgroundPresetDefaultBlur(presetId, getExtensionUrl);
    const DEFAULT_BG_URL = getBackgroundPresetResolvedUrl(DEFAULT_BACKGROUND_PRESET_ID);
    const GPT5_ANIMATED_KEY = getBackgroundPresetResolvedUrl("__gpt5_animated__");
    const JET_KEY = getBackgroundPresetResolvedUrl("jet");
    const AURORA_KEY = getBackgroundPresetResolvedUrl("aurora");
    const SUNSET_KEY = getBackgroundPresetResolvedUrl("sunset");
    const OCEAN_KEY = getBackgroundPresetResolvedUrl("ocean");

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
          thumb: preset.id === "default" ? DEFAULT_BG_URL : !preset.isSpecial && preset.url ? preset.url : "",
          defaultBlur: preset.defaultBlur,
        })
      )
    );

    // Prefer stable roles and data attributes; ChatGPT utility classes churn across releases.
    const SELECTORS = {
      GPT5_LIMIT_POPUP: 'div[class*="text-token-text-primary"]',
      UPGRADE_PROFILE_BUTTON_TRAILING_ICON:
        ':is([data-testid="accounts-profile-button"], [data-testid="profile-button"]) .__menu-item-trailing-btn',
      SORA_BUTTON_ID: "sora",
      SORA_BUTTON: 'a[href="/sora"], a[href^="/sora"], [data-testid*="sora"]',
      GPTS_BUTTON: 'a[href="/gpts"], a[href^="/gpts"], [data-testid="explore-gpts-button"]',
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

    const normalizeText = normalizeUiText;

    const registerRuntimeCleanup = (callback) => {
      runtimeCleanupCallbacks.push(callback);
    };

    const flushRuntimeCleanupCallbacks = () => {
      const callbacks = runtimeCleanupCallbacks;
      runtimeCleanupCallbacks = [];
      callbacks.forEach((callback) => callback());
    };

    const isElementVisible = (el) => {
      if (!el) return false;
      const computedStyle = window.getComputedStyle(el);
      if (computedStyle.display === "none") return false;
      if (computedStyle.visibility === "hidden" || computedStyle.visibility === "collapse") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const PULSE_ATTRS = ["aria-label", "href", "data-testid", "data-track"];
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
        pulseAttrs: PULSE_ATTRS,
        shoppingAttrs: SHOPPING_ATTRS,
        toggleClassForElements,
        matchesPulseTargetValue,
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

    const GPT5_LIMIT_PHRASES = [
      "you've reached the gpt-5 limit",
      "youve reached the gpt-5 limit",
      "has alcanzado el limite de gpt-5",
    ];

    // Quick-add items expose little stable markup, so promotion relies on normalized visible labels.
    const QUICK_ADD_MENU_HINTS = ["add photos", "add files", "create image", "deep research", "agent mode"];
    const QUICK_ADD_MORE_LABELS = ["more", "mas"];
    const QUICK_ADD_TOP_PRIORITY_HINT_GROUPS = [["deep research", "investigacion profunda"], ["github"]];
    const QUICK_ADD_PROMOTED_HINTS = ["canvas", "deep research", "github", "lienzo", "investigacion profunda"];
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
        withinSidebar: !!el?.closest?.('nav, aside, [data-testid*="sidebar" i], [id*="sidebar" i]'),
        withinProfileMenu: !!el?.closest?.(
          '[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]'
        ),
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
        if (!(el instanceof Element) || seen.has(el) || !isElementVisible(el)) return;
        seen.add(el);
        if (shouldHideUpgradeSurface(buildUpgradeDescriptor(el))) {
          matches.push(el);
        }
      });
      return matches;
    }

    function manageUpgradeButtons() {
      document.querySelectorAll(`.${HIDE_UPGRADE_CLASS}`).forEach((el) => el.classList.remove(HIDE_UPGRADE_CLASS));
      if (!settings.hideUpgradeButtons) return;

      const upgradeTargets = new Set();
      findUpgradeInteractiveElements().forEach((el) => {
        const target = resolveUpgradeHideTarget(el);
        if (target) upgradeTargets.add(target);
      });

      const profileButtonUpgrade = document.querySelector(SELECTORS.UPGRADE_PROFILE_BUTTON_TRAILING_ICON);
      if (profileButtonUpgrade) {
        upgradeTargets.add(profileButtonUpgrade);
      }

      toggleClassForElements(Array.from(upgradeTargets), HIDE_UPGRADE_CLASS, true);
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
        document.querySelector('article[data-testid^="conversation-turn-"]')
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

    function isHomeLandingShell() {
      if (location.pathname !== "/") return false;
      if (document.querySelector('article[data-testid^="conversation-turn-"]')) return false;
      return !!document.querySelector('form[data-type="unified-composer"]');
    }

    function clearHomeComposerBlurTimers() {
      homeComposerBlurTimers.forEach((timer) => clearTimeout(timer));
      homeComposerBlurTimers = [];
    }

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

    const tagVisibleNodes = (nextTaggedNodes, nodes, surface, glass = "raised") => {
      nodes.forEach((node) => {
        if (!isElementVisible(node)) return;
        tagSurfaceNode(nextTaggedNodes, node, surface, glass);
      });
    };

    function buildSurfaceDescriptor(node, overrides = {}) {
      return {
        text: node?.textContent || "",
        ariaLabel: node?.getAttribute?.("aria-label") || "",
        title: node?.getAttribute?.("title") || "",
        dataTestId: node?.getAttribute?.("data-testid") || "",
        href: node?.getAttribute?.("href") || "",
        id: node?.id || "",
        className: typeof node?.className === "string" ? node.className : "",
        role: node?.getAttribute?.("role") || "",
        tagName: node?.tagName || "",
        ...overrides,
      };
    }

    function isNodeNearProfileButton(node) {
      const profileButton = getCachedElement(SELECTORS.PROFILE_BUTTON);
      if (!(profileButton instanceof Element) || !isElementVisible(profileButton)) return false;
      const nodeRect = node.getBoundingClientRect();
      const buttonRect = profileButton.getBoundingClientRect();
      const horizontalGap = Math.min(
        Math.abs(nodeRect.left - buttonRect.left),
        Math.abs(nodeRect.right - buttonRect.right)
      );
      const verticalGap = Math.min(
        Math.abs(nodeRect.top - buttonRect.top),
        Math.abs(nodeRect.bottom - buttonRect.bottom)
      );
      return horizontalGap <= 180 && verticalGap <= 320;
    }

    function isCurrentGroupChatShell() {
      if (document.querySelector('a[aria-current="page"][href*="/gg/"]')) return true;
      return location.pathname.toLowerCase().includes("/gg/");
    }

    function isCurrentProjectShell() {
      return PROJECT_SHELL_PATH_PATTERN.test(location.pathname.toLowerCase());
    }

    function isCurrentSettingsShell() {
      return location.pathname.toLowerCase().includes("/settings");
    }

    function isSearchDialogSurface(node) {
      const inputSignals = [];
      node.querySelectorAll("input, textarea").forEach((input) => {
        if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
        inputSignals.push(input.id || "");
        inputSignals.push(input.getAttribute("type") || "");
        inputSignals.push(input.getAttribute("placeholder") || "");
        inputSignals.push(input.getAttribute("aria-label") || "");
      });
      const normalizedSignals = inputSignals.map((value) => normalizeText(value)).filter(Boolean);
      if (normalizedSignals.some((value) => value.includes("search"))) return true;
      const signalText = normalizeText(
        [
          node.textContent || "",
          node.getAttribute("aria-label") || "",
          node.getAttribute("title") || "",
          node.getAttribute("data-testid") || "",
          ...normalizedSignals,
        ].join(" ")
      );
      return SEARCH_PANEL_HINTS.some((hint) => signalText.includes(hint));
    }

    function classifyDialogSurface(node) {
      if (node.matches?.(ACTIVITY_FLYOUT_SELECTOR)) return "activity-flyout";
      if (isResearchDialogNode(node)) return "research-viewer";
      if (isSearchDialogSurface(node)) return "search-panel";
      const descriptor = buildSurfaceDescriptor(node);
      if (isSettingsSurfaceDescriptor(descriptor)) return "settings-panel";
      if (isProjectSurfaceDescriptor(descriptor)) return "project-modal";
      if (isModelPickerSurfaceDescriptor(descriptor)) return "model-picker";
      return "dialog";
    }

    function classifyMenuSurface(node) {
      const descriptor = buildSurfaceDescriptor(node);
      if (isModelPickerSurfaceDescriptor(descriptor)) return "model-picker";
      if (isProfileMenuSurfaceDescriptor(descriptor) || isNodeNearProfileButton(node)) return "profile-menu";
      if (isSettingsSurfaceDescriptor(descriptor)) return "settings-panel";
      return "menu";
    }

    function classifyListboxSurface(node) {
      return isModelPickerSurfaceDescriptor(buildSurfaceDescriptor(node)) ? "model-picker" : "listbox";
    }

    function tagPrimaryShellSurface(nextTaggedNodes) {
      const mainNode = document.querySelector("main");
      if (!(mainNode instanceof Element) || !isElementVisible(mainNode)) return;
      if (isCurrentSettingsShell()) {
        tagSurfaceNode(nextTaggedNodes, mainNode, "settings-panel");
        return;
      }
      if (isCurrentProjectShell()) {
        tagSurfaceNode(nextTaggedNodes, mainNode, "project-shell");
        return;
      }
      if (isCurrentGroupChatShell()) {
        tagSurfaceNode(nextTaggedNodes, mainNode, "group-chat-shell");
      }
    }

    const tagResearchSurfaceNodes = (nextTaggedNodes) => {
      // Fullscreen deep-research overlays render inside the report card DOM, so
      // the card itself must stop participating in the glass engine once the
      // overlay opens or it becomes the containing block for the fixed viewer.
      tagVisibleNodes(nextTaggedNodes, getClosedResearchViewerNodes(), "research-viewer");
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(RESEARCH_VIEWER_HOST_SELECTOR), "research-viewer");
      tagVisibleNodes(nextTaggedNodes, getResearchOverlayHostNodes(), "research-overlay");
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(RESEARCH_HOME_SELECTOR), "research-home");
      tagVisibleNodes(nextTaggedNodes, getResearchHomeCardNodes(), "research-card");
      tagVisibleNodes(nextTaggedNodes, getResearchAgendaItemNodes(), "research-agenda-item", "interactive");
    };

    const tagDialogNodes = (nextTaggedNodes) => {
      const dialogs = document.querySelectorAll(
        `.popover[role="dialog"], div[role="dialog"], ${ACTIVITY_FLYOUT_SELECTOR}`
      );
      dialogs.forEach((node) => {
        if (!isElementVisible(node)) return;
        const surface = classifyDialogSurface(node);
        tagSurfaceNode(nextTaggedNodes, node, surface, surface === "search-panel" ? "interactive" : "raised");
      });
    };

    const tagMenuNodes = (nextTaggedNodes) => {
      document.querySelectorAll('.popover[data-radix-menu-content], [role="menu"]').forEach((node) => {
        if (!isElementVisible(node)) return;
        tagSurfaceNode(nextTaggedNodes, node, classifyMenuSurface(node), "interactive");
      });
    };

    const tagListboxNodes = (nextTaggedNodes) => {
      document.querySelectorAll('[role="listbox"]').forEach((node) => {
        if (!isElementVisible(node)) return;
        tagSurfaceNode(nextTaggedNodes, node, classifyListboxSurface(node), "interactive");
      });
    };

    function markSemanticSurfaces() {
      const nextTaggedNodes = new Set();
      tagPrimaryShellSurface(nextTaggedNodes);
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(ACTIVITY_FLYOUT_SELECTOR), "activity-flyout");
      tagResearchSurfaceNodes(nextTaggedNodes);
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(`.${CANVAS_SURFACE_CLASS}`), "canvas-surface");
      tagVisibleNodes(
        nextTaggedNodes,
        document.querySelectorAll(
          '[role="tooltip"], .bg-black[data-state*="open"], [class*="tooltipContent"], [class*="tooltipOpen"]'
        ),
        "tooltip"
      );
      tagDialogNodes(nextTaggedNodes);
      tagMenuNodes(nextTaggedNodes);
      tagListboxNodes(nextTaggedNodes);
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

    function clearQuickSettingsCloseTimer() {
      if (!qsCloseTimer) return;
      clearTimeout(qsCloseTimer);
      qsCloseTimer = null;
    }

    function refreshSurfaceTags() {
      markCanvasSurfaces();
      markResearchReportCards();
      markSemanticSurfaces();
    }

    function queueSurfaceTagsRefresh() {
      if (surfaceTagsFrame !== null) return;
      surfaceTagsFrame = requestAnimationFrame(() => {
        surfaceTagsFrame = null;
        refreshSurfaceTags();
      });
    }

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
        void requestSettingsUpdate({ customBgUrl: sanitizedUrl }).catch((error) => {
          if (!isTransientRuntimeError(error?.message)) {
            console.error("Aether Extension Error (Normalize Background URL):", error.message);
          }
        });
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

    const syncBackgroundNodeVisibility = (bgNode, visible) => {
      if (!bgNode) return;
      bgNode.classList.toggle("bg-visible", visible);
      bgNode.style.opacity = visible ? "1" : "0";
    };

    const syncBackgroundLayerVisibility = (layer, active) => {
      if (!layer) return;
      layer.classList.toggle("active", active);
      layer.style.opacity = active ? "1" : "0";
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

      inactiveLayer.classList.remove("gpt5-active");
      inactiveLayer.classList.remove("jet-active");
      inactiveLayer.classList.remove("aurora-active");
      inactiveLayer.classList.remove("sunset-active");
      inactiveLayer.classList.remove("ocean-active");
      const inactiveImg = inactiveLayer.querySelector("img");
      const inactiveSource = inactiveLayer.querySelector("source");
      const inactiveVideo = inactiveLayer.querySelector("video");

      const transitionToInactive = () => {
        syncBackgroundLayerVisibility(inactiveLayer, true);
        syncBackgroundLayerVisibility(activeLayer, false);
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
        const isVideo = videoExtensions.some((ext) => mediaUrl.toLowerCase().includes(ext));
        inactiveImg.style.display = isVideo ? "none" : "block";
        inactiveVideo.style.display = isVideo ? "block" : "none";

        const mediaEl = isVideo ? inactiveVideo : inactiveImg;
        const eventType = isVideo ? "loadeddata" : "load";

        const onMediaReady = () => {
          transitionToInactive();
          mediaEl.removeEventListener(eventType, onMediaReady);
          mediaEl.removeEventListener("error", onMediaError);
        };
        const onMediaError = () => {
          mediaEl.removeEventListener(eventType, onMediaReady);
          mediaEl.removeEventListener("error", onMediaError);
          applyDefault();
        };

        mediaEl.addEventListener(eventType, onMediaReady, { once: true });
        mediaEl.addEventListener("error", onMediaError, { once: true });

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
      const root = document.documentElement;
      if (!root) return;
      const clampedBlur = getClampedBlurValue(settings.backgroundBlur);
      const clampedContentWidth = getClampedContentWidthValue(settings.contentWidth);
      root.style.setProperty("--cgpt-thread-content-width", `${clampedContentWidth}%`);
      root.style.setProperty("--cgpt-bg-blur-radius", `${clampedBlur}px`);
      root.style.setProperty("--cgpt-bg-object-fit", sanitizeBackgroundScaling(settings.backgroundScaling));
    }

    let qsInitScheduled = false;

    // Batch rapid slider changes so the background worker remains the only sync-storage writer.
    let storageWriteQueue = {};
    let storageWriteTimer = null;
    const flushStorageQueue = () => {
      storageWriteTimer = null;
      if (Object.keys(storageWriteQueue).length === 0) return;
      const batch = storageWriteQueue;
      storageWriteQueue = {};
      if (chrome?.runtime?.sendMessage) {
        void requestSettingsUpdate(batch).catch((error) => {
          const errMsg = error?.message || String(error);
          if (isTransientRuntimeError(errMsg)) {
            Object.assign(storageWriteQueue, batch);
            storageWriteTimer = setTimeout(flushStorageQueue, 1000);
            return;
          }
          console.error("Aether: Storage write failed:", errMsg);
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

    function bindQuickSettingsRangeControl({
      slider,
      valueLabel,
      min,
      max,
      currentValue,
      normalizeValue,
      storageKey,
      applyValue,
      formatValueText,
    }) {
      const formatSpokenValue = formatValueText || ((value) => String(value));
      const syncRangeReadout = (value) => {
        const valueText = String(value);
        valueLabel.textContent = valueText;
        slider.setAttribute("aria-valuetext", formatSpokenValue(valueText));
        return valueText;
      };
      const normalizedCurrentValue = normalizeValue(currentValue);
      slider.min = String(min);
      slider.max = String(max);
      slider.value = String(normalizedCurrentValue);
      syncRangeReadout(normalizedCurrentValue);

      let applyFrame = null;
      let pendingApplyValue = null;
      let saveTimer = null;
      let pendingSaveValue = null;

      const normalizeControlValue = () => {
        const normalizedValue = normalizeValue(slider.value);
        const valueText = String(normalizedValue);
        if (slider.value !== valueText) {
          slider.value = valueText;
        }
        return syncRangeReadout(valueText);
      };

      const scheduleApply = (value) => {
        pendingApplyValue = value;
        if (applyFrame !== null) return;
        applyFrame = requestAnimationFrame(() => {
          applyFrame = null;
          if (pendingApplyValue !== null) {
            applyValue(pendingApplyValue);
          }
        });
      };

      const flushSave = () => {
        if (pendingSaveValue === null) return;
        const valueToSave = pendingSaveValue;
        pendingSaveValue = null;
        queueStorageWrite(storageKey, valueToSave);
      };

      const scheduleSave = (value) => {
        pendingSaveValue = value;
        if (saveTimer) return;
        saveTimer = setTimeout(() => {
          saveTimer = null;
          flushSave();
        }, BLUR_SAVE_DELAY_MS);
      };

      slider.addEventListener("input", () => {
        const value = normalizeControlValue();
        scheduleApply(value);
        scheduleSave(value);
      });

      slider.addEventListener("change", () => {
        const value = normalizeControlValue();
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        pendingSaveValue = value;
        flushSave();
      });

      registerRuntimeCleanup(() => {
        if (applyFrame !== null) {
          cancelAnimationFrame(applyFrame);
          applyFrame = null;
        }
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        pendingApplyValue = null;
        pendingSaveValue = null;
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

      const syncPanelInlineState = (activePanel, state) => {
        if (!activePanel) return;
        if (state === "open") {
          activePanel.style.animation = "none";
          activePanel.style.opacity = "1";
          activePanel.style.transform = "scale(1)";
          activePanel.style.visibility = "visible";
          activePanel.style.pointerEvents = "auto";
          return;
        }

        if (state === "closed") {
          activePanel.style.animation = "none";
          activePanel.style.opacity = "0";
          activePanel.style.transform = "scale(0.95)";
          activePanel.style.visibility = "hidden";
          activePanel.style.pointerEvents = "none";
          return;
        }

        activePanel.style.removeProperty("animation");
        activePanel.style.removeProperty("opacity");
        activePanel.style.removeProperty("transform");
        activePanel.style.removeProperty("visibility");
        activePanel.style.removeProperty("pointer-events");
      };

      const setPanelState = (nextState) => {
        const activePanel = document.getElementById(QS_PANEL_ID);
        if (!activePanel) return null;

        const resolvedState = ["open", "closing", "closed"].includes(nextState) ? nextState : "closed";
        const isOpen = resolvedState === "open";
        activePanel.setAttribute("data-state", resolvedState);
        activePanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
        syncPanelInlineState(activePanel, resolvedState);

        const activeButton = document.getElementById(QS_BUTTON_ID);
        if (activeButton) {
          activeButton.setAttribute("aria-expanded", String(isOpen));
        }
        return activePanel;
      };

      const finalizeClosingState = () => {
        clearQuickSettingsCloseTimer();
        const activePanel = document.getElementById(QS_PANEL_ID);
        if (activePanel?.getAttribute("data-state") === "closing") {
          setPanelState("closed");
        }
      };

      const scheduleClosingStateFinalize = () => {
        clearQuickSettingsCloseTimer();
        qsCloseTimer = setTimeout(finalizeClosingState, QS_CLOSE_STATE_TIMEOUT_MS);
      };

      const openPanel = () => {
        clearQuickSettingsCloseTimer();
        const activePanel = setPanelState("open");
        if (activePanel) {
          if (typeof activePanel.focus === "function") {
            activePanel.focus({ preventScroll: true });
          }
          requestAnimationFrame(syncBackgroundTiles);
        }
      };

      const closePanel = (restoreFocus = false) => {
        const activePanel = setPanelState("closing");
        if (activePanel) {
          scheduleClosingStateFinalize();
          const activeButton = document.getElementById(QS_BUTTON_ID);
          if (activeButton) {
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

        if (!["open", "closing", "closed"].includes(panel.getAttribute("data-state"))) {
          panel.setAttribute("data-state", "closed");
        }
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "false");
        panel.setAttribute("aria-label", getMessage("quickSettingsButtonTitle"));
        panel.setAttribute("aria-hidden", panel.getAttribute("data-state") === "open" ? "false" : "true");
        panel.setAttribute("tabindex", "-1");

        if (panel.getAttribute("data-state") === "closing") {
          scheduleClosingStateFinalize();
        } else {
          clearQuickSettingsCloseTimer();
        }

        if (!panel.dataset.qsAnimBound) {
          panel.addEventListener("animationend", (e) => {
            const target = e.currentTarget;
            if (e.animationName === "qs-panel-close" && target.getAttribute("data-state") === "closing") {
              finalizeClosingState();
            }
          });
          panel.dataset.qsAnimBound = "true";
        }
      };

      const syncBackgroundTiles = () => {
        if (!panel) return;
        const normalizedUrl = sanitizeBackgroundUrl(settings.customBgUrl || "");
        const activePresetId = resolveBackgroundPresetId(normalizedUrl);
        let activeTile = null;
        let hasTabbableTile = false;
        panel.querySelectorAll(".qs-bg-tile").forEach((tile) => {
          const isActive = tile.dataset.bgKey === activePresetId;
          tile.classList.toggle("active", isActive);
          tile.setAttribute("aria-checked", String(isActive));
          tile.tabIndex = isActive ? 0 : -1;
          if (isActive) {
            activeTile = tile;
            hasTabbableTile = true;
          }
        });
        if (!hasTabbableTile) {
          const firstTile = panel.querySelector(".qs-bg-tile");
          if (firstTile) firstTile.tabIndex = 0;
        }
        if (activeTile && panel.getAttribute("data-state") === "open") {
          const grid = activeTile.closest(".qs-bg-grid");
          if (grid) {
            const centeredLeft = activeTile.offsetLeft - (grid.clientWidth - activeTile.clientWidth) / 2;
            grid.scrollTo({ left: centeredLeft, behavior: "auto" });
          }
        }
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
        blurSlider.setAttribute("aria-valuetext", `${currentBlur} px`);
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
        widthSlider.setAttribute("aria-valuetext", `${currentWidth}%`);
      };

      if (!btn) {
        btn = document.createElement("button");
        btn.id = QS_BUTTON_ID;
        btn.title = getMessage("quickSettingsButtonTitle");
        btn.setAttribute("aria-label", getMessage("quickSettingsButtonTitle"));
        btn.setAttribute("aria-haspopup", "dialog");
        btn.setAttribute("aria-controls", QS_PANEL_ID);
        btn.setAttribute("aria-expanded", "false");
        btn.innerHTML = `<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5A3.5 3.5 0 0 1 15.5 12A3.5 3.5 0 0 1 12 15.5M19.43 12.98C19.47 12.65 19.5 12.33 19.5 12S19.47 11.35 19.43 11L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.96 19.05 5.05L16.56 6.05C16.04 5.66 15.5 5.32 14.87 5.07L14.5 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.5 2.42L9.13 5.07C8.5 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11C4.53 11.35 4.5 11.67 4.5 12S4.53 12.65 4.57 12.98L2.46 14.63C2.27 14.78 2.21 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.04 4.95 18.95L7.44 17.94C7.96 18.34 8.5 18.68 9.13 18.93L9.5 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.5 21.58L14.87 18.93C15.5 18.68 16.04 18.34 16.56 17.94L19.05 18.95C19.27 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98Z"></path></svg>`;
        document.body.appendChild(btn);

        ensurePanel();

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const activePanel = document.getElementById(QS_PANEL_ID);
          if (!activePanel) return;
          const state = activePanel.getAttribute("data-state");
          if (state === "open") {
            closePanel(true);
          } else {
            openPanel();
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
        syncBackgroundTiles();
        syncBlurControls();
        syncContentWidthControls();
        return;
      }
      panel.setAttribute("data-initialized", "true");

      panel.innerHTML = `
      <div class="qs-section-title">${t("sectionAppearance")}</div>
      <div class="qs-row qs-blur-row" data-setting="blur">
          <label id="qs-blur-label" for="qs-blur-slider">${t("labelBlur")}</label>
          <div class="qs-range-control">
            <input type="range" id="qs-blur-slider" min="${MIN_BG_BLUR}" max="${MAX_BG_BLUR}" step="1" aria-labelledby="qs-blur-label" aria-valuetext="60 px" />
            <span id="qs-blur-value">60</span><span class="qs-blur-unit">px</span>
          </div>
      </div>
      <div class="qs-row qs-content-width-row" data-setting="contentWidth">
          <label id="qs-content-width-label" for="qs-content-width-slider">${t("quickSettingsLabelContentWidth")}</label>
          <div class="qs-range-control">
            <input
              type="range"
              id="qs-content-width-slider"
              min="${MIN_CONTENT_WIDTH}"
              max="${MAX_CONTENT_WIDTH}"
              step="1"
              aria-labelledby="qs-content-width-label"
              aria-valuetext="95%"
            />
            <span id="qs-content-width-value">95</span><span class="qs-blur-unit">%</span>
          </div>
      </div>
      <div class="qs-section-title" id="qs-bg-label">${t("quickSettingsLabelBackground")}</div>
      <div class="qs-row qs-bg-row" data-setting="background">
          <div class="qs-bg-grid" id="qs-bg-grid" role="radiogroup" aria-labelledby="qs-bg-label"></div>
      </div>
      <div class="qs-section-title">${t("quickSettingsSectionVisibility")}</div>
      <label class="qs-row qs-toggle-row" data-setting="hideUpgradeButtons">
          <span class="qs-row-label">${t("quickSettingsLabelHideUpgradeButtons")}</span>
          <span class="switch"><input type="checkbox" id="qs-hideUpgradeButtons"><span class="track"><span class="thumb"></span></span></span>
      </label>
      <label class="qs-row qs-toggle-row" data-setting="hideGptsButton">
          <span class="qs-row-label">${t("quickSettingsLabelHideGptsButton")}</span>
          <span class="switch"><input type="checkbox" id="qs-hideGptsButton"><span class="track"><span class="thumb"></span></span></span>
      </label>
      <label class="qs-row qs-toggle-row" data-setting="hideTodaysPulse">
          <span class="qs-row-label">${t("quickSettingsLabelHideTodaysPulse")}</span>
          <span class="switch"><input type="checkbox" id="qs-hideTodaysPulse"><span class="track"><span class="thumb"></span></span></span>
      </label>
      <label class="qs-row qs-toggle-row" data-setting="hideShoppingButton">
          <span class="qs-row-label">${t("quickSettingsLabelHideShoppingButton")}</span>
          <span class="switch"><input type="checkbox" id="qs-hideShoppingButton"><span class="track"><span class="thumb"></span></span></span>
      </label>
      <label class="qs-row qs-toggle-row" data-setting="blurChatHistory">
          <span class="qs-row-label">${t("quickSettingsLabelStreamerMode")}</span>
          <span class="switch"><input type="checkbox" id="qs-blurChatHistory"><span class="track"><span class="thumb"></span></span></span>
      </label>
      <div class="qs-footer">
          <button type="button" id="qs-open-settings" class="qs-open-settings">${t("quickSettingsOpenFullSettings")}</button>
      </div>
    `;

      setupQuickSettingsToggles(settings);

      const openSettingsBtn = document.getElementById("qs-open-settings");
      if (openSettingsBtn) {
        openSettingsBtn.addEventListener("click", () => {
          void sendRuntimeMessage({ type: "OPEN_POPUP" }).catch(() => {});
        });
      }

      const bgGrid = document.getElementById("qs-bg-grid");
      if (bgGrid) {
        const activeBgPresetId = resolveBackgroundPresetId(sanitizeBackgroundUrl(settings.customBgUrl || ""));

        bgGrid.innerHTML = QUICK_SETTINGS_BG_PRESETS.map((preset) => {
          const isActive = activeBgPresetId === preset.key;
          const classes = ["qs-bg-tile", isActive ? "active" : "", preset.animated ? "is-animated" : ""]
            .filter(Boolean)
            .join(" ");
          const thumbStyle = preset.thumb ? ` style="--qs-bg-thumb: url('${escapeHtml(preset.thumb)}');"` : "";
          const label = getMessage(preset.labelKey) || preset.key;
          return `
        <button type="button" class="${classes}" role="radio" aria-checked="${String(isActive)}" tabindex="${isActive ? "0" : "-1"}" title="${escapeHtml(label)}" data-bg-key="${preset.key}" data-bg-url="${escapeHtml(preset.url)}" data-bg-blur="${escapeHtml(preset.defaultBlur)}"${thumbStyle}>
          <span class="qs-bg-label">${escapeHtml(label)}</span>
        </button>
      `;
        }).join("");

        const applyQuickSettingsBackgroundTile = (tile) => {
          const nextUrl = sanitizeBackgroundUrl(tile.dataset.bgUrl || "");
          const nextBlur = String(
            getClampedBlurValue(tile.dataset.bgBlur || getBackgroundPresetResolvedBlur(tile.dataset.bgKey))
          );
          if (nextUrl !== settings.customBgUrl) {
            settings.customBgUrl = nextUrl;
            updateBackgroundImage(nextUrl);
          }
          if (nextBlur !== settings.backgroundBlur) {
            settings.backgroundBlur = nextBlur;
            applyCustomStyles();
            syncBlurControls();
          }
          queueStorageWrite("customBgUrl", nextUrl);
          queueStorageWrite("backgroundBlur", nextBlur);
          syncBackgroundTiles();
        };

        bgGrid.querySelectorAll(".qs-bg-tile").forEach((tile) => {
          tile.addEventListener("click", () => {
            applyQuickSettingsBackgroundTile(tile);
          });
        });
        bgGrid.addEventListener("keydown", (event) => {
          const navKeys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
          if (!navKeys.includes(event.key)) return;
          const tiles = Array.from(bgGrid.querySelectorAll(".qs-bg-tile"));
          if (!tiles.length) return;
          event.preventDefault();
          const focusedIndex = tiles.findIndex((tile) => tile === document.activeElement);
          const activeIndex = tiles.findIndex((tile) => tile.getAttribute("aria-checked") === "true");
          const currentIndex = focusedIndex >= 0 ? focusedIndex : Math.max(0, activeIndex);
          const nextIndex =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tiles.length - 1
                : (currentIndex + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + tiles.length) %
                  tiles.length;
          const nextTile = tiles[nextIndex];
          nextTile.focus();
          applyQuickSettingsBackgroundTile(nextTile);
        });
        syncBackgroundTiles();
      }

      const blurSlider = document.getElementById("qs-blur-slider");
      const blurValue = document.getElementById("qs-blur-value");
      if (blurSlider && blurValue) {
        bindQuickSettingsRangeControl({
          slider: blurSlider,
          valueLabel: blurValue,
          min: MIN_BG_BLUR,
          max: MAX_BG_BLUR,
          currentValue: settings.backgroundBlur,
          normalizeValue: getClampedBlurValue,
          storageKey: "backgroundBlur",
          formatValueText: (value) => `${value} px`,
          applyValue: (value) => {
            if (value === settings.backgroundBlur) return;
            settings.backgroundBlur = value;
            applyCustomStyles();
          },
        });
      }

      const contentWidthSlider = document.getElementById("qs-content-width-slider");
      const contentWidthValue = document.getElementById("qs-content-width-value");
      if (contentWidthSlider && contentWidthValue) {
        bindQuickSettingsRangeControl({
          slider: contentWidthSlider,
          valueLabel: contentWidthValue,
          min: MIN_CONTENT_WIDTH,
          max: MAX_CONTENT_WIDTH,
          currentValue: settings.contentWidth,
          normalizeValue: getClampedContentWidthValue,
          storageKey: "contentWidth",
          formatValueText: (value) => `${value}%`,
          applyValue: (value) => {
            if (value === settings.contentWidth) return;
            settings.contentWidth = value;
            applyCustomStyles();
          },
        });
      }
    }

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
      let node = getCachedElementById(ID);
      if (!node) {
        node = makeBgNode();
        const add = () => {
          document.body.prepend(node);
          ensureAppOnTop();
          applyCustomStyles();
          updateBackgroundImage();
          setTimeout(() => syncBackgroundNodeVisibility(node, true), SETTINGS_REFRESH_DELAY_MS);
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
        syncBackgroundNodeVisibility(node, true);
        updateBackgroundImage();
      }
    }

    function applyAllSettings() {
      if (!hasLoadedSettingsSnapshot) return;
      showBg();
      manageQuickSettingsUI();
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
        const blurSlider = document.getElementById("qs-blur-slider");
        const blurValue = document.getElementById("qs-blur-value");
        if (blurSlider && blurValue) {
          blurSlider.value = nextBlur;
          blurValue.textContent = nextBlur;
          blurSlider.setAttribute("aria-valuetext", `${nextBlur} px`);
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
          contentWidthSlider.setAttribute("aria-valuetext", `${nextContentWidth}%`);
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
      flushRuntimeCleanupCallbacks();
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
      clearSettingsRecoveryTimer();
      if (storageWriteTimer) {
        clearTimeout(storageWriteTimer);
        storageWriteTimer = null;
      }
      clearQuickSettingsCloseTimer();
      if (uiReadyTimeout) {
        clearTimeout(uiReadyTimeout);
        uiReadyTimeout = null;
      }
      if (uiReadySettleTimer) {
        clearTimeout(uiReadySettleTimer);
        uiReadySettleTimer = null;
      }
      if (composerLayoutFrame) {
        cancelAnimationFrame(composerLayoutFrame);
        composerLayoutFrame = null;
      }
      if (surfaceTagsFrame !== null) {
        cancelAnimationFrame(surfaceTagsFrame);
        surfaceTagsFrame = null;
      }
      clearHomeComposerBlurTimers();
      if (uiReadyObserver) {
        uiReadyObserver.disconnect();
        uiReadyObserver = null;
      }
      if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
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
      if (homeComposerInteractionHandler) {
        document.removeEventListener("pointerdown", homeComposerInteractionHandler, true);
        document.removeEventListener("keydown", homeComposerInteractionHandler, true);
        homeComposerInteractionHandler = null;
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
      lastAppliedRootState = null;
      hasLoadedSettingsSnapshot = false;
      if (backgroundTransitionTimer) {
        clearTimeout(backgroundTransitionTimer);
        backgroundTransitionTimer = null;
      }
      backgroundTransitionQueue.length = 0;
      currentBackgroundUrl = null;
      activeLayerId = "a";
      isTransitioning = false;
      observersStarted = false;
      homeComposerUserInteracted = false;
      homeComposerBlurScheduledForUrl = "";
    };

    function startObservers() {
      if (observersStarted) return;
      observersStarted = true;
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
      visibilityChangeHandler = () => {
        const bgNode = getCachedElementById(ID);
        document.documentElement.classList.toggle("cgpt-tab-hidden", document.hidden);
        if (!document.hidden) {
          checkUrl();
        }
        if (!bgNode) return;

        const videos = bgNode.querySelectorAll("video");
        videos.forEach((video) => {
          if (document.hidden) {
            video.pause();
          } else if (video.style.display !== "none") {
            video.play().catch((_e) => {
              console.debug("Aether: Background video autoplay was blocked.");
            });
          }
        });
      };
      document.addEventListener("visibilitychange", visibilityChangeHandler, { passive: true });

      homeComposerInteractionHandler = () => {
        homeComposerUserInteracted = true;
        clearHomeComposerBlurTimers();
      };
      document.addEventListener("pointerdown", homeComposerInteractionHandler, true);
      document.addEventListener("keydown", homeComposerInteractionHandler, true);

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

      windowFocusHandler = () => {
        if (!checkUrl()) {
          applyAllSettings();
        }
      };
      window.addEventListener("focus", windowFocusHandler, { passive: true });
      windowResizeHandler = queueComposerLayoutSync;
      window.addEventListener("resize", windowResizeHandler, { passive: true });
      popstateHandler = () => {
        checkUrl();
      };
      window.addEventListener("popstate", popstateHandler, { passive: true });

      quickAddInteractionHandler = (event) => {
        if (!shouldTriggerQuickAddPromotionFromEventTarget(event.target)) return;
        queueQuickAddPromotion();
      };
      document.addEventListener("click", quickAddInteractionHandler, true);

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

    const getWelcomeScreenHTML = () => `
    <div id="aurora-welcome-notification">
        <section class="welcome-card" role="dialog" aria-modal="true" aria-label="${t("extensionName")}" aria-describedby="welcome-description">
            <button id="welcome-close-btn" class="welcome-close" type="button" aria-label="${t("buttonClose")}"><span aria-hidden="true">×</span></button>
            <div class="welcome-topline">
                <span class="welcome-eyebrow">${t("extensionName")}</span>
                <span class="welcome-divider" aria-hidden="true"></span>
                <span class="welcome-kicker">${t("welcomeKicker")}</span>
            </div>
            <p id="welcome-description" class="welcome-text">${t("welcomeDescription")}</p>
            <div class="welcome-actions">
                <button id="welcome-settings-btn" class="welcome-btn" type="button">
                    <span>${t("welcomeBtnOpenSettings")}</span>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4 8h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                        <path d="M8.75 4.25 12.5 8l-3.75 3.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>
                <p class="welcome-note">${t("welcomeNote")}</p>
            </div>
        </section>
    </div>
  `;

    function showWelcomeScreen() {
      const welcomeNode = document.createElement("div");
      welcomeNode.innerHTML = getWelcomeScreenHTML();
      if (welcomeNode.firstElementChild) {
        document.body.appendChild(welcomeNode.firstElementChild);
      }

      const notification = document.getElementById("aurora-welcome-notification");
      const card = notification?.querySelector(".welcome-card");
      const closeBtn = document.getElementById("welcome-close-btn");
      const settingsBtn = document.getElementById("welcome-settings-btn");
      const previouslyFocused = document.activeElement;

      let releaseWelcomeKeydown = () => {};

      const dismissWelcome = () => {
        releaseWelcomeKeydown();
        // Return focus to wherever the user was before the modal stole it.
        if (previouslyFocused && typeof previouslyFocused.focus === "function") {
          previouslyFocused.focus({ preventScroll: true });
        }
        void requestSettingsUpdate({ hasSeenWelcomeScreen: true })
          .then(() => {
            if (notification) {
              notification.classList.add("dismissed");
              setTimeout(() => notification.remove(), 300);
            }
          })
          .catch((error) => {
            console.error("Aether Extension Error (Welcome Dismiss):", error.message);
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

      // Move focus into the modal and trap Tab within it until dismissed.
      if (card) {
        const getFocusable = () =>
          Array.from(card.querySelectorAll("button, [href], input, [tabindex]:not([tabindex='-1'])")).filter(
            (el) => !el.hasAttribute("disabled")
          );
        (settingsBtn || closeBtn || card).focus?.({ preventScroll: true });
        const onKeydown = (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dismissWelcome();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = getFocusable();
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener("keydown", onKeydown, true);
        releaseWelcomeKeydown = () => document.removeEventListener("keydown", onKeydown, true);
      }
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
        manageQuickSettingsUI();
        refreshSurfaceTags();
      };

      if (!runtimeMessageHandler && chrome?.runtime?.onMessage?.addListener) {
        runtimeMessageHandler = (request, _sender, sendResponse) => {
          if (request?.type === "AETHER_APPLY_TUNING_PATCH") {
            const didApply = applyImmediateTuningPatch(request.patch || {});
            sendResponse?.({ ok: true, applied: didApply });
            return;
          }
        };
        chrome.runtime.onMessage.addListener(runtimeMessageHandler);
      }

      refreshSettingsAndApply = ({ delayMs = SETTINGS_REFRESH_DELAY_MS, allowRetry = true } = {}) => {
        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(async () => {
          refreshTimeout = null;
          try {
            const snapshot = await loadSettingsSnapshot();

            if (!snapshot.needsRuntimeRecovery) {
              settingsRecoveryAttempt = 0;
              clearSettingsRecoveryTimer();
            } else if (snapshot.needsRuntimeRecovery && allowRetry) {
              scheduleSettingsRecovery();
            }

            if (!welcomeScreenChecked) {
              if (!snapshot.settings.hasSeenWelcomeScreen) {
                showWelcomeScreen();
              }
              welcomeScreenChecked = true;
            }

            settings = snapshot.settings;
            hasLoadedSettingsSnapshot = true;
            // Apply all visual changes only after the settings snapshot is hydrated.
            applyAllSettings();
          } catch (error) {
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
            const detectedLocale = window.AetherI18n.getDetectedLocale();
            console.log(`Aether: Language system initialized with locale: ${detectedLocale}`);
          }
        } catch (e) {
          console.warn("Aether: Could not initialize i18n system, using browser default:", e);
        }
      })();

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
            void loadSettingsSnapshot()
              .then((snapshot) => {
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
