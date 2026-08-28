const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const settingsControls = require("../extension/content/settings-controls.js");
const quickSettingsFactory = require("../extension/content/quick-settings.js");
const welcomeScreenFactory = require("../extension/content/welcome-screen.js");
const surfaceTaggingFactory = require("../extension/content/surface-tagging.js");
const refractiveGlassFactory = require("../extension/content/refractive-glass.js");
const backgroundMediaFactory = require("../extension/content/background-media.js");
const shared = require("../extension/content/shared-utils.js");

const createDom = (html = "<body></body>") => new JSDOM(`<!doctype html><html>${html}</html>`);

test("refractive glass filter mounts once and cleans up its document contract", () => {
  const dom = createDom();
  const { document } = dom.window;

  const first = refractiveGlassFactory.ensureRefractiveGlassFilter(document);
  const second = refractiveGlassFactory.ensureRefractiveGlassFilter(document);

  assert.equal(first, second);
  assert.equal(document.querySelectorAll(`#${refractiveGlassFactory.FILTER_BANK_ID}`).length, 1);
  assert.equal(first.getAttribute("aria-hidden"), "true");
  assert.ok(first.querySelector("feTurbulence"));
  assert.ok(first.querySelector("feDisplacementMap"));
  assert.equal(
    document.documentElement.style.getPropertyValue(refractiveGlassFactory.FILTER_VARIABLE),
    `url("#${refractiveGlassFactory.FILTER_ID}")`
  );

  refractiveGlassFactory.removeRefractiveGlassFilter(document);
  assert.equal(document.getElementById(refractiveGlassFactory.FILTER_BANK_ID), null);
  assert.equal(document.documentElement.style.getPropertyValue(refractiveGlassFactory.FILTER_VARIABLE), "");
});

