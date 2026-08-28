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
    shoppingAttrs: requireDependency(deps, "shoppingAttrs"),
    toggleClassForElements: requireDependency(deps, "toggleClassForElements"),
    matchesShoppingResearchValue: requireDependency(deps, "matchesShoppingResearchValue"),
  });

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

  const manageTodaysPulse = (context) => {
    const { document, getSettings, selectors, hideTodaysPulseClass, toggleClassForElements } = context;
    const mapsTargets = Array.from(document.querySelectorAll(selectors.MAPS_BUTTON));
    toggleClassForElements(mapsTargets, hideTodaysPulseClass, getSettings().hideTodaysPulse);
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
