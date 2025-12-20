// popup.js - controls settings

const LOCAL_BG_KEY = "customBgData";
const MIN_BG_BLUR = 12;
const getExtensionUrl = (path) => (chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "");

const DEFAULT_BG_URL = getExtensionUrl("Aether/blue-galaxy.webp");
const BLUE_WALLPAPER_URL = DEFAULT_BG_URL;
const GROK_HORIZON_URL = getExtensionUrl("Aether/grok-4.webp");
const GROK_BLANCO_URL = getExtensionUrl("Aether/grok_blanco.webp");
const GROK_DARKO_URL = getExtensionUrl("Aether/grok_darko.png");
const GROK_CELESTE_URL = getExtensionUrl("Aether/grok_verde.png");
const GROK_BLANCO_LEGACY_URL = getExtensionUrl("Aether/grok_white.png");
const JET_KEY = "__jet__";
const AURORA_CLASSIC_URL = getExtensionUrl("Aether/aurora-classic.webp");
const AURORA_KEY = "__aurora__";
const SUNSET_KEY = "__sunset__";
const OCEAN_KEY = "__ocean__";

// Space Background URLs
const SPACE_BLUE_GALAXY_URL = getExtensionUrl("Aether/blue-galaxy.webp");
const SPACE_COSMIC_PURPLE_URL = getExtensionUrl("Aether/cosmic-purple.webp");
const SPACE_DEEP_NEBULA_URL = getExtensionUrl("Aether/deep-space-nebula.webp");
const SPACE_MILKY_WAY_URL = getExtensionUrl("Aether/milky-way-galaxy.webp");
const SPACE_NEBULA_PURPLE_BLUE_URL = getExtensionUrl("Aether/nebula-purple-blue.webp");
const SPACE_STARS_PURPLE_URL = getExtensionUrl("Aether/space-stars-purple.webp");
const SPACE_ORION_NEBULA_URL = getExtensionUrl("Aether/space-orion-nebula-nasa.webp");
const SPACE_PILLARS_CREATION_URL = getExtensionUrl("Aether/space-pillars-creation-jwst.webp");
const SPACE_MILKYWAY_BLUE_URL = getExtensionUrl("Aether/space-milkyway-blue-pexels.webp");
const SPACE_MILKYWAY_RIDGE_URL = getExtensionUrl("Aether/space-milkyway-ridge-pexels.webp");
const SPACE_PURPLE_NEBULA_UNSPLASH_URL = getExtensionUrl("Aether/space-purple-nebula-unsplash.webp");
const SPACE_PURPLE_STARS_PEXELS_URL = getExtensionUrl("Aether/space-purple-stars-pexels.webp");

