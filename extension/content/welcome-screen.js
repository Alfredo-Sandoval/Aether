(() => {
  const TOOL_NAME = "AetherWelcomeScreen";

  const requireDependency = (deps, name) => {
    const value = deps[name];
    if (value == null) {
      throw new Error(`${TOOL_NAME}: missing dependency "${name}"`);
    }
    return value;
  };

  // First-run welcome card: focus-trapped modal that marks itself as seen on
  // dismissal. `translate` must return HTML-escaped strings.
  const createWelcomeScreen = (deps = {}) => {
    const document = requireDependency(deps, "document");
    const translate = requireDependency(deps, "translate");
    const requestSettingsUpdate = requireDependency(deps, "requestSettingsUpdate");
    const openPopup = requireDependency(deps, "openPopup");
    const notificationId = deps.notificationId || "aurora-welcome-notification";

    let releaseKeydown = () => {};
    let removalTimer = null;

    const buildHtml = () => `
    <div id="${notificationId}">
        <section class="welcome-card" role="dialog" aria-modal="true" aria-label="${translate("extensionName")}" aria-describedby="welcome-description">
            <button id="welcome-close-btn" class="welcome-close" type="button" aria-label="${translate("buttonClose")}"><span aria-hidden="true">×</span></button>
            <div class="welcome-topline">
                <span class="welcome-eyebrow">${translate("extensionName")}</span>
                <span class="welcome-divider" aria-hidden="true"></span>
                <span class="welcome-kicker">${translate("welcomeKicker")}</span>
            </div>
            <p id="welcome-description" class="welcome-text">${translate("welcomeDescription")}</p>
            <div class="welcome-actions">
                <button id="welcome-settings-btn" class="welcome-btn" type="button">
                    <span>${translate("welcomeBtnOpenSettings")}</span>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4 8h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                        <path d="M8.75 4.25 12.5 8l-3.75 3.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>
                <p class="welcome-note">${translate("welcomeNote")}</p>
            </div>
        </section>
    </div>
  `;

    const destroy = () => {
      releaseKeydown();
      releaseKeydown = () => {};
      if (removalTimer !== null) {
        clearTimeout(removalTimer);
        removalTimer = null;
      }
      document.getElementById(notificationId)?.remove();
    };

    const show = () => {
      const existingNotification = document.getElementById(notificationId);
      if (existingNotification) {
        const existingAction =
          existingNotification.querySelector("#welcome-settings-btn") ||
          existingNotification.querySelector("#welcome-close-btn");
        existingAction?.focus?.({ preventScroll: true });
        return true;
      }

      const welcomeNode = document.createElement("div");
      welcomeNode.innerHTML = buildHtml();
      if (welcomeNode.firstElementChild) {
        document.body.appendChild(welcomeNode.firstElementChild);
      }

      const notification = document.getElementById(notificationId);
      const card = notification?.querySelector(".welcome-card");
      const closeBtn = document.getElementById("welcome-close-btn");
      const settingsBtn = document.getElementById("welcome-settings-btn");
      const previouslyFocused = document.activeElement;

      const dismissWelcome = () => {
        releaseKeydown();
        releaseKeydown = () => {};
        // Return focus to wherever the user was before the modal stole it.
        if (previouslyFocused && typeof previouslyFocused.focus === "function") {
          previouslyFocused.focus({ preventScroll: true });
        }
        void requestSettingsUpdate({ hasSeenWelcomeScreen: true })
          .then(() => {
            if (notification) {
              notification.classList.add("dismissed");
              removalTimer = setTimeout(() => {
                removalTimer = null;
                notification.remove();
              }, 300);
            }
          })
          .catch((error) => {
            console.error("Aether Extension Error (Welcome Dismiss):", error.message);
          });
      };

      if (closeBtn) {
        closeBtn.addEventListener("click", dismissWelcome);
      }

      if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
          openPopup();
          dismissWelcome();
        });
      }

      // Move focus into the modal and trap Tab within it until dismissed.
      if (card) {
        const getFocusable = () =>
          Array.from(card.querySelectorAll("button, [href], input, [tabindex]:not([tabindex='-1'])")).filter(
            (el) => !el.hasAttribute("disabled")
          );
        (settingsBtn || closeBtn || card).focus?.({ preventScroll: true });
        const onKeydown = (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dismissWelcome();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = getFocusable();
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener("keydown", onKeydown, true);
        releaseKeydown = () => document.removeEventListener("keydown", onKeydown, true);
      }
      return Boolean(notification);
    };

    return Object.freeze({ show, destroy });
  };

  const AetherWelcomeScreen = Object.freeze({
    createWelcomeScreen,
  });

  globalThis.AetherWelcomeScreen = AetherWelcomeScreen;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AetherWelcomeScreen;
  }
})();
