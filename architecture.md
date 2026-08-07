# Architecture

## Overview

QuickCopy is a browser extension (MV3) that lets users select a region of any visible browser content (videos, images, PDFs, web pages) and copies the recognized text to clipboard — automatically formatted. It uses **Tesseract.js** as the primary OCR engine and **PP-OCRv5 (via @ocr-web/core + onnxruntime-web)** as a secondary code-optimized engine. Recognition supports **English plus one additional language**, with the extra language downloaded at runtime into IndexedDB.

```
┌─────────────────────────────────────────────────────┐
│                   Popup / Options                    │
│                (React SPA entry points)              │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
               ▼                      ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│   Background Service    │  │   Content Script(s)     │
│   Worker                │  │                         │
│   ┌───────────────────┐ │  │  ┌───────────────────┐  │
│   │ ShortcutManager   │ │  │  │ OverlayManager    │  │
│   │ ThemeManager      │ │  │  │ Sidebar (React)   │  │
│   │ BackgroundOcrMgr  │ │  │  └───────────────────┘  │
│   └───────────────────┘ │  └──────────┬──────────────┘
└──────────┬──────────────┘            │
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────────┐
│                    Service Layer                      │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ OCRService │  │ Capture  │  │ ClipboardService │  │
│  │            │  │ Service  │  │                  │  │
│  └────────────┘  └──────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Preprocess   │  │ PostProcess  │  │ Language    │ │
│  │ Service      │  │ Service      │  │ Manager     │ │
│  └──────────────┘  └──────────────┘  └─────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │ SettingsService (fully working)                 │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│               Compatibility Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Storage │  │ Messaging │  │ Tabs, Commands,   │  │
│  │  Compat  │  │  Compat   │  │ ContextMenus      │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Key Architecture Decisions

### 1. Compatibility Layer (`src/compat/`)

**Problem**: Chrome, Firefox, Edge, and Brave use different namespaces (`chrome.*` vs `browser.*`) and have API differences.

**Solution**: All browser API access goes through `src/compat/` modules. Each module (storage, messaging, tabs, etc.) wraps the native API and exposes a consistent interface.

**Pattern**: The `BrowserCompat` class detects the browser at runtime. Individual compat modules use this for branching decisions.

**Exception**: Only files in `src/compat/` should reference `chrome.*` or `browser.*` directly.

### 2. Local-First OCR with Automatic Fallback

The content script tries to run OCR **locally in the page first** (`initLocal()` — a page worker with `workerBlobURL: true`, falling back to a direct extension-URL worker). If local worker creation fails (restrictive CSPs, Trusted Types, etc.), it falls back to the background/offscreen document (`initBackground()`). This keeps capture fast (~100ms worker init) on the vast majority of pages without a 20s background probe, and only pays the slower background path when actually needed.

Because pages with Trusted Types policies can block blob workers, the content script patches the isolated-world `Worker` constructor at startup (`src/utils/trustedTypes.ts`) — it rewrites string URLs through a local `quickcopy#worker` TrustedScriptURL policy. This is report-only-safe and purely additive.

### 3. Dual-Engine OCR Routing

Two OCR engines are available:
- **Tesseract.js** — general-purpose text OCR
- **PP-OCRv5 (CodeOCR)** — code-optimized engine via `@ocr-web/core` (lazy, onnxruntime-web)

Both paths are managed by `OCRManager`, which analyzes the image features (text vs code) and routes accordingly. The router has a quality-gated retry: if Tesseract produces low-confidence output on an uncertain image, it retries with CodeOCR. Any CodeOCR failure degrades back to Tesseract, so the user workflow never fails.

Two modes are exposed in the options UI:
- **Automatic** (`auto`) — full analysis + routing
- **Text only** (`text`) — always Tesseract, no retry (for when auto misroutes tables/lists as code)

### 4. Language Management (English + 1)

- `eng.traineddata` ships with the extension (bundled under `public/tessdata/`).
- Additional languages are **downloaded at runtime** from `tessdata_fast` (raw GitHub) by `LanguageManager` and stored in the extension's IndexedDB (`keyval-store`), keyed `./{code}.traineddata`.
- All `createWorker()` calls use `gzip: false` so tesseract.js fetches the plain `{lang}.traineddata` (never a `.gz` 404) and reads directly from the IDB cache.
- The content script seeds `eng` into the page's own IDB cache (`syncEnglishIntoPageCache`) so local workers cache-hit English immediately.
- Traineddata moves between extension contexts as base64 (`languages:get-data` message, `src/utils/encoding.ts`), because Chrome runtime messaging JSON-serializes and would corrupt `Uint8Array` payloads (Firefox also has a 4MB message limit).

### 5. Event Bus for Decoupled Communication

**Problem**: Background, content script, popup, and options pages need to communicate without tight coupling.

**Solution**: A typed `EventBus` (`src/utils/eventBus.ts`) provides pub/sub with complete TypeScript type safety via the `EventMap` type. Modules can emit and subscribe to events without knowing about each other.

### 6. Design System as Code

**Problem**: Inline styles cause inconsistency and maintenance burden.

