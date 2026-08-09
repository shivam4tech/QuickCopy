# Current State Review

## Project Overview

QuickCopy is a browser extension (MV3) that lets users select a region of any visible browser content (videos, images, PDFs, web pages) and copies the recognized text to clipboard — automatically formatted. It uses **Tesseract.js** as the primary OCR engine and **PP-OCRv5 (via @ocr-web/core + onnxruntime-web)** as a secondary code-optimized engine. Recognition supports **English plus one additional language** (downloaded at runtime into IndexedDB).

**Version**: 1.0.0
**Tech Stack**: TypeScript, React, Vite, CRXJS, Tesseract.js, onnxruntime-web

---

## Architecture Summary

The extension follows a **service-oriented architecture** with three layers:

1. **Extension Layer** — background service worker, content scripts, popup, options page, offscreen document
2. **Service Layer** — `OCRService`, `LanguageManager`, `CaptureService`, `ClipboardService`, `PreprocessingService`, `PostProcessingService`, `SettingsService`
3. **Compatibility Layer** — `compat/` modules abstracting `chrome.*` / `browser.*` APIs

Communication between extension contexts uses `chrome.runtime.sendMessage` via a typed messaging system (`ExtensionMessage` union). Cross-context state sync (e.g., settings) uses `EventBus` pub/sub.

---

## Folder Structure

