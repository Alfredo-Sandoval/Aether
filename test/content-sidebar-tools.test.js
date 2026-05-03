const test = require("node:test");
const assert = require("node:assert/strict");

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