**Solution**: A centralized design system (`src/styles/designSystem.ts`) exports color palettes, spacing, typography, and animation tokens as TypeScript constants. UI components reference these tokens exclusively.

The actual token values live as CSS custom properties in `src/styles/global.css`, in two blocks — `:root` (dark, the default) and `:root[data-theme='light']` — so theme switching is a single attribute flip. `src/utils/theme.ts` (`themeController.setTheme`) resolves the user's dark/light/system setting and keeps `system` in sync with the OS via `matchMedia`. Because the sidebar renders inside a closed shadow root, its host re-declares the same tokens in `src/content/sidebar/index.ts` and must be kept in sync with `global.css`. See [design.md](./design.md) for the full design-system reference (liquid glass recipe, component behaviors, motion guidelines).

### 7. Shadow DOM Isolation

**Problem**: Content scripts operate in the host page's DOM, risking CSS conflicts.

**Solution**: Both the overlay and sidebar elements are created inside closed Shadow DOMs. This guarantees that QuickCopy's styles never leak into the host page, and host page styles never affect QuickCopy's UI.

## Browser-Specific Handling

### Chrome (MV3)
- Service worker **cannot** construct `Worker`s → `typeof Worker === 'undefined'` in the background
- OCR runs in an **offscreen document** created at warm-up
- `relayToOffscreen()` proxies `ocr:init`, `ocr:recognize`, `ocr:terminate`, and `clipboard:write` messages to the offscreen document
- The offscreen document has its own `backgroundOcrManager` singleton with a dedicated Tesseract worker
- Extension CSP: `script-src 'self' 'wasm-unsafe-eval'` — allows WASM in workers

### Firefox (MV3)
- **Can** construct Workers in the background/service worker → `typeof Worker !== 'undefined'`
- Content script can spawn in-page `data:`/blob workers → **local OCR** used
- If background worker is unavailable, falls through to offscreen (Firefox supports `chrome.offscreen` since FF 109)

## Data Flow

### Capture Flow

```
User holds Ctrl + mouse-drag (or Alt+Shift+Q on Chrome / Alt+Shift+C on Firefox)
       │
       ▼
mousedownHandler (content/index.ts)
  - e.ctrlKey || e.metaKey → preventDefault
  - Calls beginSelection(clientX, clientY)
       │
       ▼
beginSelection (content/index.ts)
  - Sets pipelineLock = true
  - Closes any visible sidebar from prior capture
  - Shows transparent crosshair overlay
       │
       ▼
OverlayManager: user drags → renders selection rectangle
       │
       ▼
mouseup → completeSelection (OverlayManager.ts)
  - Region must be >= 10×10px, else cancel
  - Fires onComplete(region) callback
       │
       ▼
handleRegionSelected (content/index.ts)
  - captureService.captureRegion(region)
  │   ├── Sends capture:viewport to background
  │   │     └── background: chrome.tabs.captureVisibleTab (15s timeout)
  │   └── Crops full screenshot to region (canvas drawImage)
  │
  ├── Mount sidebar (if showPanel setting)
  ├── PreprocessingService.preprocess(dataUrl, 2x) — upscale + grayscale
  ├── OCRService.recognize(preprocessed.dataUrl)
  │   ├── initialize(): initLocal() first → background mode only if it fails
  │   ├── Recognize via local OCRManager or background relay
  │   └── Returns OcrResult
  ├── PostProcessingService.process(result) — 11-stage pipeline
  ├── ClipboardService.copy(cleanedResult.text)
  │   ├── prepareCopyText → applyAppendNewline
  │   ├── tryBackgroundCopy → clipboard:write → offscreen
  │   └── Fallback: navigator.clipboard.writeText → execCommand
  └── Sidebar shows result + "Copied!" status
       │
       ▼
  Auto-dismiss after panelDismissSeconds (default 5s, configurable),
  starts only after processing + copying has finished.
  Or user starts new drag → previous sidebar closed immediately
```

### Language Sync Flow

```
Options page selects an additional language
       │
       ▼
LanguageManager.downloadLanguage(code)
  - fetch https://raw.githubusercontent.com/.../{code}.traineddata
  - Streams with progress → storeLanguage(code, data)
  - Saves traineddata to IDB (key: ./{code}.traineddata)
  - Records { code, installedAt, size } in IDB 'installed-languages'
       │
       ▼
Settings updated → chrome.storage.onChanged fires in content script
       │
       ▼
content/index.ts syncSecondaryLanguage(newCode)
  - languages:get-data → background reads IDB → base64 → content
  - base64ToUint8Array → page-local IDB (same keys)
  - ocrService.rebuildWorker() with language string 'eng+{code}'
```

### Offscreen Document Flow (Chrome-specific)

```
Background warm-up (background/index.ts)
  - ensureOffscreenDocument()
  - Creates chrome.offscreen document at /src/offscreen/index.html
       │
       ▼
Offscreen document loads (offscreen/ocr.ts)
  - backgroundOcrManager.init() → creates Tesseract worker
  - Registers chrome.runtime.onMessage listener
       │
       ▼
Content sends ocr:init → background → relayToOffscreen → offscreen
  - backgroundOcrManager.getStatus() === 'ready'
  → { success: true, mode: 'background' }
       │
       ▼
Content sends ocr:recognize → background → relayToOffscreen → offscreen
  - backgroundOcrManager.recognize(imageData)
  → recognizeWithWorker (direct Tesseract, no CodeOCR routing)
       │
       ▼
Content receives result → pipeline continues
```

