# QuickCopy

> Select any visible region in your browser and copy the text instantly with OCR.

QuickCopy is a Manifest V3 browser extension that uses optical character recognition (Tesseract.js) to extract text from any visible region of a web page — videos, images, PDFs, and regular pages — then copies it straight to your clipboard.

**Current status: Beta v0.2.0** — core capture, OCR, and clipboard flows work end-to-end. Some edge cases are still being polished.

## Features

- **Drag-to-copy**: hold `Ctrl` (or `Cmd` on macOS) and drag over any region to OCR it and copy the text automatically.
- **Floating panel**: a compact panel shows the recognized text with **Copy** and **Edit** buttons; it auto-dismisses after a successful copy.
- **Silent mode**: disable the panel and capture/copy entirely in the background (toggle in the popup or options).
- **Keyboard shortcuts**: `Alt+Shift+C` to capture a region, `Alt+Shift+S` to toggle the sidebar.
- **Smart clipboard**: copies recognized text through a background/offscreen clipboard host, with local fallback.
- **Robust OCR worker**: runs Tesseract.js in the extension background (offscreen document on Chrome, event page on Firefox), with an in-page worker fallback where CSP allows.
- **Post-processing**: character repair, URL/email restoration, and file-path cleanup on OCR output.
- **Dark/light theming** and an options page for fine-grained settings.

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
4. The panel closes on its own shortly after a successful copy (or click **Edit** to keep it open).

To capture with the keyboard instead, press `Alt+Shift+C` and drag to select.

> **Tip**: the capture region is padded slightly below the selection so descenders on letters like `g`, `y`, and `p` are not cut off.

## Options

| Setting | Description |
|---|---|
| Auto-copy | Copy recognized text to the clipboard automatically after OCR |
| Show panel after capture | Show the result panel, or capture silently in the background |
| Copy format | Plain text, preserve formatting, or smart auto-detection |
| Theme | Dark, light, or system |
| Recognition language | English (more languages coming) |

Quick toggles for the panel are also available directly in the extension popup.

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

The Chrome build is emitted to `dist/`; the Firefox build to `dist-firefox/`. The `prepare-ocr-assets` step (run automatically on `npm install`) copies the Tesseract.js worker/core files and downloads the English traineddata into `public/tessdata/`.

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
- **OCR**: Tesseract.js (runs in a dedicated background worker)
- **Manifest**: V3

## Project Structure

```
src/
├── background/      # Service worker / event page (OCR + clipboard hosts, managers)
├── content/         # Content scripts (capture overlay, panel injection, pipeline)
├── offscreen/       # Chrome offscreen document (OCR worker host)
├── popup/           # Extension popup UI
├── options/         # Full settings page
├── components/      # Reusable UI components
├── hooks/           # React hooks (e.g. useSettings)
├── services/        # Service layer (capture, OCR, clipboard, preprocessing, post-processing)
├── utils/           # Logger, event bus, timeouts
├── compat/          # Browser API compatibility layer
├── types/           # TypeScript type definitions
├── styles/          # Design system & tokens
└── shared/          # Constants & shared utilities
```

## Architecture

See [Architecture.md](./Architecture.md) for the detailed architecture and [FolderStructure.md](./FolderStructure.md) for a complete file reference.

## Known Issues

This is a beta release. Known rough edges include:

- OCR accuracy varies with font size, contrast, and image quality.
- Language support is currently English-only.
- Some pages with restrictive content security policies may need to fall back to the background OCR worker (handled automatically).

## Roadmap

- Additional OCR languages
- Smart formatting — preserving code blocks, tables, and layout
- Multi-region / batch capture
- Store publishing (Chrome Web Store, Add-ons for Firefox)

## License

MIT
