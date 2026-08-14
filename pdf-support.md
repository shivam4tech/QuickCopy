# PDF Support

QuickCopy can copy text from PDFs opened in the browser. PDF support is an
isolated, additive module — nothing in the existing capture pipeline, OCR
engines, sidebar, clipboard, or formatting was modified to make it work.

## Why the previous attempt failed (verified research)

The browser's built-in PDF viewers cannot be touched by extensions, in either
major browser. Any approach that injects a drag overlay or script into the
native viewer is impossible:

| Browser | Viewer location | Why injection fails |
| --- | --- | --- |
| Chrome | `chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html` | The PDF viewer is itself a *separate extension*. Content scripts cannot be injected into other extensions' pages (manifest match patterns don't cover `chrome-extension://`, and programmatic injection is refused). The old `postMessage`/embed tricks are dead in modern Chrome + MV3 CSP. |
| Firefox | `resource://pdf.js/web/viewer.html` | Since Firefox 60 (2018) this is **intentionally** locked down (security fix for CVE-2018-5158; Mozilla Bugzilla 1454760, 1466072): *"the viewer becomes a privileged page that extensions cannot modify."* Content scripts cannot run on `resource://` pages. |

Consequence: QuickCopy cannot render PDFs inside the browser's viewer, and it
cannot reach the viewer's text layer. Instead, QuickCopy opens **its own
capture window**, renders the PDF itself, and lets you drag over that
rendering — the same drag → copy experience, over the document rather than
inside the tab.

## How it works

```
Alt+Shift+Q (Chrome) / Alt+Shift+C (Firefox) on a PDF tab
        │
        ▼
Background detects the PDF (src/pdf/PdfDetector.ts)
   • Chrome built-in viewer: parses the ?file= param of the mhjfbmd… URL
   • .pdf suffix heuristic (any browser, incl. file:// detection)
   • Firefox: tab.mimeType === 'application/pdf'
        │
        ▼
QuickCopy popup window opens (src/pdf/PdfWindowManager.ts)
   • src/pdf/window.html — extension page, no permissions needed beyond <all_urls>
        │
        ▼
pdf.js (pdfjs-dist) loads the PDF bytes via fetch() and renders the pages
        │
        ▼
Drag over the rendered page (reuses the existing OverlayManager)
        │
        ├─ Text layer present → text extraction (never OCR of selectable text)
        │      • page.getTextContent() filtered by region (src/pdf/textExtractor.ts)
        │      • preserves spaces, line breaks, paragraphs, and multi-column order
        │      • target: <150 ms after page load
        │      • result goes straight to the clipboard (existing ClipboardService)
        │
        └─ No text layer (scanned PDF) → existing OCR pipeline, reused unchanged
               canvas crop → preprocessing (2×) → OCRService → PostProcessingService
               → clipboard
```

Results are shown in the existing sidebar, which drops into the capture window
untouched (it is DOM + React + eventBus; nothing content-script-specific). Its
"Close result window after" setting controls auto-dismissal, exactly like on
web pages.

## New files (all additive)

| File | Purpose |
| --- | --- |
| `src/pdf/PdfDetector.ts` | Pure PDF-tab detection + `chrome-extension://mhjf…?file=` parsing |
| `src/pdf/PdfWindowManager.ts` | Opens/focuses one capture window per tab |
| `src/pdf/window.html` / `src/pdf/window.ts` | The capture window: render, drag, extract/OCR, copy |
| `src/pdf/regionMapper.ts` | Drag region (CSS px) → PDF page coordinates |
| `src/pdf/textExtractor.ts` | Text-layer extraction with line/paragraph/column preservation |
| `src/__tests__/pdf/*.test.ts` | Unit tests (detector, mapper, extractor) |

## Modified files (additive-only changes)

- `src/background/index.ts` — `capture-region` command checks for a PDF tab
  first; existing `overlay:show` path untouched.
- `src/manifest.json` — `connect-src` extended with `https: http:`
  (the capture window must fetch PDF bytes from arbitrary hosts; previously
  only `self` + GitHub were allowed).
