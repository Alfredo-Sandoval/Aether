const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const popupHtml = fs.readFileSync(require.resolve("../extension/popup/popup.html"), "utf8");
const manifestSource = fs.readFileSync(require.resolve("../extension/manifest.json"), "utf8");
const loaderSource = fs.readFileSync(require.resolve("../extension/content/i18n-loader.js"), "utf8");
const englishMessages = require("../extension/_locales/en/messages.json");
const spanishMessages = require("../extension/_locales/es/messages.json");

const extractPopupKeys = (source) => {
  const keys = new Set();
  const attrPattern = /data-i18n(?:-placeholder|-title|-aria-label)?="([^"]+)"/g;
  const msgPattern = /__MSG_([A-Za-z0-9]+)__/g;

  for (const match of source.matchAll(attrPattern)) {
    keys.add(match[1]);
  }

  for (const match of source.matchAll(msgPattern)) {
    keys.add(match[1]);
  }

  return [...keys].sort();
};

const extractMessagePlaceholderKeys = (source) => {
  const keys = new Set();
  const msgPattern = /__MSG_([A-Za-z0-9]+)__/g;

  for (const match of source.matchAll(msgPattern)) {
    keys.add(match[1]);
  }

  return [...keys].sort();
};

test("popup locale keys are covered by the English messages catalog", () => {
  const popupKeys = extractPopupKeys(popupHtml);
  const messageKeys = new Set(Object.keys(englishMessages));
  const missingKeys = popupKeys.filter((key) => !messageKeys.has(key));

  assert.deepEqual(missingKeys, []);
});

test("manifest locale keys are covered by the English messages catalog", () => {
  const manifestKeys = extractMessagePlaceholderKeys(manifestSource);
  const messageKeys = new Set(Object.keys(englishMessages));
  const missingKeys = manifestKeys.filter((key) => !messageKeys.has(key));

  assert.deepEqual(missingKeys, []);
});

test("retired custom background locale keys stay removed", () => {
  assert.equal("bgPresetOptionCustom" in englishMessages, false);
  assert.equal("bgPresetOptionCustom" in spanishMessages, false);
});

test("i18n loader no longer embeds a fallback English catalog", () => {
  assert.equal(loaderSource.includes("DEFAULT_EN_TRANSLATIONS"), false);
  assert.equal(loaderSource.includes("Embedded fallback translations"), false);
});

test("i18n debug helper does not dump localStorage values", () => {
  assert.equal(loaderSource.includes("All localStorage keys"), false);
  assert.equal(loaderSource.includes("console.log(`  ${key}:`, localStorage.getItem(key))"), false);
  assert.equal(loaderSource.includes("Language-related localStorage keys"), true);
});

test("i18n debug helper does not scan every localStorage key", () => {
  assert.equal(loaderSource.includes("localStorage.length"), false);
  assert.equal(loaderSource.includes("localStorage.key("), false);
  assert.equal(loaderSource.includes("LANGUAGE_STORAGE_KEYS.filter"), true);
});