const EXTENSION_BASE_URL = getExtensionUrl("");
const isAllowedBackgroundUrl = (url) => {
  if (!url) return true;
  if (url === "__gpt5_animated__" || url === "__local__" || url === JET_KEY || url === AURORA_KEY || url === SUNSET_KEY || url === OCEAN_KEY) return true;
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

const getMessage = (key, substitutions) => {
  if (chrome?.i18n?.getMessage) {
    const text = chrome.i18n.getMessage(key, substitutions);
    if (text) return text;
  }
  return key;
};

document.addEventListener("DOMContentLoaded", () => {
  let settingsCache = {}; // Cache for current settings to enable synchronous checks and quick updates.
  let DEFAULTS_CACHE = {}; // Add this line
  let searchableSettings = []; // New: For search functionality

  const applyStaticLocalization = () => {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const message = getMessage(key);
      if (message) el.textContent = message;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const message = getMessage(key);
      if (message) el.setAttribute("placeholder", message);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const message = getMessage(key);
      if (message) el.setAttribute("title", message);
    });
  };

  applyStaticLocalization();

  // --- New: Tab Switching Logic ---
  const tabs = document.querySelectorAll(".tab-link");
  const panes = document.querySelectorAll(".tab-pane");
  const mainContent = document.querySelector(".tab-content");
  const tabNav = document.querySelector(".tab-nav");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetPaneId = tab.dataset.tab;

      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      panes.forEach((pane) => {
        pane.classList.toggle("active", pane.id === targetPaneId);
      });
    });
  });

  // --- New: Search Functionality ---
  const searchInput = document.getElementById("settingsSearch");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  let noResultsMessage = null;

  function buildSearchableData() {
    searchableSettings = [];
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      const tabId = pane.id;
      const tabTitle = document.querySelector(`.tab-link[data-tab="${tabId}"]`)?.textContent || "";
      pane.querySelectorAll(".row").forEach((row) => {
        const label = row.querySelector(".label")?.getAttribute("data-i18n");
        const tooltip = row.querySelector("[data-i18n-title]")?.getAttribute("data-i18n-title");

        let keywords = `${tabTitle} `;
        if (label) keywords += getMessage(label) + " ";
        if (tooltip) keywords += getMessage(tooltip) + " ";

        searchableSettings.push({
          element: row,
          tab: tabId,
          keywords: keywords.toLowerCase().trim(),
        });
      });
    });
  }

  function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();
    const matchedTabs = new Set();
    let matchCount = 0;

    clearSearchBtn.hidden = !query;

    if (!query) {
      resetSearchView();
      return;
    }

    // Hide everything first
    panes.forEach((p) => p.classList.remove("active"));
    tabs.forEach((t) => t.classList.add("is-hidden"));

    searchableSettings.forEach((setting) => {
      const isMatch = setting.keywords.includes(query);
      setting.element.classList.toggle("is-hidden", !isMatch);
      if (isMatch) {
        matchedTabs.add(setting.tab);
        matchCount++;
      }
    });

    if (matchCount > 0) {
      // Show tabs that have matches
      tabNav.hidden = false;
      if (noResultsMessage) noResultsMessage.style.display = "none";

      tabs.forEach((tab) => {
        const tabId = tab.dataset.tab;
        const hasMatch = matchedTabs.has(tabId);
        tab.classList.toggle("is-hidden", !hasMatch);
      });

      // Activate the first tab with a match
      const firstMatchedTab = document.querySelector(".tab-link:not(.is-hidden)");
      if (firstMatchedTab) {
        firstMatchedTab.click();
      }
    } else {
      // No results found
      tabNav.hidden = true;
      if (!noResultsMessage) {
        noResultsMessage = document.createElement("div");
        noResultsMessage.className = "no-results-message";
        noResultsMessage.textContent = getMessage("noResults");
        mainContent.appendChild(noResultsMessage);
      }
      noResultsMessage.style.display = "block";
    }
  }

  function resetSearchView() {
    tabNav.hidden = false;
    if (noResultsMessage) noResultsMessage.style.display = "none";

    searchableSettings.forEach((setting) => setting.element.classList.remove("is-hidden"));
    tabs.forEach((tab) => tab.classList.remove("is-hidden"));

    // Restore default tab view
    const activeTab = document.querySelector(".tab-link.active");
    if (!activeTab || activeTab.classList.contains("is-hidden")) {
      tabs[0]?.click();
    } else {
      activeTab.click(); // Re-click to ensure pane is active
    }
  }

  searchInput.addEventListener("input", handleSearch);
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    handleSearch();
    searchInput.focus();
  });
  // End of Search Functionality

  // --- Data-driven configuration for all toggle switches ---
  const TOGGLE_CONFIG = [
    { id: "hideGpt5Limit", key: "hideGpt5Limit" },
    { id: "hideUpgradeButtons", key: "hideUpgradeButtons" },
    { id: "disableAnimations", key: "disableAnimations" },
    { id: "disableBgAnimation", key: "disableBgAnimation" },
    { id: "focusMode", key: "focusMode" },
    { id: "hideGptsButton", key: "hideGptsButton" },
    { id: "hideSoraButton", key: "hideSoraButton" },
    { id: "hideTodaysPulse", key: "hideTodaysPulse" },
    { id: "hideShoppingButton", key: "hideShoppingButton" },
    { id: "blurChatHistory", key: "blurChatHistory" },
  ];

  // --- Initialize all toggle switch event listeners from the config ---
  TOGGLE_CONFIG.forEach(({ id, key }) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("change", () => {
        chrome.storage.sync.set({ [key]: element.checked });
      });
    }
  });

  // --- Get other UI elements ---
  const btnClearBg = document.getElementById("clearBg");
  const blurSlider = document.getElementById("blurSlider");
  const blurValue = document.getElementById("blurValue");

  // --- Rewritten Feature: Blur Slider Logic ---
  // This new logic uses a single 'input' event for real-time updates and efficient saving.
  // It completely replaces any old 'input' or 'change' listeners.
  if (blurSlider && blurValue) {
    let blurSaveTimer = null;
    let pendingBlurValue = null;

    const flushBlurSave = () => {
      if (pendingBlurValue === null) return;
      chrome.storage.sync.set({ backgroundBlur: pendingBlurValue });
    };

    const scheduleBlurSave = (value) => {
      pendingBlurValue = value;
      if (blurSaveTimer) return;
      blurSaveTimer = setTimeout(() => {
        blurSaveTimer = null;
        flushBlurSave();
      }, 120);
    };

    blurSlider.addEventListener("input", () => {
      const rawValue = Number.parseInt(blurSlider.value, 10);
      const clampedValue = Number.isFinite(rawValue) ? Math.max(MIN_BG_BLUR, rawValue) : MIN_BG_BLUR;
      if (blurSlider.value !== String(clampedValue)) {
        blurSlider.value = String(clampedValue);
      }

      // 1. Instantly update the 'px' value in the UI.
      blurValue.textContent = String(clampedValue);

      // 2. Throttle storage writes to reduce UI jank.
      scheduleBlurSave(String(clampedValue));
    });

    blurSlider.addEventListener("change", () => {
      const rawValue = Number.parseInt(blurSlider.value, 10);
      const clampedValue = Number.isFinite(rawValue) ? Math.max(MIN_BG_BLUR, rawValue) : MIN_BG_BLUR;
      if (blurSlider.value !== String(clampedValue)) {
        blurSlider.value = String(clampedValue);
      }
      blurValue.textContent = String(clampedValue);
      if (blurSaveTimer) {
        clearTimeout(blurSaveTimer);
        blurSaveTimer = null;
      }
      pendingBlurValue = String(clampedValue);
      flushBlurSave();
    });
  }

  // --- Reusable Custom Select Functionality ---
  function createCustomSelect(containerId, options, storageKey, onPresetChange, config = {}) {
    const container = document.getElementById(containerId);
    if (!container) return { update: () => {} };
    const trigger = container.querySelector(".select-trigger");
    const label = container.querySelector(".select-label");
    const optionsContainer = container.querySelector(".select-options");
    const dotInTrigger = trigger.querySelector(".color-dot");
    const { manualStorage = false, mapValueToOption, formatLabel } = config;
    let currentOptionValue = null;

    const resolveLabel = (option, rawValue) => {
      if (!option) return rawValue || "";
      if (typeof option.getLabel === "function") return option.getLabel(rawValue);
      if (typeof formatLabel === "function") {
        const custom = formatLabel(option, rawValue);
        if (custom) return custom;
      }
      if (option.labelKey) return getMessage(option.labelKey);
      return option.label || option.value;
    };

    function renderOptions(selectedValue) {
      optionsContainer.innerHTML = options
        .filter((option) => !option.hidden)
        .map((option) => {
          const colorDotHtml = option.color
            ? `<span class="color-dot" style="background-color: ${option.color}; display: block;"></span>`
            : "";
          const optionLabel = escapeHtml(resolveLabel(option, option.value));
          const isSelected = option.value === selectedValue ? "true" : "false";
          return `
            <div class="select-option" role="option" data-value="${option.value}" aria-selected="${isSelected}">
              ${colorDotHtml}
              <span class="option-label">${optionLabel}</span>
            </div>
            `;
        })
        .join("");

      optionsContainer.querySelectorAll(".select-option").forEach((optionEl) => {
        optionEl.addEventListener("click", () => {
          const newValue = optionEl.dataset.value;
          updateSelectorState(newValue);
          if (!manualStorage && storageKey) {
            chrome.storage.sync.set({ [storageKey]: newValue });
          }
          if (onPresetChange) {
            onPresetChange(newValue);
          }
          closeAllSelects();
        });
      });
    }

    function updateSelectorState(value) {
      let mappedValue = value;
      if (typeof mapValueToOption === "function") {
        mappedValue = mapValueToOption(value);
      }
      currentOptionValue = mappedValue;
      const selectedOption = options.find((opt) => opt.value === mappedValue) || options[0];
      const selectedLabel = resolveLabel(selectedOption, value);

      if (dotInTrigger) {
        if (selectedOption.color) {
          dotInTrigger.style.backgroundColor = selectedOption.color;
          dotInTrigger.style.display = "block";
        } else {
          dotInTrigger.style.display = "none";
        }
      }

      label.textContent = selectedLabel;
      renderOptions(currentOptionValue);
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = trigger.getAttribute("aria-expanded") === "true";
      closeAllSelects();
      if (!isExpanded) {
        container.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        optionsContainer.style.display = "block";
      }
    });

    return { update: updateSelectorState };
  }

  function closeAllSelects() {
    document.querySelectorAll(".custom-select").forEach((sel) => {
      sel.classList.remove("is-open");
      const trigger = sel.querySelector(".select-trigger");
      const optionsContainer = sel.querySelector(".select-options");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      if (optionsContainer) optionsContainer.style.display = "none";
    });
  }
  document.addEventListener("click", closeAllSelects);

  // --- Initialize Custom Selects ---
  const bgPresetOptions = [
    { value: "default", labelKey: "bgPresetOptionDefault" },
    { value: "__gpt5_animated__", labelKey: "bgPresetOptionGpt5Animated" },
    { value: "jet", labelKey: "bgPresetOptionJet" },
    { value: "auroraClassic", labelKey: "bgPresetOptionAuroraClassic" },
    { value: "aurora", labelKey: "bgPresetOptionAurora" },
    { value: "sunset", labelKey: "bgPresetOptionSunset" },
    { value: "ocean", labelKey: "bgPresetOptionOcean" },
    { value: "grokHorizon", labelKey: "bgPresetOptionGrokHorizon" },
    { value: "grokBlanco", labelKey: "bgPresetOptionGrokBlanco" },
    { value: "grokDarko", labelKey: "bgPresetOptionGrokDarko" },
    { value: "grokCeleste", labelKey: "bgPresetOptionGrokCeleste" },
    { value: "blue", labelKey: "bgPresetOptionBlue" },
    { value: "spaceBlueGalaxy", labelKey: "bgPresetOptionSpaceBlueGalaxy" },
    { value: "spaceCosmicPurple", labelKey: "bgPresetOptionSpaceCosmicPurple" },
    { value: "spaceDeepNebula", labelKey: "bgPresetOptionSpaceDeepNebula" },
    { value: "spaceMilkyWay", labelKey: "bgPresetOptionSpaceMilkyWay" },
    { value: "spaceMilkyWayBlue", labelKey: "bgPresetOptionSpaceMilkyWayBlue" },
    {
      value: "spaceMilkyWayRidge",
      labelKey: "bgPresetOptionSpaceMilkyWayRidge",
    },
    {
      value: "spaceNebulaPurpleBlue",
      labelKey: "bgPresetOptionSpaceNebulaPurpleBlue",
    },
    { value: "spaceStarsPurple", labelKey: "bgPresetOptionSpaceStarsPurple" },
    { value: "spaceNebulaViolet", labelKey: "bgPresetOptionSpaceNebulaViolet" },
    {
      value: "spacePurpleStarsAlt",
      labelKey: "bgPresetOptionSpacePurpleStarsAlt",
    },
    { value: "spaceOrionNebula", labelKey: "bgPresetOptionSpaceOrionNebula" },
    {
      value: "spacePillarsCreation",
      labelKey: "bgPresetOptionSpacePillarsCreation",
    },
    { value: "custom", labelKey: "bgPresetOptionCustom", hidden: true },
  ];
  const bgPresetSelect = createCustomSelect("bgPreset", bgPresetOptions, "customBgUrl", (value) => {
    let newUrl = "";
    if (value === "blue") {
      newUrl = BLUE_WALLPAPER_URL;
    } else if (value === "__gpt5_animated__") {
      newUrl = "__gpt5_animated__";
    } else if (value === "jet") {
      newUrl = JET_KEY;
    } else if (value === "auroraClassic") {
      newUrl = AURORA_CLASSIC_URL;
    } else if (value === "aurora") {
      newUrl = AURORA_KEY;
    } else if (value === "sunset") {
      newUrl = SUNSET_KEY;
    } else if (value === "ocean") {
      newUrl = OCEAN_KEY;
    } else if (value === "grokHorizon") {
      newUrl = GROK_HORIZON_URL;
    } else if (value === "grokBlanco") {
      newUrl = GROK_BLANCO_URL;
    } else if (value === "grokDarko") {
      newUrl = GROK_DARKO_URL;
    } else if (value === "grokCeleste") {
      newUrl = GROK_CELESTE_URL;
    } else if (value === "spaceBlueGalaxy") {
      newUrl = SPACE_BLUE_GALAXY_URL;
    } else if (value === "spaceCosmicPurple") {
      newUrl = SPACE_COSMIC_PURPLE_URL;
    } else if (value === "spaceDeepNebula") {
      newUrl = SPACE_DEEP_NEBULA_URL;
    } else if (value === "spaceMilkyWay") {
      newUrl = SPACE_MILKY_WAY_URL;
    } else if (value === "spaceMilkyWayBlue") {
      newUrl = SPACE_MILKYWAY_BLUE_URL;
    } else if (value === "spaceMilkyWayRidge") {
      newUrl = SPACE_MILKYWAY_RIDGE_URL;
    } else if (value === "spaceNebulaPurpleBlue") {
      newUrl = SPACE_NEBULA_PURPLE_BLUE_URL;
    } else if (value === "spaceStarsPurple") {
      newUrl = SPACE_STARS_PURPLE_URL;
    } else if (value === "spaceNebulaViolet") {
      newUrl = SPACE_PURPLE_NEBULA_UNSPLASH_URL;
    } else if (value === "spacePurpleStarsAlt") {
      newUrl = SPACE_PURPLE_STARS_PEXELS_URL;
    } else if (value === "spaceOrionNebula") {
      newUrl = SPACE_ORION_NEBULA_URL;
    } else if (value === "spacePillarsCreation") {
      newUrl = SPACE_PILLARS_CREATION_URL;
    }

    if (value !== "custom") {
      chrome.storage.local.remove(LOCAL_BG_KEY);
    }
    chrome.storage.sync.set({ customBgUrl: newUrl });
  });

  const bgScalingOptions = [
    { value: "contain", labelKey: "bgScalingOptionContain" },
    { value: "cover", labelKey: "bgScalingOptionCover" },
  ];
  const bgScalingSelect = createCustomSelect("bgScalingSelector", bgScalingOptions, "backgroundScaling");

  const themeOptions = [
    { value: "auto", labelKey: "themeOptionAuto" },
    { value: "light", labelKey: "themeOptionLight" },
    { value: "dark", labelKey: "themeOptionDark" },
  ];
  const themeSelect = createCustomSelect("themeSelector", themeOptions, "theme");

  // ADD THESE LINES
  const appearanceOptions = [
    { value: "clear", labelKey: "glassAppearanceOptionClear" },
    { value: "dimmed", labelKey: "glassAppearanceOptionDimmed" },
  ];
  const appearanceSelect = createCustomSelect("appearanceSelector", appearanceOptions, "appearance");

  const userBubbleGradientOptions = [
    { value: "none", labelKey: "userBubbleGradientOptionNone" },
    { value: "pink", labelKey: "userBubbleGradientOptionPink" },
    { value: "purple", labelKey: "userBubbleGradientOptionPurple" },
    { value: "blue", labelKey: "userBubbleGradientOptionBlue" },
    { value: "primary", labelKey: "userBubbleGradientOptionPrimary" },
  ];
  const userBubbleGradientSelect = createCustomSelect(
    "userBubbleGradientSelector",
    userBubbleGradientOptions,
    "userBubbleGradient"
  );

  // --- Function to update the UI based on current settings ---
  async function updateUi(settings) {
    let isLightTheme = settings.theme === "light";
    if (settings.theme === "auto") {
      try {
        const result = await new Promise((resolve, reject) => {
          chrome.storage.local.get("detectedTheme", (res) => {
            if (chrome.runtime.lastError) {
              console.error("Aether Popup Error (updateUi):", chrome.runtime.lastError.message);
              return reject(chrome.runtime.lastError);
            }
            resolve(res);
          });
        });
        isLightTheme = result.detectedTheme === "light";
      } catch (_e) {
        // Error is logged, default to dark theme for 'auto' on error.
        isLightTheme = false;
      }
    }
    document.documentElement.classList.toggle("theme-light", isLightTheme);

    TOGGLE_CONFIG.forEach(({ id, key }) => {
      const element = document.getElementById(id);
      if (element) {
        element.checked = !!settings[key];
      }
    });

    const parsedBlur = Number.parseInt(settings.backgroundBlur ?? "", 10);
    const clampedBlur = Number.isFinite(parsedBlur) ? Math.max(MIN_BG_BLUR, parsedBlur) : Math.max(MIN_BG_BLUR, 60);
    blurSlider.min = String(MIN_BG_BLUR);
    blurSlider.value = String(clampedBlur);
    blurValue.textContent = String(clampedBlur);

    bgScalingSelect.update(settings.backgroundScaling);
    themeSelect.update(settings.theme);
    appearanceSelect.update(settings.appearance || "clear");
    userBubbleGradientSelect.update(settings.userBubbleGradient || "none");

    const sanitizedUrl = sanitizeBackgroundUrl(settings.customBgUrl || "");
    if (sanitizedUrl !== settings.customBgUrl) {
      settings.customBgUrl = sanitizedUrl;
      if (chrome?.storage?.sync?.set) {
        chrome.storage.sync.set({ customBgUrl: sanitizedUrl });
      }
    }
    const url = settings.customBgUrl;

    if (!url) {
      bgPresetSelect.update("default");
    } else if (url === BLUE_WALLPAPER_URL) {
      bgPresetSelect.update("blue");
    } else if (url === GROK_HORIZON_URL) {
      bgPresetSelect.update("grokHorizon");
    } else if (url === GROK_BLANCO_URL || url === GROK_BLANCO_LEGACY_URL) {
      if (url === GROK_BLANCO_LEGACY_URL && chrome?.storage?.sync?.set) {
        chrome.storage.sync.set({ customBgUrl: GROK_BLANCO_URL });
      }
      bgPresetSelect.update("grokBlanco");
    } else if (url === GROK_DARKO_URL) {
      bgPresetSelect.update("grokDarko");
    } else if (url === GROK_CELESTE_URL) {
      bgPresetSelect.update("grokCeleste");
    } else if (url === "__gpt5_animated__") {
      bgPresetSelect.update("__gpt5_animated__");
    } else if (url === JET_KEY) {
      bgPresetSelect.update("jet");
    } else if (url === AURORA_CLASSIC_URL) {
      bgPresetSelect.update("auroraClassic");
    } else if (url === AURORA_KEY) {
      bgPresetSelect.update("aurora");
    } else if (url === SUNSET_KEY) {
      bgPresetSelect.update("sunset");
    } else if (url === OCEAN_KEY) {
      bgPresetSelect.update("ocean");
    } else if (url === "__neural__") {
      bgPresetSelect.update("default");
      try {
        if (chrome?.storage?.sync?.set) {
          chrome.storage.sync.set({ customBgUrl: "" });
        }
      } catch (err) {
        console.warn("Aether popup: failed to clear deprecated neural background", err);
      }
    } else if (url === SPACE_BLUE_GALAXY_URL) {
      bgPresetSelect.update("spaceBlueGalaxy");
    } else if (url === SPACE_COSMIC_PURPLE_URL) {
      bgPresetSelect.update("spaceCosmicPurple");
    } else if (url === SPACE_DEEP_NEBULA_URL) {
      bgPresetSelect.update("spaceDeepNebula");
    } else if (url === SPACE_MILKY_WAY_URL) {
      bgPresetSelect.update("spaceMilkyWay");
    } else if (url === SPACE_MILKYWAY_BLUE_URL) {
      bgPresetSelect.update("spaceMilkyWayBlue");
    } else if (url === SPACE_MILKYWAY_RIDGE_URL) {
      bgPresetSelect.update("spaceMilkyWayRidge");
    } else if (url === SPACE_NEBULA_PURPLE_BLUE_URL) {
      bgPresetSelect.update("spaceNebulaPurpleBlue");
    } else if (url === SPACE_STARS_PURPLE_URL) {
      bgPresetSelect.update("spaceStarsPurple");
    } else if (url === SPACE_PURPLE_NEBULA_UNSPLASH_URL) {
      bgPresetSelect.update("spaceNebulaViolet");
    } else if (url === SPACE_PURPLE_STARS_PEXELS_URL) {
      bgPresetSelect.update("spacePurpleStarsAlt");
    } else if (url === SPACE_ORION_NEBULA_URL) {
      bgPresetSelect.update("spaceOrionNebula");
    } else if (url === SPACE_PILLARS_CREATION_URL) {
      bgPresetSelect.update("spacePillarsCreation");
    } else if (url === "__local__") {
      bgPresetSelect.update("custom");
    } else {
      bgPresetSelect.update("custom");
    }
  }

  // --- Initial Load ---
  if (chrome.runtime?.sendMessage) {
    // Fetch the DEFAULTS object from the background script first
    chrome.runtime.sendMessage({ type: "GET_DEFAULTS" }, (defaults) => {
      if (chrome.runtime.lastError) {
        console.error("Aether Popup Error (Fetching Defaults):", chrome.runtime.lastError.message);
        // Fallback to hardcoded values if the message fails
        DEFAULTS_CACHE = {
          customBgUrl: "",
          backgroundBlur: "60",
          backgroundScaling: "cover",
        };
      } else {
        DEFAULTS_CACHE = defaults;
      }

      // Now, fetch the user's current settings
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
        if (chrome.runtime.lastError) {
          console.error("Aether Popup Error (Initial Load):", chrome.runtime.lastError.message);
          const errorNode = document.createElement("div");
          errorNode.style.padding = "20px";
          errorNode.style.textAlign = "center";
          errorNode.textContent = getMessage("errorLoadingSettings");
          document.body.textContent = "";
          document.body.appendChild(errorNode);
          return;
        }
        settingsCache = settings;
        updateUi(settings);
        buildSearchableData(); // New: Build search index after UI and text is loaded
      });
    });
  }

  // --- REWRITTEN & STABLE: Reset Button Logic ---
  // This completely replaces the old reset button logic. It is designed to be
  // atomic, reliable, and work perfectly with the new robust listener in content.js.
  if (btnClearBg) {
    btnClearBg.addEventListener("click", () => {
      // 1. Check if the defaults have been loaded. This is a safety measure.
      if (!DEFAULTS_CACHE || Object.keys(DEFAULTS_CACHE).length === 0) {
        console.error("Aether Popup Error: Cannot reset because defaults are not loaded.");
        return;
      }

      // 2. Define the complete set of background settings to be reset.
      // We pull these directly from the DEFAULTS_CACHE, which is our source of truth.
      const settingsToReset = {
        customBgUrl: DEFAULTS_CACHE.customBgUrl,
        backgroundBlur: DEFAULTS_CACHE.backgroundBlur,
        backgroundScaling: DEFAULTS_CACHE.backgroundScaling,
      };

      // 3. Execute all storage operations.
      // The `sync.set` will trigger the robust listener in content.js, causing the
      // website visuals to update correctly and reliably.
      chrome.storage.sync.set(settingsToReset);

      // The `local.remove` is a critical cleanup step for any user-provided files.
      chrome.storage.local.remove(LOCAL_BG_KEY);

      // 4. Provide immediate visual feedback in the popup UI.
      // While the storage.onChanged listener will also do this, updating the UI
      // manually here makes the reset feel instantaneous to the user.

      // Update the blur slider and its text display.
      blurSlider.value = settingsToReset.backgroundBlur;
      blurValue.textContent = settingsToReset.backgroundBlur;

      // Update the custom dropdowns using their dedicated update functions.
      // This correctly resets the preset to "Default" and scaling to "Cover".
      bgPresetSelect.update("default"); // 'default' corresponds to an empty customBgUrl
      bgScalingSelect.update(settingsToReset.backgroundScaling);

      console.log("Aether Settings: Background and blur have been reset to defaults.");
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      let needsFullUpdate = false;
      for (const key in changes) {
        settingsCache[key] = changes[key].newValue;
        needsFullUpdate = true;
      }
      if (needsFullUpdate) {
        updateUi(settingsCache);
      }
    }

    if (area === "local" && changes.detectedTheme) {
      if (settingsCache.theme === "auto") {
        document.documentElement.classList.toggle("theme-light", changes.detectedTheme.newValue === "light");
      }
    }
  });
});
