(() => {
  const TOOL_NAME = "AetherContentResearchTools";

  const requireDependency = (deps, name) => {
    const value = deps[name];
    if (value == null) {
      throw new Error(`${TOOL_NAME}: missing dependency "${name}"`);
    }
    return value;
  };

  const createResearchContext = (deps = {}) => ({
    document: requireDependency(deps, "document"),
    window: requireDependency(deps, "window"),
    Node: requireDependency(deps, "Node"),
    Element: requireDependency(deps, "Element"),
    normalizeText: requireDependency(deps, "normalizeText"),
    isElementVisible: requireDependency(deps, "isElementVisible"),
    matchesResearchBannerText: requireDependency(deps, "matchesResearchBannerText"),
    matchesResearchContentText: requireDependency(deps, "matchesResearchContentText"),
    matchesResearchFullscreenText: requireDependency(deps, "matchesResearchFullscreenText"),
    matchesCanvasActionHeaderText: requireDependency(deps, "matchesCanvasActionHeaderText"),
    isResearchDialogDescriptor: requireDependency(deps, "isResearchDialogDescriptor"),
    isResearchCardRootShellDescriptor: requireDependency(deps, "isResearchCardRootShellDescriptor"),
    composerSelector: deps.composerSelector || 'form[data-type="unified-composer"]',
    researchCardClass: deps.researchCardClass || "cgpt-aether-research-card",
    researchCardOpenClass: deps.researchCardOpenClass || "cgpt-aether-research-card-open",
    canvasSurfaceClass: deps.canvasSurfaceClass || "cgpt-aether-canvas-surface",
    researchCardContainerSelector: deps.researchCardContainerSelector || "div, section, article, main",
    researchEmbedIframeSelector:
      deps.researchEmbedIframeSelector ||
      [
        'iframe[title*="deep-research" i]',
        'iframe[title*="deep research" i]',
        'iframe[title*="research" i]',
        'iframe[src*="connector_openai_deep_research" i]',
        'iframe[src*="deep_research" i]',
        'iframe[src*="deep-research" i]',
        'iframe[src*="research.web-sandbox.oaisusercontent.com" i]',
      ].join(", "),
    researchReportMarkerSelector:
      deps.researchReportMarkerSelector ||
      [
        '[data-testid*="research" i]',
        '[data-testid*="artifact" i]',
        '[id*="research" i]',
        '[id*="artifact" i]',
        '[class*="research" i]',
        '[class*="artifact" i]',
      ].join(", "),
    researchDialogSelector: deps.researchDialogSelector || 'div[role="dialog"]',
    researchHomeSelector: deps.researchHomeSelector || ".deep-research-app",
  });

  const isResearchFullscreenControl = (context, control) => {
    const { Element, normalizeText, matchesResearchFullscreenText } = context;
    if (!(control instanceof Element)) return false;
    const labels = [
      control.getAttribute("aria-label"),
      control.getAttribute("data-testid"),
      control.getAttribute("title"),
    ];
    const combined = labels.map((value) => normalizeText(value)).join(" ");
    if (!combined) return false;
    return matchesResearchFullscreenText(combined);
  };

  const nodeHasFullscreenControl = (context, root) => {
    if (!root) return false;
    const controls = root.querySelectorAll("[aria-label], [data-testid], [title]");
    for (const control of controls) {
      if (isResearchFullscreenControl(context, control)) {
        return true;
      }
    }
    return false;
  };

  const getResearchFullscreenControlNodes = (context) => {
    const { document } = context;
    const scope = document.querySelector("#thread, #main, main") || document;
    return Array.from(scope.querySelectorAll("[aria-label], [data-testid], [title]")).filter((control) =>
      isResearchFullscreenControl(context, control)
    );
  };

  const isValidResearchCardContainer = (context, node) => {
    const { Node, window, composerSelector, isElementVisible, isResearchCardRootShellDescriptor } = context;
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (isResearchCardRootShellDescriptor({ tagName: node.tagName, id: node.id })) return false;
    if (node.querySelector(composerSelector)) return false;
    if (!node.closest("#thread, #main")) return false;
    if (!isElementVisible(node)) return false;

    const rect = node.getBoundingClientRect();
    const maxAllowedHeight = Math.max(window.innerHeight * 1.8, 2200);
    return (
      rect.width >= 480 &&
      rect.height >= 220 &&
      rect.width <= window.innerWidth * 1.2 &&
      rect.height <= maxAllowedHeight
    );
  };

  const scoreResearchCard = (context, node) => {
    const {
      window,
      normalizeText,
      matchesResearchBannerText,
      matchesResearchContentText,
      researchEmbedIframeSelector,
    } = context;
    const rect = node.getBoundingClientRect();
    const text = normalizeText(node.textContent);
    const hasBanner = matchesResearchBannerText(text);
    const hasSummary = matchesResearchContentText(text);
    const hasHeading = !!node.querySelector("h1, h2, h3");
    const hasResearchIframe = !!node.querySelector(researchEmbedIframeSelector);
    const hasEmbeddedSurface = !!node.querySelector("iframe, canvas, video, object, embed");
    const interactiveCount = node.querySelectorAll("button, [role='button'], a[href]").length;
    const hasFullscreen = nodeHasFullscreenControl(context, node);

    let score = 0;
    if (hasBanner) score -= 90;
    if (hasSummary) score -= 70;
    if (hasHeading) score -= 20;
    if (hasResearchIframe) score -= 80;
    if (hasEmbeddedSurface) score -= 18;
    if (hasFullscreen) score -= 18;
    score -= Math.min(interactiveCount, 8) * 3;

    const targetWidth = Math.min(window.innerWidth * 0.86, 1220);
    score += Math.abs(rect.width - targetWidth) / 14;
    score += Math.abs(rect.height - 430) / 16;
    return score;
  };

  const tagResearchCardNode = (context, taggedCards, node) => {
    const { Element, researchCardClass } = context;
    if (!(node instanceof Element)) return false;
    node.classList.add(researchCardClass);
    taggedCards.add(node);
    return true;
  };

  const getResearchOverlayHostNodes = (context) => {
    const { document, window, Element, isElementVisible, researchEmbedIframeSelector } = context;
    const overlayHosts = new Set();
    document.querySelectorAll(researchEmbedIframeSelector).forEach((iframe) => {
      let node = iframe.parentElement;
      for (let depth = 0; node && depth < 6; depth += 1) {
        if (!(node instanceof Element) || !isElementVisible(node)) {
          node = node?.parentElement || null;
          continue;
        }
        const rect = node.getBoundingClientRect();
        const coversViewport = rect.width >= window.innerWidth * 0.75 && rect.height >= window.innerHeight * 0.75;
        if (
          coversViewport &&
          (node.getAttribute("role") === "dialog" || window.getComputedStyle(node).position === "fixed")
        ) {
          overlayHosts.add(node);
          break;
        }
        node = node.parentElement;
      }
    });
    return Array.from(overlayHosts);
  };

  const syncResearchCardState = (context, node) => {
    const { Element, researchEmbedIframeSelector, researchCardOpenClass } = context;
    if (!(node instanceof Element)) return;
    const hasOpenResearchOverlay =
      !!node.querySelector(researchEmbedIframeSelector) &&
      getResearchOverlayHostNodes(context).some((overlayHost) => node.contains(overlayHost));
    node.classList.toggle(researchCardOpenClass, hasOpenResearchOverlay);
  };

  const findBestResearchCardAncestor = (context, startNode, maxDepth = 34) => {
    const { researchCardContainerSelector } = context;
    let node = startNode?.closest(researchCardContainerSelector) || null;
    let depth = 0;
    let bestNode = null;
    let bestScore = Number.POSITIVE_INFINITY;

    while (node && depth < maxDepth) {
      if (isValidResearchCardContainer(context, node)) {
        const score = scoreResearchCard(context, node) + depth * 0.8;
        if (score < bestScore) {
          bestScore = score;
          bestNode = node;
        }
        if (bestScore <= -55) break;
      }
      node = node.parentElement;
      depth += 1;
    }

    return bestNode;
  };

  const tagBestResearchCardAncestor = (context, taggedCards, startNode, maxDepth = 34) =>
    tagResearchCardNode(context, taggedCards, findBestResearchCardAncestor(context, startNode, maxDepth));

  const tagResearchCardCandidates = (context, taggedCards, selector, maxDepth) => {
    context.document.querySelectorAll(selector).forEach((node) => {
      tagBestResearchCardAncestor(context, taggedCards, node, maxDepth);
    });
  };

  const getResearchBannerNodes = (context) => {
    const { document, normalizeText, isElementVisible, matchesResearchBannerText } = context;
    const scope = document.querySelector("#thread, #main, main") || document;
    return Array.from(scope.querySelectorAll("div, span, p")).filter((node) => {
      if (!isElementVisible(node)) return false;
      const text = normalizeText(node.textContent);
      if (!text || text.length > 280) return false;
      return matchesResearchBannerText(text);
    });
  };

  const findBestResearchBannerCard = (context, banner) => {
    const { document, researchCardContainerSelector } = context;
    const bannerRect = banner.getBoundingClientRect();
    const scope = banner.closest("article, section, main, #thread") || document;
    let bestNode = null;
    let bestScore = Number.POSITIVE_INFINITY;

    scope.querySelectorAll(researchCardContainerSelector).forEach((candidate) => {
      if (!isValidResearchCardContainer(context, candidate)) return;
      const rect = candidate.getBoundingClientRect();
      const delta = rect.top - bannerRect.bottom;
      if (delta < -30 || delta > 380) return;
      const score = scoreResearchCard(context, candidate) + delta * 0.45;
      if (score < bestScore) {
        bestScore = score;
        bestNode = candidate;
      }
    });

    return bestNode;
  };

  const tagResearchBannerCards = (context, taggedCards) => {
    getResearchBannerNodes(context).forEach((banner) => {
      if (tagBestResearchCardAncestor(context, taggedCards, banner, 26)) return;
      tagResearchCardNode(context, taggedCards, findBestResearchBannerCard(context, banner));
    });
  };

  const syncResearchCardClasses = (context, taggedCards) => {
    const { document, researchCardClass, researchCardOpenClass } = context;
    document.querySelectorAll(`.${researchCardClass}`).forEach((node) => {
      if (!taggedCards.has(node)) {
        node.classList.remove(researchCardClass);
        node.classList.remove(researchCardOpenClass);
        return;
      }
      syncResearchCardState(context, node);
    });
  };

  const markResearchReportCards = (context) => {
    const { document, window, matchesResearchContentText, researchEmbedIframeSelector, researchReportMarkerSelector } =
      context;
    const taggedCards = new Set();

    // Library cards intentionally expose artifact test IDs, which are also a
    // fallback signal for deep-research reports. Never promote the Library
    // result grid into one giant research surface.
    if (window.location.pathname.toLowerCase().startsWith("/library")) {
      syncResearchCardClasses(context, taggedCards);
      return;
    }

    tagResearchCardCandidates(context, taggedCards, researchEmbedIframeSelector, 24);
    getResearchFullscreenControlNodes(context).forEach((control) => {
      tagBestResearchCardAncestor(context, taggedCards, control, 36);
    });

    if (taggedCards.size === 0) {
      tagResearchCardCandidates(context, taggedCards, researchReportMarkerSelector, 36);
    }
    if (taggedCards.size === 0) {
      tagResearchBannerCards(context, taggedCards);
    }
    if (taggedCards.size === 0) {
      const contentAnchors = Array.from(document.querySelectorAll("h1, h2, h3, div, p, span")).filter((node) =>
        matchesResearchContentText(node.textContent)
      );
      contentAnchors.forEach((anchor) => {
        tagBestResearchCardAncestor(context, taggedCards, anchor, 24);
      });
    }

    syncResearchCardClasses(context, taggedCards);
  };

  const hasCanvasActionHeader = (context, node) => {
    const { normalizeText, matchesCanvasActionHeaderText } = context;
    if (!node) return false;
    const headerRoot = node.querySelector("header, [role='toolbar'], .sticky");
    const headerText = normalizeText(headerRoot?.textContent || "");
    if (!headerText) return false;
    return matchesCanvasActionHeaderText(headerText);
  };

  const markCanvasSurfaces = (context) => {
    const { document, Node, isElementVisible, composerSelector, canvasSurfaceClass } = context;
    const taggedSurfaces = new Set();
    const turnRoots = document.querySelectorAll('[data-testid^="conversation-turn-"], .group\\/conversation-turn');

    turnRoots.forEach((turn) => {
      const candidates = new Set(
        turn.querySelectorAll(
          [
            '[id^="textdoc-message-"]',
            '[data-testid*="textdoc" i]',
            '[data-testid*="artifact" i]',
            '[data-testid*="canvas" i]',
            '[data-testid*="visualization" i]',
            '[data-testid*="interactive" i]',
            '[role="dialog"]',
            "article",
            "section",
          ].join(", ")
        )
      );
      turn.querySelectorAll("iframe, canvas, object, embed").forEach((embeddedNode) => {
        const parent = embeddedNode.parentElement;
        const parentIsTurnShell =
          !parent ||
          parent === turn ||
          parent.matches?.('[data-message-author-role], [data-testid^="conversation-turn-"]');
        candidates.add(parentIsTurnShell ? embeddedNode : parent);
      });

      candidates.forEach((node) => {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.querySelector(composerSelector)) return;
        if (!isElementVisible(node)) return;

        const rect = node.getBoundingClientRect();
        if (rect.width < 320 || rect.height < 220) return;

        const isKnownTextdoc = String(node.id || "").startsWith("textdoc-message-");
        const hasArtifactHook = node.matches?.(
          '[data-testid*="artifact" i], [data-testid*="canvas" i], [data-testid*="visualization" i], [data-testid*="interactive" i]'
        );
        const hasEmbeddedInteractive =
          node.matches?.("iframe, canvas, object, embed") || !!node.querySelector("iframe, canvas, object, embed");
        if (!isKnownTextdoc && !hasArtifactHook && !hasEmbeddedInteractive && !hasCanvasActionHeader(context, node)) {
          return;
        }
        if (Array.from(taggedSurfaces).some((surface) => surface.contains(node))) return;

        node.classList.add(canvasSurfaceClass);
        taggedSurfaces.add(node);
      });
    });

    document.querySelectorAll(`.${canvasSurfaceClass}`).forEach((node) => {
      if (!taggedSurfaces.has(node)) {
        node.classList.remove(canvasSurfaceClass);
      }
    });
  };

  const getResearchHomeCardNodes = (context) => {
    const { document, isElementVisible, researchHomeSelector } = context;
    const home = document.querySelector(researchHomeSelector);
    if (!home) return [];
    return Array.from(home.querySelectorAll("article")).filter((node) => {
      if (!isElementVisible(node)) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width < 220 || rect.height < 120) return false;
      return !!node.closest("a[href]");
    });
  };

  const getResearchAgendaItemNodes = (context) => {
    const { document, normalizeText, isElementVisible, researchHomeSelector } = context;
    const home = document.querySelector(researchHomeSelector);
    if (!home) return [];
    return Array.from(home.querySelectorAll("section button, [role='button']")).filter((node) => {
      if (!isElementVisible(node)) return false;
      const text = normalizeText(node.textContent || "");
      if (!text || text.length > 200) return false;
      return !!node.closest("section");
    });
  };

  const isResearchDialogNode = (context, node) => {
    const { Element, isResearchDialogDescriptor, researchDialogSelector, researchEmbedIframeSelector } = context;
    if (!(node instanceof Element)) return false;
    if (
      node.matches?.(researchDialogSelector) &&
      isResearchDialogDescriptor({
        text: node.textContent || "",
        ariaLabel: node.getAttribute("aria-label") || "",
        title: node.getAttribute("title") || "",
        dataTestId: node.getAttribute("data-testid") || "",
        id: node.id || "",
        className: typeof node.className === "string" ? node.className : "",
      })
    ) {
      return true;
    }
    return !!node.querySelector(researchEmbedIframeSelector);
  };

  const getClosedResearchViewerNodes = (context) => {
    const { document, researchCardClass, researchCardOpenClass } = context;
    return document.querySelectorAll(`.${researchCardClass}:not(.${researchCardOpenClass})`);
  };

  const createResearchSurfaceTools = (deps = {}) => {
    const context = createResearchContext(deps);
    return Object.freeze({
      markResearchReportCards: () => markResearchReportCards(context),
      markCanvasSurfaces: () => markCanvasSurfaces(context),
      getResearchOverlayHostNodes: () => getResearchOverlayHostNodes(context),
      getResearchHomeCardNodes: () => getResearchHomeCardNodes(context),
      getResearchAgendaItemNodes: () => getResearchAgendaItemNodes(context),
      isResearchDialogNode: (node) => isResearchDialogNode(context, node),
      getClosedResearchViewerNodes: () => getClosedResearchViewerNodes(context),
    });
  };

  const AetherContentResearchTools = Object.freeze({
    createResearchSurfaceTools,
  });

  globalThis.AetherContentResearchTools = AetherContentResearchTools;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AetherContentResearchTools;
  }
})();
