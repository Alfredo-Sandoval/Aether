const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("content runtime avoids history monkey-patching and keeps a sync-storage fallback", () => {
  const source = fs.readFileSync(require.resolve("../content.js"), "utf8");

  assert.equal(source.includes("originalPushState"), false);
  assert.equal(source.includes("originalReplaceState"), false);
  assert.equal(source.includes("history.pushState = function"), false);
  assert.equal(source.includes("history.replaceState = function"), false);
  assert.equal(source.includes("chrome.storage.sync.get(null"), true);
});
