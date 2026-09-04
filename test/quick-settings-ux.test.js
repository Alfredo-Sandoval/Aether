const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const readSource = (path) => fs.readFileSync(require.resolve(path), "utf8");

test("quick settings preset CSS only targets preset ids that exist", () => {
  const css = readSource("../extension/styles/quick-settings.css");
  const shared = require("../extension/content/shared-utils.js");
  const knownPresetIds = new Set(shared.POPUP_BACKGROUND_PRESET_OPTIONS.map((option) => option.value));
  const referencedIds = [...css.matchAll(/\[data-preset-key="([^"]+)"\]/g)].map((match) => match[1]);

  assert.ok(referencedIds.length > 0, "expected preset-key selectors in quick-settings.css");
  referencedIds.forEach((presetId) => {
    assert.ok(knownPresetIds.has(presetId), `quick-settings.css targets unknown preset id "${presetId}"`);
  });
});
