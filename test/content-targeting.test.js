const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

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

test("policy guard: legacy fragile upgrade selectors stay removed from content script", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
  assert.equal(source.includes(".start-1\\\\/2.absolute"), false);
  assert.equal(source.includes("#stage-sidebar-tiny-bar > div:nth-of-type(4)"), false);
  assert.equal(source.includes("div.py-2.border-b"), false);
});

test("policy guard: composer widening ignores generic project trigger controls", () => {
  const contentSource = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");

  assert.equal(contentSource.includes("const hasProjectTrigger"), false);
  assert.equal(/body:has\([^)]*button\[data-testid="project-modal-trigger"\]/s.test(styleSource), false);
});

test("policy guard: refresh-time composer glass stays gated behind ambient-ready", () => {
  const contentSource = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");

  assert.equal(contentSource.includes("const UI_READY_SETTLE_DELAY_MS = 300;"), true);
  const guardSelector =
    "html.cgpt-ambient-on:not(.cgpt-ambient-ready):not(.cgpt-legacy-composer)\n" +
    '  form[data-type="unified-composer"]:has(:is(#prompt-textarea, .ProseMirror, textarea)),';
  const composerRuleMarker =
    "/* ChatGPT's composer shell is visually loud by default; keep it full-width but ambient. */";

  assert.match(
    styleSource,
    /html\.cgpt-ambient-on:not\(\.cgpt-ambient-ready\):not\(\.cgpt-legacy-composer\)\s+form\[data-type="unified-composer"\]/
  );
  assert.ok(styleSource.indexOf(composerRuleMarker) >= 0);
  assert.ok(styleSource.lastIndexOf(guardSelector) > styleSource.indexOf(composerRuleMarker));
  assert.match(
    styleSource,
    /form\[data-type="unified-composer"\]\s+:is\(#prompt-textarea, \.ProseMirror, textarea:not\(#prompt-textarea\)\)\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?border:\s*0 !important;[\s\S]*?outline-color:\s*transparent !important;/
  );
});

test("policy guard: home landing shell keeps native composer width", () => {
  const contentSource = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");

  assert.equal(contentSource.includes('const HOME_LANDING_CLASS = "cgpt-home-landing-shell";'), true);
  assert.match(contentSource, /function isHomeLandingShell\(\)/);
  assert.match(contentSource, /location\.pathname !== "\/"/);
  assert.match(
    styleSource,
    /html\.cgpt-ambient-on\.cgpt-home-landing-shell:not\(\.cgpt-legacy-composer\)\s+div\[class\*="--thread-content-max-width"\]/
  );
  assert.match(styleSource, /--thread-content-max-width: 48rem !important;/);
});

test("policy guard: home landing shell clears autofocused composer state", () => {
  const contentSource = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  assert.equal(contentSource.includes("const HOME_COMPOSER_BLUR_DELAYS_MS = Object.freeze([0, 150, 450]);"), true);
  assert.match(contentSource, /function blurHomeLandingComposerIfAutofocused\(\)/);
  assert.match(contentSource, /activeElement\.blur\(\);/);
  assert.match(contentSource, /document\.addEventListener\("pointerdown", homeComposerInteractionHandler, true\);/);
  assert.match(contentSource, /document\.addEventListener\("keydown", homeComposerInteractionHandler, true\);/);
});

test("policy guard: home autocomplete suggestion panel stays styled", () => {
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");

  assert.match(
    styleSource,
    /div:has\(> form\[data-type="unified-composer"\]\):has\(\s+> \[class\*="top-full"\] > \.bg-surface-primary > ul\[class\*="divide-token-border-light"\]\s+\)\s+> \[class\*="top-full"\]:has\(> \.bg-surface-primary > ul\[class\*="divide-token-border-light"\]\)/
  );
  assert.match(
    styleSource,
    /> \.bg-surface-primary:has\(> ul\[class\*="divide-token-border-light"\]\)\s*\{[\s\S]*?border-radius:\s*0 0 20px 20px !important;[\s\S]*?background:\s*color-mix\(in oklab, var\(--glass-tier-raised-bg\)/
  );
  assert.match(
    styleSource,
    /> \.bg-surface-primary:has\(> ul\[class\*="divide-token-border-light"\]\)\s*\{[\s\S]*?backdrop-filter:\s*blur\(var\(--glass-tier-raised-blur\)\)/
  );
  assert.match(
    styleSource,
    /\[class\*="top-full"\]:has\(> \.bg-surface-primary > ul\[class\*="divide-token-border-light"\]\)\s+button:is\(:hover, :focus-visible\)/
  );
});

test("policy guard: removed glass appearance class is cleanup-only", () => {
  const contentSource = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  assert.equal(contentSource.includes("settings.appearance"), false);
  assert.equal(contentSource.includes("CLEAR_APPEARANCE_CLASS"), false);
  assert.match(contentSource, /classList\.remove\([\s\S]*"cgpt-appearance-clear"/);
  assert.equal(contentSource.includes('classList.toggle("cgpt-appearance-clear"'), false);
});

test("policy guard: code block chrome ignores nested CodeMirror pre nodes", () => {
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");

  assert.match(styleSource, /pre:not\(\.cm-content\)\s*\{/);
  assert.match(
    styleSource,
    /pre\.cm-content\s*\{[\s\S]*?padding-top:\s*12px !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?border:\s*0 !important;[\s\S]*?box-shadow:\s*none !important;/
  );
  assert.match(
    styleSource,
    /pre:not\(\.cm-content\)\s*> div:first-child\s*\{[\s\S]*?margin:\s*0 !important;[\s\S]*?overflow:\s*hidden !important;/
  );
  assert.match(styleSource, /:is\(\[class\*="border-radius-3xl"\], \[class\*="rounded-3xl"\]/);
  assert.match(
    styleSource,
    /\[class\*="border-token-border-light"\]\s*\{[\s\S]*?border:\s*0 !important;[\s\S]*?border-radius:\s*0 !important;/
  );
  assert.match(styleSource, /\[class\*="font-sans"\]\[class\*="bg-token-bg-elevated-secondary"\]/);
  assert.equal(
    /pre\s+\.bg-token-bg-elevated-secondary\s*\{\s*background:\s*transparent !important;/.test(styleSource),
    false
  );
});

test("policy guard: brittle research/canvas utility selectors stay removed from content script", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
  assert.equal(source.includes("min-h-[245px]"), false);
  assert.equal(source.includes("rounded-[30px]"), false);
  assert.equal(source.includes("hover:bg-token-bg-tertiary"), false);
  assert.equal(source.includes(".no-scrollbar.fixed.start-0.end-0.top-0.bottom-0.z-50"), false);
  assert.equal(source.includes('.popover[class*="bg-token-bg-primary"]'), false);
  assert.equal(source.includes('[aria-label*="full" i]'), false);
  assert.equal(source.includes('[data-testid*="full" i]'), false);
  assert.equal(source.includes('[title*="full" i]'), false);
});

test("policy guard: deep research carousel cards have immediate CSS coverage", () => {
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");

  assert.match(styleSource, /\.deep-research-app a\[href\] article/);
  assert.match(styleSource, /:is\(\[data-aether-surface="research-card"\], \.deep-research-app a\[href\] article\)/);
});

test("extracted helper bootstrap constants are declared before tool creation", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
  const pulseAttrsIndex = source.indexOf('const PULSE_ATTRS = ["aria-label", "href", "data-testid", "data-track"];');
  const shoppingAttrsIndex = source.indexOf(
    'const SHOPPING_ATTRS = ["aria-label", "data-aria-label", "data-testid", "data-track"];'
  );
  const sidebarToolsIndex = source.indexOf("sidebarToolsFactory.createSidebarTools({");
  const researchContainerIndex = source.indexOf(
    'const RESEARCH_CARD_CONTAINER_SELECTOR = "div, section, article, main";'
  );
  const researchIframeIndex = source.indexOf("const RESEARCH_EMBED_IFRAME_SELECTOR = [");
  const researchMarkerIndex = source.indexOf("const RESEARCH_REPORT_MARKER_SELECTOR = [");
  const researchDialogIndex = source.indexOf("const RESEARCH_DIALOG_SELECTOR = 'div[role=\"dialog\"]';");
  const researchHomeIndex = source.indexOf('const RESEARCH_HOME_SELECTOR = ".deep-research-app";');
  const researchToolsIndex = source.indexOf("researchToolsFactory.createResearchSurfaceTools({");

  assert.notEqual(pulseAttrsIndex, -1);
  assert.notEqual(shoppingAttrsIndex, -1);
  assert.notEqual(sidebarToolsIndex, -1);
  assert.notEqual(researchContainerIndex, -1);
  assert.notEqual(researchIframeIndex, -1);
  assert.notEqual(researchMarkerIndex, -1);
  assert.notEqual(researchDialogIndex, -1);
  assert.notEqual(researchHomeIndex, -1);
  assert.notEqual(researchToolsIndex, -1);
  assert.ok(pulseAttrsIndex < sidebarToolsIndex);
  assert.ok(shoppingAttrsIndex < sidebarToolsIndex);
  assert.ok(researchContainerIndex < researchToolsIndex);
  assert.ok(researchIframeIndex < researchToolsIndex);
  assert.ok(researchMarkerIndex < researchToolsIndex);
  assert.ok(researchDialogIndex < researchToolsIndex);
  assert.ok(researchHomeIndex < researchToolsIndex);
});

test("policy guard: quick-add proxy and suppression dead paths stay removed", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  [
    "QUICK_ADD_PROXY_ITEMS",
    "QUICK_ADD_PROXY_ICON_PATHS",
    "clearSuppressedQuickAddItems",
    "clearQuickAddProxyItems",
    "setMenuItemLabel",
    "findQuickAddSourceItem",
    "resolveQuickAddProxyIconSvg",
    "triggerQuickAddSubmenuAction",
    "makeQuickAddProxyItem",
    "ensureQuickAddProxyItems",
    "data-cgpt-quick-add-proxy",
    "data-cgpt-quick-add-suppressed",
    "cgptQuickAddProxy",
  ].forEach((removedSymbol) => {
    assert.equal(source.includes(removedSymbol), false);
  });
});

test("policy guard: quick settings sliders share one scheduler binding", () => {
  const source = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");
  const sliderBindingCalls = source.match(/^\s{8}bindQuickSettingsRangeControl\(\{/gm) || [];

  assert.equal(source.includes("function bindQuickSettingsRangeControl({"), true);
  assert.equal(sliderBindingCalls.length, 2);
  [
    "let pendingBlur",
    "let pendingWidth",
    "scheduleBlurApply",
    "scheduleContentWidthApply",
    "flushBlurSave",
    "flushContentWidthSave",
  ].forEach((removedDuplicate) => {
    assert.equal(source.includes(removedDuplicate), false);
  });
});

test("policy guard: reasoning details flyout stays covered by activity selectors", () => {
  const contentSource = fs.readFileSync(require.resolve("../extension/content/content.js"), "utf8");

  assert.equal(contentSource.includes('[aria-label*="reasoning details" i]'), true);
});

test("policy guard: current ChatGPT sidebar surface stays transparent", () => {
  const source = fs.readFileSync(require.resolve("../extension/styles/sidebar.css"), "utf8");
  const styleSource = fs.readFileSync(require.resolve("../extension/styles/styles.css"), "utf8");

  assert.equal(source.includes("#stage-slideover-sidebar .bg-token-main-surface-primary"), true);
  assert.equal(source.includes('#stage-slideover-sidebar [class*="bg-token-main-surface-primary"]'), true);
  assert.equal(source.includes('#sidebar-header\n  a[data-sidebar-item][href="/"]:is(:hover, :focus-visible)'), true);
  assert.match(
    source,
    /#sidebar-header a\[data-sidebar-item\]\[href="\/"\] \.header-wordmark\s*\{[\s\S]*?-webkit-text-fill-color:\s*currentColor !important;/
  );
  assert.equal(/html\.cgpt-ambient-on\.cgpt-accent-active\s+a:not\(\[class\*="btn"\]\):hover/.test(styleSource), false);
  assert.match(
    styleSource,
    /:is\(article\[data-testid\^="conversation-turn-"\], div\[data-message-author-role\], \.markdown\)\s+a:not\(\[class\*="btn"\]\):not\(\[data-sidebar-item\]\):hover/
  );
});
