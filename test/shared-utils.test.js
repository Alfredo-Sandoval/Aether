const test = require("node:test");
const assert = require("node:assert/strict");

const shared = require("../shared-utils.js");

test("sanitizeBackgroundUrl allows extension urls, data urls, and special keys", () => {
  const extensionBaseUrl = "chrome-extension://abcd1234/";

  assert.equal(
    shared.sanitizeBackgroundUrl(`${extensionBaseUrl}Aether/blue-galaxy.webp`, extensionBaseUrl),
    `${extensionBaseUrl}Aether/blue-galaxy.webp`
  );
  assert.equal(
    shared.sanitizeBackgroundUrl("data:image/png;base64,AA==", extensionBaseUrl),
    "data:image/png;base64,AA=="
  );
  assert.equal(
    shared.sanitizeBackgroundUrl("data:video/webm;base64,AA==", extensionBaseUrl),
    "data:video/webm;base64,AA=="
  );
  assert.equal(shared.sanitizeBackgroundUrl("__jet__", extensionBaseUrl), "__jet__");
});

test("sanitizeBackgroundUrl rejects remote urls", () => {
  const extensionBaseUrl = "chrome-extension://abcd1234/";

  assert.equal(shared.sanitizeBackgroundUrl("https://example.com/image.webp", extensionBaseUrl), "");
  assert.equal(shared.sanitizeBackgroundUrl("javascript:alert(1)", extensionBaseUrl), "");
});

test("sanitizeBackgroundScaling accepts contain/cover and defaults to cover", () => {
  assert.equal(shared.sanitizeBackgroundScaling("contain"), "contain");
  assert.equal(shared.sanitizeBackgroundScaling("cover"), "cover");
  assert.equal(shared.sanitizeBackgroundScaling("fill"), "cover");
  assert.equal(shared.sanitizeBackgroundScaling(""), "cover");
});

test("sanitizeBackgroundBlur clamps and stringifies values", () => {
  assert.equal(shared.sanitizeBackgroundBlur("75"), "75");
  assert.equal(shared.sanitizeBackgroundBlur("999"), "150");
  assert.equal(shared.sanitizeBackgroundBlur("-4"), "0");
  assert.equal(shared.sanitizeBackgroundBlur("not-a-number"), "60");
});

test("sanitizeContentWidth clamps and stringifies values", () => {
  assert.equal(shared.sanitizeContentWidth("95"), "95");
  assert.equal(shared.sanitizeContentWidth("120"), "100");
  assert.equal(shared.sanitizeContentWidth("12"), "70");
  assert.equal(shared.sanitizeContentWidth("not-a-number"), "95");
});

test("escapeHtml escapes HTML metacharacters", () => {
  assert.equal(
    shared.escapeHtml("<script>\"x\"&'y'</script>"),
    "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;"
  );
});
