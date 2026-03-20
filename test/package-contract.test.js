const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { collectExpectedEntries } = require("../scripts/validate-package.js");

test("package inventory is derived from validator expectations", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const packageEntries = collectExpectedEntries(repoRoot);
  const packageScript = fs.readFileSync(path.join(repoRoot, "package.sh"), "utf8");

  assert.equal(packageEntries.includes("runtime-client.js"), true);
  assert.equal(packageEntries.includes("content-surface-tools.js"), true);
  assert.equal(packageEntries.includes("popup.css"), true);
  assert.equal(packageEntries.includes("manifest.json"), true);
  assert.equal(packageScript.includes("collectExpectedEntries"), true);
});
