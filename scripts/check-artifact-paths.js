#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const TEXT_FILE_PATTERN = /\.(json|txt|log|md|html)$/i;
const ABSOLUTE_PATH_PATTERN =
  /(\/(?:Users|home)\/[^\s"'<>|]+)|(\/(?:private\/var|var\/folders)\/[^\s"'<>|]+)|([A-Za-z]:\\\\[^\s"'<>|]+)/;

function walkFiles(rootDir, collected) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collected);
      continue;
    }
    if (TEXT_FILE_PATTERN.test(entry.name)) {
      collected.push(fullPath);
    }
  }
}

function collectFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  walkFiles(rootDir, files);
  return files;
}

function resolveScanRoot(argv) {
  if (argv[0] === "--latest") {
    const parentDir = argv[1];
    if (!parentDir) {
      throw new Error("Usage: node scripts/check-artifact-paths.js --latest <path>");
    }
    if (!fs.existsSync(parentDir)) return parentDir;
    const entries = fs
      .readdirSync(parentDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    if (entries.length === 0) return parentDir;
    return path.join(parentDir, entries.at(-1));
  }
  return argv[0];
}

function findLeaks(filePath) {
  const leaks = [];
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(ABSOLUTE_PATH_PATTERN);
    if (!match) return;
    leaks.push(`${filePath}:${index + 1}:${match[0]}`);
  });
  return leaks;
}

function main() {
  const scanRoot = resolveScanRoot(process.argv.slice(2));
  if (!scanRoot) {
    throw new Error("Usage: node scripts/check-artifact-paths.js [--latest] <path>");
  }

  const files = collectFiles(scanRoot);
  const leaks = files.flatMap(findLeaks);
  if (leaks.length > 0) {
    console.error(leaks.join("\n"));
    process.exit(1);
  }

  console.log(`Checked ${files.length} artifact files in ${scanRoot}`);
}

main();