### Timeout Hierarchy

Every async operation has a timeout so the pipeline can never hang:

| Stage | Timeout | File |
|-------|---------|------|
| Capture (captureVisibleTab) | 15s | utils/timeout.ts |
| Image crop | 15s | CaptureService.ts |
| Local OCR worker init | 30s | OCRService.ts |
| Background OCR init | 30s | OCRService.ts |
| OCRManager Tesseract recognize | 5s | OCRManager.ts |
| CodeOCR warm-up budget | 3s | OCRManager.ts |
| OCRManager CodeOCR recognize | 5s | OCRManager.ts |
| Offscreen relay message | 5s | background/index.ts |
| Offscreen OCR handler | 5s | ocrHost.ts |
| timeoutOCR (worker.recognize) | 5s | utils/timeout.ts |
| Clipboard (navigator clipboard) | 5s | utils/timeout.ts |

## Key Files

### Background (`src/background/`)
- **index.ts** — Service worker entry. Routes messages, handles `capture:viewport`, relays OCR/clipboard to offscreen, serves `languages:get-data` (base64 traineddata)
- **ocrHost.ts** — Handles `ocr:init`, `ocr:recognize`, `ocr:terminate` messages (used by both background and offscreen)
- **clipboardHost.ts** — Handles `clipboard:write` in background/offscreen
- **offscreenHost.ts** — Creates/reuses offscreen document via `chrome.offscreen.createDocument`
- **managers/BackgroundOcrManager.ts** — Tesseract worker lifecycle + recognition in offscreen document
- **managers/ShortcutManager.ts** — Keyboard shortcut registration (`Alt+Shift+Q` on Chrome / `Alt+Shift+C` on Firefox, `Alt+Shift+S`)
- **managers/ThemeManager.ts** — Dark/light/system theme broadcasting

### Content (`src/content/`)
- **index.ts** — Pipeline orchestration: capture → OCR → postprocess → clipboard; language sync (eng seed + secondary sync)
- **overlay/OverlayManager.ts** — Full-page canvas with crosshair for region selection
- **sidebar/Sidebar.tsx** — React sidebar showing OCR output, edit, copy, configurable auto-dismiss
- **sidebar/index.ts** — Shadow DOM mount/unmount for the React sidebar

### Services (`src/services/`)
- **OCRService.ts** — Content-side OCR with local-first init (then background mode), worker management
- **CaptureService.ts** — Screenshot via background relay → canvas crop
- **PreprocessingService.ts** — 2x upscale + adaptive grayscale/binarization
- **PostProcessingService.ts** — Pipeline orchestrator for 11 postprocessing stages
- **ClipboardService.ts** — Clipboard write with background relay, newline toggle
- **SettingsService.ts** — Settings CRUD via browserStorage + event sync

### OCR Subsystem (`src/services/ocr/`)
- **OCRManager.ts** — Dual-engine router with quality-gated retry
- **LanguageManager.ts** — Download/install/remove additional languages in IndexedDB
- **geometry.ts** — Tesseract block flattening
- **image.ts** — Data URL → RGBA decoder
- **router/OCRRouter.ts** — Routing decision from text/code scores (auto / text / code / debug)
- **router/ImageAnalyzer.ts** — Image feature extraction (Otsu, line bands, margins)
- **providers/CodeOCRProvider.ts** — PP-OCRv5 engine (lazy, ~15MB model download)
- **quality/QualityScorer.ts** — Output quality assessment for retry

### Postprocessing (`src/services/postprocessing/`)
- **Pipeline.ts** — 11-stage sequential pipeline
- **ContentDetector.ts** — Content type / language detection
- **stages/ValidationStage.ts** — Quality scoring
- **stages/CodeFormattingStage.ts** — Indentation recovery + formatting
- **code/CodeFormatter.ts** — Full code formatter (indentation, line reconstruction, balancing)
- **code/BraceRecovery.ts** — Allman brace recovery from OCR geometry

### Compatibility (`src/compat/`)
- **storage.ts** — `chrome.storage` wrapper with onChanged fallback
- **messaging.ts** — `chrome.runtime` messaging wrapper
- **tabs.ts** — `chrome.tabs` wrapper
- **commands.ts** — `chrome.commands` wrapper
- **contextMenus.ts** — `chrome.contextMenus` wrapper

### Utilities (`src/utils/`)
- **encoding.ts** — `arrayBufferToBase64` / `base64ToUint8Array` for traineddata transport
- **trustedTypes.ts** — Worker-constructor patch for pages with Trusted Types policies
- **eventBus.ts** — Typed pub/sub
- **timeout.ts** — `withTimeout` helpers (capture 15s, OCR 5s, clipboard 5s)
- **logger.ts** — Structured logger
