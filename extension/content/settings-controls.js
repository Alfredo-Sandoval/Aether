(() => {
  const TOOL_NAME = "AetherSettingsControls";

  const requireDependency = (deps, name) => {
    const value = deps[name];
    if (value == null) {
      throw new Error(`${TOOL_NAME}: missing dependency "${name}"`);
    }
    return value;
  };

  // Range slider binding shared by the popup and the in-page quick-settings
  // panel: visual application is rAF-batched, persistence is debounced, and a
  // final `change` event flushes the pending save immediately.
  const createRangeControlBinding = (deps = {}) => {
    const slider = requireDependency(deps, "slider");
    const valueLabel = requireDependency(deps, "valueLabel");
    const normalizeValue = requireDependency(deps, "normalizeValue");
    const applyValue = requireDependency(deps, "applyValue");
    const saveValue = requireDependency(deps, "saveValue");
    const min = requireDependency(deps, "min");
    const max = requireDependency(deps, "max");
    const formatValueText = deps.formatValueText || ((value) => String(value));
    const saveDelayMs = deps.saveDelayMs ?? 120;
    const win = deps.window || globalThis;
    const scheduleFrame = win.requestAnimationFrame
      ? win.requestAnimationFrame.bind(win)
      : (callback) => win.setTimeout(callback, 16);
    const cancelFrame = win.cancelAnimationFrame ? win.cancelAnimationFrame.bind(win) : win.clearTimeout.bind(win);

    let applyFrame = null;
    let pendingApplyValue = null;
    let saveTimer = null;
    let pendingSaveValue = null;

    const syncRangeReadout = (value) => {
      const valueText = String(value);
      valueLabel.textContent = valueText;
      slider.setAttribute("aria-valuetext", formatValueText(valueText));
      return valueText;
    };

    const setValue = (rawValue) => {
      const valueText = String(normalizeValue(rawValue));
      if (slider.value !== valueText) {
        slider.value = valueText;
      }
      return syncRangeReadout(valueText);
    };

    const scheduleApply = (value) => {
      pendingApplyValue = value;
      if (applyFrame !== null) return;
      applyFrame = scheduleFrame(() => {
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
      saveValue(valueToSave);
    };

    const scheduleSave = (value) => {
      pendingSaveValue = value;
      if (saveTimer) return;
      saveTimer = win.setTimeout(() => {
        saveTimer = null;
        flushSave();
      }, saveDelayMs);
    };

    const onInput = () => {
      const value = setValue(slider.value);
      scheduleApply(value);
      scheduleSave(value);
    };

    const onChange = () => {
      const value = setValue(slider.value);
      scheduleApply(value);
      if (saveTimer) {
        win.clearTimeout(saveTimer);
        saveTimer = null;
      }
      pendingSaveValue = value;
      flushSave();
    };

    slider.min = String(min);
    slider.max = String(max);
    setValue(deps.currentValue);
    slider.addEventListener("input", onInput);
    slider.addEventListener("change", onChange);

    const destroy = () => {
      slider.removeEventListener("input", onInput);
      slider.removeEventListener("change", onChange);
      if (applyFrame !== null) {
        cancelFrame(applyFrame);
        applyFrame = null;
      }
      if (saveTimer) {
        win.clearTimeout(saveTimer);
        saveTimer = null;
      }
      pendingApplyValue = null;
      pendingSaveValue = null;
    };

    return Object.freeze({ setValue, destroy });
  };

  // Roving-tabindex radio grid of background preset tiles, shared by the popup
  // and quick-settings panel. Arrow keys move focus and select in one gesture,
  // which is the expected interaction for radio groups.
  const createBackgroundTileGrid = (deps = {}) => {
    const document = requireDependency(deps, "document");
    const container = requireDependency(deps, "container");
    const presets = requireDependency(deps, "presets");
    const getLabel = requireDependency(deps, "getLabel");
    const onSelect = requireDependency(deps, "onSelect");
    const tileClassName = requireDependency(deps, "tileClassName");
    const labelClassName = requireDependency(deps, "labelClassName");
    const decorateTile = deps.decorateTile || (() => {});
    const ensureActiveVisible = deps.ensureActiveVisible || ((tile) => tile.scrollIntoView?.({ block: "nearest" }));
    const NAV_KEYS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];

    let activeKey = null;

    const tiles = presets.map((preset) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = tileClassName;
      tile.dataset.presetKey = preset.key;
      tile.setAttribute("role", "radio");
      tile.setAttribute("aria-checked", "false");
      tile.tabIndex = -1;
      const label = getLabel(preset);
      tile.title = label;
      const labelEl = document.createElement("span");
      labelEl.className = labelClassName;
      labelEl.textContent = label;
      tile.appendChild(labelEl);
      decorateTile(tile, preset);
      tile.addEventListener("click", () => onSelect(preset));
      container.appendChild(tile);
      return tile;
    });

    const presetByKey = new Map(presets.map((preset) => [preset.key, preset]));

    const focusAndSelect = (index) => {
      const tile = tiles[index];
      if (!tile) return;
      tile.focus();
      const preset = presetByKey.get(tile.dataset.presetKey);
      if (preset) onSelect(preset);
    };

    const onKeydown = (event) => {
      if (!NAV_KEYS.includes(event.key)) return;
      if (!tiles.length) return;
      event.preventDefault();
      const focusedIndex = tiles.findIndex((tile) => tile === document.activeElement);
      const activeIndex = tiles.findIndex((tile) => tile.dataset.presetKey === activeKey);
      const currentIndex = focusedIndex >= 0 ? focusedIndex : Math.max(0, activeIndex);
      if (event.key === "Home") return focusAndSelect(0);
      if (event.key === "End") return focusAndSelect(tiles.length - 1);
      const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      focusAndSelect((currentIndex + delta + tiles.length) % tiles.length);
    };
    container.addEventListener("keydown", onKeydown);

    const update = (nextActiveKey) => {
      activeKey = tiles.some((tile) => tile.dataset.presetKey === nextActiveKey) ? nextActiveKey : presets[0]?.key;
      let activeTile = null;
      tiles.forEach((tile) => {
        const isActive = tile.dataset.presetKey === activeKey;
        tile.classList.toggle("active", isActive);
        tile.setAttribute("aria-checked", String(isActive));
        tile.tabIndex = isActive ? 0 : -1;
        if (isActive) activeTile = tile;
      });
      if (!activeTile && tiles[0]) {
        tiles[0].tabIndex = 0;
      }
      if (activeTile) {
        ensureActiveVisible(activeTile, container);
      }
    };

    const destroy = () => {
      container.removeEventListener("keydown", onKeydown);
      tiles.forEach((tile) => tile.remove());
      tiles.length = 0;
    };

    return Object.freeze({ update, destroy, getTiles: () => [...tiles] });
  };

  const AetherSettingsControls = Object.freeze({
    createRangeControlBinding,
    createBackgroundTileGrid,
  });

  globalThis.AetherSettingsControls = AetherSettingsControls;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AetherSettingsControls;
  }
})();
