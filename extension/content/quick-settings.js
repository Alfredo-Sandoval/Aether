(() => {
  const TOOL_NAME = "AetherQuickSettings";

  const requireDependency = (deps, name) => {
    const value = deps[name];
    if (value == null) {
      throw new Error(`${TOOL_NAME}: missing dependency "${name}"`);
    }
    return value;
  };

  const PANEL_STATES = Object.freeze(["open", "closing", "closed"]);

  const TOGGLE_CONFIG = Object.freeze([
    Object.freeze({ id: "qs-hideUpgradeButtons", key: "hideUpgradeButtons" }),
    Object.freeze({ id: "qs-hideGptsButton", key: "hideGptsButton" }),
    Object.freeze({ id: "qs-hideTodaysPulse", key: "hideTodaysPulse" }),
    Object.freeze({ id: "qs-hideShoppingButton", key: "hideShoppingButton" }),
    Object.freeze({ id: "qs-blurChatHistory", key: "blurChatHistory" }),
  ]);

  // In-page quick-settings panel: gear button plus a small dialog with live
  // tuning controls. All persistence flows through queueStorageWrite so the
  // background worker stays the only sync-storage writer.
  const createQuickSettingsPanel = (deps = {}) => {
    const document = requireDependency(deps, "document");
    const win = deps.window || globalThis;
    const controls = requireDependency(deps, "controls");
    const translate = requireDependency(deps, "translate");
    const getMessage = requireDependency(deps, "getMessage");
    const getSettings = requireDependency(deps, "getSettings");
    const presets = requireDependency(deps, "presets");
    const resolvePresetIdFromUrl = requireDependency(deps, "resolvePresetIdFromUrl");
    const sanitizeBackgroundUrl = requireDependency(deps, "sanitizeBackgroundUrl");
    const clampBlur = requireDependency(deps, "clampBlur");
    const clampContentWidth = requireDependency(deps, "clampContentWidth");
    const minBlur = requireDependency(deps, "minBlur");
    const maxBlur = requireDependency(deps, "maxBlur");
    const minContentWidth = requireDependency(deps, "minContentWidth");
    const maxContentWidth = requireDependency(deps, "maxContentWidth");
    const queueStorageWrite = requireDependency(deps, "queueStorageWrite");
    const applyTuningPatch = requireDependency(deps, "applyTuningPatch");
    const openFullSettings = requireDependency(deps, "openFullSettings");
    const buttonId = deps.buttonId || "cgpt-qs-btn";
    const panelId = deps.panelId || "cgpt-qs-panel";
    const closeStateTimeoutMs = deps.closeStateTimeoutMs ?? 320;

    let closeTimer = null;
    let initScheduled = false;
    let domReadyHandler = null;
    let documentClickHandler = null;
    let documentKeydownHandler = null;
    let tileGrid = null;
    let blurControl = null;
    let widthControl = null;

    const getPanel = () => document.getElementById(panelId);
    const getButton = () => document.getElementById(buttonId);

    const clearCloseTimer = () => {
      if (!closeTimer) return;
      win.clearTimeout(closeTimer);
      closeTimer = null;
    };

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
      const activePanel = getPanel();
      if (!activePanel) return null;

      const resolvedState = PANEL_STATES.includes(nextState) ? nextState : "closed";
      const isOpen = resolvedState === "open";
      activePanel.setAttribute("data-state", resolvedState);
      activePanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
      syncPanelInlineState(activePanel, resolvedState);

      const activeButton = getButton();
      if (activeButton) {
        activeButton.setAttribute("aria-expanded", String(isOpen));
      }
      return activePanel;
    };

    const finalizeClosingState = () => {
      clearCloseTimer();
      if (getPanel()?.getAttribute("data-state") === "closing") {
        setPanelState("closed");
      }
    };

    const scheduleClosingStateFinalize = () => {
      clearCloseTimer();
      closeTimer = win.setTimeout(finalizeClosingState, closeStateTimeoutMs);
    };

    const syncBackgroundTiles = () => {
      if (!tileGrid) return;
      const normalizedUrl = sanitizeBackgroundUrl(getSettings().customBgUrl || "");
      tileGrid.update(resolvePresetIdFromUrl(normalizedUrl) || "default");
    };

    const syncBlurControl = () => {
      blurControl?.setValue(getSettings().backgroundBlur);
    };

    const syncContentWidthControl = () => {
      widthControl?.setValue(getSettings().contentWidth);
    };

    const openPanel = () => {
      clearCloseTimer();
      const activePanel = setPanelState("open");
      if (activePanel) {
        if (typeof activePanel.focus === "function") {
          activePanel.focus({ preventScroll: true });
        }
        const scheduleFrame = win.requestAnimationFrame
          ? win.requestAnimationFrame.bind(win)
          : (callback) => win.setTimeout(callback, 16);
        scheduleFrame(syncBackgroundTiles);
      }
    };

    const closePanel = (restoreFocus = false) => {
      const activePanel = setPanelState("closing");
      if (activePanel) {
        scheduleClosingStateFinalize();
        const activeButton = getButton();
        if (activeButton && restoreFocus && typeof activeButton.focus === "function") {
          activeButton.focus({ preventScroll: true });
        }
      }
    };

    const setupToggles = () => {
      const settings = getSettings();
      TOGGLE_CONFIG.forEach(({ id, key }) => {
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

    const ensurePanel = () => {
      let panel = getPanel();
      if (!panel) {
        panel = document.createElement("div");
        panel.id = panelId;
        document.body.appendChild(panel);
      }

      if (!PANEL_STATES.includes(panel.getAttribute("data-state"))) {
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
        clearCloseTimer();
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
      return panel;
    };

    const ensureButton = () => {
      let btn = getButton();
      if (btn) return btn;

      btn = document.createElement("button");
      btn.id = buttonId;
      btn.type = "button";
      btn.title = getMessage("quickSettingsButtonTitle");
      btn.setAttribute("aria-label", getMessage("quickSettingsButtonTitle"));
      btn.setAttribute("aria-haspopup", "dialog");
      btn.setAttribute("aria-controls", panelId);
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = `<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5A3.5 3.5 0 0 1 15.5 12A3.5 3.5 0 0 1 12 15.5M19.43 12.98C19.47 12.65 19.5 12.33 19.5 12S19.47 11.35 19.43 11L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.96 19.05 5.05L16.56 6.05C16.04 5.66 15.5 5.32 14.87 5.07L14.5 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.5 2.42L9.13 5.07C8.5 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11C4.53 11.35 4.5 11.67 4.5 12S4.53 12.65 4.57 12.98L2.46 14.63C2.27 14.78 2.21 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.04 4.95 18.95L7.44 17.94C7.96 18.34 8.5 18.68 9.13 18.93L9.5 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.5 21.58L14.87 18.93C15.5 18.68 16.04 18.34 16.56 17.94L19.05 18.95C19.27 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98Z"></path></svg>`;
      document.body.appendChild(btn);

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const activePanel = getPanel();
        if (!activePanel) return;
        if (activePanel.getAttribute("data-state") === "open") {
          closePanel(true);
        } else {
          openPanel();
        }
      });

      if (!documentClickHandler) {
        documentClickHandler = (e) => {
          const activePanel = getPanel();
          if (activePanel && !activePanel.contains(e.target) && activePanel.getAttribute("data-state") === "open") {
            closePanel();
          }
        };
        document.addEventListener("click", documentClickHandler);
      }
      if (!documentKeydownHandler) {
        documentKeydownHandler = (e) => {
          if (e.key !== "Escape") return;
          const activePanel = getPanel();
          if (activePanel && activePanel.getAttribute("data-state") === "open") {
            e.preventDefault();
            closePanel(true);
          }
        };
        document.addEventListener("keydown", documentKeydownHandler);
      }
      return btn;
    };

    const buildPanelContent = (panel) => {
      panel.innerHTML = `
      <div class="qs-section-title">${translate("sectionAppearance")}</div>
      <div class="qs-row qs-blur-row" data-setting="blur">
          <label id="qs-blur-label" for="qs-blur-slider">${translate("labelBlur")}</label>
          <div class="qs-range-control">
            <input type="range" id="qs-blur-slider" min="${minBlur}" max="${maxBlur}" step="1" aria-labelledby="qs-blur-label" aria-valuetext="60 px" />
            <span id="qs-blur-value">60</span><span class="qs-blur-unit">px</span>
          </div>
      </div>
      <div class="qs-row qs-content-width-row" data-setting="contentWidth">
          <label id="qs-content-width-label" for="qs-content-width-slider">${translate("quickSettingsLabelContentWidth")}</label>
          <div class="qs-range-control">
            <input
              type="range"
              id="qs-content-width-slider"
              min="${minContentWidth}"
              max="${maxContentWidth}"
              step="1"
              aria-labelledby="qs-content-width-label"
              aria-valuetext="95%"
            />
            <span id="qs-content-width-value">95</span><span class="qs-blur-unit">%</span>
          </div>
      </div>
      <div class="qs-section-title" id="qs-bg-label">${translate("quickSettingsLabelBackground")}</div>
      <div class="qs-row qs-bg-row" data-setting="background">
          <div class="qs-bg-grid" id="qs-bg-grid" role="radiogroup" aria-labelledby="qs-bg-label"></div>
      </div>
      <div class="qs-section-title">${translate("quickSettingsSectionVisibility")}</div>
      <div class="qs-toggle-grid">
        <label class="qs-row qs-toggle-row" data-setting="hideUpgradeButtons">
            <span class="qs-row-label">${translate("quickSettingsLabelHideUpgradeButtons")}</span>
            <span class="switch"><input type="checkbox" id="qs-hideUpgradeButtons"><span class="track"><span class="thumb"></span></span></span>
        </label>
        <label class="qs-row qs-toggle-row" data-setting="hideGptsButton">
            <span class="qs-row-label">${translate("quickSettingsLabelHideGptsButton")}</span>
            <span class="switch"><input type="checkbox" id="qs-hideGptsButton"><span class="track"><span class="thumb"></span></span></span>
        </label>
        <label class="qs-row qs-toggle-row" data-setting="hideTodaysPulse">
            <span class="qs-row-label">${translate("quickSettingsLabelHideTodaysPulse")}</span>
            <span class="switch"><input type="checkbox" id="qs-hideTodaysPulse"><span class="track"><span class="thumb"></span></span></span>
        </label>
        <label class="qs-row qs-toggle-row" data-setting="hideShoppingButton">
            <span class="qs-row-label">${translate("quickSettingsLabelHideShoppingButton")}</span>
            <span class="switch"><input type="checkbox" id="qs-hideShoppingButton"><span class="track"><span class="thumb"></span></span></span>
        </label>
        <label class="qs-row qs-toggle-row" data-setting="blurChatHistory">
            <span class="qs-row-label">${translate("quickSettingsLabelStreamerMode")}</span>
            <span class="switch"><input type="checkbox" id="qs-blurChatHistory"><span class="track"><span class="thumb"></span></span></span>
        </label>
      </div>
      <div class="qs-footer">
          <button type="button" id="qs-open-settings" class="qs-open-settings">${translate("quickSettingsOpenFullSettings")}</button>
      </div>
    `;

      setupToggles();

      const openSettingsBtn = document.getElementById("qs-open-settings");
      if (openSettingsBtn) {
        openSettingsBtn.addEventListener("click", () => {
          openFullSettings();
        });
      }

      const bgGrid = document.getElementById("qs-bg-grid");
      if (bgGrid) {
        tileGrid = controls.createBackgroundTileGrid({
          document,
          container: bgGrid,
          presets,
          tileClassName: "qs-bg-tile",
          labelClassName: "qs-bg-label",
          getLabel: (preset) => getMessage(preset.labelKey) || preset.key,
          decorateTile: (tile, preset) => {
            if (preset.animated) tile.classList.add("is-animated");
            if (preset.thumb) tile.style.setProperty("--qs-bg-thumb", `url("${preset.thumb}")`);
          },
          // Center the active tile in the horizontally scrolling strip, but only
          // while the panel is open so hidden-layout math cannot misplace it.
          ensureActiveVisible: (tile, container) => {
            if (getPanel()?.getAttribute("data-state") !== "open") return;
            const centeredLeft = tile.offsetLeft - (container.clientWidth - tile.clientWidth) / 2;
            container.scrollTo?.({ left: centeredLeft, behavior: "auto" });
          },
          onSelect: (preset) => {
            const nextUrl = sanitizeBackgroundUrl(preset.url || "");
            const nextBlur = String(clampBlur(preset.defaultBlur ?? getSettings().backgroundBlur));
            applyTuningPatch({ customBgUrl: nextUrl, backgroundBlur: nextBlur });
            queueStorageWrite("customBgUrl", nextUrl);
            queueStorageWrite("backgroundBlur", nextBlur);
            syncBackgroundTiles();
          },
        });
        syncBackgroundTiles();
      }

      const blurSlider = document.getElementById("qs-blur-slider");
      const blurValue = document.getElementById("qs-blur-value");
      if (blurSlider && blurValue) {
        blurControl = controls.createRangeControlBinding({
          slider: blurSlider,
          valueLabel: blurValue,
          min: minBlur,
          max: maxBlur,
          currentValue: getSettings().backgroundBlur,
          normalizeValue: clampBlur,
          formatValueText: (value) => `${value} px`,
          applyValue: (value) => applyTuningPatch({ backgroundBlur: value }),
          saveValue: (value) => queueStorageWrite("backgroundBlur", value),
          window: win,
        });
      }

      const widthSlider = document.getElementById("qs-content-width-slider");
      const widthValue = document.getElementById("qs-content-width-value");
      if (widthSlider && widthValue) {
        widthControl = controls.createRangeControlBinding({
          slider: widthSlider,
          valueLabel: widthValue,
          min: minContentWidth,
          max: maxContentWidth,
          currentValue: getSettings().contentWidth,
          normalizeValue: clampContentWidth,
          formatValueText: (value) => `${value}%`,
          applyValue: (value) => applyTuningPatch({ contentWidth: value }),
          saveValue: (value) => queueStorageWrite("contentWidth", value),
          window: win,
        });
      }
    };

    const manage = () => {
      if (!document.body) {
        if (!initScheduled) {
          initScheduled = true;
          domReadyHandler = () => {
            initScheduled = false;
            domReadyHandler = null;
            manage();
          };
          document.addEventListener("DOMContentLoaded", domReadyHandler, { once: true });
        }
        return;
      }

      ensureButton();
      const panel = ensurePanel();

      if (panel.getAttribute("data-initialized") === "true") {
        setupToggles();
        syncBackgroundTiles();
        syncBlurControl();
        syncContentWidthControl();
        return;
      }
      panel.setAttribute("data-initialized", "true");
      buildPanelContent(panel);
    };

    // External settings changes (popup sliders, storage sync) land here so the
    // panel's controls stay in step without re-entering the save path.
    const syncTuningControls = (patch = {}) => {
      if (Object.prototype.hasOwnProperty.call(patch, "backgroundBlur")) {
        blurControl?.setValue(patch.backgroundBlur);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "contentWidth")) {
        widthControl?.setValue(patch.contentWidth);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "customBgUrl")) {
        syncBackgroundTiles();
      }
    };

    const destroy = () => {
      clearCloseTimer();
      if (documentClickHandler) {
        document.removeEventListener("click", documentClickHandler);
        documentClickHandler = null;
      }
      if (documentKeydownHandler) {
        document.removeEventListener("keydown", documentKeydownHandler);
        documentKeydownHandler = null;
      }
      if (domReadyHandler) {
        document.removeEventListener("DOMContentLoaded", domReadyHandler);
        domReadyHandler = null;
      }
      initScheduled = false;
      blurControl?.destroy();
      blurControl = null;
      widthControl?.destroy();
      widthControl = null;
      tileGrid?.destroy();
      tileGrid = null;
      getButton()?.remove();
      getPanel()?.remove();
    };

    return Object.freeze({ manage, syncTuningControls, destroy });
  };

  const AetherQuickSettings = Object.freeze({
    createQuickSettingsPanel,
  });

  globalThis.AetherQuickSettings = AetherQuickSettings;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AetherQuickSettings;
  }
})();
