const test = require("node:test");
const assert = require("node:assert/strict");

const shared = require("../shared-utils.js");

const EXTENSION_BASE_URL = "chrome-extension://abcd1234/";

test("getDefaultSettings returns a fresh clone of defaults", () => {
  const first = shared.getDefaultSettings();
  const second = shared.getDefaultSettings();

  assert.notEqual(first, second);
  assert.equal(first.theme, "auto");

  first.theme = "light";
  assert.equal(second.theme, "auto");
  assert.equal(shared.DEFAULT_SETTINGS.theme, "auto");
});

test("sanitizeSettingsPayload normalizes enums, booleans, and bounded values", () => {
  const { sanitized, patch } = shared.sanitizeSettingsPayload(
    {
      theme: "neon",
      appearance: "glass",
      accentColor: "green",
      hideUpgradeButtons: "yes",
      backgroundBlur: "999",
      contentWidth: "12",
      backgroundScaling: "fill",
    },
    { extensionBaseUrl: EXTENSION_BASE_URL }
  );

  assert.equal(sanitized.theme, "auto");
  assert.equal(sanitized.appearance, "dimmed");
  assert.equal(sanitized.accentColor, "none");
  assert.equal(sanitized.hideUpgradeButtons, true);
  assert.equal(sanitized.backgroundBlur, "150");
  assert.equal(sanitized.contentWidth, "70");
  assert.equal(sanitized.backgroundScaling, "cover");
  assert.equal(patch.theme, "auto");
  assert.equal(patch.backgroundBlur, "150");
});

test("sanitizeSettingsPayload rejects remote background urls and preserves extension urls", () => {
  const localUrl = `${EXTENSION_BASE_URL}Aether/blue-galaxy.webp`;

  const remote = shared.sanitizeSettingsPayload(
    { customBgUrl: "https://example.com/image.webp" },
    { extensionBaseUrl: EXTENSION_BASE_URL }
  );
  assert.equal(remote.sanitized.customBgUrl, "");

  const local = shared.sanitizeSettingsPayload({ customBgUrl: localUrl }, { extensionBaseUrl: EXTENSION_BASE_URL });
  assert.equal(local.sanitized.customBgUrl, localUrl);
});

test("popup option registries stay aligned with default setting values", () => {
  assert.ok(shared.POPUP_THEME_OPTIONS.some((option) => option.value === shared.DEFAULT_SETTINGS.theme));
  assert.ok(shared.POPUP_APPEARANCE_OPTIONS.some((option) => option.value === shared.DEFAULT_SETTINGS.appearance));
  assert.ok(shared.POPUP_ACCENT_COLOR_OPTIONS.some((option) => option.value === shared.DEFAULT_SETTINGS.accentColor));
  assert.ok(
    shared.POPUP_BACKGROUND_PRESET_OPTIONS.some((option) => option.value === "custom" && option.hidden === true)
  );
});

test("settings key registries remain aligned with default settings", () => {
  assert.deepEqual([...shared.SETTINGS_KEYS].sort(), Object.keys(shared.DEFAULT_SETTINGS).sort());
  assert.ok(shared.BOOLEAN_SETTING_KEYS.includes("hideUpgradeButtons"));
  assert.ok(shared.BOOLEAN_SETTING_KEYS.includes("blurChatHistory"));
});
