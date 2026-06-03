const getExtensionUrl = (path) => (chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "");

const sharedUtils = globalThis.AetherShared;
if (!sharedUtils) {
  throw new Error("Aether: shared utilities failed to load in popup context.");
}
const runtimeClient = globalThis.AetherRuntimeClient;
if (!runtimeClient) {
  throw new Error("Aether: runtime client failed to load in popup context.");
}

const {
  getDefaultSettings,
  SETTING_BOUNDS,
  POPUP_ACCENT_COLOR_OPTIONS,
  POPUP_BACKGROUND_SCALING_OPTIONS,
  sanitizeSettingsPayload,
  escapeHtml,
  clampBackgroundBlur,
  clampContentWidth,
  getBackgroundPresets,
  getBackgroundPresetUrl,
  getBackgroundPresetDefaultBlur,
  resolveBackgroundPresetIdFromUrl,
} = sharedUtils;
const { sendRuntimeMessage, updateSettings } = runtimeClient;

const DEFAULT_SETTINGS = getDefaultSettings();
const MIN_BG_BLUR = SETTING_BOUNDS.backgroundBlur.min;
const MAX_BG_BLUR = SETTING_BOUNDS.backgroundBlur.max;
const MIN_CONTENT_WIDTH = SETTING_BOUNDS.contentWidth.min;
const MAX_CONTENT_WIDTH = SETTING_BOUNDS.contentWidth.max;
const getBackgroundPresetResolvedUrl = (presetId) => getBackgroundPresetUrl(presetId, getExtensionUrl);
const getBackgroundPresetResolvedBlur = (presetId) => getBackgroundPresetDefaultBlur(presetId, getExtensionUrl);
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
  let searchableSettings = [];
  let immediatePatchRaf = null;
  let immediatePatchQueue = {};
  let hasLoadedInitialSettings = false;

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

  const versionBadge = document.getElementById("versionBadge");
  if (versionBadge && chrome?.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest.version) {
      versionBadge.textContent = `v${manifest.version}`;
    }
  }

  const persistSettingsPatch = (patch, context) => {
    void updateSettings(patch, { context }).catch((error) => {
      console.error(`Aether Popup Error (${context}):`, error.message);
    });
  };

  const isDisconnectedActiveTabMessage = (message) => {
    const text = String(message || "").toLowerCase();
    return (
      text.includes("receiving end does not exist") ||
      text.includes("could not establish connection") ||
      text.includes("message port closed")
    );
  };

  const getActiveTabId = () => {
    return new Promise((resolve, reject) => {
      if (!chrome?.tabs?.query) {
        reject(new Error("Active tab access is unavailable."));
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const tabId = tabs?.[0]?.id;
        if (typeof tabId !== "number") {
          reject(new Error("No active tab is available."));
          return;
        }
        resolve(tabId);
      });
    });
  };

  const sendMessageToActiveTab = async (payload, options = {}) => {
    const { ignoreDisconnected = false } = options;
    const tabId = await getActiveTabId();
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, payload, (response) => {
        if (!chrome.runtime.lastError) {
          resolve(response);
          return;
        }
        const message = chrome.runtime.lastError.message;
        if (ignoreDisconnected && isDisconnectedActiveTabMessage(message)) {
          resolve(null);
          return;
        }
        reject(new Error(message));
      });
    });
  };

  const downloadJsonPayload = (payload, filePrefix) => {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const downloadName = `${filePrefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
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
      if (!chrome?.tabs?.sendMessage) return;
      void sendMessageToActiveTab({ type: "AETHER_APPLY_TUNING_PATCH", patch }, { ignoreDisconnected: true }).catch(
        (error) => {
          console.error("Aether Popup Error (Active Tab Patch):", error.message);
        }
      );
    });
  };

  const tabs = document.querySelectorAll(".tab-link");
  const panes = document.querySelectorAll(".tab-pane");
  const mainContent = document.querySelector(".tab-content");
  const tabNav = document.querySelector(".tab-nav");
  const loadErrorBanner = document.getElementById("loadErrorBanner");
  const loadErrorMessage = document.getElementById("loadErrorMessage");
  const retryLoadBtn = document.getElementById("retryLoadBtn");
  const getVisibleTabs = () => Array.from(tabs).filter((tab) => !tab.classList.contains("is-hidden"));

  const setLoadErrorState = (messageKey = "") => {
    if (!loadErrorBanner || !loadErrorMessage) return;
    if (!messageKey) {
      loadErrorBanner.hidden = true;
      return;
    }
    loadErrorMessage.textContent = getMessage(messageKey);
    loadErrorBanner.hidden = false;
  };

  const setUiInteractive = (isInteractive) => {
    document.body.classList.toggle("ui-locked", !isInteractive);
    document.querySelectorAll("button, input").forEach((element) => {
      if (element.id === "retryLoadBtn") {
        element.disabled = false;
        return;
      }
      element.disabled = !isInteractive;
    });
  };

  const clearActiveTabState = () => {
    tabs.forEach((tab) => {
      tab.classList.remove("active");
      tab.setAttribute("aria-selected", "false");
      tab.setAttribute("tabindex", "-1");
    });

    panes.forEach((pane) => {
      pane.classList.remove("active");
      pane.hidden = true;
    });
  };

  const setActiveTab = (nextTab, options = {}) => {
    if (!nextTab) {
      clearActiveTabState();
      return;
    }
    const { focus = false } = options;
    const targetPaneId = nextTab.dataset.tab;

    tabs.forEach((tab) => {
      const isActive = tab === nextTab;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    panes.forEach((pane) => {
      const isActive = pane.id === targetPaneId;
      pane.classList.toggle("active", isActive);
      pane.hidden = !isActive;
    });

    if (focus) nextTab.focus();
  };

  const moveTabSelection = (direction) => {
    const visibleTabs = getVisibleTabs();
    if (!visibleTabs.length) return;
    const currentIndex = visibleTabs.findIndex((tab) => tab.classList.contains("active"));
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (startIndex + direction + visibleTabs.length) % visibleTabs.length;
    setActiveTab(visibleTabs[nextIndex], { focus: true });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab);
    });
  });

  document.addEventListener("keydown", (event) => {
    const currentTab = document.activeElement?.closest?.(".tab-link");
    if (!currentTab || (tabNav && !tabNav.contains(currentTab))) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTabSelection(1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTabSelection(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveTab(getVisibleTabs()[0], { focus: true });
      return;
    }
    if (event.key === "End") {
      const visibleTabs = getVisibleTabs();
      event.preventDefault();
      setActiveTab(visibleTabs[visibleTabs.length - 1] || null, { focus: true });
    }
  });
  setActiveTab(document.querySelector(".tab-link.active") || getVisibleTabs()[0] || null);

  const searchInput = document.getElementById("settingsSearch");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const searchStatus = document.getElementById("searchStatus");
  let noResultsMessage = null;

  const getLocalizedAttrText = (root, attrName) => {
    return Array.from(root.querySelectorAll(`[${attrName}]`))
      .map((element) => getMessage(element.getAttribute(attrName)))
      .filter(Boolean);
  };

  const getSectionGroups = (pane) => {
    const groups = [];
    let currentGroup = null;

    Array.from(pane.children).forEach((child) => {
      if (child.classList.contains("section-header")) {
        currentGroup = { header: child, rows: [], extras: [] };
        groups.push(currentGroup);
        return;
      }

      if (!currentGroup) {
        currentGroup = { header: null, rows: [], extras: [] };
        groups.push(currentGroup);
      }

      if (child.classList.contains("row")) {
        currentGroup.rows.push(child);
        return;
      }

      if (child.classList.contains("status-note")) {
        currentGroup.extras.push(child);
      }
    });

    return groups;
  };

  const syncSearchSectionVisibility = (isSearching) => {
    panes.forEach((pane) => {
      getSectionGroups(pane).forEach((group) => {
        const hasVisibleRows = group.rows.some((row) => !row.classList.contains("is-hidden"));
        if (group.header) group.header.classList.toggle("is-hidden", isSearching && !hasVisibleRows);
        group.extras.forEach((extra) => extra.classList.toggle("is-hidden", isSearching && !hasVisibleRows));
      });
    });
  };

  const setSearchStatus = (messageKey = "", substitutions = []) => {
    if (!searchStatus) return;
    if (!messageKey) {
      searchStatus.textContent = "";
      searchStatus.hidden = true;
      return;
    }
    searchStatus.textContent = getMessage(messageKey, substitutions);
    searchStatus.hidden = false;
  };

  function buildSearchableData() {
    searchableSettings = [];
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      const tabId = pane.id;
      const tabTitle = document.querySelector(`.tab-link[data-tab="${tabId}"]`)?.textContent || "";
      pane.querySelectorAll(".row").forEach((row) => {
        const keywords = [
          tabTitle,
          row.getAttribute("data-search") || "",
          row.textContent || "",
          ...getLocalizedAttrText(row, "data-i18n"),
          ...getLocalizedAttrText(row, "data-i18n-title"),
        ]
          .join(" ")
          .toLowerCase()
          .trim();

        searchableSettings.push({
          element: row,
          tab: tabId,
          keywords,
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
    syncSearchSectionVisibility(true);

    if (matchCount > 0) {
      tabNav.hidden = false;
      if (noResultsMessage) noResultsMessage.hidden = true;
      setSearchStatus("searchStatusMatches", [String(matchCount)]);

      tabs.forEach((tab) => {
        const tabId = tab.dataset.tab;
        const hasMatch = matchedTabs.has(tabId);
        tab.classList.toggle("is-hidden", !hasMatch);
      });

      const firstMatchedTab = document.querySelector(".tab-link:not(.is-hidden)");
      if (firstMatchedTab) {
        setActiveTab(firstMatchedTab);
      }
    } else {
      tabNav.hidden = true;
      setActiveTab(null);
      setSearchStatus("searchStatusNoResults", [query]);
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
    setSearchStatus("");

    searchableSettings.forEach((setting) => setting.element.classList.remove("is-hidden"));
    syncSearchSectionVisibility(false);
    tabs.forEach((tab) => tab.classList.remove("is-hidden"));

    const activeTab = document.querySelector(".tab-link.active");
    if (!activeTab || activeTab.classList.contains("is-hidden")) {
      setActiveTab(getVisibleTabs()[0] || null);
    } else {
      setActiveTab(activeTab);
    }
  }

  searchInput.addEventListener("input", handleSearch);
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    handleSearch();
    searchInput.focus();
  });
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

  TOGGLE_CONFIG.forEach(({ id, key }) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("change", () => {
        persistSettingsPatch({ [key]: element.checked }, `Toggle ${key}`);
      });
    }
  });

  const btnClearBg = document.getElementById("clearBg");
  const blurSlider = document.getElementById("blurSlider");
  const blurValue = document.getElementById("blurValue");
  const contentWidthSlider = document.getElementById("contentWidthSlider");
  const contentWidthValue = document.getElementById("contentWidthValue");

  // Keep the visible read-out and the slider's spoken value (aria-valuetext) in sync, including units.
  const setBlurDisplay = (value) => {
    if (blurValue) blurValue.textContent = String(value);
    if (blurSlider) blurSlider.setAttribute("aria-valuetext", `${value} px`);
  };
  const setContentWidthDisplay = (value) => {
    if (contentWidthValue) contentWidthValue.textContent = String(value);
    if (contentWidthSlider) contentWidthSlider.setAttribute("aria-valuetext", `${value}%`);
  };
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

  const applyInitialSettingsResponse = (response) => {
    defaultsCache = normalizeSettings(response.defaults || DEFAULT_SETTINGS);
    updateUi(response.settings || defaultsCache);
    buildSearchableData();
    hasLoadedInitialSettings = true;
    setLoadErrorState("");
    setUiInteractive(true);
    void refreshDurabilityStatus();
  };

  const hasAuthoritativeInitialSettings = (response) => {
    const source = response?.status?.source;
    return typeof source !== "string" || !source.startsWith("ephemeral-defaults:");
  };

  const loadInitialData = async () => {
    setUiInteractive(false);
    setLoadErrorState("");
    try {
      const response = await sendRuntimeMessage({ type: "GET_SETTINGS_FULL" });
      if (!response) {
        throw new Error("No response");
      }
      if (!hasAuthoritativeInitialSettings(response)) {
        throw new Error(`Settings hydration was not authoritative (${response.status?.source || "unknown"})`);
      }
      applyInitialSettingsResponse(response);
    } catch (error) {
      console.error("Aether Popup Error (Initial Load):", error.message);
      hasLoadedInitialSettings = false;
      setUiInteractive(false);
      setLoadErrorState("errorLoadingSettings");
    }
  };

  if (retryLoadBtn) {
    retryLoadBtn.addEventListener("click", async () => {
      await withButtonBusy(retryLoadBtn, loadInitialData);
    });
  }

  if (chrome.runtime?.sendMessage) {
    setUiInteractive(false);
    void loadInitialData();
  }

  // Sliders patch the active tab immediately, then throttle durable storage writes through the background worker.
  if (blurSlider && blurValue) {
    let blurSaveTimer = null;
    let pendingBlurValue = null;

    const flushBlurSave = () => {
      if (pendingBlurValue === null) return;
      const valueToSave = pendingBlurValue;
      pendingBlurValue = null;
      persistSettingsPatch({ backgroundBlur: valueToSave }, "Background Blur");
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

      setBlurDisplay(String(clampedValue));
      queueImmediateTuningPatch({ backgroundBlur: String(clampedValue) });

      scheduleBlurSave(String(clampedValue));
    });

    blurSlider.addEventListener("change", () => {
      const clampedValue = clampBlur(blurSlider.value);
      if (blurSlider.value !== String(clampedValue)) {
        blurSlider.value = String(clampedValue);
      }
      setBlurDisplay(String(clampedValue));
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
      persistSettingsPatch({ contentWidth: valueToSave }, "Content Width");
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

      setContentWidthDisplay(String(clampedValue));
      queueImmediateTuningPatch({ contentWidth: String(clampedValue) });
      scheduleWidthSave(String(clampedValue));
    });

    contentWidthSlider.addEventListener("change", () => {
      const clampedValue = clampContentWidth(contentWidthSlider.value);
      if (contentWidthSlider.value !== String(clampedValue)) {
        contentWidthSlider.value = String(clampedValue);
      }
      setContentWidthDisplay(String(clampedValue));
      if (widthSaveTimer) {
        clearTimeout(widthSaveTimer);
        widthSaveTimer = null;
      }
      pendingWidthValue = String(clampedValue);
      flushWidthSave();
      queueImmediateTuningPatch({ contentWidth: String(clampedValue) });
    });
  }

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
        persistSettingsPatch({ [storageKey]: newValue }, `Selector ${storageKey}`);
      }
      if (onPresetChange) {
        onPresetChange(newValue);
      }
    };

    // Options are re-rendered on state changes, so delegate clicks from the stable listbox node.
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

  // Visual thumbnail grid for background presets (replaces the old text dropdown).
  function createBackgroundGrid(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return { update() {} };

    const presets = getBackgroundPresets(getExtensionUrl);
    let activeId = "default";

    const applyPreset = (presetId) => {
      const newUrl = getBackgroundPresetResolvedUrl(presetId);
      const newBlur = String(clampBlur(getBackgroundPresetResolvedBlur(presetId)));
      const patch = { customBgUrl: newUrl, backgroundBlur: newBlur };
      settingsCache = { ...settingsCache, ...patch };
      blurSlider.value = newBlur;
      setBlurDisplay(newBlur);
      queueImmediateTuningPatch(patch);
      persistSettingsPatch(patch, "Background Preset");
      update(presetId);
    };

    const tiles = presets.map((preset) => {
      const label = getMessage(preset.labelKey) || preset.id;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "bg-preset-tile";
      tile.dataset.presetId = preset.id;
      tile.setAttribute("role", "radio");
      tile.setAttribute("aria-checked", "false");
      tile.tabIndex = -1;
      tile.title = label;
      if (preset.id === "default") {
        tile.classList.add("is-default");
      } else if (preset.isSpecial) {
        tile.classList.add("is-animated");
      } else if (preset.url) {
        tile.style.setProperty("--bg-preset-thumb", `url("${preset.url}")`);
      }
      tile.innerHTML = `<span class="bg-preset-label">${escapeHtml(label)}</span>`;
      tile.addEventListener("click", () => applyPreset(preset.id));
      container.appendChild(tile);
      return tile;
    });

    const focusAndSelect = (index) => {
      const tile = tiles[index];
      if (!tile) return;
      tile.focus();
      applyPreset(tile.dataset.presetId);
    };

    container.addEventListener("keydown", (event) => {
      const navKeys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
      if (!navKeys.includes(event.key)) return;
      event.preventDefault();
      const currentIndex = Math.max(
        0,
        tiles.findIndex((tile) => tile.dataset.presetId === activeId)
      );
      if (event.key === "Home") return focusAndSelect(0);
      if (event.key === "End") return focusAndSelect(tiles.length - 1);
      const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      focusAndSelect((currentIndex + delta + tiles.length) % tiles.length);
    });

    function update(presetId) {
      activeId = tiles.some((tile) => tile.dataset.presetId === presetId) ? presetId : "default";
      let hasTabbable = false;
      tiles.forEach((tile) => {
        const isActive = tile.dataset.presetId === activeId;
        tile.classList.toggle("active", isActive);
        tile.setAttribute("aria-checked", String(isActive));
        tile.tabIndex = isActive ? 0 : -1;
        if (isActive) {
          hasTabbable = true;
          if (typeof tile.scrollIntoView === "function") {
            tile.scrollIntoView({ block: "nearest" });
          }
        }
      });
      if (!hasTabbable && tiles[0]) tiles[0].tabIndex = 0;
    }

    return { update };
  }

  const bgPresetSelect = createBackgroundGrid("bgPresetGrid");

  const bgScalingSelect = createCustomSelect(
    "bgScalingSelector",
    POPUP_BACKGROUND_SCALING_OPTIONS,
    "backgroundScaling",
    (value) => {
      queueImmediateTuningPatch({ backgroundScaling: value });
    }
  );

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

  function updateUi(rawSettings) {
    const nextSettings = normalizeSettings(rawSettings);
    settingsCache = nextSettings;

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
    setBlurDisplay(String(clampedBlur));

    const clampedContentWidth = clampContentWidth(nextSettings.contentWidth, SETTING_BOUNDS.contentWidth);
    if (contentWidthSlider && contentWidthValue) {
      contentWidthSlider.min = String(MIN_CONTENT_WIDTH);
      contentWidthSlider.max = String(MAX_CONTENT_WIDTH);
      contentWidthSlider.value = String(clampedContentWidth);
      setContentWidthDisplay(String(clampedContentWidth));
    }

    bgScalingSelect.update(nextSettings.backgroundScaling);
    const accentChoice = nextSettings.accentColor || DEFAULT_SETTINGS.accentColor;
    accentColorSelect.update(accentChoice);
    applyPopupAccent(accentChoice);

    const presetId = resolveBackgroundPresetId(nextSettings.customBgUrl);
    bgPresetSelect.update(presetId || "default");
  }

  // Reset the background controls as one coherent patch so content and popup state cannot drift.
  if (btnClearBg) {
    btnClearBg.addEventListener("click", () => {
      if (!defaultsCache || Object.keys(defaultsCache).length === 0) {
        console.error("Aether Popup Error: Cannot reset because defaults are not loaded.");
        return;
      }

      const settingsToReset = {
        customBgUrl: defaultsCache.customBgUrl,
        backgroundBlur: defaultsCache.backgroundBlur,
        contentWidth: defaultsCache.contentWidth,
        backgroundScaling: defaultsCache.backgroundScaling,
      };

      queueImmediateTuningPatch(settingsToReset);

      persistSettingsPatch(settingsToReset, "Reset Background");

      blurSlider.value = settingsToReset.backgroundBlur;
      setBlurDisplay(settingsToReset.backgroundBlur);
      if (contentWidthSlider && contentWidthValue) {
        contentWidthSlider.value = settingsToReset.contentWidth;
        setContentWidthDisplay(settingsToReset.contentWidth);
      }

      bgPresetSelect.update(resolveBackgroundPresetId(settingsToReset.customBgUrl) || "default");
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

          downloadJsonPayload(response.payload, "aether-settings");
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

  const KNOWN_SETTINGS_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (!hasLoadedInitialSettings) return;
    if (area === "sync") {
      let needsFullUpdate = false;
      for (const key in changes) {
        if (!KNOWN_SETTINGS_KEYS.has(key)) continue;
        settingsCache[key] = changes[key].newValue === undefined ? DEFAULT_SETTINGS[key] : changes[key].newValue;
        needsFullUpdate = true;
      }
      if (needsFullUpdate) {
        updateUi(settingsCache);
      }
    }
  });
});
