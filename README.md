# Aether

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Alfredo-Sandoval/Aether/blob/main/LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Coming_Soon-lightgrey.svg)](https://github.com/Alfredo-Sandoval/Aether)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Alfredo-Sandoval/Aether/pulls)

ChatGPT interface extension with ambient backgrounds, glass effects, and privacy controls. Not affiliated with OpenAI.

## Quick Install

Clone the repo OR download/extract the zip -> open `chrome://extensions` -> enable Developer mode -> click Load unpacked and select the project folder -> pin the extension.

---

## Features

### Ambient Backgrounds

- Built-in presets and an optional animated gradient
- Custom backgrounds - image/video URLs or local file (up to 15MB)
- Blur control - 0 to 150px
- Scaling - contain or cover

### Interface Customization

- Glass styles - Clear or Dimmed
- Light/Dark modes - auto or manual
- Focus mode - hide sidebar and header
- Legacy composer - optional textarea input
- Quick settings - in-page panel

### Privacy and Visibility

- Privacy mode - blur chat messages and history (hover to reveal)
- Hide upgrade prompts - remove upgrade buttons and banners
- Hide UI elements - toggle GPTs, Sora, Today's pulse, and more
- Chat visibility toggle - hide/show the chat panel
- New chats only mode - show background only on new chat page

### Performance and Behavior

- Animation controls - disable background or menu animations
- Auto-hide GPT-5 limit - hide limit popup after 5 minutes
- Local settings - stored in `storage.sync`

### Languages

- English and Spanish
- Uses the ChatGPT UI language with browser fallback

### Privacy

- No network calls
- No analytics or telemetry
- Optional sync via `storage.sync`

---

## Installation

### From Source (Developer Mode)

1. Download or `git clone` this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable Developer mode (toggle in top right)
4. Click Load unpacked and select the project folder
5. Pin the extension icon for easy access
6. Visit <https://chatgpt.com>

### For Developers / Distributors

To create a clean, distributable ZIP file (excluding git history and dev files):

1. Run the packaging script:

   ```bash
   chmod +x package.sh
   ./package.sh
   ```

2. This generates a file named `Aether-vX.X.X.zip`.
3. You can share this ZIP file. Users can install it by extracting it and loading the folder in Chrome (Developer Mode -> Load Unpacked).

---

## Usage

### Basic Controls

- Extension popup - open full settings
- Quick settings - gear icon on ChatGPT pages
- Background presets - dropdown in settings
- Custom backgrounds - URL or local file (images and videos)

### Key Features

- Privacy Mode - blur chat content for privacy; hover to reveal
- Focus Mode - hide sidebar and header
- Glass Style - Clear or Dimmed

### Tips

- Settings sync across devices if Chrome sync is enabled
- Use Quick Settings for frequent changes
- Disable animations on older hardware

---

## Permissions

```json
"permissions": ["storage"],
"host_permissions": [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://openai.com/*"
]
```

- storage - remember your settings and preferences
- host_permissions - run only on ChatGPT pages

No data leaves your machine. All processing is local.

---

## Technical Details

### Architecture

- Manifest V3 - MV3 service worker + storage APIs (`manifest.json`)
- CSS-driven glass and blur - `backdrop-filter`/`filter` in CSS; JS only toggles classes/vars
- No script patching - DOM/CSS injection only (no ChatGPT script monkey-patching)
- Centralized defaults - defaults in `background.js` (popup caches/fallbacks)
- Dual-layer background - layer swap/crossfade for smooth transitions

### Browser Compatibility

- Chromium-based browsers with MV3 (Chrome/Edge/Brave/Opera)
- Not tested on Firefox/Safari
- Glass effects require `backdrop-filter` support
- **Known compatibility**: Works in Perplexity Comet; does not work in ChatGPT Atlas Browser

---

## License

Licensed under the MIT License.

See [LICENSE](LICENSE) file for details.

---
