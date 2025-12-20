// content.js — Ambient Blur + scoped transparency + robust hide/show
(() => {
  const ID = "cgpt-ambient-bg";
  const STYLE_ID = "cgpt-ambient-styles";
  const QS_BUTTON_ID = "cgpt-qs-btn";
  const QS_PANEL_ID = "cgpt-qs-panel";
  const HTML_CLASS = "cgpt-ambient-on";
  const LIGHT_CLASS = "cgpt-light-mode";
  const ANIMATIONS_DISABLED_CLASS = "cgpt-animations-disabled";
  const BG_ANIM_DISABLED_CLASS = "cgpt-bg-anim-disabled";
  const CLEAR_APPEARANCE_CLASS = "cgpt-appearance-clear";
  let settings = {};
  let lastDetectedTheme = null;

  const LOCAL_BG_KEY = "customBgData";
  const JET_KEY = "__jet__";
  const AURORA_KEY = "__aurora__";
  const SUNSET_KEY = "__sunset__";
  const OCEAN_KEY = "__ocean__";
  const HIDE_LIMIT_CLASS = "cgpt-hide-gpt5-limit";
  const HIDE_UPGRADE_CLASS = "cgpt-hide-upgrade";
  const HIDE_SORA_CLASS = "cgpt-hide-sora";
  const HIDE_GPTS_CLASS = "cgpt-hide-gpts";
  const HIDE_SHOPPING_CLASS = "cgpt-hide-shopping";
  const HIDE_TODAYS_PULSE_CLASS = "cgpt-hide-todays-pulse";
  const TIMESTAMP_KEY = "gpt5LimitHitTimestamp";
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const MIN_BG_BLUR = 12;

  const getExtensionUrl = (path) => (chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "");

  const DEFAULT_BG_URL = getExtensionUrl("Aether/blue-galaxy.webp");
  const GROK_HORIZON_URL = getExtensionUrl("Aether/grok-4.webp");
  const AURORA_CLASSIC_URL = getExtensionUrl("Aether/aurora-classic.webp");

  // Space Background URLs
  const SPACE_BLUE_GALAXY_URL = getExtensionUrl("Aether/blue-galaxy.webp");
  const SPACE_COSMIC_PURPLE_URL = getExtensionUrl("Aether/cosmic-purple.webp");
  const SPACE_MILKY_WAY_URL = getExtensionUrl("Aether/milky-way-galaxy.webp");

  // Group DOM selectors for easier maintenance. Fragile selectors are noted.
  const SELECTORS = {
    GPT5_LIMIT_POPUP: 'div[class*="text-token-text-primary"]',
    UPGRADE_MENU_ITEM: "a.__menu-item", // In user profile menu
    UPGRADE_TOP_BUTTON_CONTAINER: ".start-1\\/2.absolute", // Fragile: top-center button on free plan
    UPGRADE_PROFILE_BUTTON_TRAILING_ICON: '[data-testid="accounts-profile-button"] .__menu-item-trailing-btn', // Good selector
    UPGRADE_SIDEBAR_BUTTON: "div.gap-1\\.5.__menu-item.group", // Fragile: sidebar button
    UPGRADE_TINY_SIDEBAR_ICON: "#stage-sidebar-tiny-bar > div:nth-of-type(4)", // Fragile: depends on element order
    UPGRADE_SETTINGS_ROW_CONTAINER: "div.py-2.border-b", // Container for settings row
    UPGRADE_BOTTOM_BANNER: 'div[role="button"]', // Bottom "Upgrade your plan" banner
    SORA_BUTTON_ID: "sora", // Use with getElementById
    GPTS_BUTTON: 'a[href="/gpts"]',
    SHOPPING_BUTTON: 'div[role="menuitemradio"].group.__menu-item', // Shopping research button - more specific selector
    TODAYS_PULSE_CONTAINER: "a", // Container for Today's pulse - will need text matching
    PROFILE_BUTTON: '[data-testid="accounts-profile-button"]',
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

  const EXTENSION_BASE_URL = getExtensionUrl("");
  const isAllowedBackgroundUrl = (url) => {
    if (!url) return true;
    if (
      url === "__gpt5_animated__" ||
      url === "__local__" ||
      url === JET_KEY ||
      url === AURORA_KEY ||
      url === SUNSET_KEY ||
      url === OCEAN_KEY
    )
      return true;
    if (url.startsWith("data:image/") || url.startsWith("data:video/")) return true;
    if (EXTENSION_BASE_URL && url.startsWith(EXTENSION_BASE_URL)) return true;
    return false;
  };
  const sanitizeBackgroundUrl = (url) => (isAllowedBackgroundUrl(url) ? url : "");

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

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

  const PULSE_PHRASES = ["today's pulse", "todays pulse", "pulso de hoy"];
  const SHOPPING_ATTRS = ["aria-label", "data-aria-label", "data-testid", "data-track"];
  const SHOPPING_TOKENS = ["shopping", "research"];

  const matchesPulseText = (value) => {
    const text = normalizeText(value);
    if (!text) return false;
    return PULSE_PHRASES.some((phrase) => text.includes(phrase));
  };

  const matchesShoppingText = (value) => {
    const text = normalizeText(value);
    if (!text) return false;
    return SHOPPING_TOKENS.every((token) => text.includes(token));
  };

  // Quick add menu labels (fragile: text-based matching on ChatGPT UI)
  const QUICK_ADD_MENU_HINTS = ["add photos", "add files", "create image", "deep research", "agent mode"];
  const QUICK_ADD_MORE_LABELS = ["more", "mas"];
  const QUICK_ADD_SUBMENU_HINTS = [
    "study and learn",
    "web search",
    "canvas",
    "hugging face",
    "quizzes",
    "google drive",
    "notion",
    "explore apps",
  ];
  const QUICK_ADD_PROMOTIONS = [
    {
      key: "addSources",
      labels: ["add sources", "add source", "agregar fuentes", "anadir fuentes"],
    },
    { key: "github", labels: ["github"] },
  ];

  const THEME_LIGHT_TOKENS = ["light", "theme-light", "light-theme"];
  const THEME_DARK_TOKENS = ["dark", "theme-dark", "dark-theme"];
  const THEME_ATTRS = ["data-theme", "data-color-scheme", "data-theme-mode"];
  const USER_BUBBLE_GRADIENTS = {
    none: { gradient: "none", glowDark: "none", glowLight: "none" },
    pink: {
      gradient: "var(--gradient-pink)",
      glowDark: "var(--glow-pink)",
      glowLight: "var(--glow-pink-light)",
    },
    purple: {
      gradient: "var(--gradient-purple)",
      glowDark: "var(--glow-purple)",
      glowLight: "var(--glow-purple-light)",
    },
    blue: {
      gradient: "var(--gradient-blue)",
      glowDark: "var(--glow-blue)",
      glowLight: "var(--glow-blue-light)",
    },
    primary: {
      gradient: "var(--gradient-primary)",
      glowDark: "var(--glow-purple)",
      glowLight: "var(--glow-purple-light)",
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
      document.getElementById("__next"),
      document.getElementById("root"),
      document.querySelector("main"),
    ]);
    if (rootTheme) return rootTheme === "light";

    const attrEl = document.querySelector("[data-theme],[data-color-scheme],[data-theme-mode]");
    const attrTheme = getThemeFromElement(attrEl);
    if (attrTheme) return attrTheme === "light";

    const colorScheme = normalizeText(getComputedStyle(html || body).colorScheme);
    if (colorScheme.includes("light") && !colorScheme.includes("dark")) {
      return true;
    }
    if (colorScheme.includes("dark") && !colorScheme.includes("light")) {
      return false;
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
    if (!document.body || !document.createTreeWalker) return [];
    const matches = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (matchesPulseText(node.nodeValue)) {
        if (node.parentElement) matches.push(node.parentElement);
      }
      node = walker.nextNode();
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
      if (!e.message.toLowerCase().includes("extension context invalidated")) {
        console.error("Aether Extension Error:", e);
      }
      return key; // Fallback to key if context is lost
    }
    return key;
  };

  const t = (key, substitutions) => escapeHtml(getMessage(key, substitutions));

  function manageGpt5LimitPopup() {
    const popup = document.querySelector(SELECTORS.GPT5_LIMIT_POPUP);
    if (popup && !popup.textContent.toLowerCase().includes("you've reached the gpt-5 limit")) return;
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
      el.textContent.toLowerCase().includes("upgrade")
    );
    upgradeElements.push(panelButton);

    const topButtonContainer = document.querySelector(SELECTORS.UPGRADE_TOP_BUTTON_CONTAINER);
    upgradeElements.push(topButtonContainer);

    const profileButtonUpgrade = document.querySelector(SELECTORS.UPGRADE_PROFILE_BUTTON_TRAILING_ICON);
    upgradeElements.push(profileButtonUpgrade);

    const newSidebarUpgradeButton = Array.from(document.querySelectorAll(SELECTORS.UPGRADE_SIDEBAR_BUTTON)).find((el) =>
      el.textContent.toLowerCase().includes("upgrade")
    );
    upgradeElements.push(newSidebarUpgradeButton);

    const tinySidebarUpgradeIcon = document.querySelector(SELECTORS.UPGRADE_TINY_SIDEBAR_ICON);
    upgradeElements.push(tinySidebarUpgradeIcon);

    const bottomBannerUpgrade = Array.from(document.querySelectorAll(SELECTORS.UPGRADE_BOTTOM_BANNER)).find((el) =>
      el.textContent?.toLowerCase().includes("upgrade your plan")
    );
    if (bottomBannerUpgrade) {
      // The element to hide is the parent container of the button.
      upgradeElements.push(bottomBannerUpgrade.parentElement);
    }

    const allSettingRows = document.querySelectorAll(SELECTORS.UPGRADE_SETTINGS_ROW_CONTAINER);
    for (const row of allSettingRows) {
      const rowText = row.textContent || "";
      const hasUpgradeTitle = rowText.includes("Get ChatGPT Plus") || rowText.includes("Get ChatGPT Go");
      const hasUpgradeButton = Array.from(row.querySelectorAll("button")).some(
        (btn) => btn.textContent.trim() === "Upgrade"
      );

      if (hasUpgradeTitle && hasUpgradeButton) {
        upgradeElements.push(row);
      }
    }

    toggleClassForElements(upgradeElements, HIDE_UPGRADE_CLASS, settings.hideUpgradeButtons);
  }

  function manageSidebarButtons() {
    manageSidebarButtonsQuick();
    manageTodaysPulse();
  }

  function manageSidebarButtonsQuick() {
    toggleClassForElements(
      [document.getElementById(SELECTORS.SORA_BUTTON_ID)],
      HIDE_SORA_CLASS,
      settings.hideSoraButton
    );
    toggleClassForElements([document.querySelector(SELECTORS.GPTS_BUTTON)], HIDE_GPTS_CLASS, settings.hideGptsButton);
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

  function getMenuItems(menu) {
    if (!menu) return [];
    const items = Array.from(
      menu.querySelectorAll('[role="menuitemradio"], [role="menuitem"], button, [data-radix-collection-item]')
    );
    return items.filter((el) => isElementVisible(el) && el.closest('[role="menu"]') === menu);
  }

  function getMenuItemLabel(el) {
    return normalizeText(el?.getAttribute("aria-label") || el?.textContent || "");
  }

  function menuHasLabel(menu, labelHints) {
    if (!menu) return false;
    const labels = getMenuItems(menu).map(getMenuItemLabel);
    return labels.some((label) => labelHints.some((hint) => label.includes(hint)));
  }

  function findMenuItem(menu, labelHints) {
    const items = getMenuItems(menu);
    return items.find((item) => labelHints.some((hint) => getMenuItemLabel(item).includes(hint))) || null;
  }

  function isQuickAddMenu(menu) {
    if (!menuHasLabel(menu, QUICK_ADD_MORE_LABELS)) return false;
    return menuHasLabel(menu, QUICK_ADD_MENU_HINTS);
  }

  function isQuickAddSubmenu(menu) {
    return menuHasLabel(menu, QUICK_ADD_SUBMENU_HINTS);
  }

  function promoteQuickAddMenuItems() {
    const menus = Array.from(document.querySelectorAll('[role="menu"]')).filter(isElementVisible);
    if (!menus.length) return;

    const mainMenu = menus.find(isQuickAddMenu);
    if (!mainMenu) return;

    const moreItem = findMenuItem(mainMenu, QUICK_ADD_MORE_LABELS);
    if (!moreItem) return;

    QUICK_ADD_PROMOTIONS.forEach((promo) => {
      const existing = findMenuItem(mainMenu, promo.labels);
      if (existing) return;

      const sourceMenu = menus.find((menu) => menu !== mainMenu && isQuickAddSubmenu(menu));
      if (!sourceMenu) return;

      const item = findMenuItem(sourceMenu, promo.labels);
      if (!item) return;

      item.dataset.cgptPromoted = promo.key;
      mainMenu.insertBefore(item, moreItem);
    });
  }

  function ensureAppOnTop() {
    const app =
      document.getElementById("__next") ||
      document.querySelector("#root") ||
      document.querySelector("main") ||
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

  function updateBackgroundImage() {
    const bgNode = document.getElementById(ID);
    if (!bgNode || isTransitioning) return;

    let url = settings.customBgUrl;
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
    const sanitizedUrl = sanitizeBackgroundUrl(url);
    if (sanitizedUrl !== url) {
      url = sanitizedUrl;
      settings.customBgUrl = sanitizedUrl;
      if (chrome?.storage?.sync?.set) {
        chrome.storage.sync.set({ customBgUrl: sanitizedUrl });
      }
    }

    const inactiveLayerId = activeLayerId === "a" ? "b" : "a";
    const activeLayer = bgNode.querySelector(`.media-layer[data-layer-id="${activeLayerId}"]`);
    const inactiveLayer = bgNode.querySelector(`.media-layer[data-layer-id="${inactiveLayerId}"]`);

    if (!activeLayer || !inactiveLayer) return;

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
      isTransitioning = true;
      inactiveLayer.classList.add("active");
      activeLayer.classList.remove("active");
      activeLayerId = inactiveLayerId;
      // Wait for CSS transition to complete + buffer
      setTimeout(() => {
        isTransitioning = false;
      }, 800);
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
        mediaEl.removeEventListener("error", onMediaReady); // Also clean up error handler
      };

      mediaEl.addEventListener(eventType, onMediaReady, { once: true });
      // If media fails to load, still perform transition to avoid getting stuck
      mediaEl.addEventListener("error", onMediaReady, { once: true });

      if (isVideo) {
        inactiveVideo.src = mediaUrl;
        inactiveVideo.load();
        inactiveVideo.play().catch((_e) => {}); // Autoplay might be blocked by browser
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
      if (url === "__local__") {
        if (chrome?.runtime?.id && chrome?.storage?.local) {
          chrome.storage.local.get(LOCAL_BG_KEY, (res) => {
            if (chrome.runtime.lastError || !res || !res[LOCAL_BG_KEY]) {
              console.error(
                "Aether Extension Error (updateBackgroundImage):",
                chrome.runtime.lastError?.message || "Local BG not found."
              );
              applyDefault();
            } else {
              applyMedia(res[LOCAL_BG_KEY]);
            }
          });
        } else {
          applyDefault();
        }
      } else {
        applyMedia(url);
      }
    } else {
      applyDefault();
    }
  }

  function getClampedBlurValue(rawValue) {
    const parsed = Number.parseInt(rawValue ?? "", 10);
    if (!Number.isFinite(parsed)) return Math.max(MIN_BG_BLUR, 60);
    return Math.max(MIN_BG_BLUR, parsed);
  }

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
      const scaling = settings.backgroundScaling || "contain";
      styleNode.textContent = `
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
    };
    if (!document.head && !document.body) {
      document.addEventListener("DOMContentLoaded", ensureAndApply, {
        once: true,
      });
      return;
    }
    ensureAndApply();
  }

  let qsInitScheduled = false;

  function setupQuickSettingsToggles(settings) {
    const toggleConfig = [
      { id: "qs-focusMode", key: "focusMode" },
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
        el.addEventListener("change", () => {
          if (chrome?.storage?.sync?.set) {
            chrome.storage.sync.set({ [key]: el.checked });
          }
        });
      }
    });
  }

  function manageQuickSettingsUI() {
    if (!document.body) {
      if (!qsInitScheduled) {
        qsInitScheduled = true;
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            qsInitScheduled = false;
            manageQuickSettingsUI();
          },
          { once: true }
        );
      }
      return;
    }
    let btn = document.getElementById(QS_BUTTON_ID);
    let panel = document.getElementById(QS_PANEL_ID);

    if (!btn) {
      btn = document.createElement("button");
      btn.id = QS_BUTTON_ID;
      btn.title = getMessage("quickSettingsButtonTitle");
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5A3.5 3.5 0 0 1 15.5 12A3.5 3.5 0 0 1 12 15.5M19.43 12.98C19.47 12.65 19.5 12.33 19.5 12S19.47 11.35 19.43 11L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.96 19.05 5.05L16.56 6.05C16.04 5.66 15.5 5.32 14.87 5.07L14.5 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.5 2.42L9.13 5.07C8.5 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11C4.53 11.35 4.5 11.67 4.5 12S4.53 12.65 4.57 12.98L2.46 14.63C2.27 14.78 2.21 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.04 4.95 18.95L7.44 17.94C7.96 18.34 8.5 18.68 9.13 18.93L9.5 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.5 21.58L14.87 18.93C15.5 18.68 16.04 18.34 16.56 17.94L19.05 18.95C19.27 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98Z"></path></svg>`;
      document.body.appendChild(btn);

      panel = document.createElement("div");
      panel.id = QS_PANEL_ID;
      document.body.appendChild(panel);

      // --- NEW: STATE-DRIVEN ANIMATION LOGIC ---
      panel.setAttribute("data-state", "closed");
      const openPanel = () => panel.setAttribute("data-state", "open");
      const closePanel = () => panel.setAttribute("data-state", "closing");

      panel.addEventListener("animationend", (e) => {
        if (e.animationName === "qs-panel-close" && panel.getAttribute("data-state") === "closing") {
          panel.setAttribute("data-state", "closed");
        }
      });

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const state = panel.getAttribute("data-state");
        if (state === "closed") {
          openPanel();
        } else if (state === "open") {
          closePanel();
        }
      });

      document.addEventListener("click", (e) => {
        if (panel && !panel.contains(e.target) && panel.getAttribute("data-state") === "open") {
          closePanel();
        }
      });
    }

    panel.innerHTML = `
      <div class="qs-section-title">${t("quickSettingsSectionVisibility")}</div>
      <div class="qs-row" data-setting="focusMode">
          <label>${t("labelFocusMode")}</label>
          <label class="switch"><input type="checkbox" id="qs-focusMode"><span class="track"><span class="thumb"></span></span></label>
      </div>
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
          <div class="qs-blur-control">
            <input type="range" id="qs-blur-slider" min="${MIN_BG_BLUR}" max="150" step="1" />
            <span id="qs-blur-value">60</span><span class="qs-blur-unit">px</span>
          </div>
      </div>
    `;

    setupQuickSettingsToggles(settings);

    const appearanceButtons = Array.from(panel.querySelectorAll("[data-appearance]"));
    const syncAppearanceButtons = () => {
      appearanceButtons.forEach((btn) => {
        const isActive = (settings.appearance || "clear") === btn.dataset.appearance;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
      });
    };
    syncAppearanceButtons();
    appearanceButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.appearance;
        if (chrome?.storage?.sync?.set) {
          chrome.storage.sync.set({ appearance: value });
        }
      });
    });

    // Theme toggle buttons
    const themeButtons = Array.from(panel.querySelectorAll("[data-theme]"));
    const syncThemeButtons = () => {
      themeButtons.forEach((btn) => {
        const isActive = (settings.theme || "auto") === btn.dataset.theme;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
      });
    };
    syncThemeButtons();
    themeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.theme;
        if (chrome?.storage?.sync?.set) {
          chrome.storage.sync.set({ theme: value });
        }
      });
    });

    // Background preset grid
    const bgGrid = document.getElementById("qs-bg-grid");
    if (bgGrid) {
      const bgPresets = [
        { key: "default", url: "", label: "Default", thumb: DEFAULT_BG_URL },
        {
          key: "auroraClassic",
          url: AURORA_CLASSIC_URL,
          label: "Aurora Classic",
        },
        {
          key: "animated",
          url: "__gpt5_animated__",
          label: "Animated",
          animated: true,
        },
        { key: "jet", url: JET_KEY, label: "Jet" },
        { key: "aurora", url: AURORA_KEY, label: "Aurora", animated: true },
        { key: "sunset", url: SUNSET_KEY, label: "Sunset", animated: true },
        { key: "ocean", url: OCEAN_KEY, label: "Ocean", animated: true },
        { key: "grokHorizon", url: GROK_HORIZON_URL, label: "Horizon" },
        { key: "spaceBlueGalaxy", url: SPACE_BLUE_GALAXY_URL, label: "Galaxy" },
        {
          key: "spaceCosmicPurple",
          url: SPACE_COSMIC_PURPLE_URL,
          label: "Cosmic",
        },
        { key: "spaceMilkyWay", url: SPACE_MILKY_WAY_URL, label: "Milky Way" },
      ];

      const getCurrentBgKey = () => {
        const url = settings.customBgUrl || "";
        if (!url) return "default";
        if (url === AURORA_CLASSIC_URL) return "auroraClassic";
        if (url === "__gpt5_animated__") return "animated";
        if (url === JET_KEY) return "jet";
        if (url === AURORA_KEY) return "aurora";
        if (url === SUNSET_KEY) return "sunset";
        if (url === OCEAN_KEY) return "ocean";
        const preset = bgPresets.find((p) => p.url === url);
        return preset ? preset.key : "custom";
      };

      bgGrid.innerHTML = bgPresets
        .map((preset) => {
          const isActive = getCurrentBgKey() === preset.key;
          const classes = ["qs-bg-tile", isActive ? "active" : "", preset.animated ? "is-animated" : ""]
            .filter(Boolean)
            .join(" ");
          const resolvedThumb =
            preset.thumb ||
            (preset.url && preset.url !== "__gpt5_animated__" && preset.url !== JET_KEY ? preset.url : "");
          const thumbStyle = resolvedThumb ? ` style="--qs-bg-thumb: url('${escapeHtml(resolvedThumb)}');"` : "";
          return `
        <button type="button" class="${classes}" data-bg-key="${preset.key}" data-bg-url="${preset.url}"${thumbStyle}>
          <span class="qs-bg-label">${escapeHtml(preset.label)}</span>
        </button>
      `;
        })
        .join("");

      bgGrid.querySelectorAll(".qs-bg-tile").forEach((tile) => {
        tile.addEventListener("click", () => {
          const url = tile.dataset.bgUrl;
          if (chrome?.storage?.sync?.set) {
            chrome.storage.sync.set({ customBgUrl: url });
          }
          if (chrome?.storage?.local?.remove && url !== "__local__") {
            chrome.storage.local.remove("localBgDataUrl");
          }
          bgGrid.querySelectorAll(".qs-bg-tile").forEach((t) => t.classList.remove("active"));
          tile.classList.add("active");
        });
      });
    }

    // Blur slider control
    const blurSlider = document.getElementById("qs-blur-slider");
    const blurValue = document.getElementById("qs-blur-value");
    if (blurSlider && blurValue) {
      const currentBlur = getClampedBlurValue(settings.backgroundBlur);
      blurSlider.min = String(MIN_BG_BLUR);
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
        if (chrome?.storage?.sync?.set) {
          chrome.storage.sync.set({ backgroundBlur: pendingSaveValue });
        }
      };

      const scheduleBlurSave = (value) => {
        pendingSaveValue = value;
        if (blurSaveTimer) return;
        blurSaveTimer = setTimeout(() => {
          blurSaveTimer = null;
          flushBlurSave();
        }, 120);
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
  }

  function applyRootFlags() {
    const isUiVisible = shouldShow();
    document.documentElement.classList.toggle(HTML_CLASS, isUiVisible);
    document.documentElement.classList.toggle(ANIMATIONS_DISABLED_CLASS, !!settings.disableAnimations);
    document.documentElement.classList.toggle(BG_ANIM_DISABLED_CLASS, !!settings.disableBgAnimation);
    document.documentElement.classList.toggle(CLEAR_APPEARANCE_CLASS, settings.appearance === "clear");

    document.documentElement.classList.toggle("cgpt-focus-mode-on", !!settings.focusMode);

    document.documentElement.classList.toggle("cgpt-blur-chat-history", !!settings.blurChatHistory);

    const applyLightMode = settings.theme === "light" || (settings.theme === "auto" && isLightTheme());
    document.documentElement.classList.toggle(LIGHT_CLASS, applyLightMode);
    applyUserBubbleGradient(applyLightMode);

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
      if (!e.message.toLowerCase().includes("extension context invalidated")) {
        console.error("Aether Extension Error:", e);
      }
    }
  }

  function applyUserBubbleGradient(applyLightMode) {
    const choice = settings.userBubbleGradient || "none";
    const config = USER_BUBBLE_GRADIENTS[choice] || USER_BUBBLE_GRADIENTS.none;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--user-bubble-gradient", config.gradient);
    rootStyle.setProperty("--user-bubble-glow", applyLightMode ? config.glowLight : config.glowDark);
    if (choice === "none") {
      rootStyle.removeProperty("--user-bubble-border");
    } else {
      rootStyle.setProperty("--user-bubble-border", "transparent");
    }
  }

  function showBg() {
    let node = document.getElementById(ID);
    if (!node) {
      node = makeBgNode();
      const add = () => {
        document.body.prepend(node);
        ensureAppOnTop();
        applyCustomStyles();
        updateBackgroundImage(); // Initial background set
        setTimeout(() => node.classList.add("bg-visible"), 50);
      };
      if (document.body) add();
      else document.addEventListener("DOMContentLoaded", add, { once: true });
    } else {
      node.classList.add("bg-visible");
      updateBackgroundImage();
    }
  }

  function shouldShow() {
    return true;
  }

  function applyAllSettings() {
    showBg();
    manageQuickSettingsUI();
    applyRootFlags();
    applyCustomStyles();
    updateBackgroundImage();
    manageGpt5LimitPopup();
    manageUpgradeButtons();
    manageSidebarButtons();
  }

  let observersStarted = false;
  function startObservers() {
    if (observersStarted) return;
    observersStarted = true;

    // Performance: Pause animations and video when tab is not visible.
    document.addEventListener(
      "visibilitychange",
      () => {
        const bgNode = document.getElementById(ID);
        document.documentElement.classList.toggle("cgpt-tab-hidden", document.hidden);
        if (!bgNode) return;

        const videos = bgNode.querySelectorAll("video");
        videos.forEach((video) => {
          if (document.hidden) {
            video.pause();
          } else {
            // Only play if it's supposed to be playing
            if (video.style.display !== "none") {
              video.play().catch((_e) => {
                /* Autoplay might be blocked by browser policies */
              });
            }
          }
        });
      },
      { passive: true }
    );

    const uiReadyObserver = new MutationObserver((mutations, obs) => {
      const stableUiElement = document.querySelector(SELECTORS.PROFILE_BUTTON);
      if (stableUiElement) {
        applyAllSettings();
        obs.disconnect();
      }
    });

    uiReadyObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("focus", applyAllSettings, { passive: true });
    let lastUrl = location.href;
    const checkUrl = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      applyAllSettings();
    };
    window.addEventListener("popstate", checkUrl, { passive: true });
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      setTimeout(checkUrl, 0);
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      setTimeout(checkUrl, 0);
    };

    // For performance, debounce less-critical UI checks that don't cause flicker.
    const debouncedOtherChecks = debounce(() => {
      manageGpt5LimitPopup();
      manageTodaysPulse();
    }, 150);

    // This observer handles all dynamic UI changes.
    const domObserver = new MutationObserver(() => {
      // Run the upgrade button check immediately on every DOM change to prevent the menu item from flickering.
      manageUpgradeButtons();
      promoteQuickAddMenuItems();

      manageSidebarButtonsQuick();
      attachThemeObservers();

      // Run the less-critical checks on a debounce timer.
      debouncedOtherChecks();
    });

    domObserver.observe(document.body, { childList: true, subtree: true });

    const themeObserver = new MutationObserver(() => {
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
      observeThemeNode(document.getElementById("__next"));
      observeThemeNode(document.getElementById("root"));
      observeThemeNode(document.querySelector("main"));
    };

    attachThemeObservers();

    if (!document.body) {
      const bodyObserver = new MutationObserver(() => {
        if (document.body) {
          attachThemeObservers();
          bodyObserver.disconnect();
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
            <div class="welcome-icon">✨</div>
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

    const refreshSettingsAndApply = () => {
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
      document.addEventListener(
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

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync") {
        const changedKeys = Object.keys(changes);
        const backgroundKeys = ["customBgUrl", "backgroundBlur", "backgroundScaling"];
        const tuningKeys = ["backgroundBlur", "backgroundScaling"];
        const isOnlyTuningChange = changedKeys.length > 0 && changedKeys.every((key) => tuningKeys.includes(key));
        const isOnlyNonBackgroundChange = changedKeys.every((key) => !backgroundKeys.includes(key));

        if (isOnlyTuningChange) {
          let didUpdateStyles = false;
          if (changes.backgroundBlur) {
            const nextBlurRaw = changes.backgroundBlur.newValue;
            const clampedBlur = String(getClampedBlurValue(nextBlurRaw));
            if (clampedBlur !== String(nextBlurRaw) && chrome?.storage?.sync?.set) {
              chrome.storage.sync.set({ backgroundBlur: clampedBlur });
            }
            if (clampedBlur !== settings.backgroundBlur) {
              settings.backgroundBlur = clampedBlur;
              didUpdateStyles = true;
            }
          }
          if (changes.backgroundScaling) {
            const nextScaling = changes.backgroundScaling.newValue;
            if (nextScaling !== settings.backgroundScaling) {
              settings.backgroundScaling = nextScaling;
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
          });
        } else {
          // Full refresh for background changes or mixed changes
          refreshSettingsAndApply();
        }
      } else if (area === "local" && changes[LOCAL_BG_KEY]) {
        refreshSettingsAndApply();
      }
    });
  }
})();
