const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

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
