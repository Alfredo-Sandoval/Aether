# Changelog

Notable changes to Aether. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions track `extension/manifest.json`. History before 1.6.0 predates this file and is not reconstructed here.

## [1.7.0] — 2026-07-28

### Added

- Surface-detection debug mode: `localStorage.AETHER_DEBUG_SURFACES = "1"` on a ChatGPT tab outlines every tagged surface with its name, reveals elements the hide heuristics targeted, and logs tag counts (see README).
- Per-locale targeting copy in `extension/content/targeting-phrases.js` — all UI phrases the hide/tagging heuristics match on now live in one locale-keyed data file, so adding a display language is a data change. A test enforces parity with `_locales`.
- jsdom behavior tests for the range controls, background tile grid, quick-settings panel, welcome screen, and surface tagging (`test/dom-behavior.test.js`).
- The CI workflow now runs the dependency audit (gated at high severity so upstream low-severity advisories cannot fail unrelated PRs) and package validation in addition to formatting, lint, and tests, and uploads the built zip as a workflow artifact.
- 320×200 WebP preview assets for the background pickers, avoiding full-resolution image decode for every thumbnail.

### Changed

- Split the content script into focused modules: `background-media.js` (backdrop cross-fade engine), `surface-tagging.js` (glass surface classifier), `welcome-screen.js`, `quick-settings.js` (in-page panel), and `settings-controls.js` (range slider + preset tile grid shared with the popup). `content.js` shrank from ~2,550 to ~1,600 lines of orchestration.
- Content-runtime listeners, timers, observers, and mounted modules now register teardown at the point of acquisition; the re-injection cleanup flushes that registry instead of maintaining a parallel hand-written list.
- The popup and the in-page quick-settings panel share one slider-binding and tile-grid implementation instead of two divergent copies.
- Development now targets Node.js 22.13 or newer, and the ESLint 10 toolchain removes the remaining audited development-dependency vulnerabilities.
- Upgrade-button scanning now string-matches before running layout-forcing visibility checks and diffs the hidden set instead of unhiding and re-hiding everything each pass.
- The "reopen welcome" popup button now actually re-shows the welcome card (it previously opened the GitHub repo).
- Popup settings search matches all query words in any order.
- Lint gate is strict: unused variables are errors and warnings fail CI.

### Fixed

- The GPT-5 limit popup detector inspects every candidate node for the limit phrasing instead of trusting the first match of a broad utility-class selector.
- Removed dead state in the background worker (`localCache` bookkeeping and the unused `local` field in `GET_SETTINGS_FULL`).
- The welcome screen can no longer be injected twice, and its key handler is cleaned up on re-injection.
- Content-script locale initialization no longer logs to the page console on every load.
- Background settings mutations update the in-memory cache only after sync storage confirms the write, and mutation requests are serialized to preserve user edit order.
- Transient content-script write retries merge behind newer pending edits, preventing stale values from overwriting the latest slider or toggle state.
- Quick-settings preset selectors now match the DOM data attribute used by the shared tile grid.
- The popup confirmation dialog has an accessible name, initial focus, focus containment, Escape dismissal, backdrop dismissal, and focus restoration.
- Composer transparency is gated on successful Aether activation, so a bootstrap failure leaves ChatGPT's native composer intact.
- Reduced-transparency and high-contrast modes preserve the configured background dimming filter.
- Background media and welcome-screen teardown cancel pending timers/listeners and release detached media.
- Privacy documentation now distinguishes page-local chat processing from browser-synced preference storage.
- The GPT-5 animated preset tile now shows its intended starfield artwork; the styling previously targeted a preset id (`superStars`) that does not exist, and a contract test now rejects preset-key selectors without a matching preset.
- A throwing settings mutation can no longer stall the background worker's mutation queue, and a throwing confirmation callback can no longer leave the popup's confirmation dialog unresolved.
- Removed a targeting hint (`artifact-viewer`) that could never match because text normalization folds hyphens to spaces before comparison.

## [1.6.0] — 2026-07

Current released version at the time this changelog was introduced: ambient backgrounds with curated presets, glass styling, quick-settings panel, privacy mode, upgrade/sidebar visibility controls, settings durability (mirror, backups, import/export), and English/Spanish localization.
