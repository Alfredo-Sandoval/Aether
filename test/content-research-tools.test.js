const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");

const shared = require("../extension/content/shared-utils.js");

const researchTools = require("../extension/content/research-tools.js");
const source = fs.readFileSync(require.resolve("../extension/content/research-tools.js"), "utf8");

test("content-research-tools exports the research surface factory", () => {
  assert.equal(typeof researchTools.createResearchSurfaceTools, "function");
});

test("content-research-tools fails fast when required dependencies are missing", () => {
  assert.throws(() => researchTools.createResearchSurfaceTools({}), {
    name: "Error",
    message: 'AetherContentResearchTools: missing dependency "document"',
  });
});

test("deep research home cards ignore section wrappers", () => {
  assert.equal(source.includes('home.querySelectorAll("article, section")'), false);
  assert.match(source, /home\.querySelectorAll\("article"\)/);
  assert.match(source, /node\.closest\("a\[href\]"\)/);
});

test("artifact Library grids are excluded from research-card promotion", () => {
  assert.match(source, /window\.location\.pathname\.toLowerCase\(\)\.startsWith\("\/library"\)/);
  assert.match(
    source,
    /startsWith\("\/library"\)[\s\S]*?syncResearchCardClasses\(context, taggedCards\);[\s\S]*?return;/
  );
});

test("current in-thread artifact hooks and embedded frames receive the canvas surface class", () => {
  const dom = new JSDOM(`<!doctype html><body>
    <section data-testid="conversation-turn-1">
      <article id="artifact" data-testid="interactive-artifact">
        <section id="nested-embed"><iframe title="artifact preview"></iframe></section>
      </article>
      <section id="embed"><iframe title="interactive visualization"></iframe></section>
      <div id="plain-div-host"><iframe id="direct-frame" title="sandboxed output"></iframe></div>
      <article id="plain">Plain response</article>
    </section>
  </body>`);
  const { document } = dom.window;
  document.querySelectorAll("article, section#embed, section#nested-embed, #plain-div-host").forEach((node) => {
    node.getBoundingClientRect = () => ({ width: 800, height: 420 });
  });

  const tools = researchTools.createResearchSurfaceTools({
    document,
    window: dom.window,
    Node: dom.window.Node,
    Element: dom.window.Element,
    normalizeText: shared.normalizeUiText,
    isElementVisible: () => true,
    matchesResearchBannerText: shared.matchesResearchBannerText,
    matchesResearchContentText: shared.matchesResearchContentText,
    matchesResearchFullscreenText: shared.matchesResearchFullscreenText,
    matchesCanvasActionHeaderText: shared.matchesCanvasActionHeaderText,
    isResearchDialogDescriptor: shared.isResearchDialogDescriptor,
    isResearchCardRootShellDescriptor: shared.isResearchCardRootShellDescriptor,
  });

  tools.markCanvasSurfaces();

  assert.equal(document.getElementById("artifact").classList.contains("cgpt-aether-canvas-surface"), true);
  assert.equal(document.getElementById("nested-embed").classList.contains("cgpt-aether-canvas-surface"), false);
  assert.equal(document.getElementById("embed").classList.contains("cgpt-aether-canvas-surface"), true);
  assert.equal(document.getElementById("plain-div-host").classList.contains("cgpt-aether-canvas-surface"), true);
  assert.equal(document.getElementById("direct-frame").classList.contains("cgpt-aether-canvas-surface"), false);
  assert.equal(document.getElementById("plain").classList.contains("cgpt-aether-canvas-surface"), false);
});
