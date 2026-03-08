const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const shared = require("../shared-utils.js");

const EXTENSION_BASE_URL = "chrome-extension://abcd1234/";
const getExtensionUrl = (path = "") => `${EXTENSION_BASE_URL}${path}`;

test("sanitizeBackgroundUrl allows extension urls, data urls, and special keys", () => {
  assert.equal(
    shared.sanitizeBackgroundUrl(`${EXTENSION_BASE_URL}Aether/blue-galaxy.webp`, EXTENSION_BASE_URL),
    `${EXTENSION_BASE_URL}Aether/blue-galaxy.webp`
  );
  assert.equal(
    shared.sanitizeBackgroundUrl("data:image/png;base64,AA==", EXTENSION_BASE_URL),
    "data:image/png;base64,AA=="
  );
  assert.equal(
    shared.sanitizeBackgroundUrl("data:video/webm;base64,AA==", EXTENSION_BASE_URL),
    "data:video/webm;base64,AA=="
  );
  assert.equal(shared.sanitizeBackgroundUrl("__jet__", EXTENSION_BASE_URL), "__jet__");
});

test("sanitizeBackgroundUrl rejects remote urls", () => {
  assert.equal(shared.sanitizeBackgroundUrl("https://example.com/image.webp", EXTENSION_BASE_URL), "");
  assert.equal(shared.sanitizeBackgroundUrl("javascript:alert(1)", EXTENSION_BASE_URL), "");
});

test("sanitizeBackgroundScaling accepts contain/cover and defaults to cover", () => {
  assert.equal(shared.sanitizeBackgroundScaling("contain"), "contain");
  assert.equal(shared.sanitizeBackgroundScaling("cover"), "cover");
  assert.equal(shared.sanitizeBackgroundScaling("fill"), "cover");
  assert.equal(shared.sanitizeBackgroundScaling(""), "cover");
});

test("sanitizeBackgroundBlur clamps and stringifies values", () => {
  assert.equal(shared.sanitizeBackgroundBlur("75"), "75");
  assert.equal(shared.sanitizeBackgroundBlur("999"), "150");
  assert.equal(shared.sanitizeBackgroundBlur("-4"), "0");
  assert.equal(shared.sanitizeBackgroundBlur("not-a-number"), "60");
});

test("sanitizeContentWidth clamps and stringifies values", () => {
  assert.equal(shared.sanitizeContentWidth("95"), "95");
  assert.equal(shared.sanitizeContentWidth("120"), "100");
  assert.equal(shared.sanitizeContentWidth("12"), "70");
  assert.equal(shared.sanitizeContentWidth("not-a-number"), "95");
});

test("escapeHtml escapes HTML metacharacters", () => {
  assert.equal(
    shared.escapeHtml("<script>\"x\"&'y'</script>"),
    "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;"
  );
});

test("coerceBooleanLike parses boolean-like values", () => {
  assert.equal(shared.coerceBooleanLike(true, false), true);
  assert.equal(shared.coerceBooleanLike(false, true), false);
  assert.equal(shared.coerceBooleanLike("true", false), true);
  assert.equal(shared.coerceBooleanLike("false", true), false);
  assert.equal(shared.coerceBooleanLike("1", false), true);
  assert.equal(shared.coerceBooleanLike("0", true), false);
  assert.equal(shared.coerceBooleanLike("yes", false), true);
  assert.equal(shared.coerceBooleanLike("no", true), false);
  assert.equal(shared.coerceBooleanLike(1, false), true);
  assert.equal(shared.coerceBooleanLike(0, true), false);
});

test("coerceBooleanLike falls back for invalid values", () => {
  assert.equal(shared.coerceBooleanLike("maybe", true), true);
  assert.equal(shared.coerceBooleanLike("maybe", false), false);
  assert.equal(shared.coerceBooleanLike({}, true), true);
  assert.equal(shared.coerceBooleanLike([], false), false);
});

test("background presets roundtrip preset -> url -> preset", () => {
  const presets = shared.getBackgroundPresets(getExtensionUrl);
  assert.ok(presets.length > 0);

  presets.forEach((preset) => {
    const resolvedUrl = shared.getBackgroundPresetUrl(preset.id, getExtensionUrl);
    const resolvedPresetId = shared.resolveBackgroundPresetIdFromUrl(resolvedUrl, getExtensionUrl);
    assert.equal(resolvedUrl, preset.url);
    assert.equal(resolvedPresetId, preset.id);
  });
});

test("legacy/alias preset ids and urls are rejected", () => {
  assert.equal(shared.getBackgroundPresetUrl("blue", getExtensionUrl), "");
  assert.equal(shared.getBackgroundPresetUrl("animated", getExtensionUrl), "");
  assert.equal(
    shared.resolveBackgroundPresetIdFromUrl(getExtensionUrl("Aether/grok_white.png"), getExtensionUrl),
    null
  );
});

test("blue galaxy mapping resolves deterministically to canonical id", () => {
  const blueGalaxyUrl = shared.getBackgroundPresetUrl("spaceBlueGalaxy", getExtensionUrl);
  assert.equal(shared.resolveBackgroundPresetIdFromUrl(blueGalaxyUrl, getExtensionUrl), "spaceBlueGalaxy");
});

test("policy guard: preset alias tables must not exist", () => {
  const source = fs.readFileSync(require.resolve("../shared-utils.js"), "utf8");
  assert.equal(source.includes("BACKGROUND_PRESET_ID_ALIASES"), false);
  assert.equal(source.includes("BACKGROUND_PRESET_URL_ALIASES"), false);
});