```
src/
├── background/
│   ├── index.ts                          # Service worker entry, message routing, capture handler, offscreen relay, languages:get-data
│   ├── clipboardHost.ts                  # Offscreen/background clipboard write handler
│   ├── ocrHost.ts                        # Offscreen/background OCR message handler
│   ├── offscreenHost.ts                  # Offscreen document creation (Chrome MV3)
│   └── managers/
│       ├── BackgroundOcrManager.ts       # Tesseract worker lifecycle in background/offscreen
│       ├── ShortcutManager.ts            # Keyboard shortcut registration
│       └── ThemeManager.ts               # Dark/light theme management
├── content/
│   ├── index.ts                          # Content script entry; pipeline orchestration + language sync
│   ├── overlay/
│   │   └── OverlayManager.ts             # Canvas-based drag-select overlay (closed Shadow DOM)
│   └── sidebar/
│       ├── index.ts                      # Sidebar mount/unmount (closed Shadow DOM)
│       └── Sidebar.tsx                   # React sidebar with result display, edit, copy, auto-dismiss
├── offscreen/
│   ├── index.html                        # Offscreen document HTML (Chrome MV3)
│   └── ocr.ts                            # Offscreen entry: auto-inits BackgroundOcrManager, relays messages
├── pdf/
│   ├── PdfDetector.ts                    # PDF tab detection (viewer URL, .pdf suffix, mimeType)
│   ├── PdfWindowManager.ts               # One capture window per PDF tab
│   ├── window.html / window.ts           # PDF capture window (render, drag, extract/OCR, copy)
│   ├── regionMapper.ts                   # Drag region → PDF page coordinates
│   └── textExtractor.ts                  # Text-layer extraction (lines, columns, paragraphs)
├── popup/
│   ├── index.html / main.tsx / App.tsx   # Popup UI (React)
├── options/
│   ├── index.html / main.tsx / App.tsx   # Full settings page (React, consumer-friendly)
├── services/
│   ├── SettingsService.ts                # Settings CRUD via browserStorage + event sync
│   ├── CaptureService.ts                 # Screenshot capture via background → captureVisibleTab → crop
│   ├── ClipboardService.ts               # Clipboard write with background relay, fallback, newline toggle
│   ├── PreprocessingService.ts           # Image upscale + adaptive grayscale / colored-foreground binarization
│   ├── PostProcessingService.ts          # Pipeline orchestrator for postprocessing stages
│   ├── OCRService.ts                     # Main OCR entry: local-first init, background fallback
│   └── ocr/
│       ├── OCRManager.ts                 # Dual-engine router (Tesseract vs CodeOCR) with quality-gated retry
│       ├── LanguageManager.ts            # Download/install/remove additional languages in IndexedDB
│       ├── geometry.ts                   # Tesseract block flattening utility
│       ├── image.ts                      # Data URL → RGBA decoder (DOM and OffscreenCanvas paths)
│       ├── router/
│       │   ├── OCRRouter.ts              # Routing decision (text/code/uncertain) from mode + scores
│       │   └── ImageAnalyzer.ts          # Image feature analysis for text/code classification
│       ├── providers/
│       │   ├── OCRProvider.ts            # Provider interface
│       │   └── CodeOCRProvider.ts        # PP-OCRv5 engine via @ocr-web/core (lazy, ~15MB model download)
│       └── quality/
│           └── QualityScorer.ts          # Output quality assessment for retry decisions
│   └── postprocessing/
│       ├── Pipeline.ts                   # Stage pipeline
│       ├── types.ts                      # Pipeline types
│       ├── ContentDetector.ts            # Content type / language detection (code/terminal/markdown/JSON/etc.)
│       ├── DebugRecorder.ts              # Per-stage debug info capture
│       ├── stages/                       # 11 sequential stages
│       └── code/                         # Code formatting subsystem (7 files)
├── compat/
│   ├── BrowserCompat.ts                  # Browser detection (Chrome/Firefox/Edge/Brave)
│   ├── storage.ts                        # chrome.storage wrapper
│   ├── messaging.ts                      # chrome.runtime messaging wrapper
│   ├── tabs.ts                           # chrome.tabs wrapper
│   ├── commands.ts                       # chrome.commands wrapper
│   ├── contextMenus.ts                   # chrome.contextMenus wrapper
│   └── index.ts                          # Barrel export
├── types/
│   ├── index.ts                          # Core domain types (OcrResult, OcrEngineInfo, Region, etc.)
│   ├── messages.ts                       # Extension message types (21 message types)
│   ├── settings.ts                       # Settings type + defaults (23 fields)
│   ├── language.ts                       # Language catalog (52 languages + sizes, tessdata_fast URL)
│   ├── services.ts                       # Service interfaces
│   ├── events.ts                         # Event map (24 events)
│   └── globals.d.ts                      # __BUILD_ID__ declaration
├── utils/
│   ├── theme.ts                          # Theme engine (resolveThemeMode, createThemeApplier, themeController)
│   ├── encoding.ts                       # arrayBufferToBase64 / base64ToUint8Array (traineddata transport)
│   ├── trustedTypes.ts                   # Worker-constructor patch for Trusted Types pages
│   ├── logger.ts                         # Structured logger with levels + emoji prefixes
│   ├── eventBus.ts                       # Typed pub/sub system
│   └── timeout.ts                        # Promise.race timeout helpers (capture 15s, OCR 5s, clipboard 5s)
├── shared/
│   └── constants.ts                      # Extension identifiers, z-indices, sizing constants
├── hooks/
│   ├── useSettings.ts                    # Settings state hook
│   ├── useEventBus.ts                    # Event subscription hook
│   └── useTheme.ts                       # Theme state hook
├── components/ui/                        # Reusable UI components (Button, Badge, Card, Switch, Select, Tooltip)
├── styles/
│   ├── designSystem.ts                   # Design tokens (colors, spacing, typography, animation)
│   └── global.css                        # CSS reset + theme token blocks (dark / light)
└── manifest.json                         # MV3 manifest
```

---

## Extension Workflow

