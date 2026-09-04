const test = require("node:test");
const assert = require("node:assert/strict");

const shared = require("../extension/content/shared-utils.js");

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
  assert.equal(
    shared.matchesResearchFullscreenText(
      "Open image details for Electronics | Free Full-Text | Charuco Board-Based Omnidirectional Camera Calibration Method"
    ),
    false
  );
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
  assert.equal(shared.classifySurfaceRouteTargetValue("Move to project"), "project");
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

test("settings surface helper rejects normal thread app shells with preference footer text", () => {
  assert.equal(
    shared.isSettingsSurfaceDescriptor({
      tagName: "main",
      id: "main",
      text: "ChatGPT can make mistakes. Check important info. See Cookie Preferences.",
    }),
    false
  );
  assert.equal(
    shared.isSettingsSurfaceDescriptor({
      tagName: "div",
      role: "dialog",
      dataTestId: "settings-dialog",
      text: "General settings",
    }),
    true
  );
});

test("research card root-shell helper rejects app shells and allows inner content", () => {
  assert.equal(shared.isResearchCardRootShellDescriptor({ tagName: "main" }), true);
  assert.equal(shared.isResearchCardRootShellDescriptor({ tagName: "div", id: "main" }), true);
  assert.equal(shared.isResearchCardRootShellDescriptor({ tagName: "section", id: "thread" }), true);
  assert.equal(shared.isResearchCardRootShellDescriptor({ tagName: "article", id: "report-card" }), false);
});
