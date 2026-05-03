(() => {
  const TOOL_NAME = "AetherContentSidebarTools";

  const requireDependency = (deps, name) => {
    const value = deps[name];
    if (value == null) {
      throw new Error(`${TOOL_NAME}: missing dependency "${name}"`);
    }
    return value;
  };

  const createSidebarContext = (deps = {}) => ({
    document: requireDependency(deps, "document"),
    getSettings: typeof deps.getSettings === "function" ? deps.getSettings : () => requireDependency(deps, "settings"),
    selectors: requireDependency(deps, "selectors"),
    hideSoraClass: requireDependency(deps, "hideSoraClass"),
    hideGptsClass: requireDependency(deps, "hideGptsClass"),
    hideShoppingClass: requireDependency(deps, "hideShoppingClass"),
    hideTodaysPulseClass: requireDependency(deps, "hideTodaysPulseClass"),
    pulseAttrs: requireDependency(deps, "pulseAttrs"),
    shoppingAttrs: requireDependency(deps, "shoppingAttrs"),
    toggleClassForElements: requireDependency(deps, "toggleClassForElements"),
    matchesPulseTargetValue: requireDependency(deps, "matchesPulseTargetValue"),
    matchesShoppingResearchValue: requireDependency(deps, "matchesShoppingResearchValue"),
  });

  const findPulseContainer = (context, element) => {
    if (!element) return null;
    if (element.closest?.('article[data-testid^="conversation-turn-"], .group\\/conversation-turn')) {
      return null;
    }
    let node = element;
    for (let index = 0; index < 6 && node; index += 1) {
      if (node.matches?.("a, button, [role='button'], [role='link']")) return node;
      if (node.classList?.contains("cursor-pointer")) return node;
      node = node.parentElement;
    }
    return null;
  };

  const findPulseTextElements = (context) => {
    const { document, matchesPulseTargetValue } = context;
    const nav = document.querySelector("nav");
    if (!nav) return [];
    const matches = [];

    for (const element of nav.querySelectorAll("div, span, a, p")) {
      const text = element.textContent;
      if (text && text.length < 120 && matchesPulseTargetValue(text)) {
        matches.push(element);
      }
    }

    return matches;
  };

  const clearSidebarClass = (context, className, processedAttr = null) => {
    context.document.querySelectorAll(`.${className}`).forEach((element) => {
      element.classList.remove(className);
      if (processedAttr) {
        element.removeAttribute(processedAttr);
      }
    });
  };

  const manageShoppingButton = (context) => {
    const { document, getSettings, hideShoppingClass, shoppingAttrs, matchesShoppingResearchValue } = context;
    if (!getSettings().hideShoppingButton) {
      clearSidebarClass(context, hideShoppingClass, "data-aether-shopping-processed");
      return;
    }

    document.querySelectorAll('[role="menuitemradio"], [role="menuitem"]').forEach((element) => {
      if (!element) return;
      if (matchesShoppingResearchValue(element.textContent || "")) {
        element.classList.add(hideShoppingClass);
        return;
      }
      for (const attr of shoppingAttrs) {
        if (matchesShoppingResearchValue(element.getAttribute(attr))) {
          element.classList.add(hideShoppingClass);
          return;
        }
      }
    });
  };

  const collectPulseTargets = (context) => {
    const { document, pulseAttrs, matchesPulseTargetValue } = context;
    const targets = new Set();
    findPulseTextElements(context).forEach((element) => {
      const container = findPulseContainer(context, element);
      if (container) targets.add(container);
    });

    if (targets.size > 0) return targets;

    const attrMatches = Array.from(document.querySelectorAll("[aria-label],[href],[data-testid],[data-track]")).filter(
      (element) => pulseAttrs.some((attr) => matchesPulseTargetValue(element.getAttribute(attr)))
    );
    attrMatches.forEach((element) => {
      const container = findPulseContainer(context, element);
      if (container) targets.add(container);
    });
    return targets;
  };

  const manageTodaysPulse = (context) => {
    const { getSettings, hideTodaysPulseClass, toggleClassForElements } = context;
    if (!getSettings().hideTodaysPulse) {
      clearSidebarClass(context, hideTodaysPulseClass);
      return;
    }

    toggleClassForElements(Array.from(collectPulseTargets(context)), hideTodaysPulseClass, true);
  };

  const manageSidebarButtonsQuick = (context) => {
    const { document, getSettings, selectors, hideSoraClass, hideGptsClass, toggleClassForElements } = context;
    const settings = getSettings();
    const soraTargets = [
      document.getElementById(selectors.SORA_BUTTON_ID),
      ...Array.from(document.querySelectorAll(selectors.SORA_BUTTON)),
    ];
    toggleClassForElements(Array.from(new Set(soraTargets.filter(Boolean))), hideSoraClass, settings.hideSoraButton);

    const gptsTargets = Array.from(document.querySelectorAll(selectors.GPTS_BUTTON));
    toggleClassForElements(Array.from(new Set(gptsTargets.filter(Boolean))), hideGptsClass, settings.hideGptsButton);
    manageShoppingButton(context);
  };

  const manageSidebarButtons = (context) => {
    manageSidebarButtonsQuick(context);
    manageTodaysPulse(context);
  };

  const createSidebarTools = (deps = {}) => {
    const context = createSidebarContext(deps);
    return Object.freeze({
      manageSidebarButtons: () => manageSidebarButtons(context),
      manageSidebarButtonsQuick: () => manageSidebarButtonsQuick(context),
      manageShoppingButton: () => manageShoppingButton(context),
      manageTodaysPulse: () => manageTodaysPulse(context),
    });
  };

  const AetherContentSidebarTools = Object.freeze({
    createSidebarTools,
  });

  globalThis.AetherContentSidebarTools = AetherContentSidebarTools;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AetherContentSidebarTools;
  }
})();
