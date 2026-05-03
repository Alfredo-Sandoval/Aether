# Aether

Ambient themes, glass styling, and privacy controls for ChatGPT.

Aether is a Manifest V3 browser extension for people who want ChatGPT to feel calmer, cleaner, and more personal. It adds ambient backgrounds, glass styling, quick settings, and privacy-focused controls while keeping everything local to the browser.

Aether is not affiliated with OpenAI.

## Highlights

- Ambient themes and curated background presets
- Glass styling tuned for the ChatGPT interface
- Quick Settings panel directly on ChatGPT pages
- Privacy Mode to blur chats and history until hover
- Toggles for noisy interface elements like upgrade prompts and side surfaces
- Blur, scaling, motion, and visibility controls
- English and Spanish localization
- No analytics, no telemetry, and no external network calls

## Install

### Load From Source

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome, Brave, Edge, or another Chromium-based browser.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `Aether/extension/` folder, not the repository root.
6. Pin Aether and open `https://chatgpt.com`.

### Build A ZIP

If you want a clean distributable package:

```bash
npm run package
```

This creates `Aether-vX.X.X.zip` at the repo root with only the extension files needed for manual installation.

## What It Does

- Applies ambient backdrops behind the ChatGPT interface
- Adds glassy surfaces and visual polish without sending data anywhere
- Exposes quick toggles for privacy, motion, blur, and visibility
- Lets you hide distracting UI like upgrade prompts and cluttered side elements
- Stores preferences locally with Chrome extension storage

## Permissions

- `storage`: saves your preferences
- Content script matches:
  - `https://chatgpt.com/*`
  - `https://chat.openai.com/*`

No data leaves your machine. All processing is local.

## Compatibility

- Chromium-based browsers with Manifest V3 support
- Not tested on Firefox/Safari
- Best experience on browsers with `backdrop-filter` support
- Known compatibility:
  - Works in Chrome-, Brave-, and Edge-style MV3 environments
  - Does not work in ChatGPT Atlas Browser

## Development

```bash
npm ci
npm run lint
npm test
```

Load `extension/` as the unpacked extension while developing. The repository root is only for tooling, docs, tests, and packaging scripts.

## License

MIT. See [LICENSE](LICENSE).
