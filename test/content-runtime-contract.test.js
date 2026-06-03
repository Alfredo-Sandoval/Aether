const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("content runtime avoids history monkey-patching and direct sync-storage fallback", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  assert.equal(source.includes("originalPushState"), false);
  assert.equal(source.includes("originalReplaceState"), false);
  assert.equal(source.includes("history.pushState = function"), false);
  assert.equal(source.includes("history.replaceState = function"), false);
  assert.equal(source.includes("chrome.storage.sync.get(null"), false);
  assert.equal(source.includes("sync-storage-fallback"), false);
  assert.match(source, /Runtime settings response did not include a settings payload/);
});

test("content tuning updates use CSS variables instead of stylesheet rewrites", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");

  assert.match(source, /root\.style\.setProperty\("--cgpt-thread-content-width"/);
  assert.match(source, /root\.style\.setProperty\("--cgpt-bg-blur-radius"/);
  assert.match(source, /root\.style\.setProperty\("--cgpt-bg-object-fit"/);
  assert.equal(source.includes("styleNode.textContent = newContent"), false);
  assert.match(styleSource, /object-fit:\s*var\(--cgpt-bg-object-fit, cover\);/);
});

test("content surface refreshes coalesce through animation frames", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  assert.match(source, /let surfaceTagsFrame = null;/);
  assert.match(source, /function queueSurfaceTagsRefresh\(\)/);
  assert.match(source, /function isResearchHomeMutation\(mutation\)/);
  assert.match(source, /mutations\.some\(isResearchHomeMutation\)/);
});

test("content runtime waits for settings before mounting configured theme", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  assert.match(source, /let hasLoadedSettingsSnapshot = false;/);
  assert.match(source, /function applyAllSettings\(\) \{\n\s+if \(!hasLoadedSettingsSnapshot\) return;/);
  assert.match(
    source,
    /settings = snapshot\.settings;\n\s+hasLoadedSettingsSnapshot = true;\n\s+\/\/ Apply all visual changes/
  );
  assert.doesNotMatch(source, /settings = sanitized;\n\s+hasLoadedSettingsSnapshot = true;\n\s+applyAllSettings\(\);/);
  assert.match(source, /Settings hydration was not authoritative/);
});

test("background GET_SETTINGS reports settings source to content runtime", () => {
  const source = fs.readFileSync(require.resolve("../extension/background/background.js"), "utf8");

  assert.match(source, /const buildSettingsResponse = \(settings\) => \(\{/);
  assert.match(source, /status: \{ source: settingsCacheSource \}/);
  assert.match(source, /sendResponse\(buildSettingsResponse\(settings\)\)/);
});
