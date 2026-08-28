const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const readSource = (path) => fs.readFileSync(require.resolve(path), "utf8");

test("quick settings prioritizes live layout controls before background choices", () => {
  const source = readSource("../extension/content/quick-settings.js");
  const templateStart = source.indexOf("panel.innerHTML = `");
  const templateEnd = source.indexOf("setupToggles();", templateStart);
  const template = source.slice(templateStart, templateEnd);

  const blurIndex = template.indexOf('data-setting="blur"');
  const widthIndex = template.indexOf('data-setting="contentWidth"');
  const backgroundIndex = template.indexOf('data-setting="background"');
  const visibilityIndex = template.indexOf('data-setting="hideUpgradeButtons"');

  assert.equal(template.includes('data-setting="appearance"'), false);
  assert.equal(template.includes("data-appearance"), false);
  assert.ok(blurIndex >= 0);
  assert.ok(widthIndex > blurIndex);
  assert.ok(backgroundIndex > widthIndex);
  assert.ok(visibilityIndex > backgroundIndex);
});

test("quick settings controls expose labels and selected background state", () => {
  const source = readSource("../extension/content/quick-settings.js");
  const controlsSource = readSource("../extension/content/settings-controls.js");
  const templateStart = source.indexOf("panel.innerHTML = `");
  const templateEnd = source.indexOf("setupToggles();", templateStart);
  const template = source.slice(templateStart, templateEnd);

  assert.equal(template.includes('id="qs-blur-label" for="qs-blur-slider"'), true);
  assert.equal(template.includes('aria-labelledby="qs-blur-label"'), true);
  assert.equal(template.includes('id="qs-content-width-label" for="qs-content-width-slider"'), true);
  assert.equal(template.includes('aria-labelledby="qs-content-width-label"'), true);
  assert.equal(template.includes('id="qs-bg-grid" role="radiogroup" aria-labelledby="qs-bg-label"'), true);
  assert.equal(controlsSource.includes('tile.setAttribute("role", "radio");'), true);
  assert.equal(controlsSource.includes('tile.setAttribute("aria-checked", String(isActive));'), true);
  assert.equal(template.includes('<label class="switch"><input type="checkbox"'), false);
  assert.equal((template.match(/class="qs-row qs-toggle-row"/g) || []).length, 5);
  assert.equal(template.includes('class="qs-toggle-grid"'), true);
});

test("quick settings background presets stay compact and horizontally scannable", () => {
  const css = readSource("../extension/styles/quick-settings.css");
  const panelRule = css.match(/#cgpt-qs-panel\s*\{(?<body>[^}]+)\}/);
  const bgGridRule = css.match(/\.qs-bg-grid\s*\{(?<body>[^}]+)\}/);
  const layoutRule = css.match(/\.qs-row\.qs-blur-row,\s*\.qs-row\.qs-content-width-row\s*\{(?<body>[^}]+)\}/);

  assert.match(panelRule?.groups?.body || "", /width:\s*min\(340px,/);
  assert.match(panelRule?.groups?.body || "", /var\(--glass-refractive-filter\);/);
  assert.match(layoutRule?.groups?.body || "", /display:\s*grid;/);
  assert.match(bgGridRule?.groups?.body || "", /grid-auto-flow:\s*column;/);
  assert.match(panelRule?.groups?.body || "", /bottom:\s*calc\([^;]+\+ 122px\);/);
  assert.match(bgGridRule?.groups?.body || "", /grid-auto-columns:\s*96px;/);
  assert.match(bgGridRule?.groups?.body || "", /overflow-x:\s*auto;/);
  assert.match(bgGridRule?.groups?.body || "", /scroll-snap-type:\s*x mandatory;/);
  assert.match(bgGridRule?.groups?.body || "", /scrollbar-width:\s*none;/);
});

test("quick settings visibility and footer use the compact control-deck layout", () => {
  const css = readSource("../extension/styles/quick-settings.css");
  const toggleGridRule = css.match(/\.qs-toggle-grid\s*\{(?<body>[^}]+)\}/);
  const footerActionRule = css.match(/\.qs-open-settings\s*\{(?<body>[^}]+)\}/);

  assert.match(toggleGridRule?.groups?.body || "", /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(footerActionRule?.groups?.body || "", /width:\s*100%;/);
  assert.match(footerActionRule?.groups?.body || "", /justify-content:\s*space-between;/);
});

test("quick settings CSS has no dead glass appearance controls", () => {
  const css = readSource("../extension/styles/quick-settings.css");

  assert.equal(css.includes("cgpt-appearance-clear"), false);
  assert.equal(css.includes(".qs-pill"), false);
  assert.equal(css.includes('data-setting="appearance"'), false);
});

test("quick settings preset CSS targets the shared tile-grid data contract", () => {
  const css = readSource("../extension/styles/quick-settings.css");
  const controlsSource = readSource("../extension/content/settings-controls.js");

  assert.equal(controlsSource.includes("tile.dataset.presetKey = preset.key;"), true);
  assert.match(css, /\[data-preset-key="jet"\]/);
  assert.match(css, /\[data-preset-key="aurora"\]/);
  assert.equal(css.includes("[data-bg-key="), false);
});

test("quick settings preset CSS only targets preset ids that exist", () => {
  const css = readSource("../extension/styles/quick-settings.css");
  const shared = require("../extension/content/shared-utils.js");
  const knownPresetIds = new Set(shared.POPUP_BACKGROUND_PRESET_OPTIONS.map((option) => option.value));
  const referencedIds = [...css.matchAll(/\[data-preset-key="([^"]+)"\]/g)].map((match) => match[1]);

  assert.ok(referencedIds.length > 0, "expected preset-key selectors in quick-settings.css");
  referencedIds.forEach((presetId) => {
    assert.ok(knownPresetIds.has(presetId), `quick-settings.css targets unknown preset id "${presetId}"`);
  });
});
