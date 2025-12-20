# Aether

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Alfredo-Sandoval/Aether/blob/main/LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Coming_Soon-lightgrey.svg)](https://github.com/Alfredo-Sandoval/Aether)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Alfredo-Sandoval/Aether/pulls)

A beautiful, customizable ChatGPT interface extension with ambient backgrounds, glass effects, and privacy features. Transform your ChatGPT experience with a soft, ambient glow and powerful customization options.

Not affiliated with OpenAI.

### Quick Install Guide

Clone the repo **OR** Download/Extract the zip → Navigate to `chrome://extensions` → Enable **Developer mode** → Click **Load unpacked** and select the project folder → Pin the extension.

---

## Features

### Ambient Backgrounds

- **Built-in presets** — Choose from 12+ stunning space-themed backgrounds
- **Custom backgrounds** — Paste image/video URLs or upload your own files (up to 15MB)
- **Animated gradient** — Dynamic, performance-optimized background animation
- **Adjustable blur** — Fine-tune background blur intensity (0-100px)
- **Scaling options** — Contain (fit) or Cover (fill) modes

### Interface Customization

- **Glass morphism** — Beautiful glass effects with Clear or Dimmed styles
- **Light/Dark modes** — Auto-detection or manual theme selection
- **Focus mode** — Hide sidebar and header for distraction-free conversations
- **Legacy composer** — Optional classic textarea input instead of Lexical editor
- **Quick settings** — In-page settings panel for instant adjustments

### Privacy & Visibility

- **Streamer mode** — Blur chat messages and history for privacy during streams/screenshots (hover to reveal)
- **Hide upgrade prompts** — Remove "Upgrade plan" buttons and banners
- **Hide UI elements** — Toggle visibility of GPTs, Sora buttons, and more
- **Chat visibility toggle** — Hide/show chat panel instantly
- **New chats only mode** — Show background only on new chat page

### Voice UI Customization

- **6 color themes** — Default Blue, Sunset Orange, Solar Yellow, Sakura Pink, Aether Green, Onyx Dark
- **Real-time preview** — See changes instantly in voice mode interface

### Performance & UX

- **Seamless integration** — Blends into ChatGPT UI without breaking layouts
- **Animation controls** — Disable background or menu animations if desired
- **Auto-hide GPT-5 limit** — Automatically hide limit popup after 5 minutes
- **Smart defaults** — Sensible defaults with full customization available

### Multi-Language Support

- **2 languages** — English and Spanish with full localization
- **Smart detection** — Automatically uses ChatGPT interface language with browser fallback
- **Complete translation** — All UI elements, settings, and messages translated

### Privacy First

- **No network calls** — Everything runs locally
- **No analytics** — Zero tracking or telemetry
- **Settings sync** — Optional sync via Chrome's built-in `storage.sync`
- **No data collection** — Your data stays on your machine

---

## Installation

### From Source (Developer Mode)

1. **Download** or `git clone` this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the project folder
5. Pin the extension icon for easy access
6. Visit [ChatGPT](https://chatgpt.com) and enjoy!

Similar to [Chrome's Hello World tutorial](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)

---

## Usage

### Basic Controls

- **Extension popup** — Click the extension icon to open full settings
- **Quick settings** — Click the gear icon on ChatGPT pages for fast access
- **Background presets** — Choose from dropdown in settings
- **Custom backgrounds** — Paste URL or upload file (supports images and videos)

### Key Features

- **Streamer Mode** — Enable to blur chat content for privacy; hover over messages to temporarily reveal
- **Focus Mode** — Hide sidebar and header for minimal, distraction-free interface
- **Glass Style** — Toggle between Clear (transparent) and Dimmed (frosted) glass effects
- **Voice Colors** — Customize voice mode UI with 6 color options

### Tips

- All settings sync automatically across devices (if Chrome sync is enabled)
- Use Quick Settings for frequently adjusted options
- Custom backgrounds support both images and videos
- Disable animations for better performance on older hardware

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

- **storage** — Remember your settings and preferences
- **host_permissions** — Run only on ChatGPT pages

**No data leaves your machine.** All processing is local.

---

## Technical Details

### Architecture

- **Manifest V3** — MV3 service worker + storage APIs (`manifest.json`)
- **CSS‑driven glass & blur** — `backdrop-filter`/`filter` in CSS; JS only toggles classes/vars
- **No script patching** — DOM/CSS injection only (no ChatGPT script monkey‑patching)
- **Centralized defaults** — defaults in `background.js` (popup caches/fallbacks)
- **Dual‑layer background** — layer swap/crossfade for smooth transitions

### Browser Compatibility

- Chromium‑based browsers with MV3 (Chrome/Edge/Brave/Opera)
- Not tested on Firefox/Safari
- Glass effects require `backdrop-filter` support

---

## License

Licensed under the MIT License.

See [LICENSE](LICENSE) file for details.

---
