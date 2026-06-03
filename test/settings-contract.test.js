const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const shared = require("../extension/content/shared-utils.js");

const EXTENSION_BASE_URL = "chrome-extension://abcd1234/";
const contentSource = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
const popupHtml = fs.readFileSync(require.resolve("../extension/popup/popup.html"), "utf8");
const popupSource = fs.readFileSync(require.resolve("../extension/popup/popup.js"), "utf8");

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
