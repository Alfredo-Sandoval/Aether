(() => {
  const TOOL_NAME = "AetherSurfaceTagging";

  const requireDependency = (deps, name) => {
    const value = deps[name];
    if (value == null) {
      throw new Error(`${TOOL_NAME}: missing dependency "${name}"`);
    }
    return value;
  };

  // Tags ChatGPT surfaces (dialogs, menus, research viewers, toasts, ...) with
  // data attributes the glass CSS keys off. Each refresh recomputes the full
  // target set and diffs it against the previously tagged nodes so stale tags
  // are cleared without churning nodes whose classification did not change.
  const createSurfaceTagging = (deps = {}) => {
    const document = requireDependency(deps, "document");
    const window = requireDependency(deps, "window");
    const normalizeText = requireDependency(deps, "normalizeText");
    const isElementVisible = requireDependency(deps, "isElementVisible");
    const isSettingsSurfaceDescriptor = requireDependency(deps, "isSettingsSurfaceDescriptor");
    const isProjectSurfaceDescriptor = requireDependency(deps, "isProjectSurfaceDescriptor");
    const isProfileMenuSurfaceDescriptor = requireDependency(deps, "isProfileMenuSurfaceDescriptor");
    const isModelPickerSurfaceDescriptor = requireDependency(deps, "isModelPickerSurfaceDescriptor");
    const isResearchDialogNode = requireDependency(deps, "isResearchDialogNode");
    const getClosedResearchViewerNodes = requireDependency(deps, "getClosedResearchViewerNodes");
    const getResearchOverlayHostNodes = requireDependency(deps, "getResearchOverlayHostNodes");
    const getResearchHomeCardNodes = requireDependency(deps, "getResearchHomeCardNodes");
    const getResearchAgendaItemNodes = requireDependency(deps, "getResearchAgendaItemNodes");
    const getProfileButton = requireDependency(deps, "getProfileButton");
    const searchPanelHints = requireDependency(deps, "searchPanelHints");
    const surfaceAttr = deps.surfaceAttr || "data-aether-surface";
    const glassAttr = deps.glassAttr || "data-aether-glass";
    const activityFlyoutSelector = requireDependency(deps, "activityFlyoutSelector");
    const researchViewerHostSelector = requireDependency(deps, "researchViewerHostSelector");
    const researchHomeSelector = requireDependency(deps, "researchHomeSelector");
    const canvasSurfaceClass = requireDependency(deps, "canvasSurfaceClass");
    const projectShellPathPattern = deps.projectShellPathPattern || /\/projects?(?:\/|$)/;
    const ElementCtor = deps.Element || globalThis.Element;
    const HTMLInputElementCtor = deps.HTMLInputElement || globalThis.HTMLInputElement;
    const HTMLTextAreaElementCtor = deps.HTMLTextAreaElement || globalThis.HTMLTextAreaElement;

    let taggedSurfaceNodes = new Set();

    const clearTaggedSurfaceNode = (node) => {
      node.removeAttribute(surfaceAttr);
      node.removeAttribute(glassAttr);
    };

    const tagSurfaceNode = (nextTaggedNodes, node, surface, glass = "raised") => {
      if (!(node instanceof ElementCtor) || !node.isConnected) return;
      node.setAttribute(surfaceAttr, surface);
      if (glass) {
        node.setAttribute(glassAttr, glass);
      } else {
        node.removeAttribute(glassAttr);
      }
      nextTaggedNodes.add(node);
    };

    const commitTaggedSurfaceNodes = (nextTaggedNodes) => {
      taggedSurfaceNodes.forEach((node) => {
        if (!nextTaggedNodes.has(node) && node.isConnected) {
          clearTaggedSurfaceNode(node);
        }
      });
      taggedSurfaceNodes = nextTaggedNodes;
    };

    const tagVisibleNodes = (nextTaggedNodes, nodes, surface, glass = "raised") => {
      nodes.forEach((node) => {
        if (!isElementVisible(node)) return;
        tagSurfaceNode(nextTaggedNodes, node, surface, glass);
      });
    };

    const buildSurfaceDescriptor = (node, overrides = {}) => ({
      text: node?.textContent || "",
      ariaLabel: node?.getAttribute?.("aria-label") || "",
      title: node?.getAttribute?.("title") || "",
      dataTestId: node?.getAttribute?.("data-testid") || "",
      href: node?.getAttribute?.("href") || "",
      id: node?.id || "",
      className: typeof node?.className === "string" ? node.className : "",
      role: node?.getAttribute?.("role") || "",
      tagName: node?.tagName || "",
      ...overrides,
    });

    const isNodeNearProfileButton = (node) => {
      const profileButton = getProfileButton();
      if (!(profileButton instanceof ElementCtor) || !isElementVisible(profileButton)) return false;
      const nodeRect = node.getBoundingClientRect();
      const buttonRect = profileButton.getBoundingClientRect();
      const horizontalGap = Math.min(
        Math.abs(nodeRect.left - buttonRect.left),
        Math.abs(nodeRect.right - buttonRect.right)
      );
      const verticalGap = Math.min(
        Math.abs(nodeRect.top - buttonRect.top),
        Math.abs(nodeRect.bottom - buttonRect.bottom)
      );
      return horizontalGap <= 180 && verticalGap <= 320;
    };

    const isCurrentGroupChatShell = () => {
      if (document.querySelector('a[aria-current="page"][href*="/gg/"]')) return true;
      return window.location.pathname.toLowerCase().includes("/gg/");
    };

    const isCurrentProjectShell = () => projectShellPathPattern.test(window.location.pathname.toLowerCase());

    const isCurrentSettingsShell = () => window.location.pathname.toLowerCase().includes("/settings");

    const isSearchDialogSurface = (node) => {
      const inputSignals = [];
      node.querySelectorAll("input, textarea").forEach((input) => {
        if (!(input instanceof HTMLInputElementCtor || input instanceof HTMLTextAreaElementCtor)) return;
        inputSignals.push(input.id || "");
        inputSignals.push(input.getAttribute("type") || "");
        inputSignals.push(input.getAttribute("placeholder") || "");
        inputSignals.push(input.getAttribute("aria-label") || "");
      });
      const normalizedSignals = inputSignals.map((value) => normalizeText(value)).filter(Boolean);
      if (normalizedSignals.some((value) => value.includes("search"))) return true;
      const signalText = normalizeText(
        [
          node.textContent || "",
          node.getAttribute("aria-label") || "",
          node.getAttribute("title") || "",
          node.getAttribute("data-testid") || "",
          ...normalizedSignals,
        ].join(" ")
      );
      return searchPanelHints.some((hint) => signalText.includes(hint));
    };

    const classifyDialogSurface = (node) => {
      if (node.matches?.(activityFlyoutSelector)) return "activity-flyout";
      if (isResearchDialogNode(node)) return "research-viewer";
      const descriptor = buildSurfaceDescriptor(node);
      const isSettings = isSettingsSurfaceDescriptor(descriptor);
      if (isSettings && node.querySelector('[role="tablist"]')) return "settings-panel";
      if (isSearchDialogSurface(node)) return "search-panel";
      if (isSettings) return "settings-panel";
      if (isProjectSurfaceDescriptor(descriptor)) return "project-modal";
      if (isModelPickerSurfaceDescriptor(descriptor)) return "model-picker";
      return "dialog";
    };

    const classifyMenuSurface = (node) => {
      const descriptor = buildSurfaceDescriptor(node);
      if (isModelPickerSurfaceDescriptor(descriptor)) return "model-picker";
      if (isProfileMenuSurfaceDescriptor(descriptor) || isNodeNearProfileButton(node)) return "profile-menu";
      if (isSettingsSurfaceDescriptor(descriptor)) return "settings-panel";
      return "menu";
    };

    const classifyListboxSurface = (node) =>
      isModelPickerSurfaceDescriptor(buildSurfaceDescriptor(node)) ? "model-picker" : "listbox";

    const tagPrimaryShellSurface = (nextTaggedNodes) => {
      const mainNode = document.querySelector("main");
      if (!(mainNode instanceof ElementCtor) || !isElementVisible(mainNode)) return;
      if (isCurrentSettingsShell()) {
        tagSurfaceNode(nextTaggedNodes, mainNode, "settings-panel");
        return;
      }
      if (isCurrentProjectShell()) {
        tagSurfaceNode(nextTaggedNodes, mainNode, "project-shell");
        return;
      }
      if (isCurrentGroupChatShell()) {
        tagSurfaceNode(nextTaggedNodes, mainNode, "group-chat-shell");
      }
    };

    const tagResearchSurfaceNodes = (nextTaggedNodes) => {
      // Fullscreen deep-research overlays render inside the report card DOM, so
      // the card itself must stop participating in the glass engine once the
      // overlay opens or it becomes the containing block for the fixed viewer.
      tagVisibleNodes(nextTaggedNodes, getClosedResearchViewerNodes(), "research-viewer");
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(researchViewerHostSelector), "research-viewer");
      tagVisibleNodes(nextTaggedNodes, getResearchOverlayHostNodes(), "research-overlay");
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(researchHomeSelector), "research-home");
      tagVisibleNodes(nextTaggedNodes, getResearchHomeCardNodes(), "research-card");
      tagVisibleNodes(nextTaggedNodes, getResearchAgendaItemNodes(), "research-agenda-item", "interactive");
    };

    const tagDialogNodes = (nextTaggedNodes) => {
      const dialogs = document.querySelectorAll(
        `.popover[role="dialog"], div[role="dialog"], ${activityFlyoutSelector}`
      );
      dialogs.forEach((node) => {
        if (!isElementVisible(node)) return;
        const surface = classifyDialogSurface(node);
        tagSurfaceNode(nextTaggedNodes, node, surface, surface === "search-panel" ? "interactive" : "raised");
      });
    };

    const tagMenuNodes = (nextTaggedNodes) => {
      const menus = document.querySelectorAll(
        '.popover[data-radix-menu-content], [role="menu"], .popover:not([role]):has(> [role="group"] .__menu-item)'
      );
      menus.forEach((node) => {
        if (!isElementVisible(node)) return;
        tagSurfaceNode(nextTaggedNodes, node, classifyMenuSurface(node), "interactive");
      });
    };

    const tagListboxNodes = (nextTaggedNodes) => {
      document.querySelectorAll('[role="listbox"]').forEach((node) => {
        if (!isElementVisible(node)) return;
        tagSurfaceNode(nextTaggedNodes, node, classifyListboxSurface(node), "interactive");
      });
    };

    const tagComposerSuggestionNodes = (nextTaggedNodes) => {
      tagVisibleNodes(
        nextTaggedNodes,
        document.querySelectorAll(
          '#thread-bottom-container:has(form[data-type="unified-composer"]) .bg-surface-primary:has(ul > li[data-suggestion-index])'
        ),
        "composer-suggestions"
      );
    };

    const markSemanticSurfaces = () => {
      const nextTaggedNodes = new Set();
      tagPrimaryShellSurface(nextTaggedNodes);
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(activityFlyoutSelector), "activity-flyout");
      tagResearchSurfaceNodes(nextTaggedNodes);
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll(`.${canvasSurfaceClass}`), "canvas-surface");
      tagVisibleNodes(
        nextTaggedNodes,
        document.querySelectorAll(
          '[role="tooltip"], .bg-black[data-state*="open"], [class*="tooltipContent"], [class*="tooltipOpen"]'
        ),
        "tooltip"
      );
      tagDialogNodes(nextTaggedNodes);
      tagMenuNodes(nextTaggedNodes);
      tagListboxNodes(nextTaggedNodes);
      tagComposerSuggestionNodes(nextTaggedNodes);
      tagVisibleNodes(nextTaggedNodes, document.querySelectorAll('[role="alert"], [role="status"]'), "toast");
      tagVisibleNodes(
        nextTaggedNodes,
        document.querySelectorAll(
          '[data-testid^="conversation-turn-"] [data-message-author-role="assistant"] :is(button, a)[class*="rounded-full"]:is([class*="bg-token-bg-"], [class*="bg-token-main-surface"], .bg-black)'
        ),
        "source-chip",
        "interactive"
      );
      commitTaggedSurfaceNodes(nextTaggedNodes);
    };

    const clearAllTags = () => {
      taggedSurfaceNodes.forEach((node) => {
        if (node.isConnected) {
          clearTaggedSurfaceNode(node);
        }
      });
      taggedSurfaceNodes.clear();
    };

    const getTagSummary = () => {
      const summary = {};
      taggedSurfaceNodes.forEach((node) => {
        if (!node.isConnected) return;
        const surface = node.getAttribute(surfaceAttr) || "unknown";
        summary[surface] = (summary[surface] || 0) + 1;
      });
      return summary;
    };

    return Object.freeze({
      markSemanticSurfaces,
      clearAllTags,
      getTagSummary,
    });
  };

  const AetherSurfaceTagging = Object.freeze({
    createSurfaceTagging,
  });

  globalThis.AetherSurfaceTagging = AetherSurfaceTagging;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AetherSurfaceTagging;
  }
})();
