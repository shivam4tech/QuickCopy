# Folder Structure

```
pluk/
├── package.json                         # Dependencies and scripts
├── tsconfig.json                        # TypeScript configuration
├── vite.config.ts                       # Vite build configuration with CRXJS
├── eslint.config.js                     # ESLint flat config
├── .prettierrc                          # Prettier formatting rules
├── .gitignore                           # Git ignore patterns
├── vite-env.d.ts                        # Vite environment declarations
├── LICENSE                              # MIT license
├── README.md                            # Project overview
├── architecture.md                      # Architecture documentation
├── design.md                            # Design system (themes, glass, motion)
├── folder-structure.md                  # This file
├── current-state-review.md              # Technical review + known issues
├── pdf-support.md                       # PDF capture module documentation
│
├── src/
│   ├── manifest.json                    # Extension manifest (MV3)
│   │
│   ├── background/
│   │   ├── index.ts                     # Service worker entry, message routing, offscreen relay, languages:get-data
│   │   ├── clipboardHost.ts             # Background/offscreen clipboard write handler
│   │   ├── ocrHost.ts                   # Background/offscreen OCR message handler (5s timeout)
│   │   ├── offscreenHost.ts             # Offscreen document creation (Chrome MV3)
│   │   └── managers/
│   │       ├── BackgroundOcrManager.ts  # Tesseract worker in offscreen (direct recognize, no routing)
│   │       ├── ShortcutManager.ts       # Keyboard shortcut registration
│   │       └── ThemeManager.ts          # Dark/light theme management
│   │
│   ├── content/
│   │   ├── index.ts                     # Content script entry, pipeline orchestration, language sync
│   │   ├── overlay/
│   │   │   └── OverlayManager.ts        # Full-page canvas for region selection
│   │   └── sidebar/
│   │       ├── Sidebar.tsx              # React sidebar (result display, edit, copy, auto-dismiss timer)
│   │       └── index.ts                 # Shadow DOM mount/unmount
│   │
│   ├── offscreen/
│   │   ├── index.html                   # Offscreen document HTML
│   │   └── ocr.ts                       # Offscreen entry: auto-init OCR + message listener
│   │
│   ├── pdf/
│   │   ├── PdfDetector.ts               # PDF tab detection (viewer URL, .pdf suffix, mimeType)
│   │   ├── PdfWindowManager.ts          # One capture window per PDF tab
│   │   ├── window.html / window.ts      # PDF capture window (render, drag, extract/OCR, copy)
│   │   ├── regionMapper.ts              # Drag region → PDF page coordinates
│   │   └── textExtractor.ts             # Text-layer extraction (lines, columns, paragraphs)
│   │
│   ├── popup/
│   │   ├── index.html / main.tsx / App.tsx  # Popup UI (React)
│   │
│   ├── options/
│   │   ├── index.html / main.tsx / App.tsx  # Full settings page (React, consumer-friendly)
│   │
│   ├── components/
│   │   └── ui/
│   │       ├── Button.tsx / Badge.tsx / Card.tsx / Switch.tsx / Select.tsx / Tooltip.tsx
│   │       └── index.ts                # UI component barrel
│   │
│   ├── hooks/
│   │   ├── useSettings.ts              # Settings state hook
│   │   ├── useEventBus.ts              # Event subscription hook
│   │   └── useTheme.ts                 # Theme state hook
│   │
│   ├── services/
│   │   ├── SettingsService.ts           # Settings CRUD via browserStorage + event sync
│   │   ├── CaptureService.ts            # Screenshot via background relay → canvas crop
│   │   ├── ClipboardService.ts          # Clipboard write (background relay, execCommand fallback)
│   │   ├── PreprocessingService.ts      # 2x upscale + adaptive grayscale/binarization
│   │   ├── PostProcessingService.ts     # Postprocessing pipeline with 11 stages
│   │   ├── OCRService.ts                # Content-side OCR (local-first init, background fallback)
│   │   └── ocr/
│   │       ├── OCRManager.ts            # Dual-engine router (Tesseract + CodeOCR, 5s timeout)
│   │       ├── LanguageManager.ts       # Download/install/remove languages in IndexedDB
│   │       ├── geometry.ts              # Tesseract block flattening
│   │       ├── image.ts                 # Data URL → RGBA decoder
│   │       ├── router/
│   │       │   ├── OCRRouter.ts         # Text/code routing decision
│   │       │   └── ImageAnalyzer.ts     # Image features for routing
│   │       ├── providers/
│   │       │   ├── OCRProvider.ts       # Provider interface
│   │       │   └── CodeOCRProvider.ts   # PP-OCRv5 engine (lazy, onnxruntime-web)
│   │       └── quality/
│   │           └── QualityScorer.ts     # Output quality for retry decisions
│   │   └── postprocessing/
│   │       ├── Pipeline.ts              # 11-stage pipeline builder
│   │       ├── types.ts                 # Pipeline-specific types
│   │       ├── ContentDetector.ts       # Content type / language detection
│   │       ├── DebugRecorder.ts         # Per-stage debug info
│   │       ├── stages/                  # 11 stage implementations
│   │       └── code/                    # Code formatting subsystem (7 files)
│   │
│   ├── utils/
│   │   ├── theme.ts                     # Theme engine (resolveThemeMode, createThemeApplier, themeController)
│   │   ├── encoding.ts                  # arrayBufferToBase64 / base64ToUint8Array (traineddata transport)
│   │   ├── trustedTypes.ts              # Worker-constructor patch for Trusted Types pages
│   │   ├── logger.ts                    # Structured logger (levels, emoji prefixes)
│   │   ├── eventBus.ts                  # Typed pub/sub system
│   │   └── timeout.ts                   # Promise.race timeouts (capture 15s, OCR 5s, clipboard 5s)
│   │
│   ├── compat/
│   │   ├── BrowserCompat.ts             # Browser detection
│   │   ├── storage.ts                   # chrome.storage wrapper
│   │   ├── messaging.ts                 # chrome.runtime messaging wrapper
│   │   ├── tabs.ts                      # chrome.tabs wrapper
│   │   ├── commands.ts                  # chrome.commands wrapper
│   │   └── index.ts                     # Barrel export
│   │
│   ├── types/
│   │   ├── index.ts                     # Core domain types (OcrResult, OcrEngineInfo, Region, etc.)
│   │   ├── messages.ts                  # 21 message types for extension messaging
│   │   ├── settings.ts                  # 23 settings fields + defaults
│   │   ├── language.ts                  # Language catalog (52 languages) + sizes
│   │   ├── services.ts                  # Service interfaces
│   │   ├── events.ts                    # 24 event types
│   │   └── globals.d.ts                 # __BUILD_ID__, re-exports
│   │
│   ├── styles/
│   │   ├── designSystem.ts              # Design tokens (colors, spacing, typography, animation)
│   │   └── global.css                   # CSS reset + theme token blocks (dark / light)
│   │
│   └── shared/
│       ├── constants.ts                 # App identifiers, z-indices, sizing
│       └── index.ts                     # Barrel export
│
├── public/
│   ├── icons/                           # 16×16, 48×48, 128×128 extension icons
│   ├── tessdata/                        # Bundled OCR assets (worker, cores, eng.traineddata)
│   ├── codeocr/                         # PP-OCRv5 models (det + rec ONNX + dict)
│   └── ort/                             # onnxruntime-web WASM
├── scripts/
│   ├── generate-icons.ts                # Procedural PNG icons (16/48/128) → public/icons
│   ├── build-firefox.ts                 # Firefox build (WebExt)
│   └── prepare-ocr-assets.ts            # Copies tesseract assets into public/tessdata
│
├── __tests__/
│   ├── services/                        # Service tests (OCR manager, router, clipboard, …)
│   └── postprocessing/                  # Postprocessing stage tests
│
├── dist/                                # Chrome build output
├── dist-firefox/                        # Firefox build output
└── node_modules/
```

## Module Responsibility Summary

| Module | Responsibility | Files |
|--------|---------------|-------|
| `background/` | Service worker, message routing, offscreen relay, language data serving | 8 |
| `content/` | Pipeline orchestration, overlay, sidebar, language sync | 4 |
| `offscreen/` | Offscreen document entry (Chrome) | 2 |
| `popup/` | Quick status and shortcut reference | 3 |
| `options/` | Full settings page | 3 |
| `components/` | Reusable design system components | 7 |
| `hooks/` | React state hooks | 3 |
| `services/` | All business logic (OCR, languages, capture, clipboard, preprocessing, postprocessing, settings) | ~35 |
| `compat/` | Browser API abstraction | 7 |
| `utils/` | Theme engine, logger, event bus, timeouts, encoding, Trusted Types patch | 6 |
| `types/` | All TypeScript type definitions | 7 |
| `styles/` | Design tokens and CSS | 2 |
| `shared/` | Constants | 2 |
