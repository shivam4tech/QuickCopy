# Folder Structure

```
quickcopy/
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration with CRXJS
├── eslint.config.js              # ESLint flat config
├── .prettierrc                   # Prettier formatting rules
├── .gitignore                    # Git ignore patterns
├── vite-env.d.ts                 # Vite environment declarations
├── README.md                     # Project overview
├── Architecture.md               # Architecture documentation
├── FolderStructure.md            # This file
│
├── src/
│   ├── manifest.json             # Extension manifest (MV3)
│   │
│   ├── background/
│   │   ├── index.ts              # Service worker entry point
│   │   └── managers/
│   │       ├── ShortcutManager.ts # Keyboard shortcut registration
│   │       └── ThemeManager.ts    # Dark/light theme management
│   │
│   ├── content/
│   │   ├── index.ts              # Content script entry point
│   │   ├── overlay/
│   │   │   └── OverlayManager.ts # Transparent overlay for region selection
│   │   └── sidebar/
│   │       ├── Sidebar.tsx       # Floating sidebar React component
│   │       └── index.ts          # Sidebar mount/unmount logic
│   │
│   ├── popup/
│   │   ├── index.html            # Popup HTML
│   │   ├── main.tsx              # Popup React entry
│   │   └── App.tsx               # Popup React component
│   │
│   ├── options/
│   │   ├── index.html            # Options HTML
│   │   ├── main.tsx              # Options React entry
│   │   └── App.tsx               # Options React component
│   │
│   ├── components/
│   │   └── ui/
│   │       ├── Button.tsx        # Reusable button component
│   │       ├── Badge.tsx         # Status badge component
│   │       ├── Card.tsx          # Card container component
│   │       ├── Switch.tsx        # Toggle switch component
│   │       ├── Select.tsx        # Dropdown select component
│   │       └── index.ts          # UI component barrel export
│   │
│   ├── hooks/
│   │   ├── useTheme.ts           # Theme state hook
│   │   ├── useSettings.ts        # Settings state hook
│   │   └── useEventBus.ts        # Event bus subscription hook
│   │
│   ├── services/
│   │   ├── SettingsService.ts    # Settings read/write (functioning)
│   │   ├── CaptureService.ts     # Screenshot capture (placeholder)
│   │   ├── OCRService.ts         # OCR text recognition (placeholder)
│   │   └── ClipboardService.ts   # Clipboard operations (placeholder)
│   │
│   ├── utils/
│   │   ├── logger.ts             # Structured logging utility
│   │   └── eventBus.ts           # Typed pub/sub event system
│   │
│   ├── compat/
│   │   ├── BrowserCompat.ts      # Browser detection and info
│   │   ├── storage.ts            # Storage API abstraction
│   │   ├── messaging.ts          # Messaging API abstraction
│   │   ├── tabs.ts               # Tabs API abstraction
│   │   ├── contextMenus.ts       # Context menus API abstraction
│   │   ├── commands.ts           # Commands API abstraction
│   │   └── index.ts              # Compat barrel export
│   │
│   ├── types/
│   │   ├── index.ts              # Core domain types
│   │   ├── messages.ts           # Message types for extension messaging
│   │   ├── settings.ts           # Settings types and defaults
│   │   ├── services.ts           # Service interface contracts
│   │   └── events.ts             # Event bus event map types
│   │
│   ├── styles/
│   │   ├── designSystem.ts       # Design tokens (colors, spacing, fonts, etc.)
│   │   └── global.css            # CSS reset and CSS custom properties
│   │
│   └── shared/
│       ├── constants.ts          # Shared constants and identifiers
│       └── index.ts              # Shared barrel export
│
├── public/
│   └── icons/
│       ├── icon16.png            # 16x16 extension icon
│       ├── icon48.png            # 48x48 extension icon
│       └── icon128.png           # 128x128 extension icon
│
└── scripts/
    ├── generate-icons.ts         # Icon generation script
    └── build-firefox.ts          # Firefox build script
```

## File Count: ~45 files

## Module Responsibility Summary

| Module | Responsibility | Lines (est.) |
|--------|---------------|--------------|
| `background/` | Extension lifecycle, keyboard shortcuts, theme | ~120 |
| `content/` | DOM injection, overlay UI, sidebar UI | ~250 |
| `popup/` | Quick status and shortcut reference | ~100 |
| `options/` | Full settings page with all controls | ~200 |
| `components/` | Reusable design system components | ~200 |
| `hooks/` | React state management hooks | ~80 |
| `services/` | Business logic layer (OCR, capture, clipboard, settings) | ~200 |
| `compat/` | Browser API abstraction | ~200 |
| `utils/` | Event bus and logger | ~100 |
| `types/` | TypeScript type definitions | ~200 |
| `styles/` | Design tokens and global CSS | ~200 |
| `shared/` | Constants | ~50 |
