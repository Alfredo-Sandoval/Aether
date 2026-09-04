const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../extension/content/i18n-loader.js"), "utf8");
const catalogs = {
  en: require("../extension/_locales/en/messages.json"),
  es: require("../extension/_locales/es/messages.json"),
};

const createHarness = () => {
  const requests = [];
  const delays = [];
  const document = { readyState: "complete", documentElement: { lang: "en" } };
  const runtime = { id: "aether-test", getURL: (path) => `chrome-extension://aether-test/${path}` };
  let failures = 0;
  let status = 200;
  const context = vm.createContext({
    window: {},
    document,
    chrome: { runtime, i18n: { getUILanguage: () => "en", getMessage: () => "" } },
    localStorage: { getItem: () => null },
    console,
    TypeError,
    setTimeout(callback, delay) {
      delays.push(delay);
      callback();
    },
    async fetch(url) {
      requests.push(url);
      if (failures > 0) {
        failures -= 1;
        throw new TypeError("Failed to fetch");
      }
      const locale = url.includes("/es/") ? "es" : "en";
      return { ok: status === 200, status, json: async () => catalogs[locale] };
    },
  });
  vm.runInContext(source, context, { filename: "i18n-loader.js" });
  return {
    i18n: context.window.AetherI18n,
    document,
    runtime,
    requests,
    delays,
    failRequests(count) {
      failures = count;
    },
    setStatus(value) {
      status = value;
    },
  };
};

test("translation loading retries a failed fetch once before caching the real catalog", async () => {
  const h = createHarness();
  h.failRequests(1);
  assert.equal(await h.i18n.initialize(), "en");
  assert.equal(h.i18n.getMessage("extensionName"), catalogs.en.extensionName.message);
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.delays, [200]);
  await h.i18n.initialize();
  assert.equal(h.requests.length, 2);
});

test("persistent translation failures reject without poisoning the locale cache", async () => {
  const h = createHarness();
  h.failRequests(2);
  await assert.rejects(h.i18n.initialize(), /Failed to load bundled translations for en.*Reload/);
  assert.equal(h.requests.length, 2);
  assert.equal(h.i18n.getDetectedLocale(), null);
  await h.i18n.initialize();
  assert.equal(h.requests.length, 3);
  assert.equal(h.i18n.getMessage("extensionName"), catalogs.en.extensionName.message);
});

test("an unavailable extension context asks for a page reload without fetching", async () => {
  const h = createHarness();
  delete h.runtime.id;
  await assert.rejects(h.i18n.initialize(), /Extension context.*Reload this ChatGPT tab/);
  assert.equal(h.requests.length, 0);
});

test("missing catalog responses fail immediately and can recover on a later initialization", async () => {
  const h = createHarness();
  h.setStatus(404);
  await assert.rejects(h.i18n.initialize(), /translations for en.*HTTP 404/);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.delays, []);
  h.setStatus(200);
  await h.i18n.initialize();
  assert.equal(h.i18n.getMessage("extensionName"), catalogs.en.extensionName.message);
});

test("a failed language switch keeps the loaded locale and retries on the next check", async () => {
  const h = createHarness();
  await h.i18n.initialize();
  h.document.documentElement.lang = "es";
  h.failRequests(2);
  await assert.rejects(h.i18n.recheckLanguage(), /Failed to load bundled translations for es/);
  assert.equal(h.i18n.getDetectedLocale(), "en");
  assert.equal(await h.i18n.recheckLanguage(), true);
  assert.equal(h.i18n.getDetectedLocale(), "es");
  assert.equal(h.i18n.getMessage("actionTitle"), catalogs.es.actionTitle.message);
  assert.equal(await h.i18n.recheckLanguage(), false);
});
