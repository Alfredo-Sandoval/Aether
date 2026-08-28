const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const sidebarTools = require("../extension/content/sidebar-tools.js");

test("content-sidebar-tools exports the sidebar factory", () => {
  assert.equal(typeof sidebarTools.createSidebarTools, "function");
});

test("content-sidebar-tools fails fast when required dependencies are missing", () => {
  assert.throws(() => sidebarTools.createSidebarTools({}), {
    name: "Error",
    message: 'AetherContentSidebarTools: missing dependency "document"',
  });
});

test("sidebar visibility controls target current ChatGPT routes", () => {
  const dom = new JSDOM(`<!doctype html><body><nav>
    <a href="/images">Images</a>
    <a href="/plugins">Plugins</a>
    <a href="/maps">Maps</a>
    <a href="/sora">Legacy Sora route</a>
    <a href="/gpts">Legacy GPTs route</a>
  </nav></body>`);
  const settings = {
    hideSoraButton: true,
    hideGptsButton: true,
    hideTodaysPulse: true,
    hideShoppingButton: false,
  };
  const tools = sidebarTools.createSidebarTools({
    document: dom.window.document,
    getSettings: () => settings,
    selectors: {
      SORA_BUTTON_ID: "sidebar-item-images",
      SORA_BUTTON: 'a[href="/images"], a[href^="/images/"]',
      GPTS_BUTTON: 'a[href="/plugins"], a[href^="/plugins/"]',
      MAPS_BUTTON: 'a[href="/maps"], a[href^="/maps/"]',
    },
    hideSoraClass: "hide-images",
    hideGptsClass: "hide-plugins",
    hideShoppingClass: "hide-shopping",
    hideTodaysPulseClass: "hide-maps",
    shoppingAttrs: ["aria-label", "href", "data-testid", "data-track"],
    toggleClassForElements: (elements, className, force) => {
      elements.forEach((element) => element.classList.toggle(className, force));
    },
    matchesShoppingResearchValue: () => false,
  });

  tools.manageSidebarButtons();

  assert.equal(dom.window.document.querySelector('a[href="/images"]').classList.contains("hide-images"), true);
  assert.equal(dom.window.document.querySelector('a[href="/plugins"]').classList.contains("hide-plugins"), true);
  assert.equal(dom.window.document.querySelector('a[href="/maps"]').classList.contains("hide-maps"), true);
  assert.equal(dom.window.document.querySelector('a[href="/sora"]').className, "");
  assert.equal(dom.window.document.querySelector('a[href="/gpts"]').className, "");
});
