# Architecture

## Overview

QuickCopy is built around a modular, service-oriented architecture. The design prioritizes separation of concerns, testability, and the ability to replace placeholder implementations in later phases without restructuring the codebase.

```
┌─────────────────────────────────────────────────────┐
│                     Popup / Options                  │
│                  (React SPA entry points)            │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
               ▼                      ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│   Background Service    │  │   Content Script(s)     │
│   Worker                │  │                         │
│   ┌───────────────────┐ │  │  ┌───────────────────┐  │
│   │ ShortcutManager   │ │  │  │ OverlayManager    │  │
│   │ ThemeManager      │ │  │  │ Sidebar (React)   │  │
│   └───────────────────┘ │  │  └───────────────────┘  │
└──────────┬──────────────┘  └──────────┬──────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────────────────────────────────────┐
│                   Service Layer                      │
│  ┌────────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ OCRService │  │ Capture  │  │ ClipboardService │  │
│  │ (Phase 2)  │  │ Service  │  │ (Phase 2)       │  │
│  │            │  │ (Ph. 2)  │  │                  │  │
│  └────────────┘  └──────────┘  └──────────────────┘  │
│  ┌─────────────────────────────────────────────────┐ │
│  │ SettingsService (fully working)                 │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                Compatibility Layer                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Storage │  │ Messaging │  │ Tabs, Commands,   │  │
│  │  Compat  │  │  Compat   │  │ ContextMenus      │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Key Architecture Decisions

### 1. Compatibility Layer (`src/compat/`)

**Problem**: Chrome, Firefox, Edge, and Brave use different namespaces (`chrome.*` vs `browser.*`) and have API differences.

**Solution**: All browser API access goes through `src/compat/` modules. Each module (storage, messaging, tabs, etc.) wraps the native API and exposes a consistent interface. If a browser-specific code path is required, it lives exclusively inside these modules.

**Pattern**: The `BrowserCompat` class detects the browser at runtime and exposes this information. Individual compat modules use this to make branching decisions internally.

**Exception**: Only files in `src/compat/` should reference `chrome.*` or `browser.*` directly.

### 2. Service Layer with Dependency Injection

**Problem**: Services like OCR and clipboard are stubs in Phase 1. Their implementations must be replaceable without touching the rest of the codebase.

**Solution**: Each service is a singleton class behind an interface (defined in `src/types/services.ts`). Phase 2 will implement the real logic inside the same class structure. The consumer code never imports implementation details — it always imports the service singleton.

```
src/services/OCRService.ts        ← Phase 1: placeholder
src/services/OCRService.ts        ← Phase 2: real Tesseract.js integration
```

No other file needs to change.

### 3. Event Bus for Decoupled Communication

**Problem**: Background, content script, popup, and options pages need to communicate without tight coupling.

**Solution**: A typed `EventBus` (`src/utils/eventBus.ts`) provides pub/sub with complete TypeScript type safety via the `EventMap` type. Modules can emit and subscribe to events without knowing about each other.

### 4. Design System as Code

**Problem**: Inline styles cause inconsistency and maintenance burden.

**Solution**: A centralized design system (`src/styles/designSystem.ts`) exports color palettes, spacing, typography, and animation tokens as TypeScript constants. UI components reference these tokens exclusively. CSS custom properties in `global.css` mirror the same tokens for selectors and third-party use.

### 5. Shadow DOM Isolation

**Problem**: Content scripts operate in the host page's DOM, risking CSS conflicts.

**Solution**: Both the overlay and sidebar elements are created inside closed Shadow DOMs. This guarantees that QuickCopy's styles never leak into the host page, and host page styles never affect QuickCopy's UI.

---

## Data Flow

### Capture Flow (Phase 2+)

```
User presses Alt+Shift+C
       │
       ▼
ShortcutManager (background) emits 'shortcut:triggered'
       │
       ▼
Background sends 'overlay:show' message to content script
       │
       ▼
OverlayManager.show() — transparent crosshair overlay appears
       │
       ▼
User drags to select region
       │
       ▼
CaptureService.captureRegion() — captures screenshot of region
       │
       ▼
OCRService.recognize() — runs Tesseract.js on image data
       │
       ▼
ClipboardService.copy() — writes recognized text to clipboard
       │
       ▼
Sidebar shows result (optional confirmation)
```

### Settings Flow

```
Popup/Options reads/writes settings
       │
       ▼
SettingsService persists via browserStorage (compat layer)
       │
       ▼
EventBus emits 'settings:changed'
       │
       ▼
Background/Content listeners react to changes
```

---

## How to Implement Phase 2 (OCR Integration)

Phase 2 requires implementing only these files:

### 1. `src/services/OCRService.ts`

Replace the placeholder `recognize()` method with actual Tesseract.js integration:

```typescript
import Tesseract from 'tesseract.js';

async recognize(imageData: string, language?: OcrLanguage): Promise<OcrResult> {
  const result = await Tesseract.recognize(imageData, language ?? 'eng');
  return {
    text: result.data.text,
    confidence: result.data.confidence,
    blocks: result.data.blocks.map(b => ({
      text: b.text,
      confidence: b.confidence,
      bbox: { x: b.bbox.x0, y: b.bbox.y0, width: b.bbox.x1 - b.bbox.x0, height: b.bbox.y1 - b.bbox.y0 },
    })),
    language: language ?? 'eng',
    duration: result.data.timing,
  };
}
```

### 2. `src/services/CaptureService.ts`

Implement screenshot capture using the Chrome tabs API (`chrome.tabs.captureVisibleTab`) or HTML Canvas for region extraction.

### 3. `src/services/ClipboardService.ts`

Implement clipboard write using `navigator.clipboard.writeText()` or the execCommand fallback.

### 4. `src/content/index.ts` (minor)

Wire the `capture-region` shortcut to the capture-flow sequence.

**No structural changes required.** The architecture already accounts for all these integrations.

## How to Implement Phase 3 (Smart Formatting)

Phase 3 adds smart formatting on top of Phase 2's OCR output:

### `src/services/FormatterService.ts` (new)

```typescript
class FormatterService {
  formatText(raw: OcrResult, behavior: CopyBehavior): FormattedText {
    switch (behavior) {
      case 'code':
        return this.detectAndFormatCode(raw);
      case 'table':
        return this.detectAndFormatTable(raw);
      case 'smart':
        return this.autoDetectFormat(raw);
    }
  }
}
```

The `ClipboardService.copy()` method already accepts a `CopyBehavior` parameter, so Phase 3 simply plugs into the existing flow without modifying any architecture.
