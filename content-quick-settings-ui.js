// content-quick-settings-ui.js - Quick Settings controller for content script
(() => {
  const createQuickSettingsController = (options) => {
    if (!options || typeof options !== "object") {
      throw new Error("Aether: createQuickSettingsController requires an options object.");
    }

    const {
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
      getSettings,
      getMessage,
      t,
      escapeHtml,
      sanitizeBackgroundUrl,
      getClampedBlurValue,
      getClampedContentWidthValue,
      applyCustomStyles,
      updateBackgroundImage,
    } = options;

    if (typeof getSettings !== "function") {
      throw new Error("Aether: quick settings controller requires getSettings().");
    }

    let qsInitScheduled = false;
    let qsInitDomReadyHandler = null;
    let qsDocumentClickBound = false;
    let qsDocumentClickHandler = null;
    let qsDocumentKeydownBound = false;
    let qsDocumentKeydownHandler = null;

    let storageWriteQueue = {};
    let storageWriteTimer = null;

    const readSettings = () => getSettings() || {};

    const flushStorageQueue = () => {
      storageWriteTimer = null;
      if (Object.keys(storageWriteQueue).length === 0) return;
      const batch = storageWriteQueue;
      storageWriteQueue = {};
      if (chrome?.storage?.sync?.set) {
        chrome.storage.sync.set(batch, () => {
          if (chrome.runtime.lastError) {
            console.error("Aether: Storage write failed:", chrome.runtime.lastError.message);
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

    const setupQuickSettingsToggles = () => {
      const settings = readSettings();
      const toggleConfig = [
        { id: "qs-hideUpgradeButtons", key: "hideUpgradeButtons" },
        { id: "qs-hideGptsButton", key: "hideGptsButton" },
        { id: "qs-hideTodaysPulse", key: "hideTodaysPulse" },
        { id: "qs-hideShoppingButton", key: "hideShoppingButton" },
        { id: "qs-blurChatHistory", key: "blurChatHistory" },
      ];

      toggleConfig.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (!el) return;

        el.checked = !!settings[key];
        if (!el.dataset.cgptToggleBound) {
          el.addEventListener("change", () => {
            queueStorageWrite(key, el.checked);
          });
          el.dataset.cgptToggleBound = "true";
        }
      });
    };

    const manage = () => {
      if (!document.body) {
        if (!qsInitScheduled) {
          qsInitScheduled = true;
          qsInitDomReadyHandler = () => {
            qsInitScheduled = false;
            qsInitDomReadyHandler = null;
            manage();
          };
          document.addEventListener("DOMContentLoaded", qsInitDomReadyHandler, { once: true });
        }
        return;
      }

      let btn = document.getElementById(QS_BUTTON_ID);
      let panel = document.getElementById(QS_PANEL_ID);

      const openPanel = () => {
        const activePanel = document.getElementById(QS_PANEL_ID);
        if (!activePanel) return;
        if (activePanel.getAttribute("data-state") === "open") return;
        activePanel.setAttribute("data-state", "open");
        activePanel.setAttribute("aria-hidden", "false");
        const activeButton = document.getElementById(QS_BUTTON_ID);
        if (activeButton) activeButton.setAttribute("aria-expanded", "true");
        if (typeof activePanel.focus === "function") {
          activePanel.focus({ preventScroll: true });
        }
      };

      const closePanel = (restoreFocus = false) => {
        const activePanel = document.getElementById(QS_PANEL_ID);
        if (!activePanel) return;

        const state = activePanel.getAttribute("data-state");
        if (state === "closed" || state === "closing") return;

        activePanel.setAttribute("data-state", "closing");
        activePanel.setAttribute("aria-hidden", "true");
        const activeButton = document.getElementById(QS_BUTTON_ID);
        if (!activeButton) return;

        activeButton.setAttribute("aria-expanded", "false");
        if (restoreFocus && typeof activeButton.focus === "function") {
          activeButton.focus({ preventScroll: true });
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
          panel.addEventListener("animationend", (event) => {
            const target = event.currentTarget;
            if (event.animationName === "qs-panel-close" && target.getAttribute("data-state") === "closing") {
              target.setAttribute("data-state", "closed");
            }
          });
          panel.dataset.qsAnimBound = "true";
        }
      };

      const syncAppearanceButtons = () => {
        if (!panel) return;
        const settings = readSettings();
        panel.querySelectorAll("[data-appearance]").forEach((appearanceButton) => {
          const isActive = (settings.appearance || "dimmed") === appearanceButton.dataset.appearance;
          appearanceButton.classList.toggle("active", isActive);
          appearanceButton.setAttribute("aria-pressed", String(isActive));
        });
      };

      const syncThemeButtons = () => {
        if (!panel) return;
        const settings = readSettings();
        panel.querySelectorAll("[data-theme]").forEach((themeButton) => {
          const isActive = (settings.theme || "auto") === themeButton.dataset.theme;
          themeButton.classList.toggle("active", isActive);
          themeButton.setAttribute("aria-pressed", String(isActive));
        });
      };

      const syncBackgroundTiles = () => {
        if (!panel) return;
        const settings = readSettings();
        const normalizedUrl =
          settings.customBgUrl === GROK_BLANCO_LEGACY_URL
            ? GROK_BLANCO_URL
            : sanitizeBackgroundUrl(settings.customBgUrl || "");
        panel.querySelectorAll(".qs-bg-tile").forEach((tile) => {
          const tileUrl = tile.dataset.bgUrl || "";
          tile.classList.toggle("active", tileUrl === normalizedUrl);
        });
      };

      const syncBlurControls = () => {
        if (!panel) return;
        const settings = readSettings();
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
        const settings = readSettings();
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
        btn.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5A3.5 3.5 0 0 1 15.5 12A3.5 3.5 0 0 1 12 15.5M19.43 12.98C19.47 12.65 19.5 12.33 19.5 12S19.47 11.35 19.43 11L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.96 19.05 5.05L16.56 6.05C16.04 5.66 15.5 5.32 14.87 5.07L14.5 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.5 2.42L9.13 5.07C8.5 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11C4.53 11.35 4.5 11.67 4.5 12S4.53 12.65 4.57 12.98L2.46 14.63C2.27 14.78 2.21 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.04 4.95 18.95L7.44 17.94C7.96 18.34 8.5 18.68 9.13 18.93L9.5 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.5 21.58L14.87 18.93C15.5 18.68 16.04 18.34 16.56 17.94L19.05 18.95C19.27 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98Z"></path></svg>';
        document.body.appendChild(btn);

        ensurePanel();

        btn.addEventListener("click", (event) => {
          event.stopPropagation();
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
          qsDocumentClickHandler = (event) => {
            const activePanel = document.getElementById(QS_PANEL_ID);
            if (activePanel && !activePanel.contains(event.target) && activePanel.getAttribute("data-state") === "open") {
              closePanel();
            }
          };
          document.addEventListener("click", qsDocumentClickHandler);
          qsDocumentClickBound = true;
        }

        if (!qsDocumentKeydownBound) {
          qsDocumentKeydownHandler = (event) => {
            if (event.key !== "Escape") return;
            const activePanel = document.getElementById(QS_PANEL_ID);
            if (activePanel && activePanel.getAttribute("data-state") === "open") {
              event.preventDefault();
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
        setupQuickSettingsToggles();
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

      setupQuickSettingsToggles();

      const appearanceButtons = Array.from(panel.querySelectorAll("[data-appearance]"));
      syncAppearanceButtons();
      appearanceButtons.forEach((appearanceButton) => {
        appearanceButton.addEventListener("click", () => {
          const value = appearanceButton.dataset.appearance;
          queueStorageWrite("appearance", value);
        });
      });

      const themeButtons = Array.from(panel.querySelectorAll("[data-theme]"));
      syncThemeButtons();
      themeButtons.forEach((themeButton) => {
        themeButton.addEventListener("click", () => {
          const value = themeButton.dataset.theme;
          queueStorageWrite("theme", value);
        });
      });

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
          { key: "superStars", url: SUPER_STARS_KEY, label: "Super Stars" },
          { key: "grokHorizon", url: GROK_HORIZON_URL, label: "Horizon" },
          { key: "grokBlanco", url: GROK_BLANCO_URL, label: "Grok White" },
          { key: "grokDarko", url: GROK_DARKO_URL, label: "Grok Dark" },
          { key: "grokCeleste", url: GROK_CELESTE_URL, label: "Grok Green" },
          { key: "spaceBlueGalaxy", url: SPACE_BLUE_GALAXY_URL, label: "Galaxy" },
          { key: "spaceCosmicPurple", url: SPACE_COSMIC_PURPLE_URL, label: "Cosmic" },
          { key: "spaceDeepNebula", url: SPACE_DEEP_NEBULA_URL, label: "Deep Nebula" },
          { key: "spaceMilkyWay", url: SPACE_MILKY_WAY_URL, label: "Milky Way" },
          { key: "spaceMilkyWayBlue", url: SPACE_MILKYWAY_BLUE_URL, label: "Milky Way Blue" },
          { key: "spaceMilkyWayRidge", url: SPACE_MILKYWAY_RIDGE_URL, label: "Milky Way Ridge" },
          { key: "spaceOrionNebula", url: SPACE_ORION_NEBULA_URL, label: "Orion" },
          { key: "spacePillarsCreation", url: SPACE_PILLARS_CREATION_URL, label: "Pillars" },
          { key: "spaceNebulaViolet", url: SPACE_PURPLE_NEBULA_UNSPLASH_URL, label: "Purple Nebula" },
          { key: "spacePurpleStarsAlt", url: SPACE_PURPLE_STARS_PEXELS_URL, label: "Purple Stars" },
          { key: "spaceNebulaPurpleBlue", url: SPACE_NEBULA_PURPLE_BLUE_URL, label: "Nebula Purple Blue" },
          { key: "spaceStarsPurple", url: SPACE_STARS_PURPLE_URL, label: "Stars Purple" },
        ];

        const getCurrentBgKey = () => {
          const settings = readSettings();
          const url = settings.customBgUrl || "";
          if (!url) return "default";
          if (url === AURORA_CLASSIC_URL) return "auroraClassic";
          if (url === "__gpt5_animated__") return "animated";
          if (url === JET_KEY) return "jet";
          if (url === AURORA_KEY) return "aurora";
          if (url === SUNSET_KEY) return "sunset";
          if (url === OCEAN_KEY) return "ocean";
          if (url === SUPER_STARS_KEY || url === LEGACY_GROK_SIGNUP_KEY) return "superStars";
          if (url === GROK_BLANCO_URL || url === GROK_BLANCO_LEGACY_URL) return "grokBlanco";
          if (url === GROK_DARKO_URL) return "grokDarko";
          if (url === GROK_CELESTE_URL) return "grokCeleste";
          const preset = bgPresets.find((presetItem) => presetItem.url === url);
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
              (preset.url &&
              preset.url !== "__gpt5_animated__" &&
              preset.url !== JET_KEY &&
              preset.url !== AURORA_KEY &&
              preset.url !== SUNSET_KEY &&
              preset.url !== OCEAN_KEY &&
              preset.url !== SUPER_STARS_KEY &&
              preset.url !== LEGACY_GROK_SIGNUP_KEY
                ? preset.url
                : "");
            const thumbStyle = resolvedThumb ? ` style="--qs-bg-thumb: url('${escapeHtml(resolvedThumb)}');"` : "";
            return `
        <button type="button" class="${classes}" data-bg-key="${preset.key}" data-bg-url="${escapeHtml(preset.url)}"${thumbStyle}>
          <span class="qs-bg-label">${escapeHtml(preset.label)}</span>
        </button>
      `;
          })
          .join("");

        bgGrid.querySelectorAll(".qs-bg-tile").forEach((tile) => {
          tile.addEventListener("click", () => {
            const nextUrl = sanitizeBackgroundUrl(tile.dataset.bgUrl || "");
            const settings = readSettings();
            if (nextUrl !== settings.customBgUrl) {
              settings.customBgUrl = nextUrl;
              updateBackgroundImage(nextUrl);
            }
            queueStorageWrite("customBgUrl", nextUrl);
            bgGrid.querySelectorAll(".qs-bg-tile").forEach((gridTile) => gridTile.classList.remove("active"));
            tile.classList.add("active");
          });
        });
        syncBackgroundTiles();
      }

      const blurSlider = document.getElementById("qs-blur-slider");
      const blurValue = document.getElementById("qs-blur-value");
      if (blurSlider && blurValue) {
        const settings = readSettings();
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
          const liveSettings = readSettings();
          if (value === liveSettings.backgroundBlur) return;
          liveSettings.backgroundBlur = value;
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

      const contentWidthSlider = document.getElementById("qs-content-width-slider");
      const contentWidthValue = document.getElementById("qs-content-width-value");
      if (contentWidthSlider && contentWidthValue) {
        const settings = readSettings();
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
          const liveSettings = readSettings();
          if (value === liveSettings.contentWidth) return;
          liveSettings.contentWidth = value;
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
    };

    const teardown = () => {
      if (storageWriteTimer) {
        clearTimeout(storageWriteTimer);
        storageWriteTimer = null;
      }
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
      if (qsInitDomReadyHandler) {
        document.removeEventListener("DOMContentLoaded", qsInitDomReadyHandler);
        qsInitDomReadyHandler = null;
      }
      qsInitScheduled = false;
      storageWriteQueue = {};
    };

    return Object.freeze({
      manage,
      teardown,
    });
  };

  globalThis.AetherContentQuickSettings = Object.freeze({
    ...(globalThis.AetherContentQuickSettings || {}),
    createQuickSettingsController,
  });
})();
