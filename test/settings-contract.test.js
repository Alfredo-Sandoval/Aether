const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const shared = require("../extension/content/shared-utils.js");

const EXTENSION_BASE_URL = "chrome-extension://abcd1234/";
const contentSource = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
const quickSettingsSource = fs.readFileSync(require.resolve("../extension/content/quick-settings.js"), "utf8");
const popupHtml = fs.readFileSync(require.resolve("../extension/popup/popup.html"), "utf8");
const popupSource = fs.readFileSync(require.resolve("../extension/popup/popup.js"), "utf8");
const popupCss = fs.readFileSync(require.resolve("../extension/popup/popup.css"), "utf8");

test("getDefaultSettings returns a fresh clone of defaults", () => {
  const first = shared.getDefaultSettings();
  const second = shared.getDefaultSettings();

  assert.notEqual(first, second);
  assert.equal("appearance" in first, false);

  first.accentColor = "blue";
  assert.equal(second.accentColor, "none");
  assert.equal(shared.DEFAULT_SETTINGS.accentColor, "none");
});

test("sanitizeSettingsPayload normalizes enums, booleans, and bounded values", () => {
  const { sanitized, patch } = shared.sanitizeSettingsPayload(
    {
      theme: "light",
      appearance: "glass",
      accentColor: "green",
      hideUpgradeButtons: "yes",
      backgroundBlur: "999",
      contentWidth: "12",
      backgroundScaling: "fill",
    },
    { extensionBaseUrl: EXTENSION_BASE_URL }
  );

  assert.equal("theme" in sanitized, false);
  assert.equal("appearance" in sanitized, false);
  assert.equal("appearance" in patch, false);
  assert.equal(sanitized.accentColor, "none");
  assert.equal(sanitized.hideUpgradeButtons, true);
  assert.equal(sanitized.backgroundBlur, "150");
  assert.equal(sanitized.contentWidth, "70");
  assert.equal(sanitized.backgroundScaling, "cover");
  assert.equal(patch.backgroundBlur, "150");
});

test("sanitizeSettingsPayload rejects remote background urls and preserves extension urls", () => {
  const localUrl = `${EXTENSION_BASE_URL}assets/backgrounds/blue-galaxy.webp`;

  const remote = shared.sanitizeSettingsPayload(
    { customBgUrl: "https://example.com/image.webp" },
    { extensionBaseUrl: EXTENSION_BASE_URL }
  );
  assert.equal(remote.sanitized.customBgUrl, "");

  const local = shared.sanitizeSettingsPayload({ customBgUrl: localUrl }, { extensionBaseUrl: EXTENSION_BASE_URL });
  assert.equal(local.sanitized.customBgUrl, localUrl);
});

test("popup option registries stay aligned with default setting values", () => {
  assert.ok(shared.POPUP_ACCENT_COLOR_OPTIONS.some((option) => option.value === shared.DEFAULT_SETTINGS.accentColor));
  assert.ok(shared.POPUP_BACKGROUND_PRESET_OPTIONS.some((option) => option.value === "default"));
});

test("policy guard: custom background option stays removed", () => {
  assert.equal(
    shared.POPUP_BACKGROUND_PRESET_OPTIONS.some((option) => option.value === "custom"),
    false
  );
});

test("popup background picker uses the preset grid instead of the retired custom select", () => {
  assert.equal(popupHtml.includes('id="bgPresetGrid"'), true);
  assert.equal(popupHtml.includes('role="radiogroup"'), true);
  assert.equal(popupHtml.includes('id="bgPreset"'), false);
  assert.equal(popupSource.includes('createBackgroundGrid("bgPresetGrid")'), true);
  assert.equal(popupSource.includes("CUSTOM_BG_PRESET_ID"), false);
});

test("popup background presets stay readable in a horizontal filmstrip", () => {
  const gridRule = popupCss.match(/\.bg-preset-grid\s*\{(?<body>[^}]+)\}/);
  const tileRule = popupCss.match(/\.bg-preset-tile\s*\{(?<body>[^}]+)\}/);

  assert.ok(gridRule?.groups?.body, "missing popup background preset grid styles");
  assert.ok(tileRule?.groups?.body, "missing popup background preset tile styles");
  assert.match(gridRule.groups.body, /grid-auto-flow:\s*column;/);
  assert.match(gridRule.groups.body, /grid-auto-columns:\s*minmax\(124px,\s*140px\);/);
  assert.match(gridRule.groups.body, /overflow-x:\s*auto;/);
  assert.match(gridRule.groups.body, /overflow-y:\s*hidden;/);
  assert.match(gridRule.groups.body, /scroll-snap-type:\s*x proximity;/);
  assert.doesNotMatch(gridRule.groups.body, /max-height:/);
  assert.doesNotMatch(gridRule.groups.body, /grid-template-columns:/);
  assert.match(tileRule.groups.body, /scroll-snap-align:\s*start;/);
});

