#!/usr/bin/env node

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_CHATGPT_URL = "https://chatgpt.com/";

const printUsage = () => {
  console.log(`Usage:
  node scripts/ui-dynamic-audit.js [options]

Options:
  --out-dir <path>       Output directory (default: .tmp/ui-audit)
  --timeout-ms <number>  Timeout for waits/navigation (default: 20000)
  --chatgpt-url <url>    ChatGPT URL for live checks (default: https://chatgpt.com/)
  --fail-on-warning      Exit non-zero when warnings are recorded
  --skip-chatgpt         Skip ChatGPT page checks and run popup-only audit
  --headless             Run headless (extensions may not initialize in all environments)
  --keep-profile         Keep temporary browser profile for debugging
  -h, --help             Show this help
`);
};

const parseArgs = (argv) => {
  const options = {
    outDir: ".tmp/ui-audit",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    chatgptUrl: DEFAULT_CHATGPT_URL,
    failOnWarning: false,
    skipChatgpt: false,
    headless: false,
    keepProfile: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--out-dir") {
      options.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--timeout-ms") {
      options.timeoutMs = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--chatgpt-url") {
      options.chatgptUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--fail-on-warning") {
      options.failOnWarning = true;
      continue;
    }
    if (token === "--skip-chatgpt") {
      options.skipChatgpt = true;
      continue;
    }
    if (token === "--headless") {
      options.headless = true;
      continue;
    }
    if (token === "--keep-profile") {
      options.keepProfile = true;
      continue;
    }
    if (token === "-h" || token === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!options.outDir || typeof options.outDir !== "string") {
    throw new Error("--out-dir requires a path value");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error("--timeout-ms must be a number >= 1000");
  }
  if (!options.chatgptUrl || typeof options.chatgptUrl !== "string") {
    throw new Error("--chatgpt-url requires a URL value");
  }

  return options;
};

const toRunSlug = () => {
  const iso = new Date().toISOString();
  return iso.replace(/[:.]/g, "-");
};

const toRepoRelative = (repoRoot, targetPath) => {
  const relative = path.relative(repoRoot, targetPath);
  if (!relative || relative.startsWith("..")) {
    return path.resolve(targetPath);
  }
  return relative;
};

const writeJson = async (targetPath, payload) => {
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const getExtensionId = async (context, timeoutMs) => {
  let [serviceWorker] = context.serviceWorkers();
  if (serviceWorker) {
    return new URL(serviceWorker.url()).host;
  }

  const waitForWorker = context.waitForEvent("serviceworker", { timeout: timeoutMs });
  const bootstrap = await context.newPage();
  try {
    await bootstrap.goto("about:blank", { waitUntil: "domcontentloaded", timeout: timeoutMs });
  } finally {
    await bootstrap.close();
  }

  serviceWorker = await waitForWorker;
  return new URL(serviceWorker.url()).host;
};

const collectPopupTabSnapshot = async (popupPage) => {
  return popupPage.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll(".tab-link")).map((tabEl) => ({
      id: tabEl.id,
      tab: tabEl.dataset.tab || null,
      ariaControls: tabEl.getAttribute("aria-controls"),
      ariaSelected: tabEl.getAttribute("aria-selected"),
      tabindex: tabEl.getAttribute("tabindex"),
      isActive: tabEl.classList.contains("active"),
      isHidden: tabEl.classList.contains("is-hidden"),
    }));
    const panes = Array.from(document.querySelectorAll(".tab-pane")).map((paneEl) => ({
      id: paneEl.id,
      labelledBy: paneEl.getAttribute("aria-labelledby"),
      hidden: paneEl.hidden,
      isActive: paneEl.classList.contains("active"),
    }));
    const tabNav = document.querySelector(".tab-nav");
    const noResultsMessage = document.querySelector(".no-results-message");
    return {
      tabNavHidden: Boolean(tabNav?.hidden),
      noResultsVisible: Boolean(noResultsMessage && !noResultsMessage.hidden),
      tabs,
      panes,
    };
  });
};

