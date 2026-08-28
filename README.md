# Aether

Ambient themes, glass styling, and privacy controls for ChatGPT.

Aether is a Manifest V3 browser extension for people who want ChatGPT to feel calmer, cleaner, and more personal. It adds ambient backgrounds, glass styling, quick settings, and privacy-focused controls. Chat content is processed in the page only; preference values use Chromium extension sync storage and may be synced by your browser provider.

Aether is not affiliated with OpenAI.

## Highlights

- Ambient themes and curated background presets
- Glass styling tuned for the ChatGPT interface
- Quick Settings panel directly on ChatGPT pages
- Privacy Mode to visually blur chats and history until hover
- Toggles for noisy interface elements like upgrade prompts, Images, Plugins, and Maps
- Blur, scaling, motion, and visibility controls
- English and Spanish localization
- No analytics, telemetry, or Aether-initiated external network requests

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
- Adds glassy surfaces and visual polish without sending ChatGPT page content to Aether
- Exposes quick toggles for privacy, motion, blur, and visibility
- Lets you hide distracting UI like upgrade prompts and cluttered side elements
- Stores preferences with Chromium extension sync storage

## Permissions

- `storage`: saves preferences with the browser's extension storage; Chromium may sync these values through the signed-in browser profile
- Content script matches:
  - `https://chatgpt.com/*`
  - `https://chat.openai.com/*`

Aether does not collect or transmit ChatGPT page or conversation content. Chromium may sync Aether preference values through your browser account. Privacy Mode is a visual shoulder-surfing aid; it is not encryption or access control.

## Privacy

- Aether has no analytics or telemetry client.
- Aether does not issue application-initiated requests to third-party services.
- Its content script reads the current ChatGPT page only to apply the enabled visual and visibility rules.
- Settings can include UI preferences such as the selected bundled background, blur level, and hidden controls. These use `chrome.storage.sync`, subject to your browser provider's sync behavior.

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

### Debugging surface detection

Aether finds ChatGPT surfaces (dialogs, menus, upgrade prompts, research cards) with text and structure heuristics that can drift when ChatGPT changes its UI. To see what the heuristics are doing, run this in the ChatGPT tab's DevTools console:

```js
localStorage.AETHER_DEBUG_SURFACES = "1";
```

Reload the page: every tagged surface gets an outline labeled with its surface name, elements the hide rules targeted are revealed with a red outline instead of being hidden, and tag counts are logged to the console. Remove the key (or set it to anything else) to turn it off.

### Adding a display language

The hide/tagging heuristics match visible UI copy. All of that copy lives in `extension/content/targeting-phrases.js`, keyed by locale — adding a language means adding a locale block there (mirroring the `en` shape) plus a matching `extension/_locales/<locale>/messages.json` catalog. A test enforces that both stay in sync.

## License

The source code is licensed under MIT; see [LICENSE](LICENSE). Bundled visual assets are not automatically covered by the code license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the current provenance record and redistribution caveat.
