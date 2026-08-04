# Folder Structure

```
quickcopy/
├── package.json                         # Dependencies and scripts
├── tsconfig.json                        # TypeScript configuration
├── vite.config.ts                       # Vite build configuration with CRXJS
├── eslint.config.js                     # ESLint flat config
├── .prettierrc                          # Prettier formatting rules
├── .gitignore                           # Git ignore patterns
├── vite-env.d.ts                        # Vite environment declarations
├── README.md                            # Project overview
├── Architecture.md                      # Architecture documentation
├── FolderStructure.md                   # This file
├── CURRENT_STATE_REVIEW.md              # Technical review + known issues
│
├── src/
│   ├── manifest.json                    # Extension manifest (MV3)
│   │
│   ├── background/
│   │   ├── index.ts                     # Service worker entry, message routing, offscreen relay
│   │   ├── clipboardHost.ts             # Background/offscreen clipboard write handler
│   │   ├── ocrHost.ts                   # Background/offscreen OCR message handler (5s timeout)
│   │   ├── offscreenHost.ts             # Offscreen document creation (Chrome MV3)
│   │   └── managers/
│   │       ├── BackgroundOcrManager.ts  # Tesseract worker in offscreen (direct recognize, no routing)
│   │       ├── ShortcutManager.ts       # Keyboard shortcut registration
│   │       └── ThemeManager.ts          # Dark/light theme management
│   │
│   ├── content/
│   │   ├── index.ts                     # Content script entry, pipeline orchestration
│   │   ├── overlay/
│   │   │   └── OverlayManager.ts        # Full-page canvas for region selection (no dimension label)
│   │   └── sidebar/
│   │       ├── Sidebar.tsx              # React sidebar (no idle default view)
│   │       └── index.ts                 # Shadow DOM mount/unmount
│   │
│   ├── offscreen/
│   │   ├── index.html                   # Offscreen document HTML
│   │   └── ocr.ts                       # Offscreen entry: auto-init OCR + message listener
│   │
│   ├── popup/
│   │   ├── index.html / main.tsx / App.tsx  # Popup UI (React)
│   │
│   ├── options/
│   │   ├── index.html / main.tsx / App.tsx  # Full settings page (React)
│   │
│   ├── components/
│   │   └── ui/
│   │       ├── Button.tsx / Badge.tsx / Card.tsx / Switch.tsx / Select.tsx
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
│   │   ├── OCRService.ts                # Content-side OCR (local/background mode)
│   │   └── ocr/
│   │       ├── OCRManager.ts            # Dual-engine router (Tesseract + CodeOCR, 5s timeout)
│   │       ├── geometry.ts              # Tesseract block flattening
│   │       ├── image.ts                 # Data URL → RGBA decoder
│   │       ├── router/
│   │       │   ├── OCRRouter.ts         # Text/code routing decision
│   │       │   └── ImageAnalyzer.ts     # Image features for routing
│   │       ├── providers/
│   │       │   ├── OCRProvider.ts       # Provider interface
│   │       │   └── CodeOCRProvider.ts   # PP-OCRv5 engine (lazy, onnxruntime-web)
│   │       ├── quality/
│   │       │   └── QualityScorer.ts     # Output quality for retry decisions
│   │       └── emoji/
│   │           ├── EmojiService.ts      # Emoji detection pipeline
│   │           ├── EmojiCatalog.ts      # Pre-rendered 1141-emoji catalog
│   │           ├── geometry.ts          # Color mask + connected components
│   │           ├── match.ts             # Shape IoU + histogram matching
│   │           ├── apply.ts             # Splice detections into OcrResult
│   │           ├── emojiSet.ts          # Candidate emoji list
│   │           └── index.ts             # Barrel export
│   │   └── postprocessing/
│   │       ├── Pipeline.ts              # 11-stage pipeline builder
│   │       ├── types.ts                 # Pipeline-specific types
│   │       ├── ContentDetector.ts       # Content type / language detection
│   │       ├── DebugRecorder.ts         # Per-stage debug info
│   │       ├── stages/                  # 11 stage implementations
│   │       └── code/                    # Code formatting subsystem (7 files)
│   │
│   ├── utils/
│   │   ├── logger.ts                    # Structured logger (levels, emoji prefixes)
│   │   ├── eventBus.ts                  # Typed pub/sub system
│   │   └── timeout.ts                   # Promise.race timeouts (5s OCR, 5s clipboard)
│   │
│   ├── compat/
│   │   ├── BrowserCompat.ts             # Browser detection
│   │   ├── storage.ts                   # chrome.storage wrapper
│   │   ├── messaging.ts                 # chrome.runtime messaging wrapper
│   │   ├── tabs.ts                      # chrome.tabs wrapper
│   │   ├── commands.ts                  # chrome.commands wrapper
│   │   ├── contextMenus.ts              # chrome.contextMenus wrapper
│   │   └── index.ts                     # Barrel export
│   │
│   ├── types/
│   │   ├── index.ts                     # Core domain types (OcrResult, Region, etc.)
│   │   ├── messages.ts                  # 22 message types for extension messaging
│   │   ├── settings.ts                  # 27 settings fields + defaults
│   │   ├── services.ts                  # Service interfaces
│   │   ├── events.ts                    # 35 event types
│   │   └── globals.d.ts                 # __BUILD_ID__, re-exports
│   │
│   ├── styles/
│   │   ├── designSystem.ts              # Design tokens (colors, spacing, typography)
│   │   └── global.css                   # CSS reset and custom properties
│   │
│   └── shared/
│       ├── constants.ts                 # App identifiers, z-indices, sizing
│       └── index.ts                     # Barrel export
│
├── public/icons/                        # 16×16, 48×48, 128×128 extension icons
├── scripts/
│   ├── generate-icons.ts                # Icon generation from SVG
│   └── build-firefox.ts                 # Firefox build (WebExt)
│
├── __tests__/
│   └── services/ocr/emoji/              # 34 emoji tests
│   └── services/ClipboardService.test.ts # 11 clipboard tests
│   └── postprocessing/                  # Postprocessing stage tests
│
├── dist/                                # Chrome build output
├── dist-firefox/                        # Firefox build output
└── node_modules/
```

## Module Responsibility Summary

| Module | Responsibility | Files |
|--------|---------------|-------|
| `background/` | Service worker, message routing, offscreen relay | 8 |
| `content/` | Pipeline orchestration, overlay, sidebar | 4 |
| `offscreen/` | Offscreen document entry (Chrome) | 2 |
| `popup/` | Quick status and shortcut reference | 3 |
| `options/` | Full settings page | 3 |
| `components/` | Reusable design system components | 7 |
| `hooks/` | React state hooks | 3 |
| `services/` | All business logic (OCR, capture, clipboard, preprocessing, postprocessing, settings) | ~30 |
| `compat/` | Browser API abstraction | 7 |
| `utils/` | Logger, event bus, timeouts | 3 |
| `types/` | All TypeScript type definitions | 6 |
| `styles/` | Design tokens and CSS | 2 |
| `shared/` | Constants | 2 |
