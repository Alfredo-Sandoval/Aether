// popup.js - controls settings

const getExtensionUrl = (path) => (chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "");

const sharedUtils = globalThis.AetherShared;
if (!sharedUtils) {
  throw new Error("Aether: shared utilities failed to load in popup context.");
}

const {
  getDefaultSettings,
  SETTING_BOUNDS,
  POPUP_BACKGROUND_PRESET_OPTIONS,
  POPUP_THEME_OPTIONS,
  POPUP_APPEARANCE_OPTIONS,
  POPUP_ACCENT_COLOR_OPTIONS,
  POPUP_BACKGROUND_SCALING_OPTIONS,
  sanitizeSettingsPayload,
  escapeHtml,
  clampBackgroundBlur,
  clampContentWidth,
  getBackgroundPresetUrl,
  resolveBackgroundPresetIdFromUrl,
} = sharedUtils;

const CUSTOM_BG_PRESET_ID = "custom";
const DEFAULT_SETTINGS = getDefaultSettings();
const MIN_BG_BLUR = SETTING_BOUNDS.backgroundBlur.min;
const MAX_BG_BLUR = SETTING_BOUNDS.backgroundBlur.max;
const MIN_CONTENT_WIDTH = SETTING_BOUNDS.contentWidth.min;
const MAX_CONTENT_WIDTH = SETTING_BOUNDS.contentWidth.max;
const getBackgroundPresetResolvedUrl = (presetId) => getBackgroundPresetUrl(presetId, getExtensionUrl);
const resolveBackgroundPresetId = (url) => resolveBackgroundPresetIdFromUrl(url, getExtensionUrl);

const EXTENSION_BASE_URL = getExtensionUrl("");
const normalizeSettings = (rawSettings) =>
  sanitizeSettingsPayload(rawSettings, {
    baseSettings: DEFAULT_SETTINGS,
    extensionBaseUrl: EXTENSION_BASE_URL,
  }).sanitized;

const getMessage = (key, substitutions) => {
  if (chrome?.i18n?.getMessage) {
    const text = chrome.i18n.getMessage(key, substitutions);
    if (text) return text;
  }
  return key;
};

const clampBlur = (raw) => {
  return clampBackgroundBlur(raw, SETTING_BOUNDS.backgroundBlur);
};

