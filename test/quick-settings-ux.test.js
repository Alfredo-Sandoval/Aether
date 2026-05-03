const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const readSource = (path) => fs.readFileSync(require.resolve(path), "utf8");

test("quick settings prioritizes live layout controls before background choices", () => {
  const source = readSource("../extension/content/content.js");
  const templateStart = source.indexOf("panel.innerHTML = `");
  const templateEnd = source.indexOf("setupQuickSettingsToggles(settings);", templateStart);
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

test("quick settings background presets stay compact and horizontally scannable", () => {
  const css = readSource("../extension/styles/quick-settings.css");
  const panelRule = css.match(/#cgpt-qs-panel\s*\{(?<body>[^}]+)\}/);
  const bgGridRule = css.match(/\.qs-bg-grid\s*\{(?<body>[^}]+)\}/);
  const layoutRule = css.match(/\.qs-row\.qs-blur-row,\s*\.qs-row\.qs-content-width-row\s*\{(?<body>[^}]+)\}/);

  assert.match(panelRule?.groups?.body || "", /width:\s*min\(340px,/);
  assert.match(layoutRule?.groups?.body || "", /display:\s*grid;/);
  assert.match(bgGridRule?.groups?.body || "", /grid-auto-flow:\s*column;/);
  assert.match(bgGridRule?.groups?.body || "", /grid-auto-columns:\s*minmax\(104px,\s*118px\);/);
  assert.match(bgGridRule?.groups?.body || "", /overflow-x:\s*auto;/);
  assert.match(bgGridRule?.groups?.body || "", /scroll-snap-type:\s*x proximity;/);
});

test("quick settings CSS has no dead glass appearance controls", () => {
  const css = readSource("../extension/styles/quick-settings.css");

  assert.equal(css.includes("cgpt-appearance-clear"), false);
  assert.equal(css.includes(".qs-pill"), false);
  assert.equal(css.includes('data-setting="appearance"'), false);
});
