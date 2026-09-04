const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const popupHtml = fs.readFileSync(require.resolve("../extension/popup/popup.html"), "utf8");
const popupSource = fs.readFileSync(require.resolve("../extension/popup/popup.js"), "utf8");
const manifestSource = fs.readFileSync(require.resolve("../extension/manifest.json"), "utf8");
const englishMessages = require("../extension/_locales/en/messages.json");
const spanishMessages = require("../extension/_locales/es/messages.json");

const extractPopupKeys = (...sources) => {
  const keys = new Set();
  const attrPattern = /data-i18n(?:-placeholder|-title|-aria-label)?="([^"]+)"/g;
  const msgPattern = /__MSG_([A-Za-z0-9]+)__/g;
  const getMessagePattern = /getMessage\("([A-Za-z0-9]+)"/g;

  sources.forEach((source) => {
    for (const match of source.matchAll(attrPattern)) {
      keys.add(match[1]);
    }

    for (const match of source.matchAll(msgPattern)) {
      keys.add(match[1]);
    }

    for (const match of source.matchAll(getMessagePattern)) {
      keys.add(match[1]);
    }
  });

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
  const popupKeys = extractPopupKeys(popupHtml, popupSource);
  const messageKeys = new Set(Object.keys(englishMessages));
  const missingKeys = popupKeys.filter((key) => !messageKeys.has(key));

  assert.deepEqual(missingKeys, []);
});

test("popup locale keys are covered by the Spanish messages catalog", () => {
  const popupKeys = extractPopupKeys(popupHtml, popupSource);
  const messageKeys = new Set(Object.keys(spanishMessages));
  const missingKeys = popupKeys.filter((key) => !messageKeys.has(key));

  assert.deepEqual(missingKeys, []);
});

test("manifest locale keys are covered by the English messages catalog", () => {
  const manifestKeys = extractMessagePlaceholderKeys(manifestSource);
  const messageKeys = new Set(Object.keys(englishMessages));
  const missingKeys = manifestKeys.filter((key) => !messageKeys.has(key));

  assert.deepEqual(missingKeys, []);
});

test("every shipped locale has a targeting-phrase table", () => {
  const path = require("node:path");
  const targetingPhrases = require("../extension/content/targeting-phrases.js");
  const localesDir = path.resolve(__dirname, "..", "extension", "_locales");
  const shippedLocales = fs
    .readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(Object.keys(targetingPhrases.locales).sort(), shippedLocales);
  for (const locale of shippedLocales) {
    assert.ok(
      Object.keys(targetingPhrases.locales[locale]).length > 0,
      `targeting phrases for "${locale}" must not be empty`
    );
  }
});