test("popup controls keep explicit accessibility wiring", () => {
  const svgTags = popupHtml.match(/<svg\b[\s\S]*?>/g) || [];
  const buttonTags = popupHtml.match(/<button\b[\s\S]*?>/g) || [];
  const hiddenSvgCount = svgTags.filter(
    (tag) => tag.includes('aria-hidden="true"') && tag.includes('focusable="false"')
  ).length;

  assert.equal(popupHtml.includes('<html lang="en">'), true);
  assert.equal(popupSource.includes("document.documentElement.lang = uiLanguage"), true);
  assert.equal(popupHtml.includes('aria-labelledby="bgScalingLabel bgScalingValue"'), true);
  assert.equal(popupHtml.includes('aria-labelledby="accentColorLabel accentColorValue"'), true);
  assert.equal(popupHtml.includes('role="alertdialog" aria-modal="true" aria-labelledby="confirmationMessage"'), true);
  assert.match(
    popupHtml,
    /<input[\s\S]*?id="importSettingsInput"[\s\S]*?aria-labelledby="importSettings"[\s\S]*?tabindex="-1"/
  );
  assert.equal(quickSettingsSource.includes('btn.type = "button"'), true);
  assert.equal(
    buttonTags.every((tag) => tag.includes('type="button"')),
    true
  );
  assert.match(popupSource, /cancelBtn\.focus\(\{ preventScroll: true \}\);/);
  assert.match(popupSource, /event\.key === "Escape"/);
  assert.match(popupSource, /event\.key !== "Tab"/);
  assert.match(popupSource, /previouslyFocused\.focus\(\{ preventScroll: true \}\);/);
  assert.equal(hiddenSvgCount, svgTags.length);
  assert.equal(popupCss.includes("transition: all"), false);
});

test("popup uses the shared restrained refraction treatment", () => {
  const tabRules = [...popupCss.matchAll(/\.tab-nav\s*\{(?<body>[^}]+)\}/g)];
  const refractiveTabRule = tabRules.find((rule) => rule.groups?.body.includes("--popup-refractive-filter"));

  assert.ok(refractiveTabRule?.groups?.body, "missing popup tab surface styles");
  assert.match(refractiveTabRule.groups.body, /var\(--popup-refractive-filter\);/);
  assert.match(popupSource, /ensureRefractiveGlassFilter\(document\)/);
  assert.match(
    popupCss,
    /@media \(prefers-reduced-transparency: reduce\)[\s\S]*\.tab-nav,[\s\S]*backdrop-filter: none;/
  );
});

test("popup keyboard tabs move from the focused tab", () => {
  assert.equal(popupSource.includes("moveTabSelection(1, currentTab)"), true);
  assert.equal(popupSource.includes("moveTabSelection(-1, currentTab)"), true);
});

test("popup custom selects stack above sibling sections and open toward available space", () => {
  assert.match(popupCss, /\.tab-pane > \.row:has\(\.custom-select\.is-open\)\s*\{[^}]*z-index:\s*20;/);
  assert.match(popupCss, /\.custom-select\.opens-upward \.select-options\s*\{[^}]*bottom:/);
  assert.equal(popupSource.includes('container.classList.toggle("opens-upward"'), true);
});

test("range, switch, and compact action controls keep usable pointer targets", () => {
  assert.match(popupCss, /\.switch\s*\{[^}]*height:\s*24px;/);
  assert.match(popupCss, /input\[type="range"\]\s*\{[^}]*height:\s*24px;/);
  assert.match(popupCss, /\.section-action\s*\{[^}]*min-height:\s*24px;/);

  const quickSettingsCss = fs.readFileSync(require.resolve("../extension/styles/quick-settings.css"), "utf8");
  assert.match(quickSettingsCss, /\.qs-range-control input\[type="range"\],[\s\S]*?height:\s*24px;/);
});

test("popup owns scrolling inside the bounded action viewport", () => {
  const bodyRule = popupCss.match(/body\s*\{(?<body>[^}]+)\}/);
  const contentRule = popupCss.match(/\.tab-content\s*\{(?<body>[^}]+)\}/);

  assert.match(bodyRule?.groups?.body || "", /height:\s*calc\(100vh - 20px\);/);
  assert.match(bodyRule?.groups?.body || "", /overflow:\s*hidden;/);
  assert.match(contentRule?.groups?.body || "", /min-height:\s*0;/);
  assert.match(contentRule?.groups?.body || "", /overflow-y:\s*auto;/);
});

test("popup welcome action targets the content runtime instead of an external page", () => {
  assert.equal(popupHtml.includes('<title data-i18n="popupTitle">'), true);
  assert.equal(popupSource.includes('type: "AETHER_SHOW_WELCOME"'), true);
  assert.equal(contentSource.includes('request?.type === "AETHER_SHOW_WELCOME"'), true);
  assert.equal(popupSource.includes("github.com/Alfredo-Sandoval/Aether"), false);
});

test("confirmation dialog traps and restores keyboard focus", () => {
  assert.equal(popupSource.includes('document.addEventListener("keydown", handleKeydown, true)'), true);
  assert.equal(popupSource.includes('if (event.key === "Escape")'), true);
  assert.equal(popupSource.includes("previouslyFocused.focus({ preventScroll: true })"), true);
  assert.equal(popupSource.includes("cancelBtn.focus({ preventScroll: true })"), true);
});

test("policy guard: retired custom background media paths stay removed", () => {
  assert.equal(contentSource.includes('option.value !== "custom"'), false);
  assert.equal(contentSource.includes('startsWith("data:video")'), false);
});

test("settings key registries remain aligned with default settings", () => {
  assert.deepEqual([...shared.SETTINGS_KEYS].sort(), Object.keys(shared.DEFAULT_SETTINGS).sort());
  assert.ok(shared.BOOLEAN_SETTING_KEYS.includes("hideUpgradeButtons"));
  assert.ok(shared.BOOLEAN_SETTING_KEYS.includes("blurChatHistory"));
});

test("policy guard: glass appearance mode settings stay removed", () => {
  assert.equal("appearance" in shared.DEFAULT_SETTINGS, false);
  assert.equal("APPEARANCE_VALUES" in shared, false);
  assert.equal("POPUP_APPEARANCE_OPTIONS" in shared, false);
  assert.equal("sanitizeAppearance" in shared, false);
});
