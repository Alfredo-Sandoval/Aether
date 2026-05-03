#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const DEFAULT_EXTENSION_DIR = "extension";
const PACKAGE_LICENSE_ENTRY = "LICENSE";

const walkFiles = (rootDir, currentDir, collected) => {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(rootDir, fullPath, collected);
      continue;
    }
    collected.push(path.relative(rootDir, fullPath).replaceAll(path.sep, "/"));
  }
};

const toPosixPath = (value) => value.replaceAll(path.sep, "/");

const normalizePackagePath = (entry) => {
  const normalized = path.posix.normalize(toPosixPath(entry));
  if (normalized === "." || normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(normalized)) {
    throw new Error(`Invalid package-relative path: ${entry}`);
  }
  return normalized;
};

const resolveExtensionRoot = (repoRoot) => {
  const extensionRoot = path.resolve(repoRoot, DEFAULT_EXTENSION_DIR);
  const manifestPath = path.join(extensionRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing extension manifest: ${toPosixPath(path.join(DEFAULT_EXTENSION_DIR, "manifest.json"))}`);
  }
  return extensionRoot;
};

const collectSourceFiles = (sourceRoot) => {
  const collected = [];
  walkFiles(sourceRoot, sourceRoot, collected);
  return collected;
};

const addPathIfPresent = (sourceRoot, entry, collected) => {
  if (!entry || typeof entry !== "string") return;
  const normalized = normalizePackagePath(entry);
  const fullPath = path.join(sourceRoot, normalized);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    throw new Error(`Missing expected runtime entry: ${normalized}`);
  }
  collected.push(normalized);
};

const addPatternMatches = (sourceRoot, pattern, sourceFiles, collected) => {
  if (!pattern || typeof pattern !== "string") return;
  if (!pattern.includes("*")) {
    addPathIfPresent(sourceRoot, pattern, collected);
    return;
  }

  const matcher = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+")}$`);
  const matches = sourceFiles.filter((entry) => matcher.test(entry));
  if (matches.length === 0) {
    throw new Error(`Pattern did not match any packaged entries: ${pattern}`);
  }
  collected.push(...matches);
};

const resolvePopupReference = (popupEntry, target) => {
  const popupDir = path.posix.dirname(popupEntry);
  return normalizePackagePath(path.posix.join(popupDir, target));
};

const collectPopupReferencedEntries = (extensionRoot, popupEntry, collected) => {
  const normalizedPopupEntry = normalizePackagePath(popupEntry);
  const popupPath = path.join(extensionRoot, normalizedPopupEntry);
  if (!fs.existsSync(popupPath)) {
    throw new Error(`Missing popup referenced by manifest action popup: ${normalizedPopupEntry}`);
  }

  const popupHtml = fs.readFileSync(popupPath, "utf8");
  const assetPattern = /<(?:script|link|img)\b[^>]+(?:src|href)="([^"]+)"/g;
  for (const match of popupHtml.matchAll(assetPattern)) {
    const target = match[1];
    if (!target || /^(?:[a-z]+:|#|\/\/)/i.test(target)) continue;
    addPathIfPresent(extensionRoot, resolvePopupReference(normalizedPopupEntry, target), collected);
  }
};

const collectExpectedEntries = (repoRoot) => {
  const extensionRoot = resolveExtensionRoot(repoRoot);
  const manifestPath = path.join(extensionRoot, "manifest.json");
  const extensionFiles = collectSourceFiles(extensionRoot);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const expected = [];
  addPathIfPresent(extensionRoot, "manifest.json", expected);
  addPathIfPresent(repoRoot, PACKAGE_LICENSE_ENTRY, expected);

  addPathIfPresent(extensionRoot, manifest.background?.service_worker, expected);
  addPathIfPresent(extensionRoot, manifest.action?.default_popup, expected);

  Object.values(manifest.icons || {}).forEach((entry) => addPathIfPresent(extensionRoot, entry, expected));
  Object.values(manifest.action?.default_icon || {}).forEach((entry) =>
    addPathIfPresent(extensionRoot, entry, expected)
  );

  (manifest.content_scripts || []).forEach((contentScript) => {
    (contentScript.js || []).forEach((entry) => addPathIfPresent(extensionRoot, entry, expected));
    (contentScript.css || []).forEach((entry) => addPathIfPresent(extensionRoot, entry, expected));
  });

  (manifest.web_accessible_resources || []).forEach((resourceBlock) => {
    (resourceBlock.resources || []).forEach((entry) =>
      addPatternMatches(extensionRoot, entry, extensionFiles, expected)
    );
  });

  if (manifest.default_locale) {
    addPatternMatches(extensionRoot, "_locales/*/messages.json", extensionFiles, expected);
  }

  collectPopupReferencedEntries(extensionRoot, manifest.action?.default_popup, expected);

  return [...new Set(expected)].sort();
};

const collectActualEntries = (packageRoot) => {
  const collected = [];
  walkFiles(packageRoot, packageRoot, collected);
  return [...new Set(collected)].sort();
};

const extractZip = (zipPath) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-package-validate-"));
  try {
    execFileSync("unzip", ["-q", zipPath, "-d", tempDir], { stdio: "inherit" });
    return tempDir;
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error(`Failed to extract zip ${zipPath}: ${error.message}`);
  }
};

const parseArgs = (argv) => {
  const options = {
    root: process.cwd(),
    dir: null,
    zip: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") {
      options.root = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--dir") {
      options.dir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--zip") {
      options.zip = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "-h" || token === "--help") {
      console.log(`Usage:
  node scripts/validate-package.js --root <repo-root> --dir <package-dir>
  node scripts/validate-package.js --root <repo-root> --zip <package-zip>`);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!options.root) {
    throw new Error("--root requires a path value");
  }
  if (Boolean(options.dir) === Boolean(options.zip)) {
    throw new Error("Provide exactly one of --dir or --zip");
  }

  return options;
};

const main = () => {
  const { root, dir, zip } = parseArgs(process.argv.slice(2));
  const expectedEntries = collectExpectedEntries(root);

  let packageRoot = dir;
  let extractedTempDir = null;
  if (zip) {
    extractedTempDir = extractZip(zip);
    packageRoot = extractedTempDir;
  }

  try {
    const actualEntries = collectActualEntries(packageRoot);
    const expectedSet = new Set(expectedEntries);
    const actualSet = new Set(actualEntries);
    const missing = expectedEntries.filter((entry) => !actualSet.has(entry));
    const unexpected = actualEntries.filter((entry) => !expectedSet.has(entry));

    if (missing.length || unexpected.length) {
      if (missing.length) {
        console.error("Missing package entries:");
        missing.forEach((entry) => console.error(`  ${entry}`));
      }
      if (unexpected.length) {
        console.error("Unexpected package entries:");
        unexpected.forEach((entry) => console.error(`  ${entry}`));
      }
      process.exit(1);
    }

    console.log(`Validated package contents for ${packageRoot}`);
  } finally {
    if (extractedTempDir) {
      fs.rmSync(extractedTempDir, { recursive: true, force: true });
    }
  }
};

if (require.main === module) {
  main();
} else {
  module.exports = {
    collectActualEntries,
    collectExpectedEntries,
    extractZip,
    parseArgs,
    resolveExtensionRoot,
  };
}
