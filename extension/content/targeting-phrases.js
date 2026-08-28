(() => {
  // Locale-keyed copy tables for targeting ChatGPT UI surfaces.
  //
  // Matching logic lives in shared-utils.js; this file is data only. Supporting a
  // new ChatGPT display language means adding a locale block that mirrors the
  // shape of "en" (any subset of keys is fine — lists merge across locales).
  // Strings are compared against normalizeUiMatchText output: lowercase,
  // accent-stripped, with _/:- collapsed to spaces.
  //
  // "common" holds locale-independent signals (route slugs, product names,
  // data-testid fragments) that never need translating.
  const TARGETING_PHRASES = {
    common: {
      upgradeContextPhrases: ["chatgpt plus", "chatgpt go"],
      upgradeRouteHints: ["upgrade", "plus", "subscription", "billing"],
      // Compared via normalizeUiMatchText, which folds -_/: to spaces, so hints
      // must be written space-separated; hyphenated forms can never match.
      researchDialogHints: ["artifact viewer"],
      quickAddPinnedItemOrder: ["deep-research", "github"],
      quickAddPinnedItemHints: { github: ["github"] },
    },
    en: {
      pulsePhrases: ["today's pulse", "todays pulse"],
      pulseTokenGroups: [
        ["today", "pulse"],
        ["todays", "pulse"],
      ],
      shoppingResearchPhrases: ["shopping research"],
      shoppingResearchTokenGroups: [["shopping", "research"]],
      upgradeKeywordPhrases: ["upgrade"],
      upgradeShortLabels: ["upgrade"],
      upgradeContextPhrases: ["upgrade your plan"],
      upgradeSettingsTitlePhrases: ["get chatgpt plus", "get chatgpt go"],
      researchBannerTokenGroups: [["research completed in", "citations", "searches"]],
      researchContentTokenGroups: [["executive summary"]],
      researchFullscreenTokens: ["full screen", "fullscreen", "expand", "maximize"],
      researchDialogHints: ["deep research", "research report"],
      settingsSurfaceHints: ["settings", "appearance", "personalization", "customize chatgpt", "preferences"],
      projectSurfaceHints: ["project", "projects", "new project", "project settings"],
      profileMenuSurfaceHints: ["my plan", "customize chatgpt", "log out", "logout", "sign out", "profile", "account"],
      modelPickerSurfaceHints: ["model", "models", "legacy models", "choose model", "select model", "switch model"],
      canvasActionTokenGroups: [["copy", "edit", "download"]],
      gpt5LimitPhrases: ["you've reached the gpt-5 limit", "youve reached the gpt-5 limit"],
      quickAddMenuHints: ["add photos", "add files", "create image", "deep research", "agent mode"],
      quickAddMoreLabels: ["more"],
      quickAddPromotedHints: ["canvas", "deep research", "github"],
      quickAddPinnedItemHints: { "deep-research": ["deep research"] },
      searchPanelHints: ["search chats", "search chat", "chat history", "conversation history", "search conversations"],
      deepResearchRoutePhrases: ["deep research"],
      settingsRouteLabels: ["settings"],
      personalizationRouteLabels: ["personalization"],
      legacyModelsRoutePhrases: ["legacy models"],
      canvasRouteLabels: ["canvas"],
      moreRouteLabels: ["more"],
      profileRouteLabels: ["profile", "account"],
    },
    es: {
      pulsePhrases: ["pulso de hoy"],
      pulseTokenGroups: [["pulso", "hoy"]],
      upgradeKeywordPhrases: ["actualizar", "mejorar"],
      upgradeShortLabels: ["actualizar", "mejorar"],
      upgradeContextPhrases: ["actualiza tu plan", "mejora tu plan"],
      upgradeSettingsTitlePhrases: ["obten chatgpt plus", "obten chatgpt go"],
      settingsSurfaceHints: [
        "configuracion",
        "configuración",
        "personalizacion",
        "personalización",
        "apariencia",
        "preferencias",
      ],
      projectSurfaceHints: ["proyecto", "proyectos", "nuevo proyecto"],
      profileMenuSurfaceHints: ["mi plan", "cerrar sesion", "cerrar sesión", "perfil", "cuenta"],
      modelPickerSurfaceHints: ["modelo", "modelos", "elige modelo", "selecciona modelo"],
      canvasActionTokenGroups: [["copiar", "editar", "descargar"]],
      gpt5LimitPhrases: ["has alcanzado el limite de gpt-5"],
      quickAddMoreLabels: ["mas"],
      quickAddPromotedHints: ["lienzo", "investigacion profunda"],
      quickAddPinnedItemHints: { "deep-research": ["investigacion profunda"] },
      searchPanelHints: ["buscar chats", "historial de chats", "historial de chat"],
      deepResearchRoutePhrases: ["investigacion profunda"],
      settingsRouteLabels: ["configuracion", "configuración"],
      personalizationRouteLabels: ["personalizacion", "personalización"],
      legacyModelsRoutePhrases: ["modelos legacy", "modelos heredados"],
      canvasRouteLabels: ["lienzo"],
      moreRouteLabels: ["mas"],
      profileRouteLabels: ["perfil", "cuenta"],
    },
  };

  const deepFreeze = (value) => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.values(value).forEach(deepFreeze);
    }
    return value;
  };

  const api = deepFreeze({
    common: TARGETING_PHRASES.common,
    locales: deepFreeze(
      Object.fromEntries(Object.entries(TARGETING_PHRASES).filter(([localeKey]) => localeKey !== "common"))
    ),
  });

  globalThis.AetherTargetingPhrases = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