const auditPopupTabSnapshot = (snapshot, label) => {
  const issues = [];
  const activeTabs = snapshot.tabs.filter((tab) => tab.isActive);
  const selectedTabs = snapshot.tabs.filter((tab) => tab.ariaSelected === "true");
  const activePanes = snapshot.panes.filter((pane) => pane.isActive && !pane.hidden);

  if (!snapshot.noResultsVisible && activeTabs.length !== 1) {
    issues.push(`${label}: expected exactly 1 active tab, found ${activeTabs.length}`);
  }
  if (!snapshot.noResultsVisible && selectedTabs.length !== 1) {
    issues.push(`${label}: expected exactly 1 selected tab, found ${selectedTabs.length}`);
  }
  if (!snapshot.noResultsVisible && activePanes.length !== 1) {
    issues.push(`${label}: expected exactly 1 visible active panel, found ${activePanes.length}`);
  }

  const selectedTab = selectedTabs[0];
  const activePane = activePanes[0];
  if (!selectedTab || !activePane) {
    return issues;
  }

  if (selectedTab.isHidden) {
    issues.push(`${label}: selected tab is hidden`);
  }
  if (!selectedTab.isActive) {
    issues.push(`${label}: selected tab is missing the active class`);
  }
  if (selectedTab.tabindex !== "0") {
    issues.push(`${label}: selected tab must have tabindex="0"`);
  }
  if (selectedTab.ariaControls !== activePane.id) {
    issues.push(`${label}: selected tab does not control the visible panel`);
  }
  if (activePane.labelledBy !== selectedTab.id) {
    issues.push(`${label}: visible panel is not labelled by the selected tab`);
  }

  snapshot.tabs
    .filter((tab) => tab.id !== selectedTab.id)
    .forEach((tab) => {
      if (tab.ariaSelected !== "false") {
        issues.push(`${label}: inactive tab ${tab.id} must have aria-selected="false"`);
      }
      if (tab.tabindex !== "-1") {
        issues.push(`${label}: inactive tab ${tab.id} must have tabindex="-1"`);
      }
    });

  snapshot.panes
    .filter((pane) => pane.id !== activePane.id)
    .forEach((pane) => {
      if (!pane.hidden) {
        issues.push(`${label}: inactive panel ${pane.id} must be hidden`);
      }
    });

  return issues;
};

const auditPopupKeyboardNavigation = async (popupPage) => {
  const issues = [];

  await popupPage.click("#tab-appearance");
  await popupPage.waitForTimeout(80);
  await popupPage.focus("#tab-appearance");
  await popupPage.keyboard.press("ArrowRight");
  await popupPage.waitForTimeout(80);
  const afterArrowRight = await collectPopupTabSnapshot(popupPage);
  if (!afterArrowRight.tabs.find((tab) => tab.id === "tab-visibility" && tab.ariaSelected === "true")) {
    issues.push("Keyboard: ArrowRight did not move selection to the next tab");
  }

  await popupPage.click("#tab-visibility");
  await popupPage.waitForTimeout(80);
  await popupPage.focus("#tab-visibility");
  await popupPage.keyboard.press("ArrowLeft");
  await popupPage.waitForTimeout(80);
  const afterArrowLeft = await collectPopupTabSnapshot(popupPage);
  if (!afterArrowLeft.tabs.find((tab) => tab.id === "tab-appearance" && tab.ariaSelected === "true")) {
    issues.push("Keyboard: ArrowLeft did not move selection to the previous tab");
  }

  return {
    issues,
    states: {
      afterArrowRight,
      afterArrowLeft,
    },
  };
};

const auditAndCapturePopupState = async (popupPage, capture, issues, label, screenshotName) => {
  const snapshot = await collectPopupTabSnapshot(popupPage);
  issues.push(...auditPopupTabSnapshot(snapshot, label));
  await capture(screenshotName, { fullPage: true });
  return snapshot;
};