document.addEventListener("DOMContentLoaded", () => {
  let settingsCache = { ...DEFAULT_SETTINGS };
  let defaultsCache = { ...DEFAULT_SETTINGS };
  let detectedThemeCache = null;
  let searchableSettings = [];
  let immediatePatchRaf = null;
  let immediatePatchQueue = {};

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
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      const message = getMessage(key);
      if (message) el.setAttribute("aria-label", message);
    });
  };

  applyStaticLocalization();

  const sendRuntimeMessage = (payload) => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  };

  const formatTimestamp = (rawTimestamp) => {
    const numeric = Number(rawTimestamp);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(numeric));
  };

  const queueImmediateTuningPatch = (partialPatch) => {
    if (!partialPatch || typeof partialPatch !== "object") return;
    immediatePatchQueue = { ...immediatePatchQueue, ...partialPatch };
    if (immediatePatchRaf) return;
    immediatePatchRaf = requestAnimationFrame(() => {
      immediatePatchRaf = null;
      const patch = immediatePatchQueue;
      immediatePatchQueue = {};
      if (!chrome?.tabs?.query || !chrome?.tabs?.sendMessage) return;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) return;
        const tabId = tabs?.[0]?.id;
        if (typeof tabId !== "number") return;
        chrome.tabs.sendMessage(tabId, { type: "AETHER_APPLY_TUNING_PATCH", patch }, () => {
          if (!chrome.runtime.lastError) return;
          const message = String(chrome.runtime.lastError.message || "").toLowerCase();
          // Ignore tabs without this content script (e.g. extension pages or non-ChatGPT tabs).
          if (message.includes("receiving end does not exist")) return;
          if (message.includes("could not establish connection")) return;
        });
      });
    });
  };

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
        const isActive = pane.id === targetPaneId;
        pane.classList.toggle("active", isActive);
        pane.hidden = !isActive;
      });
    });
  });
  panes.forEach((pane) => {
    pane.hidden = !pane.classList.contains("active");
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
      if (noResultsMessage) noResultsMessage.hidden = true;

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
        noResultsMessage.setAttribute("role", "status");
        noResultsMessage.setAttribute("aria-live", "polite");
        noResultsMessage.textContent = getMessage("noResults");
        mainContent.appendChild(noResultsMessage);
      }
      noResultsMessage.hidden = false;
    }
  }

  function resetSearchView() {
    tabNav.hidden = false;
    if (noResultsMessage) noResultsMessage.hidden = true;

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
  const contentWidthSlider = document.getElementById("contentWidthSlider");
  const contentWidthValue = document.getElementById("contentWidthValue");
  const saveMyDefaultsBtn = document.getElementById("saveMyDefaults");
  const restoreMyDefaultsBtn = document.getElementById("restoreMyDefaults");
  const exportSettingsBtn = document.getElementById("exportSettings");
  const importSettingsBtn = document.getElementById("importSettings");
  const importSettingsInput = document.getElementById("importSettingsInput");
  const durabilityStatusEl = document.getElementById("durabilityStatus");
  const durabilityNoticeEl = document.getElementById("durabilityNotice");

  const setDurabilityNotice = (messageKey, tone = "success") => {
    if (!durabilityNoticeEl) return;

    if (!messageKey) {
      durabilityNoticeEl.textContent = "";
      durabilityNoticeEl.classList.remove("is-error", "is-success");
      return;
    }

    durabilityNoticeEl.textContent = getMessage(messageKey);
    durabilityNoticeEl.classList.toggle("is-error", tone === "error");
    durabilityNoticeEl.classList.toggle("is-success", tone === "success");
  };

  const renderDurabilityStatus = (status) => {
    if (!durabilityStatusEl) return;
    if (!status || typeof status !== "object") {
      durabilityStatusEl.textContent = getMessage("durabilityStatusUnavailable");
      return;
    }

    const segments = [];
    const userDefaultsStamp = formatTimestamp(status.userDefaultsSavedAt);
    const latestBackupStamp = formatTimestamp(status.latestBackupAt);
    const backupCount = Number.isFinite(Number(status.backupCount)) ? Number(status.backupCount) : 0;

    if (userDefaultsStamp) {
      segments.push(getMessage("durabilityStatusMyDefaults", [userDefaultsStamp]));
    }
    segments.push(getMessage("durabilityStatusBackupCount", [String(backupCount)]));
    if (latestBackupStamp) {
      segments.push(getMessage("durabilityStatusLastBackup", [latestBackupStamp]));
    }

    durabilityStatusEl.textContent = segments.join(" • ");
  };

  const refreshDurabilityStatus = async () => {
    if (!chrome.runtime?.sendMessage) return;

    try {
      const response = await sendRuntimeMessage({ type: "GET_DURABILITY_STATUS" });
      if (!response?.ok) {
        if (durabilityStatusEl) {
          durabilityStatusEl.textContent = getMessage("durabilityStatusUnavailable");
        }
        return;
      }
      renderDurabilityStatus(response.status);
    } catch (error) {
      console.error("Aether Popup Error (Durability Status):", error.message);
      if (durabilityStatusEl) {
        durabilityStatusEl.textContent = getMessage("durabilityStatusUnavailable");
      }
    }
  };

  const withButtonBusy = async (button, work) => {
    if (!button) return;
    button.disabled = true;
    try {
      await work();
    } finally {
      button.disabled = false;
    }
  };

  // --- Rewritten Feature: Blur Slider Logic ---
  // This new logic uses a single 'input' event for real-time updates and efficient saving.
  // It completely replaces any old 'input' or 'change' listeners.
  if (blurSlider && blurValue) {
    let blurSaveTimer = null;
    let pendingBlurValue = null;

    const flushBlurSave = () => {
      if (pendingBlurValue === null) return;
      const valueToSave = pendingBlurValue;
      pendingBlurValue = null;
      chrome.storage.sync.set({ backgroundBlur: valueToSave });
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
      const clampedValue = clampBlur(blurSlider.value);
      if (blurSlider.value !== String(clampedValue)) {
        blurSlider.value = String(clampedValue);
      }

      // 1. Instantly update the 'px' value in the UI.
      blurValue.textContent = String(clampedValue);
      queueImmediateTuningPatch({ backgroundBlur: String(clampedValue) });

      // 2. Throttle storage writes to reduce UI jank.
      scheduleBlurSave(String(clampedValue));
    });

    blurSlider.addEventListener("change", () => {
      const clampedValue = clampBlur(blurSlider.value);
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
      queueImmediateTuningPatch({ backgroundBlur: String(clampedValue) });
    });
  }

  if (contentWidthSlider && contentWidthValue) {
    let widthSaveTimer = null;
    let pendingWidthValue = null;

    const flushWidthSave = () => {
      if (pendingWidthValue === null) return;
      const valueToSave = pendingWidthValue;
      pendingWidthValue = null;
      chrome.storage.sync.set({ contentWidth: valueToSave });
    };

    const scheduleWidthSave = (value) => {
      pendingWidthValue = value;
      if (widthSaveTimer) return;
      widthSaveTimer = setTimeout(() => {
        widthSaveTimer = null;
        flushWidthSave();
      }, 120);
    };

    contentWidthSlider.addEventListener("input", () => {
      const clampedValue = clampContentWidth(contentWidthSlider.value);
      if (contentWidthSlider.value !== String(clampedValue)) {
        contentWidthSlider.value = String(clampedValue);
      }

      contentWidthValue.textContent = String(clampedValue);
      queueImmediateTuningPatch({ contentWidth: String(clampedValue) });
      scheduleWidthSave(String(clampedValue));
    });

    contentWidthSlider.addEventListener("change", () => {
      const clampedValue = clampContentWidth(contentWidthSlider.value);
      if (contentWidthSlider.value !== String(clampedValue)) {
        contentWidthSlider.value = String(clampedValue);
      }
      contentWidthValue.textContent = String(clampedValue);
      if (widthSaveTimer) {
        clearTimeout(widthSaveTimer);
        widthSaveTimer = null;
      }
      pendingWidthValue = String(clampedValue);
      flushWidthSave();
      queueImmediateTuningPatch({ contentWidth: String(clampedValue) });
    });
  }

  // --- Reusable Custom Select Functionality ---
  function createCustomSelect(containerId, options, storageKey, onPresetChange, config = {}) {
    const container = document.getElementById(containerId);
    if (!container) return { update: () => {} };
    const trigger = container.querySelector(".select-trigger");
    const label = container.querySelector(".select-label");
    const optionsContainer = container.querySelector(".select-options");
    if (!trigger || !label || !optionsContainer) return { update: () => {} };

    const dotInTrigger = trigger.querySelector(".color-dot");
    const { manualStorage = false, mapValueToOption, formatLabel } = config;
    let currentOptionValue = null;
    const listboxId = `${containerId}-listbox`;
    optionsContainer.id = optionsContainer.id || listboxId;
    trigger.setAttribute("aria-controls", optionsContainer.id);
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    optionsContainer.dataset.state = "closed";
    optionsContainer.hidden = true;

    const getRenderedOptions = () => Array.from(optionsContainer.querySelectorAll(".select-option"));

    const setOptionsOpenState = (isOpen) => {
      container.classList.toggle("is-open", isOpen);
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      optionsContainer.dataset.state = isOpen ? "open" : "closed";
      optionsContainer.hidden = !isOpen;
    };

    const closeSelect = (restoreFocus = false) => {
      setOptionsOpenState(false);
      optionsContainer.removeAttribute("aria-activedescendant");
      if (restoreFocus) trigger.focus();
    };

    const focusOptionAt = (index) => {
      const rendered = getRenderedOptions();
      if (!rendered.length) return;
      const clamped = Math.max(0, Math.min(rendered.length - 1, index));
      rendered.forEach((optionEl, optionIndex) => {
        optionEl.setAttribute("tabindex", optionIndex === clamped ? "0" : "-1");
      });
      const targetOption = rendered[clamped];
      optionsContainer.setAttribute("aria-activedescendant", targetOption.id);
      targetOption.focus();
    };

    const openSelect = (focusTarget = "selected") => {
      closeAllSelects(container);
      setOptionsOpenState(true);

      const rendered = getRenderedOptions();
      if (!rendered.length) return;

      if (focusTarget === "first") {
        focusOptionAt(0);
        return;
      }
      if (focusTarget === "last") {
        focusOptionAt(rendered.length - 1);
        return;
      }

      const selectedIndex = rendered.findIndex((optionEl) => optionEl.getAttribute("aria-selected") === "true");
      focusOptionAt(selectedIndex >= 0 ? selectedIndex : 0);
    };

    const selectOptionElement = (optionEl) => {
      if (!optionEl) return;
      const newValue = optionEl.dataset.value;
      updateSelectorState(newValue);
      if (!manualStorage && storageKey) {
        chrome.storage.sync.set({ [storageKey]: newValue });
      }
      if (onPresetChange) {
        onPresetChange(newValue);
      }
    };

    // Event delegation: single listener on the container handles all option clicks
    optionsContainer.addEventListener("click", (e) => {
      const optionEl = e.target.closest(".select-option");
      if (!optionEl) return;
      selectOptionElement(optionEl);
      closeSelect();
    });

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
        .map((option, index) => {
          const colorDotHtml = option.color
            ? `<span class="color-dot" style="background-color: ${escapeHtml(option.color)}; display: block;"></span>`
            : "";
          const optionValue = escapeHtml(String(option.value));
          const optionLabel = escapeHtml(resolveLabel(option, option.value));
          const isSelected = option.value === selectedValue;
          const optionId = `${containerId}-option-${index}`;
          return `
            <div class="select-option" id="${optionId}" role="option" tabindex="${
              isSelected ? "0" : "-1"
            }" data-value="${optionValue}" aria-selected="${isSelected ? "true" : "false"}">
              ${colorDotHtml}
              <span class="option-label">${optionLabel}</span>
            </div>
            `;
        })
        .join("");

      const rendered = getRenderedOptions();
      if (rendered.length && !rendered.some((optionEl) => optionEl.getAttribute("tabindex") === "0")) {
        rendered[0].setAttribute("tabindex", "0");
      }
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
      if (!isExpanded) {
        openSelect("selected");
      } else {
        closeSelect();
      }
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openSelect("first");
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        openSelect("last");
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const isExpanded = trigger.getAttribute("aria-expanded") === "true";
        if (isExpanded) {
          closeSelect();
        } else {
          openSelect("selected");
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeSelect(true);
      }
    });

    optionsContainer.addEventListener("keydown", (e) => {
      const rendered = getRenderedOptions();
      if (!rendered.length) return;

      let activeIndex = rendered.findIndex((optionEl) => optionEl === document.activeElement);
      if (activeIndex < 0) {
        activeIndex = rendered.findIndex((optionEl) => optionEl.getAttribute("aria-selected") === "true");
      }
      if (activeIndex < 0) activeIndex = 0;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusOptionAt(Math.min(rendered.length - 1, activeIndex + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        focusOptionAt(Math.max(0, activeIndex - 1));
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        focusOptionAt(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        focusOptionAt(rendered.length - 1);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectOptionElement(rendered[activeIndex]);
        closeSelect(true);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeSelect(true);
        return;
      }
      if (e.key === "Tab") {
        closeSelect();
      }
    });

    return { update: updateSelectorState };
  }

  function closeAllSelects(exceptContainer = null) {
    document.querySelectorAll(".custom-select").forEach((sel) => {
      if (exceptContainer && sel === exceptContainer) return;
      sel.classList.remove("is-open");
      const trigger = sel.querySelector(".select-trigger");
      const optionsContainer = sel.querySelector(".select-options");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      if (optionsContainer) {
        optionsContainer.dataset.state = "closed";
        optionsContainer.hidden = true;
        optionsContainer.removeAttribute("aria-activedescendant");
      }
    });
  }
  document.addEventListener("click", closeAllSelects);

  // --- Initialize Custom Selects ---
  const bgPresetSelect = createCustomSelect(
    "bgPreset",
    POPUP_BACKGROUND_PRESET_OPTIONS,
    "customBgUrl",
    (value) => {
      const newUrl = getBackgroundPresetResolvedUrl(value);
      queueImmediateTuningPatch({ customBgUrl: newUrl });
      chrome.storage.sync.set({ customBgUrl: newUrl });
    },
    { manualStorage: true }
  );

  const bgScalingSelect = createCustomSelect(
    "bgScalingSelector",
    POPUP_BACKGROUND_SCALING_OPTIONS,
    "backgroundScaling",
    (value) => {
      queueImmediateTuningPatch({ backgroundScaling: value });
    }
  );

  const themeSelect = createCustomSelect("themeSelector", POPUP_THEME_OPTIONS, "theme");

  const accentColorSelect = createCustomSelect("accentColorSelector", POPUP_ACCENT_COLOR_OPTIONS, "accentColor");
  const POPUP_ACCENT_SOLID = {
    none: "#2563eb",
    pink: "#f093fb",
    purple: "#667eea",
    blue: "#4facfe",
    primary: "#667eea",
  };

  const applyPopupAccent = (choice) => {
    const accent = POPUP_ACCENT_SOLID[choice] || POPUP_ACCENT_SOLID.none;
    document.documentElement.style.setProperty("--primary-accent", accent);
  };

  const appearanceSelect = createCustomSelect("appearanceSelector", POPUP_APPEARANCE_OPTIONS, "appearance");
  const resolveIsLightTheme = (themeChoice) =>
    themeChoice === "light" || (themeChoice === "auto" && detectedThemeCache === "light");
  const getSafeThemeChoice = (themeChoice) =>
    themeChoice === "dark" ? "dark" : themeChoice === "light" ? "light" : "auto";

  function updateUi(rawSettings) {
    const nextSettings = normalizeSettings(rawSettings);
    settingsCache = nextSettings;
    const isLightTheme = resolveIsLightTheme(getSafeThemeChoice(nextSettings.theme));
    document.documentElement.classList.toggle("theme-light", isLightTheme);

    TOGGLE_CONFIG.forEach(({ id, key }) => {
      const element = document.getElementById(id);
      if (element) {
        element.checked = !!nextSettings[key];
      }
    });

    const clampedBlur = clampBlur(nextSettings.backgroundBlur);
    blurSlider.min = String(MIN_BG_BLUR);
    blurSlider.max = String(MAX_BG_BLUR);
    blurSlider.value = String(clampedBlur);
    blurValue.textContent = String(clampedBlur);

    const clampedContentWidth = clampContentWidth(nextSettings.contentWidth, SETTING_BOUNDS.contentWidth);
    if (contentWidthSlider && contentWidthValue) {
      contentWidthSlider.min = String(MIN_CONTENT_WIDTH);
      contentWidthSlider.max = String(MAX_CONTENT_WIDTH);
      contentWidthSlider.value = String(clampedContentWidth);
      contentWidthValue.textContent = String(clampedContentWidth);
    }

    bgScalingSelect.update(nextSettings.backgroundScaling);
    themeSelect.update(nextSettings.theme);
    appearanceSelect.update(nextSettings.appearance || DEFAULT_SETTINGS.appearance);
    const accentChoice = nextSettings.accentColor || DEFAULT_SETTINGS.accentColor;
    accentColorSelect.update(accentChoice);
    applyPopupAccent(accentChoice);

    const presetId = resolveBackgroundPresetId(nextSettings.customBgUrl);
    bgPresetSelect.update(presetId || CUSTOM_BG_PRESET_ID);
  }

  // --- Initial Load (single call for zero-latency popup) ---
  if (chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS_FULL" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.error("Aether Popup Error (Initial Load):", chrome.runtime.lastError?.message || "No response");
        const errorNode = document.createElement("div");
        errorNode.style.padding = "20px";
        errorNode.style.textAlign = "center";
        errorNode.textContent = getMessage("errorLoadingSettings");
        document.body.textContent = "";
        document.body.appendChild(errorNode);
        return;
      }

      defaultsCache = normalizeSettings(response.defaults || DEFAULT_SETTINGS);
      detectedThemeCache = typeof response.local?.detectedTheme === "string" ? response.local.detectedTheme : null;
      updateUi(response.settings || defaultsCache);
      buildSearchableData();
      void refreshDurabilityStatus();
    });
  }

  // --- REWRITTEN & STABLE: Reset Button Logic ---
  // This completely replaces the old reset button logic. It is designed to be
  // atomic, reliable, and work perfectly with the new robust listener in content.js.
  if (btnClearBg) {
    btnClearBg.addEventListener("click", () => {
      // 1. Check if the defaults have been loaded. This is a safety measure.
      if (!defaultsCache || Object.keys(defaultsCache).length === 0) {
        console.error("Aether Popup Error: Cannot reset because defaults are not loaded.");
        return;
      }

      // 2. Define the complete set of background settings to be reset.
      // We pull these directly from the defaults cache, which is our source of truth.
      const settingsToReset = {
        customBgUrl: defaultsCache.customBgUrl,
        backgroundBlur: defaultsCache.backgroundBlur,
        contentWidth: defaultsCache.contentWidth,
        backgroundScaling: defaultsCache.backgroundScaling,
      };

      queueImmediateTuningPatch(settingsToReset);

      // 3. Execute all storage operations.
      // The `sync.set` will trigger the robust listener in content.js, causing the
      // website visuals to update correctly and reliably.
      chrome.storage.sync.set(settingsToReset);

      // 4. Provide immediate visual feedback in the popup UI.
      // While the storage.onChanged listener will also do this, updating the UI
      // manually here makes the reset feel instantaneous to the user.

      // Update the blur slider and its text display.
      blurSlider.value = settingsToReset.backgroundBlur;
      blurValue.textContent = settingsToReset.backgroundBlur;
      if (contentWidthSlider && contentWidthValue) {
        contentWidthSlider.value = settingsToReset.contentWidth;
        contentWidthValue.textContent = settingsToReset.contentWidth;
      }

      // Update the custom dropdowns using their dedicated update functions.
      // This keeps the dropdown aligned with the actual canonical default preset.
      bgPresetSelect.update(resolveBackgroundPresetId(settingsToReset.customBgUrl) || CUSTOM_BG_PRESET_ID);
      bgScalingSelect.update(settingsToReset.backgroundScaling);
      settingsCache = { ...settingsCache, ...settingsToReset };

      console.log("Aether Settings: Background and blur have been reset to defaults.");
    });
  }

  const getRestoreNoticeForError = (errorCode) => {
    if (errorCode === "missing_user_defaults") return "noticeRestoreDefaultsMissing";
    return "noticeRestoreDefaultsFailed";
  };

  const getImportNoticeForError = (errorCode) => {
    if (errorCode === "invalid_import_payload") return "noticeImportInvalidFile";
    return "noticeImportFailed";
  };

  if (saveMyDefaultsBtn) {
    saveMyDefaultsBtn.addEventListener("click", async () => {
      setDurabilityNotice("");
      await withButtonBusy(saveMyDefaultsBtn, async () => {
        try {
          const response = await sendRuntimeMessage({ type: "SAVE_USER_DEFAULTS" });
          if (!response?.ok) {
            setDurabilityNotice("noticeSaveDefaultsFailed", "error");
            return;
          }
          setDurabilityNotice("noticeSaveDefaultsSuccess");
          await refreshDurabilityStatus();
        } catch (error) {
          console.error("Aether Popup Error (Save Defaults):", error.message);
          setDurabilityNotice("noticeSaveDefaultsFailed", "error");
        }
      });
    });
  }

  if (restoreMyDefaultsBtn) {
    restoreMyDefaultsBtn.addEventListener("click", async () => {
      setDurabilityNotice("");
      await withButtonBusy(restoreMyDefaultsBtn, async () => {
        try {
          const response = await sendRuntimeMessage({ type: "RESTORE_USER_DEFAULTS" });
          if (!response?.ok) {
            setDurabilityNotice(getRestoreNoticeForError(response?.error), "error");
            return;
          }

          if (response.settings) {
            updateUi(response.settings);
            queueImmediateTuningPatch(response.settings);
          }

          setDurabilityNotice("noticeRestoreDefaultsSuccess");
          await refreshDurabilityStatus();
        } catch (error) {
          console.error("Aether Popup Error (Restore Defaults):", error.message);
          setDurabilityNotice("noticeRestoreDefaultsFailed", "error");
        }
      });
    });
  }

  if (exportSettingsBtn) {
    exportSettingsBtn.addEventListener("click", async () => {
      setDurabilityNotice("");
      await withButtonBusy(exportSettingsBtn, async () => {
        try {
          const response = await sendRuntimeMessage({ type: "EXPORT_SETTINGS" });
          if (!response?.ok || !response.payload) {
            setDurabilityNotice("noticeExportFailed", "error");
            return;
          }

          const payload = JSON.stringify(response.payload, null, 2);
          const blob = new Blob([payload], { type: "application/json" });
          const objectUrl = URL.createObjectURL(blob);
          const downloadName = `aether-settings-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

          const link = document.createElement("a");
          link.href = objectUrl;
          link.download = downloadName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(objectUrl);

          setDurabilityNotice("noticeExportSuccess");
        } catch (error) {
          console.error("Aether Popup Error (Export Settings):", error.message);
          setDurabilityNotice("noticeExportFailed", "error");
        }
      });
    });
  }

  if (importSettingsBtn && importSettingsInput) {
    importSettingsBtn.addEventListener("click", () => {
      importSettingsInput.click();
    });

    importSettingsInput.addEventListener("change", async () => {
      const file = importSettingsInput.files?.[0];
      importSettingsInput.value = "";
      if (!file) return;

      setDurabilityNotice("");
      await withButtonBusy(importSettingsBtn, async () => {
        let payload;
        try {
          const rawText = await file.text();
          payload = JSON.parse(rawText);
        } catch (error) {
          console.error("Aether Popup Error (Parse Import File):", error);
          setDurabilityNotice("noticeImportInvalidFile", "error");
          return;
        }

        try {
          const response = await sendRuntimeMessage({ type: "IMPORT_SETTINGS", payload });
          if (!response?.ok) {
            setDurabilityNotice(getImportNoticeForError(response?.error), "error");
            return;
          }

          if (response.settings) {
            updateUi(response.settings);
            queueImmediateTuningPatch(response.settings);
          }

          setDurabilityNotice("noticeImportSuccess");
          await refreshDurabilityStatus();
        } catch (error) {
          console.error("Aether Popup Error (Import Settings):", error.message);
          setDurabilityNotice("noticeImportFailed", "error");
        }
      });
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
      detectedThemeCache = changes.detectedTheme.newValue || null;
      if (settingsCache.theme === "auto") {
        document.documentElement.classList.toggle("theme-light", detectedThemeCache === "light");
      }
    }
  });
});
