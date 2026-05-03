const js = require("@eslint/js");
const globals = require("globals");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = [
  {
    ignores: [
      ".claude/**",
      ".tmp/**",
      "tmp/**",
      "Aether_package_temp/**",
      "extension/assets/backgrounds/**",
      "extension/icons/**",
      "Aether-v*.zip",
      "eslint.config.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["extension/background/background.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        importScripts: "readonly",
      },
    },
  },
  {
    files: [
      "extension/content/shared-utils.js",
      "extension/content/sidebar-tools.js",
      "extension/content/research-tools.js",
      "extension/content/runtime-client.js",
      "extension/content/surface-tools.js",
    ],
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
];
