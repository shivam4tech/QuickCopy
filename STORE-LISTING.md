# Ekadanta — Chrome Web Store Submission Kit (v1.6.0)

Everything you need to fill in the Chrome Web Store developer dashboard for
**Ekadanta 1.6.0**.

## Package

| Item | File | Notes |
| --- | --- | --- |
| Upload package | `Ekadanta-chrome-1.6.0.zip` | Built from `dist/` — ready to upload as-is. Manifest at zip root. Do not repackage. |
| Store icon | `dist/icons/icon128.png` | 128×128 required. |
| Privacy policy | `PRIVACY.md` | Push to the repo and host at a public URL (see below). |

## Before you upload

1. Create your developer account at https://chrome.google.com/webstore/devconsole
   (registered with **shivam4devs@gmail.com**, pay the one-time $5 fee — the
   registration email is account-only and does not affect the zip or listing;
   users never see it).
2. **Support email**: in the dashboard set the support email to
   **helloquickcopy@gmail.com** (Listing → Support → Support email). CWS sends
   a one-time verification link to that inbox — click it once and that address
   becomes the contact shown to users on the store page.
3. Host the privacy policy: push `PRIVACY.md` to the GitHub repo and either
   - enable GitHub Pages (Settings → Pages → deploy from branch, root), giving
     `https://shivam4tech.github.io/Ekadanta/PRIVACY.html` style URL, or
   - reference the raw file: `https://raw.githubusercontent.com/shivam4tech/Ekadanta/main/PRIVACY.md`.
   The dashboard will not let you submit without a privacy policy URL.

## Dashboard fields

**Listing → Basic info**

- **Name:** Ekadanta — Copy text you can't select
- **Summary (132 chars max):**
  ```
  Copy text from videos, images, PDFs and any visible browser content using OCR — drag to capture, text lands on your clipboard.
  ```
- **Detailed description (markdown supported, max 16,000 chars):**

```markdown
Ekadanta extracts text from anything visible on your screen — videos, images,
PDFs, and regular web pages — and copies it to your clipboard in one drag.

## How it works

1. Hold **Alt+Shift** (Option+Shift on macOS; Ctrl/Cmd also supported) and drag
   over any region of the screen.
2. Ekadanta OCRs the selected area with Tesseract.js and copies the text to
   your clipboard instantly.
3. A floating panel shows the result so you can review, edit, or copy again —
   or use **Silent mode** to skip the panel and copy automatically.

Prefer a keyboard? Press **Alt+Shift+Q** to enter capture mode and drag with the
left mouse button. **Alt+Shift+S** toggles the sidebar with your capture history.

## Works everywhere

- **Videos**: subtitles, code on a stream, slides in a talk — capture while playing.
- **Images**: screenshots, memes, receipts, diagrams.
- **PDFs**: open any https:// PDF and trigger capture — Ekadanta opens its own
  PDF viewer with drag-to-copy. Text-layer pages are extracted exactly (no OCR);
  scanned pages automatically fall back to OCR.
- **Any web page**: menus, error messages, tables, comparisons.

## Languages

English always works out of the box. Add one more language — Ekadanta supports 123 languages in total (English + 122 more) — in the options page
(settings download the language model from the project's public GitHub
repository, cached locally) — swap or switch languages anytime without
restarting the browser.

## Privacy first

Ekadanta is fully offline: every capture, OCR pass, and clipboard write happens
on your machine. Nothing is collected, stored, or transmitted. No accounts, no
analytics, no tracking. See the privacy policy for details.

## Customization

- Configurable drag modifier (Alt+Shift or Ctrl/Cmd)
- Dark/light theme that follows your system
- Adjustable panel auto-close delay and silent capture mode
- Open-source: github.com/shivam4tech/Ekadanta
```

- **Category:** Productivity
- **Language:** English (United States)

**Listing → Store assets**

| Asset | Size | Notes |
| --- | --- | --- |
| Screenshot 1 | 1280×800 (or 640×400) | Capture overlay over a page with text + result panel visible |
| Screenshot 2 | 1280×800 | PDF window with drag box and copied text panel |
| Screenshot 3 | 1280×800 | Options page showing language selection |
| Screenshot 4 | 1280×800 | Sidebar with capture history |
| Small promo tile | 440×280 | Optional but recommended |
| Marquee promo tile | 920×680 | Optional |
| Store icon | 128×128 | Reuse `dist/icons/icon128.png` |

Screenshot tips: use a real page (e.g. a Wikipedia article) for the overlay
shot; keep UI crisp (1x scale, no browser zoom); PNG or JPG ≤ 2 MB each.

**Privacy practices (dashboard questionnaire)**

- Does your product collect or transmit any user data? **No.**
- The permission questionnaire will still ask about `host_permissions`:
  answer **No** for all data categories (the extension performs no data
  collection — the `<all_urls>` host permission is used solely to draw the
  capture overlay and read pixels on any page).
- **Single purpose** justification for `clipboardWrite`, `activeTab`, `tabs`,
  `<all_urls>`, `offscreen`, `storage`: OCR text extraction and clipboard copy
  from any page/PDF — all processing is local and on-demand.
- Remote code: none. All code ships in the package; model files are downloaded
  from the publisher's public GitHub repo on explicit user action.

**Support**

- Support URL: https://github.com/shivam4tech/Ekadanta/issues
- Support email: helloquickcopy@gmail.com (verify once via the dashboard link;
  developer login stays shivam4devs@gmail.com)

## Publishing flow

1. **Package** → upload `Ekadanta-chrome-1.6.0.zip` (keep "Default" as the
   only package; `_locales` not needed).
2. **Privacy** → paste the privacy policy URL; answer questionnaire (No to all).
3. **Distribution** → public; add a submitter note. Site access: choose
   *"On all sites"* (matches `<all_urls>`). Keep the default `https://*/*` /
   `http://*/*` match patterns — do not restrict further or the PDF/overlay
   features break.
4. **Review** → submit. Typical review is a few days; you may be asked to
   upload a test account or explain `<all_urls>` usage — reply referencing the
   single-purpose statement above.

## Post-release

- Bump `version` in `src/manifest.json` for every store update (CWS rejects
  same-version reuploads). Re-run `npm run build`, re-zip, upload as the new
  package version.
- The Firefox build (`dist-firefox/`) and its zip are separate artifacts — do
  not upload the Chrome zip to AMO or the Firefox zip to CWS.
