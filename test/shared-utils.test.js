const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const shared = require("../extension/content/shared-utils.js");

const EXTENSION_BASE_URL = "chrome-extension://abcd1234/";
const getExtensionUrl = (path = "") => `${EXTENSION_BASE_URL}${path}`;

test("sanitizeBackgroundUrl allows extension urls, data urls, and special keys", () => {
  assert.equal(
    shared.sanitizeBackgroundUrl(`${EXTENSION_BASE_URL}assets/backgrounds/blue-galaxy.webp`, EXTENSION_BASE_URL),
    `${EXTENSION_BASE_URL}assets/backgrounds/blue-galaxy.webp`
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

test("default background uses the built-in default preset sentinel", () => {
  assert.equal(shared.DEFAULT_BACKGROUND_PRESET_ID, "infraredNoir");
  assert.equal(shared.DEFAULT_SETTINGS.backgroundBlur, String(shared.DEFAULT_BACKGROUND_BLUR));
  assert.equal(shared.DEFAULT_SETTINGS.customBgUrl, "");
  assert.equal(
    shared.resolveBackgroundPresetIdFromUrl(shared.DEFAULT_SETTINGS.customBgUrl, getExtensionUrl),
    "default"
  );
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
  assert.equal(shared.sanitizeBackgroundBlur("not-a-number"), String(shared.DEFAULT_BACKGROUND_BLUR));
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

test("background presets expose bounded asset-tuned default blurs", () => {
  const presets = shared.getBackgroundPresets(getExtensionUrl);

  presets.forEach((preset) => {
    const defaultBlur = Number.parseInt(shared.getBackgroundPresetDefaultBlur(preset.id, getExtensionUrl), 10);
    assert.ok(defaultBlur >= shared.SETTING_BOUNDS.backgroundBlur.min);
    assert.ok(defaultBlur <= shared.SETTING_BOUNDS.backgroundBlur.max);
  });

  assert.equal(
    shared.getBackgroundPresetDefaultBlur("default", getExtensionUrl),
    String(shared.DEFAULT_BACKGROUND_BLUR)
  );
  assert.equal(
    shared.getBackgroundPresetDefaultBlur("infraredNoir", getExtensionUrl),
    String(shared.DEFAULT_BACKGROUND_BLUR)
  );
  assert.equal(shared.getBackgroundPresetDefaultBlur("spacePurpleStarsAlt", getExtensionUrl), "72");
});

test("generated ambient backgrounds are registered as local presets", () => {
  [
    ["obsidianBloom", "assets/backgrounds/obsidian-bloom.webp"],
    ["liquidSapphire", "assets/backgrounds/liquid-sapphire.webp"],
    ["velvetDusk", "assets/backgrounds/velvet-dusk.webp"],
    ["arcticGlass", "assets/backgrounds/arctic-glass.webp"],
    ["neuralField", "assets/backgrounds/neural-field.webp"],
    ["topographicMist", "assets/backgrounds/topographic-mist.webp"],
    ["infraredNoir", "assets/backgrounds/infrared-noir.webp"],
    ["emeraldDrift", "assets/backgrounds/emerald-drift.webp"],
  ].forEach(([presetId, expectedPath]) => {
    assert.equal(shared.getBackgroundPresetUrl(presetId, getExtensionUrl), getExtensionUrl(expectedPath));
  });
});

test("content default fallback points at infrared noir", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  assert.match(source, /const DEFAULT_BG_URL = getBackgroundPresetResolvedUrl\(DEFAULT_BACKGROUND_PRESET_ID\);/);
  assert.match(source, /data-bg-blur="\$\{escapeHtml\(preset\.defaultBlur\)\}"/);
  assert.match(source, /queueStorageWrite\("backgroundBlur", nextBlur\);/);
});

test("legacy/alias preset ids and urls are rejected", () => {
  assert.equal(shared.getBackgroundPresetUrl("blue", getExtensionUrl), "");
  assert.equal(shared.getBackgroundPresetUrl("animated", getExtensionUrl), "");
  assert.equal(
    shared.resolveBackgroundPresetIdFromUrl(getExtensionUrl("assets/backgrounds/removed-preset.png"), getExtensionUrl),
    null
  );
});

test("blue galaxy mapping resolves deterministically to canonical id", () => {
  const blueGalaxyUrl = shared.getBackgroundPresetUrl("spaceBlueGalaxy", getExtensionUrl);
  assert.equal(shared.resolveBackgroundPresetIdFromUrl(blueGalaxyUrl, getExtensionUrl), "spaceBlueGalaxy");
});

test("policy guard: preset alias tables must not exist", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/shared-utils.js"), "utf8");
  assert.equal(source.includes("BACKGROUND_PRESET_ID_ALIASES"), false);
  assert.equal(source.includes("BACKGROUND_PRESET_URL_ALIASES"), false);
});
