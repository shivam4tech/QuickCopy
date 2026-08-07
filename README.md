# QuickCopy

> Select any visible region in your browser and copy the text instantly with OCR.

QuickCopy is a Manifest V3 browser extension that uses optical character recognition (Tesseract.js) to extract text from any visible region of a web page — videos, images, PDFs, and regular pages — then copies it straight to your clipboard.

**v1.0.0** — stable and ready for everyday use on Chrome and Firefox, with dual-language recognition (English + one additional language).

> **Privacy first**: QuickCopy does not collect any data. Every capture, OCR pass, and clipboard write happens locally on your machine — nothing is ever sent to a server. If you find it useful, a star on the [repository](https://github.com/shivam4tech/QuickCopy) goes a long way. ⭐

## Features

- **Drag-to-copy**: hold `Ctrl` (or `Cmd` on macOS) and drag over any region to OCR it and copy the text automatically.
- **Floating panel**: a compact panel shows the recognized text with **Copy** and **Edit** buttons; it closes on its own after a successful copy (configurable delay, or keep it open).
- **Silent mode**: disable the panel and capture/copy entirely in the background (toggle in the options page).
- **Keyboard shortcuts**: `Alt+Shift+Q` on Chrome / `Alt+Shift+C` on Firefox to capture a region, `Alt+Shift+S` to toggle the sidebar. (Chrome silently rejects `Alt+Shift+C`, so the Chrome build uses `Alt+Shift+Q`.)
- **Smart recognition**: Automatic mode analyzes each capture and routes it to the best engine — Tesseract for text, a code-optimized engine (PP-OCRv5) for code — with quality-gated retry. Text-only mode always uses Tesseract.
- **Two languages**: English is always available; download one additional language (German, Hindi, French, and 50+ more) from within the options page.
- **Smart clipboard**: copies recognized text through a background/offscreen clipboard host, with local fallback.
- **Robust OCR worker**: runs Tesseract.js locally in the page when possible (local-first), falling back to the extension background/offscreen document automatically.
- **Post-processing**: 11-stage cleanup — character repair, URL/email restoration, file-path fixes, code formatting, and more.
- **Options page** with consumer-friendly settings for recognition, languages, and copy behavior.

## Privacy

QuickCopy is designed to be **private by default**:

- **No data collection.** No analytics, no telemetry, no tracking, no accounts — nothing is ever sent to a server.
- **Everything runs locally.** Region selection, OCR, and clipboard writes all happen on your machine.
- **Language files stay on your device.** Downloaded OCR languages are stored in your browser's local storage (IndexedDB) and never leave it. The only network requests QuickCopy ever makes are for downloading these language files when you choose to add one.
- **Open source.** The entire codebase is MIT-licensed, so you can audit exactly what the extension does.

## Installation (unpacked)

### Chrome / Edge / Brave / Chromium

1. Clone the repo and build the extension (see [Development](#development)).
2. Open `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `dist/` directory.

### Firefox

1. Build with `npm run build:firefox` (see [Development](#development)).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select the `dist-firefox/manifest.json` file.

## Usage

1. Hold `Ctrl` (or `Cmd`) and drag a selection box around the text you want to copy.
2. Release the mouse — QuickCopy captures the region, runs OCR, and copies the text automatically.
3. A panel appears with the result so you can review or edit it before copying again.
4. The panel closes on its own after the chosen delay following a successful copy (or click **Edit** to keep it open).

To capture with the keyboard instead, press `Alt+Shift+Q` (Chrome) or `Alt+Shift+C` (Firefox) and drag to select.

> **Tip**: the capture region is padded slightly below the selection so descenders on letters like `g`, `y`, and `p` are not cut off.

## Languages

QuickCopy always reads English. You can optionally add **one more language**:

- Open the options page → **Downloaded Languages** → pick a language from the **Additional Language** dropdown in **Text Recognition**.
- If the language isn't downloaded yet, QuickCopy shows its size and downloads it (with progress), then activates it automatically.
- Downloaded languages are stored on this device. Use **Set as additional** to activate a downloaded language, or **Remove** to delete it. The **Storage used** line shows the total including English.
- Reading takes slightly longer when an additional language is active.

## Options

| Setting | Description |
|---|---|
| Recognition Mode | Automatic (recommended) — routes each capture to the best engine; Text only — always use Tesseract |
| Additional Language | English plus one more downloaded language, or English only |
| Downloaded Languages | Manage languages on this device (set as additional / remove) |
| Automatically copy text | Copy recognized text to the clipboard immediately after recognition |
| Show result window | Display the copied text before closing (turn off for silent capture) |
| Close result window after | Auto-close delay after copying finishes — 2s to 1 minute, or never (disabled when the result window is hidden) |
| Append newline | Adds a new line after copied text |
| About | Version, license, privacy, and repository |

## Development

Requirements: Node.js 18+ and npm.

```bash
# Install dependencies (runs the OCR asset preparation script)
npm install

# Generate icon files
npm run generate-icons

# Development mode (with HMR)
npm run dev

# Type checking
npm run typecheck

# Tests
npm test

# Lint
npm run lint

# Build for Chrome/Chromium
npm run build

# Build for Firefox (also runs the Chrome build)
npm run build:firefox
```

The Chrome build is emitted to `dist/`; the Firefox build to `dist-firefox/`. The `prepare-ocr-assets` step (run automatically on `npm install`) copies the Tesseract.js worker/core files and the English traineddata into `public/tessdata/`. Additional languages are downloaded at runtime (from `tessdata_fast` on GitHub) into IndexedDB and are not bundled.

## Browser Support

| Browser | Support |
|---|---|
| Chrome 102+ | Manifest V3, offscreen OCR worker |
| Edge / Brave / Chromium | Manifest V3, offscreen OCR worker |
| Firefox 121+ | Manifest V3, event-page OCR worker |

## Tech Stack

- **Language**: TypeScript (strict)
- **Build**: Vite + `@crxjs/vite-plugin`
- **UI**: React 18
- **OCR**: Tesseract.js (primary) + PP-OCRv5 via onnxruntime-web (code-optimized engine)
- **Manifest**: V3

## Project Structure

```
src/
├── background/      # Service worker / event page (OCR + clipboard hosts, managers)
├── content/         # Content scripts (capture overlay, panel, pipeline)
├── offscreen/       # Chrome offscreen document (OCR worker host)
├── popup/           # Extension popup UI
├── options/         # Full settings page
├── components/      # Reusable UI components
├── hooks/           # React hooks (e.g. useSettings)
├── services/        # Service layer (capture, OCR, languages, clipboard, preprocessing, post-processing)
├── utils/           # Logger, event bus, timeouts, encoding, Trusted Types patch
├── compat/          # Browser API compatibility layer
├── types/           # TypeScript type definitions
├── styles/          # Design system & tokens
└── shared/          # Constants & shared utilities
```

## Architecture

See [Architecture.md](./Architecture.md) for the detailed architecture, [FolderStructure.md](./FolderStructure.md) for a complete file reference, and [CURRENT_STATE_REVIEW.md](./CURRENT_STATE_REVIEW.md) for the current-state review.

## Known Issues

Known rough edges include:

- OCR accuracy varies with font size, contrast, and image quality.
- Only one additional language can be active at a time (English always included).
- Pages with restrictive content security policies fall back to the background OCR worker (handled automatically).
- **Local PDF files (`file://`) are not supported yet**: only PDFs opened from a browser URL (https://) work. Reading PDFs from the local machine didn't work well in earlier builds (Chrome blocks `file://` reads in extension contexts; the file-picker fallback was unreliable), so the feature was removed and is planned for a future update.

## Roadmap

- More than one additional language
- Multi-region / batch capture
- Local `file://` PDF reading (see Known Issues)
- Store publishing (Chrome Web Store, Add-ons for Firefox)

## License

MIT
