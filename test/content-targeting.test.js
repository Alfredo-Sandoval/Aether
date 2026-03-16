const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const shared = require("../shared-utils.js");

test("UI text normalization is accent-insensitive and punctuation-tolerant", () => {
  assert.equal(shared.normalizeUiText("  Más   rápido  "), "mas rapido");
  assert.equal(shared.normalizeUiMatchText("shopping-research/menu:item"), "shopping research menu item");
});

test("pulse matching stays specific to Today's Pulse labels", () => {
  assert.equal(shared.matchesPulseTargetValue("Today's Pulse"), true);
  assert.equal(shared.matchesPulseTargetValue("Pulso de hoy"), true);
  assert.equal(shared.matchesPulseTargetValue("Your pulse settings"), false);
});

test("shopping matching stays specific to Shopping Research labels", () => {
  assert.equal(shared.matchesShoppingResearchValue("Shopping research"), true);
  assert.equal(shared.matchesShoppingResearchValue("shopping-research"), true);
  assert.equal(shared.matchesShoppingResearchValue("Shopping list"), false);
});

test("upgrade helper matches contextual upgrade CTAs and rejects generic upgrade text", () => {
  assert.equal(
    shared.shouldHideUpgradeSurface({
      text: "Upgrade",
      tagName: "button",
      role: "button",
      withinSidebar: true,
    }),
    true
  );
  assert.equal(
    shared.shouldHideUpgradeSurface({
      text: "Manage billing",
      href: "/settings/subscription",
      tagName: "a",
      role: "link",
    }),
    true
  );
  assert.equal(
    shared.shouldHideUpgradeSurface({
      text: "Upgrade browser",
      tagName: "button",
      role: "button",
    }),
    false
  );
});

test("upgrade settings helper only matches real plan rows", () => {
  assert.equal(
    shared.isUpgradeSettingsDescriptor({
      text: "Get ChatGPT Plus Upgrade",
      tagName: "button",
      role: "button",
      withinSettings: true,
    }),
    true
  );
  assert.equal(
    shared.isUpgradeSettingsDescriptor({
      text: "Appearance Theme",
      tagName: "button",
      role: "button",
      withinSettings: true,
    }),
    false
  );
});

test("research helper text matching stays semantic", () => {
  assert.equal(shared.matchesResearchBannerText("Research completed in 2m with 14 citations and 3 searches"), true);
  assert.equal(shared.matchesResearchBannerText("Research status panel"), false);
  assert.equal(shared.matchesResearchContentText("Executive Summary"), true);
  assert.equal(shared.matchesResearchFullscreenText("Expand"), true);
  assert.equal(shared.matchesResearchFullscreenText("Download"), false);
});

test("canvas action helper matches localized action headers only", () => {
  assert.equal(shared.matchesCanvasActionHeaderText("Copy Edit Download"), true);
  assert.equal(shared.matchesCanvasActionHeaderText("Copiar Editar Descargar"), true);
  assert.equal(shared.matchesCanvasActionHeaderText("Edit history"), false);
});

test("surface route helper classifies safe navigation labels without overmatching", () => {
  assert.equal(shared.classifySurfaceRouteTargetValue("Deep research"), "deep-research");
  assert.equal(shared.classifySurfaceRouteTargetValue("Investigación profunda"), "deep-research");
  assert.equal(shared.classifySurfaceRouteTargetValue("Settings"), "settings");
  assert.equal(shared.classifySurfaceRouteTargetValue("Personalization"), "personalization");
  assert.equal(shared.classifySurfaceRouteTargetValue("Legacy models"), "legacy-models");
  assert.equal(shared.classifySurfaceRouteTargetValue("Canvas"), "canvas");
  assert.equal(shared.classifySurfaceRouteTargetValue("More"), "more");
  assert.equal(shared.classifySurfaceRouteTargetValue("Add files and more"), "");
  assert.equal(shared.classifySurfaceRouteTargetValue("Move to project"), "");
});

test("research dialog helper only matches research-specific dialogs", () => {
  assert.equal(
    shared.isResearchDialogDescriptor({
      dataTestId: "deep-research-dialog",
      text: "Deep research",
    }),
    true
  );
  assert.equal(
    shared.isResearchDialogDescriptor({
      dataTestId: "settings-dialog",
      text: "General settings",
    }),
    false
  );
});

test("policy guard: legacy fragile upgrade selectors stay removed from content script", () => {
  const source = fs.readFileSync(require.resolve("../content.js"), "utf8");
  assert.equal(source.includes(".start-1\\\\/2.absolute"), false);
  assert.equal(source.includes("#stage-sidebar-tiny-bar > div:nth-of-type(4)"), false);
  assert.equal(source.includes("div.py-2.border-b"), false);
});

test("policy guard: brittle research/canvas utility selectors stay removed from content script", () => {
  const source = fs.readFileSync(require.resolve("../content.js"), "utf8");
  assert.equal(source.includes("min-h-[245px]"), false);
  assert.equal(source.includes("rounded-[30px]"), false);
  assert.equal(source.includes("hover:bg-token-bg-tertiary"), false);
  assert.equal(source.includes(".no-scrollbar.fixed.start-0.end-0.top-0.bottom-0.z-50"), false);
  assert.equal(source.includes('.popover[class*="bg-token-bg-primary"]'), false);
});
