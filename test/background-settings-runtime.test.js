const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const shared = require("../extension/content/shared-utils.js");

const createBackgroundHarness = () => {
  const source = fs.readFileSync(require.resolve("../extension/background/background.js"), "utf8");
  const persisted = shared.getDefaultSettings();
  let failNextSyncWrite = false;
  let messageListener = null;
  const runtime = {
    lastError: null,
    getURL: (path = "") => `chrome-extension://abcd1234/${path}`,
    onInstalled: { addListener() {} },
    onMessage: {
      addListener(listener) {
        messageListener = listener;
      },
    },
  };
  const storage = {
    sync: {
      get(_keys, callback) {
        callback({ ...persisted });
      },
      set(patch, callback = () => {}) {
        if (failNextSyncWrite) {
          failNextSyncWrite = false;
          runtime.lastError = { message: "simulated sync write failure" };
          callback();
          runtime.lastError = null;
          return;
        }
        Object.assign(persisted, patch);
        callback();
      },
    },
    local: {
      get(_keys, callback) {
        callback({});
      },
      set(_patch, callback = () => {}) {
        callback();
      },
    },
    onChanged: { addListener() {} },
  };
  const context = vm.createContext({
    AetherShared: shared,
    chrome: {
      runtime,
      storage,
      tabs: { create() {} },
      action: {},
    },
    console: {
      log() {},
      debug() {},
      warn() {},
      error() {},
    },
    importScripts() {},
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(source, context, { filename: "background.js" });

  const send = (request) =>
    new Promise((resolve, reject) => {
      if (!messageListener) {
        reject(new Error("Background message listener was not registered"));
        return;
      }
      const keepChannelOpen = messageListener(request, {}, resolve);
      if (keepChannelOpen !== true && request.type !== "GET_DEFAULTS") {
        reject(new Error(`Message channel closed before ${request.type} responded`));
      }
    });

  return {
    persisted,
    failNextWrite() {
      failNextSyncWrite = true;
    },
    send,
  };
};

test("failed settings writes do not mutate the background cache", async () => {
  const harness = createBackgroundHarness();
  const initial = await harness.send({ type: "GET_SETTINGS" });
  assert.equal(initial.settings.backgroundBlur, shared.DEFAULT_SETTINGS.backgroundBlur);

  harness.failNextWrite();
  const failed = await harness.send({ type: "UPDATE_SETTINGS", patch: { backgroundBlur: "99" } });
  assert.equal(failed.ok, false);
  assert.equal(failed.error, "failed_to_update_settings");
  assert.equal(harness.persisted.backgroundBlur, shared.DEFAULT_SETTINGS.backgroundBlur);

  const afterFailure = await harness.send({ type: "GET_SETTINGS" });
  assert.equal(afterFailure.settings.backgroundBlur, shared.DEFAULT_SETTINGS.backgroundBlur);
});

test("successful settings writes commit storage and cache together", async () => {
  const harness = createBackgroundHarness();
  await harness.send({ type: "GET_SETTINGS" });

  const updated = await harness.send({ type: "UPDATE_SETTINGS", patch: { backgroundBlur: "99" } });
  assert.equal(updated.ok, true);
  assert.equal(updated.settings.backgroundBlur, "99");
  assert.equal(harness.persisted.backgroundBlur, "99");

  const afterSuccess = await harness.send({ type: "GET_SETTINGS" });
  assert.equal(afterSuccess.settings.backgroundBlur, "99");
  assert.equal(afterSuccess.status.source, "sync-storage");
});