const collectPopupMetrics = async (popupPage) => {
  return popupPage.evaluate(() => {
    const activeTab = document.querySelector(".tab-link.active")?.dataset.tab || null;
    const visibleRowsInActiveTab = Array.from(document.querySelectorAll(".tab-pane.active .row")).filter(
      (row) => !row.classList.contains("is-hidden")
    ).length;
    const blurValue = document.getElementById("blurValue")?.textContent?.trim() || null;
    const tabCount = document.querySelectorAll(".tab-link").length;
    const visibleTabCount = Array.from(document.querySelectorAll(".tab-link")).filter(
      (tabEl) => !tabEl.classList.contains("is-hidden")
    ).length;
    const themeDropdownState = document.querySelector("#themeSelector .select-options")?.dataset.state || null;
    return {
      activeTab,
      tabCount,
      visibleTabCount,
      visibleRowsInActiveTab,
      blurValue,
      themeDropdownState,
    };
  });
};

const runPopupSearchAudit = async (popupPage, capture, issues) => {
  await popupPage.fill("#settingsSearch", "blur");
  await popupPage.waitForTimeout(120);
  const afterSearchMatch = await auditAndCapturePopupState(
    popupPage,
    capture,
    issues,
    "Search results state",
    "popup-search-blur.png"
  );

  await popupPage.fill("#settingsSearch", "__zz_no_matches_zz__");
  await popupPage.waitForTimeout(120);
  const afterNoResults = await collectPopupTabSnapshot(popupPage);
  await capture("popup-search-no-results.png", { fullPage: true });

  if (!afterNoResults.noResultsVisible) {
    issues.push("No-results search state did not expose the status message");
  }
  if (!afterNoResults.tabNavHidden) {
    issues.push("No-results search state did not hide the tab navigation");
  }

  await popupPage.click("#clearSearchBtn");
  await popupPage.waitForTimeout(120);
  const afterSearchReset = await auditAndCapturePopupState(
    popupPage,
    capture,
    issues,
    "Search reset state",
    "popup-search-cleared.png"
  );

  return { afterSearchMatch, afterNoResults, afterSearchReset };
};

