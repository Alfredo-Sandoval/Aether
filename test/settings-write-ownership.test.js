const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const manifest = require("../extension/manifest.json");

const popupHtml = fs.readFileSync(require.resolve("../extension/popup/popup.html"), "utf8");
const contentScriptEntries = manifest.content_scripts.flatMap((contentScript) => contentScript.js || []);

test("popup and content settings writes go through runtime messages instead of direct sync writes", () => {
  const popupSource = fs.readFileSync(require.resolve("../extension/popup/popup.js"), "utf8");
  const contentSource = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  assert.equal(popupSource.includes("chrome.storage.sync.set("), false);
  assert.equal(contentSource.includes("chrome.storage.sync.set("), false);
  assert.equal(popupSource.includes("AetherRuntimeClient"), true);
  assert.equal(contentSource.includes("AetherRuntimeClient"), true);
  assert.equal(popupHtml.includes('src="../content/runtime-client.js"'), true);
  assert.equal(contentScriptEntries.includes("content/runtime-client.js"), true);
});

test("popup does not expose page-snapshot export controls", () => {
  const popupSource = fs.readFileSync(require.resolve("../extension/popup/popup.js"), "utf8");

  assert.equal(popupHtml.includes("exportDomSnapshot"), false);
  assert.equal(popupHtml.includes("exportSurfaceCrawl"), false);
  assert.equal(popupHtml.includes("sectionPageTools"), false);
  assert.equal(popupSource.includes("AETHER_CAPTURE_DOM_SNAPSHOT"), false);
  assert.equal(popupSource.includes("AETHER_CRAWL_SURFACES"), false);
});