```
User holds the configured drag modifier + mouse-drag (Alt+Shift by default; Ctrl/Cmd
also available), or presses Alt+Shift+Q to arm the overlay
       │
       ▼
1. Content script detects mousedown with matching modifier (or receives overlay:show from background)
       │
       ▼
2. OverlayManager shows full-page canvas → user drags selection → region computed
       │
       ▼
3. CaptureService.captureRegion(region)
   ├── Sends capture:viewport to background
   │     └── background: chrome.tabs.captureVisibleTab (15s timeout)
   ├── Crops full screenshot to region (canvas drawImage)
   └── Returns CaptureResult.dataUrl
       │
       ▼
4. PreprocessingService.preprocess(dataUrl, 2x)
   ├── Upscale 2x with high-quality imageSmoothing
   ├── Adaptive grayscale OR colored-foreground binarization (box blur + local threshold)
   └── Returns preprocessed dataUrl (grayscale, 2x resolution)
       │
       ▼
5. OCRService.recognize(preprocessed.dataUrl)
   ├── initialize()
   │   ├── initLocal() first — page worker (blob URL → extension-URL retry, 30s timeout)
   │   └── Only if local fails → initBackground() → ocr:init → background/offscreen
   ├── syncMode() → reads ocrMode setting (auto | text)
   ├── If background mode → recognizeInBackground() → relay to offscreen
   │     └── Offscreen: BackgroundOcrManager.recognize → recognizeWithWorker
   ├── If local mode → OCRManager.recognize()
   │     └── OCRManager: decodeDataUrl → analyzeImageFeatures → planRoute
   │           ├── Tesseract (5s timeout) with quality-gated CodeOCR retry
   │           └── OR CodeOCR (3s warm budget + 5s timeout) with Tesseract fallback
   └── Returns OcrResult { text, confidence, blocks, duration, engine }
       │
       ▼
6. PostProcessingService.process(result)
   ├── Pipeline: 11 stages run sequentially
   └── Returns PostProcessingResult { text, confidence, blocks, repairCount }
       │
       ▼
7. Content script: autoCopy setting → clipboardService.copy(cleanedResult.text)
   ├── prepareCopyText → applyAppendNewline (reads appendNewline from storage)
   ├── tryBackgroundCopy → clipboard:write message → background/offscreen
   ├── OR copyPlain: navigator.clipboard.writeText → execCommand fallback
   └── Emits clipboard:written / clipboard:failed events
       │
       ▼
8. Sidebar shows result (if showPanel=true); auto-dismisses after
   panelDismissSeconds (default 5s) — the timer starts only after
   processing + copying has finished, and never while the user is editing.
```

### Language Change Flow

```
Options page → Additional Language dropdown (or "Set as additional" button)
       │
       ▼
Already downloaded? → updateSetting('secondaryLanguage', code) directly
Not downloaded?      → "Download {lang}?" modal (size shown)
                       → LanguageManager.downloadLanguage(code)
                         ├── fetch tessdata_fast/{code}.traineddata (raw, no gzip)
                         ├── stream with progress → IDB ('./{code}.traineddata')
                         └── record { code, installedAt, size } in 'installed-languages'
       │
       ▼
Settings change propagates via chrome.storage.onChanged
       │
       ▼
content/index.ts: syncSecondaryLanguage(newCode)
  ├── languages:get-data → background reads IDB → base64 → content
  ├── base64ToUint8Array → page-local IDB cache
  └── ocrService.rebuildWorker() with language 'eng+{code}'
```

---

## OCR Pipeline (Detailed)

### Worker Initialization (local-first)

**A. Local (in-page) OCR — `OCRService.initLocal()`** (tried first)
- Imports `tesseract.js` dynamically
- Creates worker with `gzip: false`; blob-URL path first, falls back to direct extension worker URL (`workerBlobURL: false`)
- Loads assets from `chrome.runtime.getURL('tessdata/')`
- Paths: `worker.min.js`, core WASM (`tesseract-core-simd-lstm.wasm.js`), traineddata (`eng.traineddata` — or `eng+{secondary}.traineddata`)
- English is pre-seeded into the page's IndexedDB cache (`syncEnglishIntoPageCache`) so the first local worker cache-hits instead of re-fetching
- 30s total timeout via `withTimeout`

**B. Background (offscreen) OCR — `OCRService.initBackground()`** (fallback)
- Used only when local worker creation fails (restrictive CSP, Trusted Types, etc.)
- Same tesseract.js import + worker creation in the offscreen document
- Traineddata pre-seeded in the extension's IndexedDB (`keyval-store`)
- Uses `workerBlobURL: false` directly

