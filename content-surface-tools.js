/* global module */
(() => {
  const AetherContentSurfaceTools = Object.freeze({
    createSurfaceTools(deps = {}) {
      const requireDependency = (name) => {
        const value = deps[name];
        if (value == null) {
          throw new Error(`AetherContentSurfaceTools: missing dependency "${name}"`);
        }
        return value;
      };

      const document = requireDependency("document");
      const window = requireDependency("window");
      const location = requireDependency("location");
      const history = requireDependency("history");
      const setTimeout = requireDependency("setTimeout");
      const Element = requireDependency("Element");
      const HTMLElement = requireDependency("HTMLElement");
      const HTMLDetailsElement = requireDependency("HTMLDetailsElement");
      const KeyboardEvent = requireDependency("KeyboardEvent");
      const MouseEvent = requireDependency("MouseEvent");
      const PointerEvent = deps.PointerEvent;
      const normalizeText = requireDependency("normalizeText");
      const classifySurfaceRouteTargetValue = requireDependency("classifySurfaceRouteTargetValue");
      const refreshSurfaceTags = requireDependency("refreshSurfaceTags");
      const getSettings = typeof deps.getSettings === "function" ? deps.getSettings : () => deps.settings || {};
      const ambientBackgroundId = deps.ambientBackgroundId || "cgpt-ambient-bg";
      const quickSettingsPanelId = deps.quickSettingsPanelId || "cgpt-qs-panel";
      const quickSettingsButtonId = deps.quickSettingsButtonId || "cgpt-qs-btn";
      const composerSelector = deps.composerSelector || 'form[data-type="unified-composer"]';
      const surfaceAttr = deps.surfaceAttr || "data-aether-surface";
      const glassAttr = deps.glassAttr || "data-aether-glass";
      const researchCardClass = deps.researchCardClass || "cgpt-aether-research-card";
      const canvasSurfaceClass = deps.canvasSurfaceClass || "cgpt-aether-canvas-surface";

      const DOM_SNAPSHOT_LIMITS = Object.freeze({
        taggedSurfaces: 48,
        dialogs: 16,
        menus: 16,
        buttons: 28,
        links: 28,
        headings: 20,
        landmarks: 8,
        composers: 4,
        shellTabs: 16,
        sidebarItems: 20,
        routeHints: 20,
        styleCandidates: 16,
        canvases: 12,
        researchCards: 12,
        uniqueValues: 96,
        textPreview: 160,
        classTokens: 6,
        pathDepth: 6,
      });

      const SURFACE_CRAWL_LIMITS = Object.freeze({
        topLevel: 24,
        nestedPerSurface: 10,
        totalInteractions: 36,
        maxDepth: 3,
        postClickDelayMs: 180,
        postCloseDelayMs: 140,
        routePollDelayMs: 220,
        routeSettleChecks: 8,
      });

      const SURFACE_CRAWL_OPEN_SELECTOR = [
        '[role="tab"]',
        "summary",
        "button[aria-haspopup]",
        'button[aria-controls]:not([type="submit"])',
        "button[aria-expanded]",
        '[role="button"][aria-haspopup]',
        '[role="button"][aria-controls]',
        '[role="button"][aria-expanded]',
      ].join(", ");
      const SURFACE_CRAWL_ROUTE_SELECTOR = [
        "button",
        "a[href]",
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
        '[role="option"]',
      ].join(", ");
      const SURFACE_CRAWL_SELECTOR = [SURFACE_CRAWL_OPEN_SELECTOR, SURFACE_CRAWL_ROUTE_SELECTOR].join(", ");
      const SURFACE_CRAWL_ROOT_SELECTOR = [
        '.popover[role="dialog"]',
        'div[role="dialog"]',
        '[data-testid="stage-thread-flyout"]',
        ".popover[data-radix-menu-content]",
        '[role="menu"]',
        '[role="listbox"]',
      ].join(", ");
      const SURFACE_CRAWL_DANGEROUS_TOKENS = Object.freeze([
        "send",
        "submit",
        "delete",
        "remove",
        "archive",
        "clear",
        "logout",
        "log out",
        "sign out",
        "new chat",
        "rename",
        "regenerate",
        "stop generating",
        "purchase",
        "buy",
      ]);
      const STYLE_AUDIT_SELECTOR = [
        "main",
        "aside",
        "nav",
        "section",
        "article",
        '[role="tabpanel"]',
        '[role="dialog"]',
        '[role="menu"]',
        '[role="listbox"]',
        "[data-testid]",
        ".deep-research-app",
      ].join(", ");
      const RESEARCH_VIEWER_HOST_SELECTOR =
        deps.researchViewerHostSelector ||
        [
          'div[role="dialog"]',
          'main[data-testid*="deep-research" i]',
          'div[data-testid*="deep-research" i]',
          'section[data-testid*="deep-research" i]',
          'article[data-testid*="deep-research" i]',
          'main[data-testid*="research-report" i]',
          'div[data-testid*="research-report" i]',
          'section[data-testid*="research-report" i]',
          'article[data-testid*="research-report" i]',
        ].join(", ");
      const RESEARCH_HOME_SELECTOR = deps.researchHomeSelector || ".deep-research-app";

      const isElementVisible = (el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const getSnapshotClassTokens = (node) => {
        const className = typeof node.className === "string" ? node.className : "";
        return className.split(/\s+/).filter(Boolean).slice(0, DOM_SNAPSHOT_LIMITS.classTokens);
      };

      const getSnapshotRect = (node) => {
        const rect = node.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };

      const getSnapshotPathSegment = (node) => {
        const tagName = node.tagName.toLowerCase();
        if (node.id) return `${tagName}#${node.id}`;

        const dataTestId = node.getAttribute("data-testid");
        if (dataTestId) {
          return `${tagName}[data-testid="${dataTestId}"]`;
        }

        const role = node.getAttribute("role");
        if (role) {
          return `${tagName}[role="${role}"]`;
        }

        const ariaLabel = node.getAttribute("aria-label");
        if (ariaLabel) {
          const shortLabel = normalizeText(ariaLabel).slice(0, 32);
          return `${tagName}[aria-label="${shortLabel}"]`;
        }

        const classTokens = getSnapshotClassTokens(node);
        if (classTokens[0]) {
          return `${tagName}.${classTokens[0]}`;
        }

        return tagName;
      };

      const getSnapshotPath = (node) => {
        const segments = [];
        let current = node;
        let depth = 0;

        while (current && depth < DOM_SNAPSHOT_LIMITS.pathDepth) {
          segments.unshift(getSnapshotPathSegment(current));
          current = current.parentElement;
          depth += 1;
        }

        return segments.join(" > ");
      };

      const getSnapshotTextPreview = (node) => {
        const text = normalizeText(node.textContent || "");
        if (!text) return "";
        return text.slice(0, DOM_SNAPSHOT_LIMITS.textPreview);
      };

      const describeSnapshotNode = (node) => {
        if (!(node instanceof Element)) return null;

        const descriptor = {
          tag: node.tagName.toLowerCase(),
          path: getSnapshotPath(node),
          rect: getSnapshotRect(node),
        };

        const id = node.id;
        const role = node.getAttribute("role");
        const dataTestId = node.getAttribute("data-testid");
        const ariaLabel = node.getAttribute("aria-label");
        const title = node.getAttribute("title");
        const href = node.getAttribute("href");
        const type = node.getAttribute("type");
        const surface = node.getAttribute(surfaceAttr);
        const glass = node.getAttribute(glassAttr);
        const classTokens = getSnapshotClassTokens(node);
        const textPreview = getSnapshotTextPreview(node);

        if (id) descriptor.id = id;
        if (role) descriptor.role = role;
        if (dataTestId) descriptor.dataTestId = dataTestId;
        if (ariaLabel) descriptor.ariaLabel = ariaLabel;
        if (title) descriptor.title = title;
        if (href) descriptor.href = href;
        if (type) descriptor.type = type;
        if (surface) descriptor.surface = surface;
        if (glass) descriptor.glass = glass;
        if (classTokens.length) descriptor.classList = classTokens;
        if (textPreview) descriptor.text = textPreview;

        return descriptor;
      };

      const collectVisibleSnapshotNodes = (selector, limit, filter = null) => {
        const nodes = Array.from(document.querySelectorAll(selector)).filter((node) => {
          if (!(node instanceof Element) || !isElementVisible(node)) return false;
          return typeof filter === "function" ? filter(node) : true;
        });
        return nodes.slice(0, limit).map(describeSnapshotNode).filter(Boolean);
      };

      const countVisibleNodes = (selector, filter = null) => {
        return Array.from(document.querySelectorAll(selector)).filter((node) => {
          if (!(node instanceof Element) || !isElementVisible(node)) return false;
          return typeof filter === "function" ? filter(node) : true;
        }).length;
      };

      const collectUniqueVisibleAttributeValues = (attributeName, limit, normalizer = null) => {
        const values = [];
        const seen = new Set();

        document.querySelectorAll(`[${attributeName}]`).forEach((node) => {
          if (!(node instanceof Element) || !isElementVisible(node)) return;
          const rawValue = node.getAttribute(attributeName);
          if (!rawValue) return;
          const value = typeof normalizer === "function" ? normalizer(rawValue) : rawValue.trim();
          if (!value || seen.has(value)) return;
          seen.add(value);
          values.push(value);
        });

        return values.slice(0, limit);
      };

      const countSurfaceTypes = (nodes) => {
        return nodes.reduce((counts, node) => {
          const surface = node.getAttribute(surfaceAttr) || "untagged";
          counts[surface] = (counts[surface] || 0) + 1;
          return counts;
        }, {});
      };

      const isInspectableInteractiveNode = (node) => {
        return !!(
          getSnapshotTextPreview(node) ||
          node.getAttribute("aria-label") ||
          node.getAttribute("data-testid") ||
          node.getAttribute("title") ||
          node.getAttribute("href")
        );
      };

      const getSurfaceRouteTargetSignals = (node) => {
        return [
          node.getAttribute("aria-label") || "",
          node.getAttribute("title") || "",
          getSnapshotTextPreview(node),
          node.getAttribute("data-testid") || "",
        ].filter(Boolean);
      };

      const getNearestSectionLabel = (node) => {
        let current = node.parentElement;
        let depth = 0;
        while (current && depth < 4) {
          const labelNode = Array.from(current.children).find((child) =>
            child.matches?.('button[aria-expanded], h1, h2, h3, [role="heading"]')
          );
          const label = normalizeText(labelNode?.textContent || "");
          if (label) return label;
          current = current.parentElement;
          depth += 1;
        }
        return "";
      };

      const getExplicitSurfaceRouteTarget = (node) => {
        for (const signal of getSurfaceRouteTargetSignals(node)) {
          const routeTarget = classifySurfaceRouteTargetValue(signal);
          if (routeTarget) return routeTarget;
        }
        return "";
      };

      const getContextualSurfaceRouteTarget = (node) => {
        const tagName = node.tagName.toLowerCase();
        if (tagName !== "a") return "";
        const label = normalizeText(node.textContent || node.getAttribute("aria-label") || "");
        if (!label || label.length > 120 || label === "new project") return "";
        const sectionLabel = getNearestSectionLabel(node);
        if (sectionLabel === "projects" || sectionLabel === "proyectos") return "project-entry";
        return "";
      };

      const getSurfaceRouteTarget = (node) => {
        return getExplicitSurfaceRouteTarget(node) || getContextualSurfaceRouteTarget(node);
      };

      const describeRouteHintNode = (node) => {
        const descriptor = describeSnapshotNode(node);
        if (!descriptor) return null;
        const routeTarget = getSurfaceRouteTarget(node);
        if (!routeTarget) return null;
        return { ...descriptor, routeTarget };
      };

      const collectVisibleRouteHintNodes = (limit) => {
        const routeHints = [];
        const seen = new Set();

        Array.from(document.querySelectorAll(SURFACE_CRAWL_ROUTE_SELECTOR)).forEach((node) => {
          if (!(node instanceof Element) || !isElementVisible(node)) return;
          const descriptor = describeRouteHintNode(node);
          if (!descriptor) return;
          const key = `${descriptor.routeTarget}|${descriptor.path}`;
          if (seen.has(key)) return;
          seen.add(key);
          routeHints.push(descriptor);
        });

        routeHints.sort((left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x);
        return routeHints.slice(0, limit);
      };

      const isLargeShellNode = (node) => {
        if (!(node instanceof Element) || !isElementVisible(node)) return false;
        const rect = node.getBoundingClientRect();
        return rect.width >= 180 && rect.height >= 56;
      };

      const isSettingsShellVisible = () => {
        if (location.pathname.toLowerCase().includes("/settings")) return true;
        const panels = collectVisibleSnapshotNodes("main, section, article, div[role='dialog']", 6, isLargeShellNode);
        return panels.some((panel) => {
          const signal = normalizeText([panel.text || "", panel.ariaLabel || "", panel.dataTestId || ""].join(" "));
          return signal.includes("settings") && (signal.includes("appearance") || signal.includes("personalization"));
        });
      };

      const detectShellKind = () => {
        const pathname = location.pathname.toLowerCase();
        if (countVisibleNodes(RESEARCH_VIEWER_HOST_SELECTOR) > 0) return "research-viewer";
        if (countVisibleNodes(`.${canvasSurfaceClass}`) > 0) return "canvas";
        if (countVisibleNodes(RESEARCH_HOME_SELECTOR) > 0) return "research-home";
        if (isSettingsShellVisible()) return "settings";
        if (pathname.includes("/project")) return "project";
        if (pathname === "/" || pathname === "") return "chat-home";
        return "chat-route";
      };

      const isShellSidebarItem = (node) => {
        if (!(node instanceof Element) || !isElementVisible(node)) return false;
        const text = getSnapshotTextPreview(node);
        if (!text || text.length > 120) return false;
        return !!node.closest("aside, nav");
      };

      const isShellTabNode = (node) => {
        if (!(node instanceof Element) || !isElementVisible(node)) return false;
        if (node.matches('[role="tab"]')) return true;
        if (node.matches("[aria-current='page']")) return true;
        return node.matches("button[aria-expanded]") && !!node.closest("aside, nav, [role='tablist']");
      };

      const buildShellSnapshot = () => {
        return {
          kind: detectShellKind(),
          pathname: location.pathname,
          search: location.search,
          panels: collectVisibleSnapshotNodes(
            "main, aside, nav, [role='dialog'], [role='tabpanel']",
            8,
            isLargeShellNode
          ),
          tabs: collectVisibleSnapshotNodes(
            '[role="tab"], [aria-current="page"], aside button[aria-expanded], nav button[aria-expanded]',
            DOM_SNAPSHOT_LIMITS.shellTabs,
            isShellTabNode
          ),
          sidebarItems: collectVisibleSnapshotNodes(
            "aside button, aside a[href], nav button, nav a[href]",
            DOM_SNAPSHOT_LIMITS.sidebarItems,
            isShellSidebarItem
          ),
          routeHints: collectVisibleRouteHintNodes(DOM_SNAPSHOT_LIMITS.routeHints),
        };
      };

      const getStyleCandidateSignalText = (node) => {
        return normalizeText(
          [
            node.getAttribute("data-testid") || "",
            node.getAttribute("aria-label") || "",
            node.getAttribute("title") || "",
            node.id || "",
            typeof node.className === "string" ? node.className : "",
            getSnapshotTextPreview(node),
          ].join(" ")
        );
      };

      const getMissingStyleCandidateReasons = (node) => {
        const reasons = [];
        const signal = getStyleCandidateSignalText(node);
        const rect = node.getBoundingClientRect();
        if (node.matches("main")) reasons.push("main-shell");
        if (node.matches("aside, nav")) reasons.push("sidebar-shell");
        if (node.matches('[role="tabpanel"]')) reasons.push("tab-panel");
        if (node.getAttribute("data-testid")) reasons.push("data-testid");
        if (signal.includes("research")) reasons.push("research-hint");
        if (signal.includes("project")) reasons.push("project-hint");
        if (signal.includes("settings") || signal.includes("personalization")) reasons.push("settings-hint");
        if (rect.width >= window.innerWidth * 0.45) reasons.push("wide-surface");
        return reasons.slice(0, 4);
      };

      const isMissingStyleCandidate = (node) => {
        if (!(node instanceof Element) || !isElementVisible(node)) return false;
        if (node.closest(`#${ambientBackgroundId}, #${quickSettingsPanelId}, #${quickSettingsButtonId}`)) return false;
        if (node.hasAttribute(surfaceAttr) || node.closest(`[${surfaceAttr}]`)) return false;
        const rect = node.getBoundingClientRect();
        if (rect.width < 160 || rect.height < 80) return false;
        return getMissingStyleCandidateReasons(node).length > 0;
      };

      const collectMissingStyleCandidates = (limit) => {
        const candidates = [];
        const seen = new Set();

        document.querySelectorAll(STYLE_AUDIT_SELECTOR).forEach((node) => {
          if (!isMissingStyleCandidate(node)) return;
          const descriptor = describeSnapshotNode(node);
          if (!descriptor || seen.has(descriptor.path)) return;
          seen.add(descriptor.path);
          candidates.push({ ...descriptor, reasons: getMissingStyleCandidateReasons(node) });
        });

        candidates.sort((left, right) => right.rect.width * right.rect.height - left.rect.width * left.rect.height);
        return candidates.slice(0, limit);
      };

      const captureDomSurfaceSnapshot = () => {
        refreshSurfaceTags();

        const taggedSurfaceElements = Array.from(document.querySelectorAll(`[${surfaceAttr}]`)).filter(
          (node) => node instanceof Element && isElementVisible(node)
        );
        const shell = buildShellSnapshot();
        const currentSettings = getSettings() || {};

        return {
          schemaVersion: 1,
          capturedAt: new Date().toISOString(),
          page: {
            title: document.title,
            url: location.href,
            lang: document.documentElement.lang || "",
            readyState: document.readyState,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
              scrollX: Math.round(window.scrollX),
              scrollY: Math.round(window.scrollY),
            },
          },
          aether: {
            theme: currentSettings.theme || "",
            appearance: currentSettings.appearance || "",
            taggedSurfaceAttr: surfaceAttr,
            taggedGlassAttr: glassAttr,
          },
          shell,
          summary: {
            taggedSurfaceCount: taggedSurfaceElements.length,
            surfaceTypeCounts: countSurfaceTypes(taggedSurfaceElements),
            dialogCount: countVisibleNodes(
              '.popover[role="dialog"], div[role="dialog"], [data-testid="stage-thread-flyout"]'
            ),
            menuCount: countVisibleNodes('.popover[data-radix-menu-content], [role="menu"], [role="listbox"]'),
            buttonCount: countVisibleNodes("button, [role='button']", isInspectableInteractiveNode),
            linkCount: countVisibleNodes("a[href]", isInspectableInteractiveNode),
            dataTestIdCount: collectUniqueVisibleAttributeValues("data-testid", DOM_SNAPSHOT_LIMITS.uniqueValues)
              .length,
          },
          landmarks: {
            main: collectVisibleSnapshotNodes("main", DOM_SNAPSHOT_LIMITS.landmarks),
            nav: collectVisibleSnapshotNodes("nav", DOM_SNAPSHOT_LIMITS.landmarks),
            aside: collectVisibleSnapshotNodes("aside", DOM_SNAPSHOT_LIMITS.landmarks),
            composer: collectVisibleSnapshotNodes('form[data-type="unified-composer"]', DOM_SNAPSHOT_LIMITS.composers),
          },
          research: {
            home: collectVisibleSnapshotNodes(RESEARCH_HOME_SELECTOR, DOM_SNAPSHOT_LIMITS.landmarks),
            viewers: collectVisibleSnapshotNodes(RESEARCH_VIEWER_HOST_SELECTOR, DOM_SNAPSHOT_LIMITS.dialogs),
            cards: collectVisibleSnapshotNodes(`.${researchCardClass}`, DOM_SNAPSHOT_LIMITS.researchCards),
            canvas: collectVisibleSnapshotNodes(`.${canvasSurfaceClass}`, DOM_SNAPSHOT_LIMITS.canvases),
          },
          taggedSurfaces: taggedSurfaceElements.slice(0, DOM_SNAPSHOT_LIMITS.taggedSurfaces).map(describeSnapshotNode),
          dialogs: collectVisibleSnapshotNodes(
            '.popover[role="dialog"], div[role="dialog"], [data-testid="stage-thread-flyout"]',
            DOM_SNAPSHOT_LIMITS.dialogs
          ),
          menus: collectVisibleSnapshotNodes(
            '.popover[data-radix-menu-content], [role="menu"], [role="listbox"]',
            DOM_SNAPSHOT_LIMITS.menus
          ),
          headings: collectVisibleSnapshotNodes("h1, h2, h3", DOM_SNAPSHOT_LIMITS.headings),
          buttons: collectVisibleSnapshotNodes(
            "button, [role='button']",
            DOM_SNAPSHOT_LIMITS.buttons,
            isInspectableInteractiveNode
          ),
          links: collectVisibleSnapshotNodes("a[href]", DOM_SNAPSHOT_LIMITS.links, isInspectableInteractiveNode),
          visibleDataTestIds: collectUniqueVisibleAttributeValues("data-testid", DOM_SNAPSHOT_LIMITS.uniqueValues),
          visibleAriaLabels: collectUniqueVisibleAttributeValues(
            "aria-label",
            DOM_SNAPSHOT_LIMITS.uniqueValues,
            normalizeText
          ),
          crawlHints: {
            routeTargets: shell.routeHints,
          },
          styleAudit: {
            missingStyleCandidates: collectMissingStyleCandidates(DOM_SNAPSHOT_LIMITS.styleCandidates),
          },
        };
      };

      const waitForSurfaceCrawlDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const isSubmenuSurfaceRouteTarget = (routeTarget) => {
        return routeTarget === "more" || routeTarget === "legacy-models";
      };

      const getSnapshotSignature = (snapshot) => {
        return JSON.stringify({
          page: {
            url: snapshot.page.url,
            title: snapshot.page.title,
          },
          shell: {
            kind: snapshot.shell.kind,
            pathname: snapshot.shell.pathname,
            search: snapshot.shell.search,
            routeTargets: snapshot.shell.routeHints.map((node) => `${node.routeTarget}:${node.path}`),
          },
          summary: snapshot.summary,
          taggedSurfaces: snapshot.taggedSurfaces.map((node) => `${node.surface || ""}:${node.path}`),
          dialogs: snapshot.dialogs.map((node) => node.path),
          menus: snapshot.menus.map((node) => node.path),
          headings: snapshot.headings.map((node) => node.text || ""),
          styleCandidates: snapshot.styleAudit.missingStyleCandidates.map(
            (node) => `${node.path}:${(node.reasons || []).join(",")}`
          ),
          research: {
            viewers: snapshot.research.viewers.map((node) => node.path),
            cards: snapshot.research.cards.map((node) => node.path),
            canvas: snapshot.research.canvas.map((node) => node.path),
          },
        });
      };

      const getSurfaceActivatorRouteTarget = (node) => getSurfaceRouteTarget(node);

      const getSurfaceActivatorKind = (node) => {
        const routeTarget = getSurfaceActivatorRouteTarget(node);
        if (routeTarget) {
          return isSubmenuSurfaceRouteTarget(routeTarget) ? "submenu" : "route";
        }
        if (node.getAttribute("role") === "tab") return "tab";
        if (node.tagName.toLowerCase() === "summary") return "summary";
        if (node.hasAttribute("aria-haspopup")) return "popup";
        if (node.hasAttribute("aria-expanded")) return "disclosure";
        if (node.hasAttribute("aria-controls")) return "controls";
        return "activator";
      };

      const getSurfaceActivatorLabel = (node) => {
        return normalizeText(
          [node.getAttribute("aria-label") || "", node.getAttribute("title") || "", node.textContent || ""].join(" ")
        );
      };

      const isDangerousSurfaceActivator = (node) => {
        const label = getSurfaceActivatorLabel(node);
        return SURFACE_CRAWL_DANGEROUS_TOKENS.some((token) => label.includes(token));
      };

      const getSurfaceActivatorPriority = (node) => {
        const kind = getSurfaceActivatorKind(node);
        if (kind === "popup") return 0;
        if (kind === "submenu") return 1;
        if (kind === "tab") return 2;
        if (kind === "route") return 3;
        if (kind === "disclosure") return 4;
        if (kind === "controls") return 5;
        return 6;
      };

      const getSurfaceActivatorKey = (node) => {
        const descriptor = describeSnapshotNode(node);
        if (!descriptor) return "";
        return [
          getSurfaceActivatorKind(node),
          getSurfaceActivatorRouteTarget(node),
          descriptor.path,
          descriptor.dataTestId || "",
          descriptor.ariaLabel || "",
          descriptor.text || "",
        ].join("|");
      };

      const isSafeSurfaceActivator = (node) => {
        if (!(node instanceof HTMLElement) || !node.isConnected || !isElementVisible(node)) return false;
        if (!(node.matches(SURFACE_CRAWL_OPEN_SELECTOR) || !!getSurfaceActivatorRouteTarget(node))) return false;
        if (node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true") return false;
        if (node.getAttribute("type") === "submit") return false;
        if (node.closest(`#${quickSettingsPanelId}, #${quickSettingsButtonId}, ${composerSelector}`)) return false;
        if (node.getAttribute("role") === "tab" && node.getAttribute("aria-selected") === "true") return false;
        if (node.hasAttribute("aria-expanded") && node.getAttribute("aria-expanded") === "true") return false;
        if (isDangerousSurfaceActivator(node)) return false;
        return true;
      };

      const collectSafeSurfaceActivators = (root, seenKeys, limit) => {
        const candidates = Array.from(root.querySelectorAll(SURFACE_CRAWL_SELECTOR)).filter(isSafeSurfaceActivator);
        candidates.sort((left, right) => {
          const priorityDelta = getSurfaceActivatorPriority(left) - getSurfaceActivatorPriority(right);
          if (priorityDelta !== 0) return priorityDelta;
          const verticalDelta = left.getBoundingClientRect().top - right.getBoundingClientRect().top;
          if (verticalDelta !== 0) return verticalDelta;
          return left.getBoundingClientRect().left - right.getBoundingClientRect().left;
        });

        const selected = [];
        candidates.forEach((node) => {
          if (selected.length >= limit) return;
          const key = getSurfaceActivatorKey(node);
          if (!key || seenKeys.has(key)) return;
          seenKeys.add(key);
          selected.push(node);
        });
        return selected;
      };

      const getOpenSurfaceRoots = () => {
        return Array.from(document.querySelectorAll(SURFACE_CRAWL_ROOT_SELECTOR)).filter(
          (node) => node instanceof Element && isElementVisible(node)
        );
      };

      const getTabRestoreTarget = (node) => {
        const tablist = node.closest('[role="tablist"]');
        if (!tablist) return null;
        return (
          Array.from(tablist.querySelectorAll('[role="tab"]')).find(
            (tab) => tab !== node && tab.getAttribute("aria-selected") === "true"
          ) || null
        );
      };

      const getSurfaceInteractionState = (node) => {
        const details = node.tagName.toLowerCase() === "summary" ? node.parentElement : null;
        return {
          kind: getSurfaceActivatorKind(node),
          routeTarget: getSurfaceActivatorRouteTarget(node),
          ariaExpanded: node.getAttribute("aria-expanded"),
          detailsOpen: !!(details instanceof HTMLDetailsElement && details.open),
          restoreTab: getTabRestoreTarget(node),
          beforeUrl: location.href,
          beforePathname: location.pathname,
          beforeSearch: location.search,
        };
      };

      const dispatchEscapeToPage = () => {
        const target = document.activeElement instanceof Element ? document.activeElement : document.body;
        ["keydown", "keyup"].forEach((type) => {
          target.dispatchEvent(
            new KeyboardEvent(type, {
              key: "Escape",
              code: "Escape",
              keyCode: 27,
              which: 27,
              bubbles: true,
            })
          );
        });
      };

      const dispatchSyntheticSurfaceClick = (node) => {
        const rect = node.getBoundingClientRect();
        const eventInit = {
          bubbles: true,
          cancelable: true,
          composed: true,
          button: 0,
          buttons: 1,
          clientX: Math.round(rect.left + Math.max(1, rect.width / 2)),
          clientY: Math.round(rect.top + Math.max(1, rect.height / 2)),
          view: window,
        };
        if (typeof PointerEvent === "function") {
          ["pointerdown", "pointerup"].forEach((type) => {
            node.dispatchEvent(new PointerEvent(type, { ...eventInit, pointerType: "mouse", isPrimary: true }));
          });
        }
        ["mousedown", "mouseup"].forEach((type) => {
          node.dispatchEvent(new MouseEvent(type, eventInit));
        });
        node.click();
      };

      const hasShellSnapshotChanged = (beforeSnapshot, afterSnapshot) => {
        return (
          beforeSnapshot.page.url !== afterSnapshot.page.url ||
          beforeSnapshot.shell.kind !== afterSnapshot.shell.kind ||
          beforeSnapshot.shell.pathname !== afterSnapshot.shell.pathname ||
          beforeSnapshot.shell.search !== afterSnapshot.shell.search
        );
      };

      const hasTraversalSettled = (beforeSnapshot, afterSnapshot, kind) => {
        if (getSnapshotSignature(beforeSnapshot) === getSnapshotSignature(afterSnapshot)) return false;
        if (kind !== "route" && kind !== "submenu") return true;
        return (
          hasShellSnapshotChanged(beforeSnapshot, afterSnapshot) ||
          beforeSnapshot.summary.dialogCount !== afterSnapshot.summary.dialogCount ||
          beforeSnapshot.summary.menuCount !== afterSnapshot.summary.menuCount
        );
      };

      const waitForSurfaceTraversalSnapshot = async (beforeSnapshot, kind) => {
        await waitForSurfaceCrawlDelay(SURFACE_CRAWL_LIMITS.postClickDelayMs);
        let latestSnapshot = captureDomSurfaceSnapshot();
        if (hasTraversalSettled(beforeSnapshot, latestSnapshot, kind)) return latestSnapshot;
        for (let index = 0; index < SURFACE_CRAWL_LIMITS.routeSettleChecks; index += 1) {
          await waitForSurfaceCrawlDelay(SURFACE_CRAWL_LIMITS.routePollDelayMs);
          latestSnapshot = captureDomSurfaceSnapshot();
          if (hasTraversalSettled(beforeSnapshot, latestSnapshot, kind)) {
            return latestSnapshot;
          }
        }
        return latestSnapshot;
      };

      const waitForSurfaceRestore = async (beforeSnapshot) => {
        const targetSignature = getSnapshotSignature(beforeSnapshot);
        let latestSnapshot = captureDomSurfaceSnapshot();
        if (getSnapshotSignature(latestSnapshot) === targetSignature) return latestSnapshot;
        for (let index = 0; index < SURFACE_CRAWL_LIMITS.routeSettleChecks; index += 1) {
          await waitForSurfaceCrawlDelay(SURFACE_CRAWL_LIMITS.postCloseDelayMs);
          latestSnapshot = captureDomSurfaceSnapshot();
          if (getSnapshotSignature(latestSnapshot) === targetSignature) {
            return latestSnapshot;
          }
        }
        return latestSnapshot;
      };

      const activateSurfaceActivator = async (node, beforeSnapshot, kind) => {
        node.focus({ preventScroll: true });
        dispatchSyntheticSurfaceClick(node);
        return waitForSurfaceTraversalSnapshot(beforeSnapshot, kind);
      };

      const shouldRestoreSurfaceRouteWithHistory = (state, currentSnapshot) => {
        if (state.kind !== "route") return false;
        return (
          currentSnapshot.page.url !== state.beforeUrl ||
          currentSnapshot.shell.pathname !== state.beforePathname ||
          currentSnapshot.shell.search !== state.beforeSearch
        );
      };

      const restoreSurfaceInteraction = async (node, state, beforeSnapshot, currentSnapshot) => {
        if (state.kind === "tab") {
          if (
            state.restoreTab &&
            state.restoreTab.isConnected &&
            state.restoreTab.getAttribute("aria-selected") !== "true"
          ) {
            dispatchSyntheticSurfaceClick(state.restoreTab);
            await waitForSurfaceRestore(beforeSnapshot);
          }
          return;
        }

        if (shouldRestoreSurfaceRouteWithHistory(state, currentSnapshot)) {
          history.back();
          await waitForSurfaceRestore(beforeSnapshot);
          return;
        }

        dispatchEscapeToPage();
        await waitForSurfaceRestore(beforeSnapshot);

        if (!node.isConnected) return;
        if (state.kind === "summary" && node.parentElement instanceof HTMLDetailsElement && node.parentElement.open) {
          dispatchSyntheticSurfaceClick(node);
          await waitForSurfaceRestore(beforeSnapshot);
          return;
        }
        if (state.ariaExpanded === "false" && node.getAttribute("aria-expanded") === "true") {
          dispatchSyntheticSurfaceClick(node);
          await waitForSurfaceRestore(beforeSnapshot);
        }
      };

      const buildSurfaceCrawlStep = (node, depth, snapshot) => {
        return {
          depth,
          kind: getSurfaceActivatorKind(node),
          routeTarget: getSurfaceActivatorRouteTarget(node) || undefined,
          trigger: describeSnapshotNode(node),
          shell: snapshot.shell,
          summary: snapshot.summary,
          snapshot,
        };
      };

      const collectNestedSurfaceActivators = (seenKeys, limit) => {
        const nested = [];
        getOpenSurfaceRoots().forEach((root) => {
          if (nested.length >= limit) return;
          const remaining = limit - nested.length;
          nested.push(...collectSafeSurfaceActivators(root, seenKeys, remaining));
        });
        if (nested.length < limit) {
          nested.push(...collectSafeSurfaceActivators(document, seenKeys, limit - nested.length));
        }
        return nested;
      };

      const inspectSurfaceActivator = async (node, depth, steps, seenKeys, seenSignatures, budget) => {
        if (budget.remaining <= 0 || !isSafeSurfaceActivator(node)) return;

        const beforeSnapshot = captureDomSurfaceSnapshot();
        const state = getSurfaceInteractionState(node);
        const beforeSignature = getSnapshotSignature(beforeSnapshot);
        budget.remaining -= 1;
        const afterSnapshot = await activateSurfaceActivator(node, beforeSnapshot, state.kind);
        const afterSignature = getSnapshotSignature(afterSnapshot);
        const didChange = afterSignature !== beforeSignature && !seenSignatures.has(afterSignature);

        if (didChange) {
          seenSignatures.add(afterSignature);
          steps.push(buildSurfaceCrawlStep(node, depth, afterSnapshot));
        }

        if (didChange && depth + 1 < SURFACE_CRAWL_LIMITS.maxDepth && budget.remaining > 0) {
          const nestedLimit = Math.min(SURFACE_CRAWL_LIMITS.nestedPerSurface, budget.remaining);
          const nestedActivators = collectNestedSurfaceActivators(seenKeys, nestedLimit);
          for (const nestedActivator of nestedActivators) {
            if (budget.remaining <= 0) break;
            await inspectSurfaceActivator(nestedActivator, depth + 1, steps, seenKeys, seenSignatures, budget);
          }
        }

        await restoreSurfaceInteraction(node, state, beforeSnapshot, captureDomSurfaceSnapshot());
      };

      const crawlVisibleSurfaces = async () => {
        refreshSurfaceTags();
        const baseline = captureDomSurfaceSnapshot();
        const seenSignatures = new Set([getSnapshotSignature(baseline)]);
        const seenKeys = new Set();
        const steps = [];
        const budget = { remaining: SURFACE_CRAWL_LIMITS.totalInteractions };
        const topLevelActivators = collectSafeSurfaceActivators(document, seenKeys, SURFACE_CRAWL_LIMITS.topLevel);

        for (const activator of topLevelActivators) {
          if (budget.remaining <= 0) break;
          await inspectSurfaceActivator(activator, 0, steps, seenKeys, seenSignatures, budget);
        }

        return {
          schemaVersion: 1,
          mode: "safe-state-graph-crawl",
          crawledAt: new Date().toISOString(),
          limits: SURFACE_CRAWL_LIMITS,
          topLevelActivatorCount: topLevelActivators.length,
          interactionsAttempted: SURFACE_CRAWL_LIMITS.totalInteractions - budget.remaining,
          baseline,
          steps,
        };
      };

      return Object.freeze({
        captureDomSurfaceSnapshot,
        crawlVisibleSurfaces,
      });
    },
  });

  globalThis.AetherContentSurfaceTools = AetherContentSurfaceTools;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AetherContentSurfaceTools;
  }
})();