- `vite.config.ts` — added `src/pdf/window.html` as a build entry.
- `package.json` — new dependency `pdfjs-dist` (Mozilla's PDF renderer,
  ~165 KB gzip, loaded **only** inside the capture window; content scripts and
  the page pipeline are unaffected).

## Behaviors and constraints

- **Preference order**: a selectable text layer is always extracted directly.
  OCR is only used when the selected region contains no text items
  (scanned/handwritten pages) — selectable text is never OCR'd.
- **Whole PDF, lazy rendering**: placeholders for every page (up to 500) are
  created at once so the document is fully present and scrollable; pages are
  rasterized as they approach the viewport. Text extraction works on any page,
  rasterized or not; the OCR fallback rasterizes its page on demand.
- **Scrolling**: mouse wheel and keyboard (arrows, PgUp/PgDn, Space, Home/End)
  scroll the document even while the selection overlay is up (the overlay sits
  above the scroll container, so scroll input is forwarded manually).
- **Multi-copy (instant re-capture)**: the window never blocks the next drag —
  the selection overlay arms on the first press of each drag, exactly like
  capture on regular pages. After a copy you can drag again immediately, even
  while the side panel is still showing. The panel remains fully interactive
  between captures (Copy/Edit/typing) and closes on its own
  "Close result window after" delay following the last copy. Close the PDF
  view with the ✕ button or Esc.
- **Whole-line selection**: a drag selects any text line whose center falls
  inside the rectangle — dragging over part of a line copies the whole line.
- **Columns and paragraphs**: horizontal gaps between items on the same line
  (1.5× the line's median item width) are treated as column breaks;
  vertical gaps (1.2× the line height) become paragraph breaks.
- **Debug logging**: extraction/fallback decisions log at `debug` level only,
  which is silent unless the logger level is changed (same convention as the
  rest of the codebase).
- **One window per tab**: pressing the capture shortcut (Alt+Shift+Q on
  Chrome, Alt+Shift+C on Firefox) again focuses the existing
  window instead of spawning a duplicate.

## Known limitations

- **`blob:` PDFs** (web apps that open PDFs via blob URLs) cannot be fetched
  from the extension page — blob URLs are origin-bound. The window shows a
  clear error. A `captureVisibleTab`-based fallback is a possible follow-up.
- **Local files (`file://`)**: not supported (yet). Reading PDFs from the
  local machine never worked reliably — Chrome blocks `file://` reads in
  every extension context (verified up to 151), and the file-picker
  workaround that shipped earlier proved unreliable. The capture window now
  shows a clear error when triggered on a `file://` tab. Local PDF reading is
  planned for a future update.
- **Auth-protected PDFs** may fail to fetch if cookies are blocked for
  cross-site extension requests.
- **PDFs whose URL has no `.pdf` suffix** are detected in Firefox via
  `mimeType`; in Chrome only the built-in viewer (any URL) is detected.
- The drag happens in the QuickCopy window, not over the browser tab — a
  hard browser restriction (see table above), not a design choice.

## Verification checklist (manual, browser)

1. Text PDF (copy a paragraph, a code block, a two-column paper page)
2. Scanned PDF (OCR fallback — same quality/flow as normal captures)
3. Research paper / engineering PDF (multi-column ordering, formulas line)
4. Invoice / ebook / presentation PDF
5. Handwritten scan (OCR fallback)
6. ~~Local `file://` PDF~~ (removed — not supported yet, see Known limitations)
7. Remote PDF over HTTPS
8. Browser PDF (drag on a tab displaying a PDF)
9. Regression: images, videos, Twitter/LinkedIn/YouTube, code screenshots,
   language switching, sidebar edit/copy, dismiss timer

## Automated checks

- `npm run typecheck`
- `npm test` (295 tests incl. 28 new PDF tests: detector heuristics, region
  mapping, text extraction ordering/columns/paragraphs)
- `npm run build` (Chrome) and `npm run build:firefox`
