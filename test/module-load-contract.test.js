const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const manifest = require("../extension/manifest.json");

test("shared helper modules load before the popup and content consumers", () => {
  const popupHtml = fs.readFileSync(require.resolve("../extension/popup/popup.html"), "utf8");
  const contentScriptEntries = manifest.content_scripts.flatMap((contentScript) => contentScript.js || []);

  assert.equal(contentScriptEntries.includes("content/runtime-client.js"), true);
  assert.equal(contentScriptEntries.includes("content/sidebar-tools.js"), true);
  assert.equal(contentScriptEntries.includes("content/research-tools.js"), true);
  assert.equal(contentScriptEntries.includes("content/surface-tools.js"), false);
  assert.ok(
    contentScriptEntries.indexOf("content/runtime-client.js") < contentScriptEntries.indexOf("content/content.js")
  );
  assert.ok(
    contentScriptEntries.indexOf("content/sidebar-tools.js") < contentScriptEntries.indexOf("content/content.js")
  );
  assert.ok(
    contentScriptEntries.indexOf("content/research-tools.js") < contentScriptEntries.indexOf("content/content.js")
  );
  assert.ok(popupHtml.indexOf('src="../content/runtime-client.js"') < popupHtml.indexOf('src="popup.js"'));
});

test("background worker imports shared utilities with a static relative path", () => {
  const backgroundScript = fs.readFileSync(require.resolve("../extension/background/background.js"), "utf8");

  assert.match(backgroundScript, /importScripts\("\.\.\/content\/shared-utils\.js"\)/);
  assert.doesNotMatch(backgroundScript, /importScripts\(chrome\.runtime\.getURL/);
  assert.doesNotMatch(backgroundScript, /getSharedUtilsScriptUrl/);
});

test("shared helper modules expose the extracted extension helpers", () => {
  const runtimeClient = require("../extension/content/runtime-client.js");
  const sidebarTools = require("../extension/content/sidebar-tools.js");
  const researchTools = require("../extension/content/research-tools.js");

  assert.equal(typeof runtimeClient.sendRuntimeMessage, "function");
  assert.equal(typeof runtimeClient.requestSettingsUpdate, "function");
  assert.equal(typeof sidebarTools.createSidebarTools, "function");
  assert.equal(typeof researchTools.createResearchSurfaceTools, "function");
});
