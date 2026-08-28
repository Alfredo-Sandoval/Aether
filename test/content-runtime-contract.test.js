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

test("ambient background dithers low-contrast gradients without animation", () => {
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");
  const ditherRule = styleSource.match(/#cgpt-ambient-bg::after\s*\{([\s\S]*?)\}/)?.[1] || "";

  assert.match(ditherRule, /feTurbulence/);
  assert.match(ditherRule, /stitchTiles='stitch'/);
  assert.match(ditherRule, /background-size:\s*128px 128px;/);
  assert.match(ditherRule, /mix-blend-mode:\s*normal;/);
  assert.match(ditherRule, /opacity:\s*var\(--ambient-dither-opacity\);/);
  assert.equal(/animation|transition/.test(ditherRule), false);
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

test("content retries preserve newer pending settings and teardown queued work", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  assert.match(source, /let storageWriteInFlight = false;/);
  assert.match(source, /storageWriteQueue = \{ \.\.\.batch, \.\.\.storageWriteQueue \};/);
  assert.match(source, /storageWriteDisposed = true;/);
  assert.match(source, /debouncedCriticalChecks\.cancel\(\);/);
  assert.match(source, /debouncedOtherChecks\.cancel\(\);/);
});

test("failure-safe and accessible media modes keep native chrome and background dimming", () => {
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");

  assert.match(styleSource, /^html\.cgpt-ambient-on form\[data-type="unified-composer"\]/m);
  assert.doesNotMatch(styleSource, /^form\[data-type="unified-composer"\]/m);
  assert.equal((styleSource.match(/filter:\s*var\(--bg-filter\) !important;/g) || []).length >= 2, true);
});

test("refractive glass is limited to active surfaces with native fallbacks", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");
  const sidebarSource = fs.readFileSync(require.resolve("../extension/styles/sidebar.css"), "utf8");

  assert.match(source, /AetherRefractiveGlass/);
  assert.match(source, /ensureRefractiveGlassFilter\(document\)/);
  assert.match(styleSource, /--glass-refractive-filter:\s*var\(--aether-refractive-filter, opacity\(1\)\);/);
  assert.match(styleSource, /saturate\(124%\) var\(--glass-refractive-filter\)/);
  assert.match(styleSource, /saturate\(var\(--glass-tier-raised-saturate\)\)[\s\S]*var\(--glass-refractive-filter\)/);
  assert.equal(sidebarSource.includes("glass-refractive-filter"), false);
});