There is **no CSP probe** — the old `canSpawnWorkersLocally()` (which could cost ~20s of background polling when misjudging a page) was removed. Local-first init is fast (~100ms) on pages that allow workers, and only pays the slower background path when it actually fails.

### Trusted Types Patch

Pages with Trusted Types policies (report-only or enforced) flag blob-URL workers. `content/index.ts` calls `enableTrustedTypesWorkers()` at startup (before anything else): it wraps the isolated-world `Worker` constructor with a Proxy that converts string URLs through a local `quickcopy#worker` TrustedScriptURL policy. Purely additive — pages without Trusted Types are unaffected.

### Asset Loading

Bundled assets are copied to `dist/tessdata/` at build time via the postinstall script (`prepare-ocr-assets.ts`):
- `worker.min.js` — tesseract worker script (~111KB)
- `eng.traineddata` — English language data (~4.1MB, always bundled)
- `tesseract-core-simd-lstm.wasm.js` + `.wasm` — SIMD WASM core
- `tesseract-core-lstm.wasm.js` + `.wasm` — non-SIMD fallback core
- `tesseract-core-relaxedsimd-lstm.wasm.js` + `.wasm` — relaxed SIMD core

Additional languages are **not bundled** — they are downloaded at runtime from `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/` and stored in IndexedDB.

### Multi-Language Setup

- `LanguageManager` (`src/services/ocr/LanguageManager.ts`) owns the language lifecycle: `downloadLanguage`, `removeLanguage`, `storeLanguage`, `getInstalledLanguages`, `getActiveLanguageString`
- Language catalog (`src/types/language.ts`): 52 languages with friendly names + approximate sizes
- All `createWorker()` calls use **`gzip: false`** so tesseract.js fetches `{lang}.traineddata` directly (never a `.gz` 404 from cache misses)
- Traineddata travels between contexts as **base64** (`languages:get-data` → background → `arrayBufferToBase64` → content → `base64ToUint8Array`) — Chrome runtime messaging JSON-serializes and would corrupt raw `Uint8Array`; Firefox also caps messages at ~4MB
- Active language string: `'eng'` or `'eng+{code}'`

### Image Preprocessing

`PreprocessingService.preprocess()`:
1. Loads image from data URL
2. Upscales 2x with `imageSmoothingQuality: 'high'`
3. **Adaptive grayscale**: If image has colored foreground content (>0.1% colored pixels AND >60% dark pixels), applies an adaptive binarization (box blur radius 8 → local threshold with brightness range) that handles light-on-dark and dark-on-light. Otherwise applies standard luma weighting (0.2126R + 0.7152G + 0.0722B).

### Dual-Engine Routing

`OCRManager.recognize()`:
1. **Image analysis** — `decodeDataUrl` → `analyzeImageFeatures` (Otsu threshold, line band detection, margin alignment score, indent gutter score, monospace score, symbol-like ratio → `computeTextCodeScores`) — <5ms
2. **Routing** — `planRoute(mode, scores)`:
   - Manual mode (`text`) → forces Tesseract (no retry)
   - Auto: `codeScore > 80` → CodeOCR; `textScore > 80` → Tesseract; uncertain → Tesseract with CodeOCR retry
3. **Execution** — `execTesseract()` (5s timeout) or `execCode()` (3s warm-up + 5s timeout)
4. **Quality gate** — If uncertain route, `scoreOcrQuality(result)` checks confidence, bracket balance, impossible tokens, merged lines, lost indentation; if >= 2 flags + overall < 60 → retry with CodeOCR
5. Code engine pre-warm for next capture if `codeScore >= 40`

The UI exposes **Automatic** and **Text only**. (`code`/`debug` modes remain in the internal type but are not exposed — the debug routing variant had no user-visible behavior.)

### CodeOCR Engine

