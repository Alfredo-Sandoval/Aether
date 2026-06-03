const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { collectExpectedEntries } = require("../scripts/validate-package.js");

test("package inventory is derived from validator expectations", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const packageEntries = collectExpectedEntries(repoRoot);
  const packageScript = fs.readFileSync(path.join(repoRoot, "package.sh"), "utf8");

  assert.equal(packageEntries.includes("content/runtime-client.js"), true);
  assert.equal(packageEntries.includes("content/sidebar-tools.js"), true);
  assert.equal(packageEntries.includes("content/research-tools.js"), true);
  assert.equal(packageEntries.includes("background/background.js"), true);
  assert.equal(packageEntries.includes("popup/popup.html"), true);
  assert.equal(packageEntries.includes("popup/popup.css"), true);
  assert.equal(packageEntries.includes("manifest.json"), true);
  assert.equal(
    packageEntries.some((entry) => entry.startsWith("extension/")),
    false
  );
  assert.equal(packageScript.includes("collectExpectedEntries"), true);
});

test("extension load root is unambiguous", () => {
  const repoRoot = path.resolve(__dirname, "..");

  assert.equal(fs.existsSync(path.join(repoRoot, "manifest.json")), false);
  assert.equal(fs.existsSync(path.join(repoRoot, "assets")), false);
  assert.equal(fs.existsSync(path.join(repoRoot, "_locales")), false);
  assert.equal(fs.existsSync(path.join(repoRoot, "extension", "manifest.json")), true);
});
