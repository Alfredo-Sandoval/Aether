const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const manifest = require("../manifest.json");

const popupHtml = fs.readFileSync(require.resolve("../popup.html"), "utf8");
const contentScriptEntries = manifest.content_scripts.flatMap((contentScript) => contentScript.js || []);

test("popup and content settings writes go through runtime messages instead of direct sync writes", () => {
  const popupSource = fs.readFileSync(require.resolve("../popup.js"), "utf8");
  const contentSource = fs.readFileSync(require.resolve("../content.js"), "utf8");

  assert.equal(popupSource.includes("chrome.storage.sync.set("), false);
  assert.equal(contentSource.includes("chrome.storage.sync.set("), false);
  assert.equal(popupSource.includes("AetherRuntimeClient"), true);
  assert.equal(contentSource.includes("AetherRuntimeClient"), true);
  assert.equal(popupHtml.includes('src="runtime-client.js"'), true);
  assert.equal(contentScriptEntries.includes("runtime-client.js"), true);
});
