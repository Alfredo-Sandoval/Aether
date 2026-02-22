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

const writeJson = async (targetPath, payload) => {
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const getExtensionId = async (context, timeoutMs, bootstrapUrl, warnings) => {
  let [serviceWorker] = context.serviceWorkers();
  if (serviceWorker) {
    return new URL(serviceWorker.url()).host;
  }

  const waitForWorker = context.waitForEvent("serviceworker", { timeout: timeoutMs });
  const bootstrap = await context.newPage();
  try {
    await bootstrap.goto(bootstrapUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  } catch (_error) {
    warnings.push(`Bootstrap navigation to ${bootstrapUrl} failed; continuing while waiting for extension worker.`);
  } finally {
    await bootstrap.close();
  }

  serviceWorker = await waitForWorker;
  return new URL(serviceWorker.url()).host;
};

const snapshotPopup = async (context, extensionId, runDir, timeoutMs) => {
  const popupPage = await context.newPage();
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  await popupPage.goto(popupUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await popupPage.waitForSelector(".tab-link", { timeout: timeoutMs });
  await popupPage.waitForTimeout(220);

  const screenshots = [];
  const capture = async (name, options = {}) => {
    const filePath = path.join(runDir, name);
    await popupPage.screenshot({ path: filePath, ...options });
    screenshots.push(filePath);
  };

  await capture("popup-initial.png", { fullPage: true });
  await popupPage.click('.tab-link[data-tab="visibility"]');
  await popupPage.waitForTimeout(120);
  await capture("popup-visibility-tab.png", { fullPage: true });

  await popupPage.fill("#settingsSearch", "blur");
  await popupPage.waitForTimeout(120);
  await capture("popup-search-blur.png", { fullPage: true });

  await popupPage.fill("#settingsSearch", "__zz_no_matches_zz__");
  await popupPage.waitForTimeout(120);
  await capture("popup-search-no-results.png", { fullPage: true });

  const noResultsVisible = await popupPage.evaluate(() => {
    const node = document.querySelector(".no-results-message");
    if (!node) return false;
    return getComputedStyle(node).display !== "none";
  });

  await popupPage.click("#clearSearchBtn");
  await popupPage.waitForTimeout(120);
  await capture("popup-search-cleared.png", { fullPage: true });

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

  const metrics = await popupPage.evaluate(() => {
    const activeTab = document.querySelector(".tab-link.active")?.dataset.tab || null;
    const visibleRowsInActiveTab = Array.from(document.querySelectorAll(".tab-pane.active .row")).filter(
      (row) => !row.classList.contains("is-hidden")
    ).length;
    const blurValue = document.getElementById("blurValue")?.textContent?.trim() || null;
    const tabCount = document.querySelectorAll(".tab-link").length;
    const visibleTabCount = Array.from(document.querySelectorAll(".tab-link")).filter(
      (tabEl) => !tabEl.classList.contains("is-hidden")
    ).length;
    return {
      activeTab,
      tabCount,
      visibleTabCount,
      visibleRowsInActiveTab,
      blurValue,
    };
  });

  await popupPage.close();
  return { popupUrl, noResultsVisible, metrics, screenshots };
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

  await page.close();
  return {
    url: chatgptUrl,
    available: true,
    initialState,
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
    runDir,
    options: {
      ...options,
      outDir: path.resolve(repoRoot, options.outDir),
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

    const extensionId = await getExtensionId(context, options.timeoutMs, "https://example.com", warnings);
    report.extensionId = extensionId;

    report.popup = await snapshotPopup(context, extensionId, runDir, options.timeoutMs);

    if (!options.skipChatgpt) {
      report.chatgpt = await snapshotChatgpt(context, runDir, options.timeoutMs, options.chatgptUrl, warnings);
    }

    await writeJson(reportPath, report);

    console.log(`UI audit complete.`);
    console.log(`Report: ${reportPath}`);
    console.log(`Screenshots directory: ${runDir}`);
    if (warnings.length > 0) {
      console.log(`Warnings: ${warnings.length}`);
      warnings.forEach((warning) => console.log(`- ${warning}`));
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
