const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const manifest = require("../manifest.json");

test("shared helper modules load before the popup and content consumers", () => {
  const popupHtml = fs.readFileSync(require.resolve("../popup.html"), "utf8");
  const contentScriptEntries = manifest.content_scripts.flatMap((contentScript) => contentScript.js || []);

  assert.equal(contentScriptEntries.includes("runtime-client.js"), true);
  assert.equal(contentScriptEntries.includes("content-surface-tools.js"), true);
  assert.ok(contentScriptEntries.indexOf("runtime-client.js") < contentScriptEntries.indexOf("content.js"));
  assert.ok(contentScriptEntries.indexOf("content-surface-tools.js") < contentScriptEntries.indexOf("content.js"));
  assert.ok(popupHtml.indexOf('src="runtime-client.js"') < popupHtml.indexOf('src="popup.js"'));
});

test("shared helper modules expose the extracted extension helpers", () => {
  const runtimeClient = require("../runtime-client.js");
  const surfaceTools = require("../content-surface-tools.js");

  assert.equal(typeof runtimeClient.sendRuntimeMessage, "function");
  assert.equal(typeof runtimeClient.requestSettingsUpdate, "function");
  assert.equal(typeof surfaceTools.createSurfaceTools, "function");
});
