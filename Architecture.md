# Architecture

## Overview

QuickCopy is a browser extension (MV3) that lets users select a region of any visible browser content (videos, images, PDFs, web pages) and copies the recognized text to clipboard — automatically formatted. It uses **Tesseract.js** as the primary OCR engine and **PP-OCRv5 (via @ocr-web/core + onnxruntime-web)** as a secondary code-optimized engine. The extension also includes emoji detection via pixel-level template matching.

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
│  ┌──────────────┐  ┌──────────────┐                  │
│  │ Preprocess   │  │ PostProcess  │                  │
│  │ Service      │  │ Service      │                  │
│  └──────────────┘  └──────────────┘                  │
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

### 2. Dual-Engine OCR Routing

Two OCR engines are available:
- **Tesseract.js** — general-purpose text OCR
- **PP-OCRv5 (CodeOCR)** — code-optimized engine via `@ocr-web/core`

Both paths are managed by `OCRManager`, which analyzes the image features (text vs code) and routes accordingly. The router has a quality-gated retry: if Tesseract produces low-confidence output on an uncertain image, it retries with CodeOCR.

### 3. Event Bus for Decoupled Communication

**Problem**: Background, content script, popup, and options pages need to communicate without tight coupling.

**Solution**: A typed `EventBus` (`src/utils/eventBus.ts`) provides pub/sub with complete TypeScript type safety via the `EventMap` type. Modules can emit and subscribe to events without knowing about each other.

### 4. Design System as Code

**Problem**: Inline styles cause inconsistency and maintenance burden.

**Solution**: A centralized design system (`src/styles/designSystem.ts`) exports color palettes, spacing, typography, and animation tokens as TypeScript constants. UI components reference these tokens exclusively.

### 5. Shadow DOM Isolation

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
User holds Ctrl + mouse-drag (or Alt+Shift+C)
       │
       ▼
mousedownHandler (content/index.ts:236)
  - e.ctrlKey || e.metaKey → preventDefault
  - Calls beginSelection(clientX, clientY)
       │
       ▼
beginSelection (content/index.ts:191)
  - Sets pipelineLock = true
  - Closes any visible sidebar from prior capture
  - Shows transparent crosshair overlay
       │
       ▼
OverlayManager: user drags → renders selection rectangle
       │
       ▼
mouseup → completeSelection (OverlayManager.ts:198)
  - Region must be >= 10×10px, else cancel
  - Fires onComplete(region) callback
       │
       ▼
handleRegionSelected (content/index.ts:77)
  - captureService.captureRegion(region)
  │   ├── Sends capture:viewport to background
  │   │     └── background: chrome.tabs.captureVisibleTab (15s timeout)
  │   └── Crops full screenshot to region (canvas drawImage)
  │
  ├── Mount sidebar (if showPanel setting)
  ├── EmojiService.detect(dataUrl) ← runs in parallel, best-effort
  ├── PreprocessingService.preprocess(dataUrl, 2x) — upscale + grayscale
  ├── OCRService.recognize(preprocessed.dataUrl)
  │   ├── Initialize: local worker probe → background mode in Chrome
  │   ├── Recognize via background relay (Chrome) or local OCRManager (Firefox)
  │   └── Returns OcrResult
  ├── Await emojiPromise → applyEmojiDetections
  ├── PostProcessingService.process(result) — 11-stage pipeline
  ├── ClipboardService.copy(cleanedResult.text)
  │   ├── prepareCopyText → applyAppendNewline
  │   ├── tryBackgroundCopy → clipboard:write → offscreen
  │   └── Fallback: navigator.clipboard.writeText → execCommand
  └── Sidebar shows result + "Copied!" status
       │
       ▼
  Auto-dismiss after sidebarDuration (default 10s)
  Or user starts new drag → previous sidebar closed immediately
```

### Offscreen Document Flow (Chrome-specific)

```
Background warm-up (index.ts:65)
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
| Capture (captureVisibleTab) | 10s | background/index.ts |
| Image crop | 15s | CaptureService.ts |
| OCR init probe | 3s first, 20s polling | OCRService.ts |
| Local OCR worker init | 30s | OCRService.ts |
| OCRManager Tesseract recognize | 5s | OCRManager.ts |
| Offscreen relay message | 5s | background/index.ts |
| Offscreen OCR handler | 5s | ocrHost.ts |
| timeoutOCR (worker.recognize) | 5s | utils/timeout.ts |
| Clipboard (navigator clipboard) | 5s | utils/timeout.ts |

## Key Files

### Background (`src/background/`)
- **index.ts** — Service worker entry. Routes messages, handles `capture:viewport`, relays OCR/clipboard to offscreen
- **ocrHost.ts** — Handles `ocr:init`, `ocr:recognize`, `ocr:terminate` messages (used by both background and offscreen)
- **clipboardHost.ts** — Handles `clipboard:write` in background/offscreen
- **offscreenHost.ts** — Creates/reuses offscreen document via `chrome.offscreen.createDocument`
- **managers/BackgroundOcrManager.ts** — Tesseract worker lifecycle + recognition in offscreen document
- **managers/ShortcutManager.ts** — Keyboard shortcut registration (`Alt+Shift+C`, `Alt+Shift+S`)
- **managers/ThemeManager.ts** — Dark/light/system theme broadcasting

### Content (`src/content/`)
- **index.ts** — Pipeline orchestration: capture → OCR → postprocess → clipboard
- **overlay/OverlayManager.ts** — Full-page canvas with crosshair for region selection
- **sidebar/Sidebar.tsx** — React sidebar showing OCR output, edit, copy
- **sidebar/index.ts** — Shadow DOM mount/unmount for the React sidebar

### Services (`src/services/`)
- **OCRService.ts** — Content-side OCR with local/background mode, worker management
- **CaptureService.ts** — Screenshot via background relay → canvas crop
- **PreprocessingService.ts** — 2x upscale + adaptive grayscale/binarization
- **PostProcessingService.ts** — Pipeline orchestrator for 11 postprocessing stages
- **ClipboardService.ts** — Clipboard write with background relay, newline toggle

### OCR Subsystem (`src/services/ocr/`)
- **OCRManager.ts** — Dual-engine router with quality-gated retry
- **geometry.ts** — Tesseract block flattening
- **image.ts** — Data URL → RGBA decoder
- **router/OCRRouter.ts** — Routing decision from text/code scores
- **router/ImageAnalyzer.ts** — Image feature extraction (Otsu, line bands, margins)
- **providers/CodeOCRProvider.ts** — PP-OCRv5 engine (lazy, ~15MB model download)
- **quality/QualityScorer.ts** — Output quality assessment for retry

### Emoji Subsystem (`src/services/ocr/emoji/`)
- **EmojiService.ts** — Detection pipeline
- **EmojiCatalog.ts** — Pre-rendered 1141-emoji catalog
- **geometry.ts** — Color mask, connected components, thumbnail extraction
- **match.ts** — Shape IoU + color histogram matching
- **apply.ts** — Splice detections into OcrResult
- **emojiSet.ts** — Emoji candidate list

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
