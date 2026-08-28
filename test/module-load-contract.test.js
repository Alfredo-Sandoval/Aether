const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const manifest = require("../extension/manifest.json");

test("shared helper modules load before the popup and content consumers", () => {
  const popupHtml = fs.readFileSync(require.resolve("../extension/popup/popup.html"), "utf8");
  const contentScriptEntries = manifest.content_scripts.flatMap((contentScript) => contentScript.js || []);

  const helperModules = [
    "content/runtime-client.js",
    "content/sidebar-tools.js",
    "content/research-tools.js",
    "content/background-media.js",
    "content/surface-tagging.js",
    "content/refractive-glass.js",
    "content/welcome-screen.js",
    "content/settings-controls.js",
    "content/quick-settings.js",
  ];
  helperModules.forEach((entry) => {
    assert.equal(contentScriptEntries.includes(entry), true, `${entry} must be a content script`);
    assert.ok(
      contentScriptEntries.indexOf(entry) < contentScriptEntries.indexOf("content/content.js"),
      `${entry} must load before content.js`
    );
  });
  assert.ok(
    contentScriptEntries.indexOf("content/targeting-phrases.js") <
      contentScriptEntries.indexOf("content/shared-utils.js")
  );
  assert.ok(
    contentScriptEntries.indexOf("content/settings-controls.js") <
      contentScriptEntries.indexOf("content/quick-settings.js")
  );
  assert.ok(
    popupHtml.indexOf('src="../content/targeting-phrases.js"') < popupHtml.indexOf('src="../content/shared-utils.js"')
  );
  assert.ok(popupHtml.indexOf('src="../content/runtime-client.js"') < popupHtml.indexOf('src="popup.js"'));
  assert.ok(popupHtml.indexOf('src="../content/settings-controls.js"') < popupHtml.indexOf('src="popup.js"'));
  assert.ok(popupHtml.indexOf('src="../content/refractive-glass.js"') < popupHtml.indexOf('src="popup.js"'));
});

test("background worker imports shared utilities with a static relative path", () => {
  const backgroundScript = fs.readFileSync(require.resolve("../extension/background/background.js"), "utf8");

  assert.match(backgroundScript, /importScripts\("\.\.\/content\/shared-utils\.js"\)/);
  assert.ok(
    backgroundScript.indexOf('importScripts("../content/targeting-phrases.js")') <
      backgroundScript.indexOf('importScripts("../content/shared-utils.js")')
  );
  assert.doesNotMatch(backgroundScript, /importScripts\(chrome\.runtime\.getURL/);
  assert.doesNotMatch(backgroundScript, /getSharedUtilsScriptUrl/);
});

test("shared helper modules expose the extracted extension helpers", () => {
  const runtimeClient = require("../extension/content/runtime-client.js");
  const sidebarTools = require("../extension/content/sidebar-tools.js");
  const researchTools = require("../extension/content/research-tools.js");
  const backgroundMedia = require("../extension/content/background-media.js");
  const surfaceTagging = require("../extension/content/surface-tagging.js");
  const refractiveGlass = require("../extension/content/refractive-glass.js");
  const welcomeScreen = require("../extension/content/welcome-screen.js");
  const settingsControls = require("../extension/content/settings-controls.js");
  const quickSettings = require("../extension/content/quick-settings.js");

  assert.equal(typeof runtimeClient.sendRuntimeMessage, "function");
  assert.equal(typeof runtimeClient.requestSettingsUpdate, "function");
  assert.equal(typeof sidebarTools.createSidebarTools, "function");
  assert.equal(typeof researchTools.createResearchSurfaceTools, "function");
  assert.equal(typeof backgroundMedia.createBackgroundMediaEngine, "function");
  assert.equal(typeof surfaceTagging.createSurfaceTagging, "function");
  assert.equal(typeof refractiveGlass.ensureRefractiveGlassFilter, "function");
  assert.equal(typeof refractiveGlass.removeRefractiveGlassFilter, "function");
  assert.equal(typeof welcomeScreen.createWelcomeScreen, "function");
  assert.equal(typeof settingsControls.createRangeControlBinding, "function");
  assert.equal(typeof settingsControls.createBackgroundTileGrid, "function");
  assert.equal(typeof quickSettings.createQuickSettingsPanel, "function");
});