- `CodeOCRProvider`: lazy — only initializes when router decides code
- Downloads PP-OCRv5 models (detection + recognition ONNX) from `chrome.runtime.getURL('codeocr/')`
- Uses onnxruntime-web WASM backend (bundled as `ort.wasm.min.mjs`)
- Char-width detection → quad-to-rect bbox conversion
- Single-threaded (`numThreads: 1`)

### Browser Differences

- **Chrome (MV3)**: Service worker CANNOT construct Workers → offscreen document hosts Tesseract. `typeof Worker === 'undefined'` detected in background → relays OCR messages to offscreen via `ensureOffscreenDocument()` → `chrome.runtime.sendMessage`. In the content script, page CSPs that block worker construction fall back to the background path.
- **Firefox (MV3)**: Service worker CAN construct Workers → direct message handling. Content script can spawn blob workers → local OCR used.
- Extension CSP: `script-src 'self' 'wasm-unsafe-eval'` — allows WASM in workers

---

## Postprocessing Pipeline

11 sequential stages in `Pipeline.buildStages()`:

1. **NormalizeStage** — `\r\n`→`\n`, remove null bytes/BOM, normalize smart quotes/dashes
2. **WhitespaceStage** — Trim trailing whitespace, collapse 3+ blank lines to 2, dedent prose runs (preserve code indent)
3. **LineRecoveryStage** — Fix line splits/merges: method chains, operators, imports, short CLI commands (docker, git, npm, etc.)
4. **CharacterRepairStage** — ~40 regex rules: OCR misreads (O→0, I/l→1), broken operators (= > → =>), console.method(), import/from, broken URLs
5. **UrlEmailStage** — Fix URL/email spacing (https: // → https://, www. com → www.com)
6. **FilePathStage** — Fix path separators (C:\ → C:\, / dir / file → /dir/file)
7. **ProgrammingStage** (conditional) — Fix keyword OCR errors (whiIe, funct ion, tr ue) — only for code types
8. **CodeFormattingStage** (conditional) — Brace recovery + code formatting (indentation, line reconstruction, balancing)
9. **MarkdownStage** (conditional) — Fix markdown syntax spacing
10. **TerminalStage** (conditional) — Fix shell prompt spacing, command continuation
11. **ValidationStage** — Trim and ensure trailing newline, compute final quality score

Content detection via `ContentDetector` (regex-weighted scoring) determines which stages fire.

---

## Clipboard Pipeline

`ClipboardService.copy(text, behavior)`:
1. `prepareCopyText()`: reads `appendNewline` from chrome.storage directly, applies `applyAppendNewline(text, append)` — single authority for trailing newline
2. `tryBackgroundCopy()`: sends `clipboard:write` message to background → `handleClipboardWrite` → `navigator.clipboard.write` (with ClipboardItem for formatted) or `writeText`. Background host runs in offscreen document in Chrome.
3. If background unavailable: `copyPlain()` → `navigator.clipboard.writeText()` → `execCommand('copy')` fallback with textarea
4. If formatted behavior: `ClipboardItem` with text/plain + text/html blobs

---

## Performance Characteristics

- **Capture**: ~230ms for small regions (full viewport + crop)
- **Image analysis (routing)**: <5ms
- **Local worker init**: ~100ms when the page allows workers (no probe, no polling)
- **Background OCR init (fallback)**: slower — offscreen warm-up + message relay
- **Tesseract recognition**: 0.5-2s for small regions; depends heavily on image size/content
- **CodeOCR warm-up**: 3+ seconds (downloads ~15MB models on first code capture)
- **Postprocessing**: <10ms typically
- **Total pipeline**: ~1-5s for typical small region capture
- **Timeouts**: Capture 15s, OCR init 30s, Tesseract recognize 5s, CodeOCR warm 3s + recognize 5s, timeoutOCR 5s, clipboard 5s

---

## Current Strengths

1. **Dual-engine OCR** with smart routing — text vs code detection before recognition avoids wasted inference
2. **Local-first worker init** — fast (~100ms) on normal pages; background fallback only when genuinely needed; no 20s CSP probe
3. **Two-language recognition** — English always bundled; one additional language downloaded on demand with progress UI
4. **Robust language data pipeline** — `gzip: false` everywhere, IDB caching (extension + page), base64 transport avoids JSON corruption and Firefox message limits
5. **Trusted Types patch** — neutralizes a whole class of report-only/enforced CSP noise without touching the worker pipeline
6. **Offscreen document** properly handles Chrome MV3's Worker unavailability
7. **Robust postprocessing** — 11 stage pipeline fixes common OCR errors (character misreads, line breaks, URLs, file paths, formatting)
8. **Adaptive image preprocessing** — colored-foreground binarization handles dark-theme code screenshots
9. **Quality-gated retry** — only retries with CodeOCR when confidence is genuinely low AND multiple signals indicate failure
10. **Shadow DOM isolation** for overlay and sidebar prevents CSS conflicts
11. **Design system as code** — single source of truth for all visual tokens; options page is consumer-friendly (no jargon)
12. **Compatibility layer** cleanly abstracts browser API differences
13. **Theme-driven liquid glass UI** — dark/light/system themes across options, popup, and sidebar (shadow-root token blocks), with motion restricted to transform/opacity and `prefers-reduced-motion` respected

---

## Known Weaknesses

1. **No cancellation mechanism**: Once the pipeline starts (capture → OCR), the user can't cancel it. Long-running captures are unresponsive.

2. **Single additional language**: Only one language can be active beyond English; switching downloads are not auto-removed (user manages via Remove).

3. **Race condition in content script storage access**: Content script uses `chrome.storage.local.get()` directly (bypassing `settingsService`) for `currentSettings`, while the background uses `settingsService`. Two parallel sources of truth for settings.

4. **`MESSAGE_IDS` constants are unused**: `constants.ts` defines string constants like `CAPTURE_REGION: 'quickcopy:capture-region'` but the actual messages use TypeScript union types from `messages.ts` with string literals like `'capture:viewport'`. The `MESSAGE_IDS` map is dead code.

5. **Unused barrel exports**: `src/compat/index.ts` re-exports all compat modules but most files import compat modules directly rather than through the barrel.

6. **Legacy `sidebarDuration` setting**: The old `sidebarDuration` key (default 10000) remains in the settings type but is unused — the sidebar uses `panelDismissSeconds` (default 5).

7. **Log noise**: The "Still awaiting createWorker() after Xms" warning fires every 5s during normal initialization on slow machines; creates unnecessary console pollution.

8. **Minimal integration test coverage**: 295 unit tests (33 files) cover the OCR router, postprocessing stages, and services, but the core pipeline integration (capture→OCR→postprocess→clipboard) has no end-to-end tests.

9. **`handleCaptureViewport` accesses `chrome.runtime.lastError` after callback**, which is the correct pattern but fragile (Chrome MV3 sometimes calls the callback without a runtime.lastError for success).

10. **Routed capture of large regions**: Tesseract recognize has a 5s cap; very large or complex regions can still time out and fall to the quality-gated CodeOCR path.

11. **Theme token duplication**: the sidebar lives in a closed shadow root, so its theme tokens are duplicated in `src/content/sidebar/index.ts` (dark + light host blocks) and must be kept in sync manually with `src/styles/global.css` — a missed token edit drifts the panel from the rest of the UI silently.

---

## Regression Risks

1. **Local-first worker creation**: `initLocal()` runs before `initBackground()`. On pages where blob/extension workers throw, the pipeline must cleanly fall through — a hang in `createWorker()` would block OCR entirely (mitigated by 30s timeout).

2. **Offscreen document lifecycle**: Chrome terminates offscreen documents after ~30s idle. `ensureOffscreenDocument` caches the creation promise but doesn't detect document closure. If the offscreen doc is terminated, subsequent `chrome.runtime.sendMessage` to it would fail with "Receiving end does not exist".

3. **Base64 traineddata transport**: The `languages:get-data` path assumes IDB data is available in the background context. Any mismatch between page-local and extension-level IDB stores would produce a cache miss and re-fetch (slow but non-fatal).

4. **`gzip: false`**: All `createWorker` calls must keep `gzip: false` — reverting to the tesseract.js v7 default would produce `.gz` fetches that 404 against the raw tessdata_fast URL.

5. **`workerBlobURL: false` in BackgroundOcrManager**: The offscreen worker uses direct extension URL. Must verify the offscreen document can still construct workers with chrome-extension:// URLs and that WASM initialization works under the extension CSP.

6. **Trusted Types patch ordering**: `enableTrustedTypesWorkers()` must run before any `new Worker()` in the content script; a refactor that moves the import later would silently re-enable CSP noise on Trusted Types pages.

---

## Components That Must Never Be Broken

1. `OCRService.initLocal()` / `initBackground()` — The local-first init chain that determines which OCR path runs. Breaking the fallback causes full OCR failure on CSP-restricted pages.
2. `BackgroundOcrManager.recognizeWithWorker()` — The actual recognition path in background/offscreen. If broken, background mode OCR produces no results.
3. `content/index.ts:handleRegionSelected()` — The pipeline orchestration. All steps (capture → OCR → postprocess → clipboard) depend on correct sequencing.
4. `LanguageManager.downloadLanguage()/storeLanguage()` — The language download + IDB persistence flow; also used by content scripts syncing page caches.
5. `offscreen/ocr.ts` — Offscreen message listener must properly relay `ocr:init`, `ocr:recognize`, `ocr:terminate`, and `clipboard:write`.
6. `compat/storage.ts:getBrowserAPI()` — If `chrome` vs `browser` detection is wrong, ALL settings/storage operations fail.
7. `manifest.json:content_security_policy` — CSP changes risk blocking WASM, worker construction, or asset loading.
8. `OCRManager.recognize()` — The dual-engine routing and retry logic. If it hangs or returns bad data, all OCR fails.
9. `clipboardService.copy()` — The final output step. If broken, even correct OCR text never reaches the clipboard.

---

## Overall Technical Health Score

**7.5 / 10**

| Category | Score | Notes |
|---|---|---|
| Architecture quality | 7.5 | Well-structured service layer; mature patterns (singletons, DI-ready interfaces, event bus) |
| Code quality | 7.5 | Clean TypeScript, good types, no anys, strict mode |
| Test coverage | 5 | 295 unit tests (33 files) for OCR routing, postprocessing, services; no integration tests |
| Documentation | 7 | architecture.md, folder-structure.md, design.md, README kept in sync with the current flow |
| Browser compat | 6.5 | Chrome and Firefox confirmed working; Edge/Brave untested |
| Error handling | 6 | Many catch blocks and timeouts; no pipeline cancellation |
| Performance | 8 | Fast local-first init; small captures 1-2s; CodeOCR warm-up slow |
| Security | 8 | Shadow DOM isolation, CSP set, Trusted Types patch, minimal permissions |
| Extensibility | 7 | Provider interface, pipeline stages, service interfaces, language catalog |
| Regression risk | 6.5 | Recent local-first init + language pipeline changes; carefully verified in both builds |

---

## Confidence Score

**Confidence: 95%**

This review reflects the current codebase after the recent rounds of work: emoji support removed entirely, local-first OCR initialization (no CSP probe), dual-language support with IDB-traineddata management, `gzip: false` worker config, base64 traineddata transport, Trusted Types patch, the consumer-facing options page redesign (Recognition Mode, Downloaded Languages with storage accounting, Copying section with configurable panel dismiss), the liquid-glass dark/light/system theme system (v1.0.0), and the custom (non-native) dropdown that keeps popup styling consistent across Chrome and Firefox.

Remaining gaps: `prepare-ocr-assets.ts` script internals, `build-firefox.ts` build script, and the full test suite in `__tests__/` are not read in detail — these are build-time helpers and test files which don't affect the runtime architecture understanding.
