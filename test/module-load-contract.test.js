const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const manifest = require("../extension/manifest.json");

const assertLoadsBefore = (entries, dependency, consumer) => {
  assert.ok(entries.includes(dependency), `${dependency} must be loaded`);
  assert.ok(entries.includes(consumer), `${consumer} must be loaded`);
  assert.ok(entries.indexOf(dependency) < entries.indexOf(consumer), `${dependency} must load before ${consumer}`);
};

test("shared helper modules load before the popup and content consumers", () => {
  const popupHtml = fs.readFileSync(require.resolve("../extension/popup/popup.html"), "utf8");
  const popupDocument = new JSDOM(popupHtml).window.document;
  const popupScriptEntries = Array.from(popupDocument.scripts, (script) => script.getAttribute("src"));
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
    assertLoadsBefore(contentScriptEntries, entry, "content/content.js");
  });
  assertLoadsBefore(contentScriptEntries, "content/targeting-phrases.js", "content/shared-utils.js");
  assertLoadsBefore(contentScriptEntries, "content/settings-controls.js", "content/quick-settings.js");
  assertLoadsBefore(popupScriptEntries, "../content/targeting-phrases.js", "../content/shared-utils.js");
  assertLoadsBefore(popupScriptEntries, "../content/runtime-client.js", "popup.js");
  assertLoadsBefore(popupScriptEntries, "../content/settings-controls.js", "popup.js");
  assertLoadsBefore(popupScriptEntries, "../content/refractive-glass.js", "popup.js");
});