// Deterministic timer/frame host: callbacks are captured and flushed manually so
// debounce and rAF behavior can be asserted without real waiting.
const createFakeWindow = () => {
  let nextId = 1;
  const timers = new Map();
  const frames = new Map();
  return {
    win: {
      setTimeout: (callback) => {
        const id = nextId++;
        timers.set(id, callback);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      requestAnimationFrame: (callback) => {
        const id = nextId++;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
    },
    flushFrames: () => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    },
    flushTimers: () => {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((callback) => callback());
    },
  };
};

test("range control binding clamps, applies on frame, and debounces saves", () => {
  const dom = createDom('<body><input type="range" id="s" /><span id="v"></span></body>');
  const { document } = dom.window;
  const slider = document.getElementById("s");
  const valueLabel = document.getElementById("v");
  const { win, flushFrames, flushTimers } = createFakeWindow();
  const applied = [];
  const saved = [];

  const binding = settingsControls.createRangeControlBinding({
    slider,
    valueLabel,
    min: 0,
    max: 150,
    currentValue: "42",
    normalizeValue: (raw) => Math.min(150, Math.max(0, Number.parseInt(raw, 10) || 0)),
    formatValueText: (value) => `${value} px`,
    applyValue: (value) => applied.push(value),
    saveValue: (value) => saved.push(value),
    window: win,
  });

  assert.equal(slider.min, "0");
  assert.equal(slider.max, "150");
  assert.equal(slider.value, "42");
  assert.equal(valueLabel.textContent, "42");
  assert.equal(slider.getAttribute("aria-valuetext"), "42 px");

  slider.value = "999";
  slider.dispatchEvent(new dom.window.Event("input"));
  assert.equal(slider.value, "150", "out-of-range input is clamped in place");
  assert.deepEqual(applied, [], "apply waits for the animation frame");
  flushFrames();
  assert.deepEqual(applied, ["150"]);
  assert.deepEqual(saved, [], "save waits for the debounce timer");
  flushTimers();
  assert.deepEqual(saved, ["150"]);

  slider.value = "10";
  slider.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual(saved, ["150", "10"], "change flushes the save immediately");

  binding.setValue("70");
  assert.equal(slider.value, "70");
  assert.equal(valueLabel.textContent, "70");
  flushFrames();
  flushTimers();
  assert.deepEqual(saved, ["150", "10"], "programmatic setValue never persists");

  binding.destroy();
  slider.value = "33";
  slider.dispatchEvent(new dom.window.Event("input"));
  flushFrames();
  assert.deepEqual(applied, ["150", "10"], "destroyed binding ignores events");
});

test("background tile grid renders a roving radio group and selects on arrow keys", () => {
  const dom = createDom('<body><div id="grid"></div></body>');
  const { document } = dom.window;
  const container = document.getElementById("grid");
  const selections = [];

  const grid = settingsControls.createBackgroundTileGrid({
    document,
    container,
    presets: [
      { key: "default", url: "" },
      { key: "aurora", url: "chrome-extension://abc/aurora.webp" },
      { key: "nebula", url: "chrome-extension://abc/nebula.webp" },
    ],
    tileClassName: "qs-bg-tile",
    labelClassName: "qs-bg-label",
    getLabel: (preset) => `<b>${preset.key}</b>`,
    onSelect: (preset) => selections.push(preset.key),
    ensureActiveVisible: () => {},
  });

  const tiles = grid.getTiles();
  assert.equal(tiles.length, 3);
  assert.equal(tiles[1].dataset.presetKey, "aurora");
  tiles.forEach((tile) => {
    assert.equal(tile.getAttribute("role"), "radio");
    assert.equal(tile.querySelector("b"), null, "labels are set as text, not parsed HTML");
  });

  grid.update("aurora");
  assert.equal(tiles[1].getAttribute("aria-checked"), "true");
  assert.equal(tiles[1].tabIndex, 0);
  assert.equal(tiles[0].tabIndex, -1);
  assert.equal(tiles[2].tabIndex, -1);

  tiles[2].click();
  assert.deepEqual(selections, ["nebula"]);

  tiles[1].focus();
  container.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.deepEqual(selections, ["nebula", "nebula"], "arrow moves from the focused tile and selects");

  grid.update("bogus-key");
  assert.equal(tiles[0].getAttribute("aria-checked"), "true", "unknown keys fall back to the first preset");
});

test("background media reset cancels a pending transition and releases media", () => {
  const dom = createDom("<body></body>");
  const { document } = dom.window;
  const engine = backgroundMediaFactory.createBackgroundMediaEngine({
    document,
    nodeId: "ambient",
    sanitizeUrl: (url) => url,
    defaultUrl: "chrome-extension://abc/default.webp",
    transitionDurationMs: 0,
  });
  const node = engine.createNode();
  document.body.appendChild(node);
  node.querySelectorAll("video").forEach((video) => {
    video.load = () => {};
    video.pause = () => {};
    video.play = () => Promise.resolve();
  });

  engine.update("chrome-extension://abc/next.webp");
  const pendingImage = node.querySelector('.media-layer[data-layer-id="b"] img');
  assert.equal(pendingImage.getAttribute("src"), "chrome-extension://abc/next.webp");

  engine.reset();
  pendingImage.dispatchEvent(new dom.window.Event("load"));

  assert.equal(node.querySelector(".media-layer.active")?.dataset.layerId, "a");
  assert.equal(pendingImage.hasAttribute("src"), false);
  node.querySelectorAll("video").forEach((video) => {
    assert.equal(video.hasAttribute("src"), false);
  });
});

const createQuickSettingsHarness = () => {
  const dom = createDom("<body></body>");
  const { document } = dom.window;
  const { win, flushFrames, flushTimers } = createFakeWindow();
  const settings = {
    hideUpgradeButtons: false,
    hideGptsButton: true,
    hideTodaysPulse: false,
    hideShoppingButton: true,
    blurChatHistory: false,
    customBgUrl: "",
    backgroundBlur: "42",
    contentWidth: "95",
  };
  const storageWrites = [];
  const tuningPatches = [];
  const openedSettings = [];

  const panel = quickSettingsFactory.createQuickSettingsPanel({
    document,
    window: win,
    controls: settingsControls,
    translate: (key) => key,
    getMessage: (key) => key,
    getSettings: () => settings,
    presets: [
      { key: "default", url: "", labelKey: "bgPresetOptionDefault", animated: false, thumb: "", defaultBlur: "42" },
      {
        key: "aurora",
        url: "chrome-extension://abc/aurora.webp",
        labelKey: "bgPresetOptionAurora",
        animated: true,
        thumb: "chrome-extension://abc/aurora.webp",
        defaultBlur: "44",
      },
    ],
    resolvePresetIdFromUrl: (url) => (url ? "aurora" : "default"),
    sanitizeBackgroundUrl: (url) => url,
    clampBlur: (raw) => Math.min(150, Math.max(0, Number.parseInt(raw, 10) || 0)),
    clampContentWidth: (raw) => Math.min(100, Math.max(70, Number.parseInt(raw, 10) || 95)),
    minBlur: 0,
    maxBlur: 150,
    minContentWidth: 70,
    maxContentWidth: 100,
    queueStorageWrite: (key, value) => storageWrites.push([key, value]),
    applyTuningPatch: (patch) => tuningPatches.push(patch),
    openFullSettings: () => openedSettings.push(true),
  });

  return { dom, document, panel, settings, storageWrites, tuningPatches, openedSettings, flushFrames, flushTimers };
};

test("quick settings panel builds, opens, closes, and persists through its callbacks", () => {
  const { dom, document, panel, storageWrites, tuningPatches, openedSettings } = createQuickSettingsHarness();

  panel.manage();
  const button = document.getElementById("cgpt-qs-btn");
  const panelEl = document.getElementById("cgpt-qs-panel");
  assert.ok(button, "gear button is created");
  assert.ok(panelEl, "panel is created");
  assert.equal(panelEl.getAttribute("role"), "dialog");
  assert.equal(panelEl.getAttribute("data-state"), "closed");

  const toggle = document.getElementById("qs-hideGptsButton");
  assert.equal(toggle.checked, true, "toggles reflect current settings");
  toggle.checked = false;
  toggle.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual(storageWrites.at(-1), ["hideGptsButton", false]);

  button.click();
  assert.equal(panelEl.getAttribute("data-state"), "open");
  assert.equal(button.getAttribute("aria-expanded"), "true");

  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  assert.equal(panelEl.getAttribute("data-state"), "closing");

  const auroraTile = panelEl.querySelector('[data-preset-key="aurora"]');
  auroraTile.click();
  assert.deepEqual(tuningPatches.at(-1), {
    customBgUrl: "chrome-extension://abc/aurora.webp",
    backgroundBlur: "44",
  });
  assert.ok(storageWrites.some(([key, value]) => key === "customBgUrl" && value.includes("aurora")));

  const openSettingsButton = document.getElementById("qs-open-settings");
  openSettingsButton.click();
  assert.equal(openedSettings.length, 1);

  panel.syncTuningControls({ backgroundBlur: "77" });
  assert.equal(document.getElementById("qs-blur-slider").value, "77");
  assert.equal(document.getElementById("qs-blur-value").textContent, "77");

  panel.destroy();
  assert.equal(document.getElementById("cgpt-qs-btn"), null);
  assert.equal(document.getElementById("cgpt-qs-panel"), null);
});

test("quick settings manage() is idempotent and resyncs from settings", () => {
  const { document, panel, settings } = createQuickSettingsHarness();
  panel.manage();
  settings.backgroundBlur = "60";
  panel.manage();
  assert.equal(document.querySelectorAll("#cgpt-qs-panel").length, 1);
  assert.equal(document.getElementById("qs-blur-slider").value, "60");
});

test("welcome screen traps focus, dismisses, and never duplicates", async () => {
  const dom = createDom("<body></body>");
  const { document } = dom.window;
  const updates = [];
  const opened = [];

  const welcome = welcomeScreenFactory.createWelcomeScreen({
    document,
    translate: (key) => key,
    requestSettingsUpdate: (patch) => {
      updates.push(patch);
      return Promise.resolve({});
    },
    openPopup: () => opened.push(true),
  });

  welcome.show();
  welcome.show();
  assert.equal(document.querySelectorAll("#aurora-welcome-notification").length, 1, "second show() is a no-op");
  assert.equal(document.activeElement.id, "welcome-settings-btn", "focus moves into the modal");

  document.getElementById("welcome-settings-btn").click();
  assert.equal(opened.length, 1);
  assert.deepEqual(updates, [{ hasSeenWelcomeScreen: true }]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(document.getElementById("aurora-welcome-notification").classList.contains("dismissed"), true);

  welcome.destroy();
  assert.equal(document.getElementById("aurora-welcome-notification"), null);
});

test("surface tagging classifies dialogs and clears stale tags on the next pass", () => {
  const dom = createDom(
    `<body>
      <main id="main"></main>
      <section data-testid="conversation-turn-1">
        <div data-message-author-role="assistant">
          <button id="source-chip" class="rounded-full bg-token-bg-primary">Source</button>
        </div>
      </section>
      <div id="settings-dialog" role="dialog" aria-label="Settings">Configuración</div>
      <div id="plain-dialog" role="dialog">Anything else</div>
      <div id="menu" role="menu">My plan Log out</div>
    </body>`
  );
  const { document } = dom.window;

  const tagging = surfaceTaggingFactory.createSurfaceTagging({
    document,
    window: dom.window,
    Element: dom.window.Element,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    normalizeText: shared.normalizeUiText,
    isElementVisible: () => true,
    isSettingsSurfaceDescriptor: shared.isSettingsSurfaceDescriptor,
    isProjectSurfaceDescriptor: shared.isProjectSurfaceDescriptor,
    isProfileMenuSurfaceDescriptor: shared.isProfileMenuSurfaceDescriptor,
    isModelPickerSurfaceDescriptor: shared.isModelPickerSurfaceDescriptor,
    isResearchDialogNode: () => false,
    getClosedResearchViewerNodes: () => [],
    getResearchOverlayHostNodes: () => [],
    getResearchHomeCardNodes: () => [],
    getResearchAgendaItemNodes: () => [],
    getProfileButton: () => null,
    searchPanelHints: shared.SEARCH_PANEL_HINTS,
    activityFlyoutSelector: '[data-testid="stage-thread-flyout"]',
    researchViewerHostSelector: 'main[data-testid*="deep-research" i]',
    researchHomeSelector: ".deep-research-app",
    canvasSurfaceClass: "cgpt-aether-canvas-surface",
  });

  tagging.markSemanticSurfaces();
  assert.equal(document.getElementById("settings-dialog").getAttribute("data-aether-surface"), "settings-panel");
  assert.equal(document.getElementById("plain-dialog").getAttribute("data-aether-surface"), "dialog");
  assert.equal(document.getElementById("menu").getAttribute("data-aether-surface"), "profile-menu");
  assert.equal(document.getElementById("menu").getAttribute("data-aether-glass"), "interactive");
  assert.equal(document.getElementById("source-chip").getAttribute("data-aether-surface"), "source-chip");
  assert.equal(document.getElementById("source-chip").getAttribute("data-aether-glass"), "interactive");

  const summary = tagging.getTagSummary();
  assert.equal(summary["settings-panel"], 1);
  assert.equal(summary["profile-menu"], 1);

  // A dialog that stops matching loses its tag on the next pass.
  const settingsDialog = document.getElementById("settings-dialog");
  settingsDialog.removeAttribute("role");
  tagging.markSemanticSurfaces();
  assert.equal(settingsDialog.getAttribute("data-aether-surface"), null);

  tagging.clearAllTags();
  assert.equal(document.querySelectorAll("[data-aether-surface]").length, 0);
  assert.deepEqual(tagging.getTagSummary(), {});
});