const capturePopupControls = async (popupPage, capture, timeoutMs) => {
  await popupPage.click("#themeSelector .select-trigger");
  await popupPage.waitForSelector("#themeSelector .select-options .select-option", {
    state: "visible",
    timeout: timeoutMs,
  });
  await capture("popup-theme-dropdown-open.png", { fullPage: true });
  await popupPage.keyboard.press("Escape");
  await popupPage.waitForTimeout(80);

  await popupPage.$eval("#blurSlider", (sliderEl) => {
    const nextValue = "108";
    sliderEl.value = nextValue;
    sliderEl.dispatchEvent(new Event("input", { bubbles: true }));
    sliderEl.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await popupPage.waitForTimeout(140);
  await capture("popup-blur-updated.png", { fullPage: true });
};

const snapshotPopup = async (context, extensionId, runDir, timeoutMs, repoRoot) => {
  const popupPage = await context.newPage();
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  await popupPage.goto(popupUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await popupPage.waitForSelector(".tab-link", { timeout: timeoutMs });
  await popupPage.waitForFunction(
    () => !document.querySelector("#settingsSearch")?.disabled && !document.querySelector("#tab-appearance")?.disabled,
    { timeout: timeoutMs }
  );
  await popupPage.waitForTimeout(220);

  const screenshots = [];
  const issues = [];
  const capture = async (name, options = {}) => {
    const filePath = path.join(runDir, name);
    await popupPage.screenshot({ path: filePath, ...options });
    screenshots.push(toRepoRelative(repoRoot, filePath));
  };

  const initialSnapshot = await auditAndCapturePopupState(
    popupPage,
    capture,
    issues,
    "Initial popup state",
    "popup-initial.png"
  );

  await popupPage.click('.tab-link[data-tab="visibility"]');
  await popupPage.waitForTimeout(120);
  const afterVisibilityClick = await auditAndCapturePopupState(
    popupPage,
    capture,
    issues,
    "Visibility tab click",
    "popup-visibility-tab.png"
  );

  const keyboardAudit = await auditPopupKeyboardNavigation(popupPage);
  issues.push(...keyboardAudit.issues);

  const { afterSearchMatch, afterNoResults, afterSearchReset } = await runPopupSearchAudit(popupPage, capture, issues);

  await capturePopupControls(popupPage, capture, timeoutMs);

  const metrics = await collectPopupMetrics(popupPage);

  await popupPage.close();
  return {
    popupUrl,
    issues,
    metrics,
    screenshots,
    states: {
      initialSnapshot,
      afterVisibilityClick,
      afterSearchMatch,
      afterNoResults,
      afterSearchReset,
      keyboard: keyboardAudit.states,
    },
  };
};

const inspectQuickSettingsGeometry = async (page, viewportName) => {
  return page.evaluate((name) => {
    const button = document.getElementById("cgpt-qs-btn");
    const panel = document.getElementById("cgpt-qs-panel");
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    if (!button || !panel) {
      return {
        viewportName: name,
        viewport,
        hasButton: Boolean(button),
        hasPanel: Boolean(panel),
        panelInViewport: false,
      };
    }

    if (panel.getAttribute("data-state") !== "open") {
      button.click();
    }

    const panelRect = panel.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const panelInViewport =
      panelRect.left >= 0 &&
      panelRect.top >= 0 &&
      panelRect.right <= window.innerWidth &&
      panelRect.bottom <= window.innerHeight;

    return {
      viewportName: name,
      viewport,
      hasButton: true,
      hasPanel: true,
      state: panel.getAttribute("data-state"),
      panelInViewport,
      panelRect: {
        left: panelRect.left,
        top: panelRect.top,
        right: panelRect.right,
        bottom: panelRect.bottom,
        width: panelRect.width,
        height: panelRect.height,
      },
      buttonRect: {
        left: buttonRect.left,
        top: buttonRect.top,
        right: buttonRect.right,
        bottom: buttonRect.bottom,
        width: buttonRect.width,
        height: buttonRect.height,
      },
    };
  }, viewportName);
};

const snapshotChatgpt = async (context, runDir, timeoutMs, chatgptUrl, warnings) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1366, height: 900 });

  try {
    await page.goto(chatgptUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  } catch (error) {
    warnings.push(`ChatGPT navigation failed: ${error.message}`);
    await page.screenshot({ path: path.join(runDir, "chatgpt-navigation-error.png"), fullPage: true });
    await page.close();
    return {
      url: chatgptUrl,
      available: false,
      reason: "navigation_failed",
      screenshots: [path.join(runDir, "chatgpt-navigation-error.png")],
      geometries: [],
    };
  }

  await page.waitForTimeout(2500);
  const screenshots = [];
  const geometries = [];
  const capture = async (name, options = {}) => {
    const filePath = path.join(runDir, name);
    await page.screenshot({ path: filePath, ...options });
    screenshots.push(filePath);
  };

  const collectAetherSurfaceSummary = async () =>
    page.evaluate(() => {
      const counts = {};
      document.querySelectorAll("[data-aether-surface]").forEach((node) => {
        const surface = node.getAttribute("data-aether-surface");
        if (!surface) return;
        counts[surface] = (counts[surface] || 0) + 1;
      });
      return {
        total: Object.values(counts).reduce((sum, value) => sum + value, 0),
        counts,
      };
    });

  const initialState = await page.evaluate(() => ({
    href: location.href,
    title: document.title,
    hasButton: Boolean(document.getElementById("cgpt-qs-btn")),
    hasPanel: Boolean(document.getElementById("cgpt-qs-panel")),
  }));

  if (!initialState.hasButton || !initialState.hasPanel) {
    warnings.push(
      "Quick Settings controls were not detected on ChatGPT. Ensure you are logged in and the full ChatGPT UI is loaded."
    );
    await capture("chatgpt-no-quick-settings.png", { fullPage: true });
    await page.close();
    return {
      url: chatgptUrl,
      available: false,
      reason: "quick_settings_not_found",
      initialState,
      screenshots,
      geometries,
    };
  }

  const viewports = [
    { name: "desktop", width: 1366, height: 900 },
    { name: "compact", width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(260);
    const geometry = await inspectQuickSettingsGeometry(page, viewport.name);
    geometries.push(geometry);

    if (!geometry.panelInViewport) {
      warnings.push(
        `Quick Settings panel is out of viewport in ${viewport.name} viewport (${viewport.width}x${viewport.height}).`
      );
    }

    await capture(`chatgpt-${viewport.name}.png`, { fullPage: true });
  }

  const panelLocator = page.locator("#cgpt-qs-panel");
  const panelBox = await panelLocator.boundingBox();
  if (panelBox && panelBox.width > 0 && panelBox.height > 0) {
    const clip = {
      x: Math.max(0, panelBox.x),
      y: Math.max(0, panelBox.y),
      width: Math.max(1, panelBox.width),
      height: Math.max(1, panelBox.height),
    };
    await capture("chatgpt-quick-settings-panel.png", { clip });
  }

  const aetherSurfaces = await collectAetherSurfaceSummary();
  await page.close();
  return {
    url: chatgptUrl,
    available: true,
    initialState,
    aetherSurfaces,
    geometries,
    screenshots,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const runDir = path.resolve(repoRoot, options.outDir, toRunSlug());
  const userDataDir = path.join(os.tmpdir(), `aether-ui-audit-${Date.now()}`);
  const warnings = [];

  await fs.mkdir(runDir, { recursive: true });
  const reportPath = path.join(runDir, "report.json");

  const report = {
    generatedAt: new Date().toISOString(),
    runDir: toRepoRelative(repoRoot, runDir),
    options: {
      ...options,
      outDir: toRepoRelative(repoRoot, path.resolve(repoRoot, options.outDir)),
    },
    warnings,
    extensionId: null,
    popup: null,
    chatgpt: null,
  };

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: options.headless,
      viewport: { width: 1366, height: 900 },
      args: [
        "--no-first-run",
        "--no-default-browser-check",
        `--disable-extensions-except=${repoRoot}`,
        `--load-extension=${repoRoot}`,
      ],
    });

    const extensionId = await getExtensionId(context, options.timeoutMs);
    report.extensionId = extensionId;

    report.popup = await snapshotPopup(context, extensionId, runDir, options.timeoutMs, repoRoot);

    if (!options.skipChatgpt) {
      report.chatgpt = await snapshotChatgpt(context, runDir, options.timeoutMs, options.chatgptUrl, warnings);
    }

    await writeJson(reportPath, report);

    console.log(`UI audit complete.`);
    console.log(`Report: ${toRepoRelative(repoRoot, reportPath)}`);
    console.log(`Screenshots directory: ${toRepoRelative(repoRoot, runDir)}`);
    if (report.popup?.issues?.length) {
      console.log(`Popup issues: ${report.popup.issues.length}`);
      report.popup.issues.forEach((issue) => console.log(`- ${issue}`));
    }
    if (warnings.length > 0) {
      console.log(`Warnings: ${warnings.length}`);
      warnings.forEach((warning) => console.log(`- ${warning}`));
    }

    if (report.popup?.issues?.length > 0) {
      process.exitCode = 1;
    }
    if (options.failOnWarning && warnings.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (context) {
      await context.close();
    }
    if (!options.keepProfile) {
      await fs.rm(userDataDir, { recursive: true, force: true });
    }
  }
};

main().catch((error) => {
  console.error(`UI audit failed: ${error.message}`);
  process.exitCode = 1;
});
