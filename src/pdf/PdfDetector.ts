export const CHROME_PDF_VIEWER_ORIGIN = 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/';

const PDF_URL_RE = /\.pdf($|[?#])/i;

export interface PdfDetection {
  pdfUrl: string | null;
  via: 'chrome-viewer' | 'pdf-suffix' | 'mime-type' | null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Detect whether a tab is showing a PDF, and recover the original PDF URL.
 *
 * The native PDF viewers of Chrome and Firefox are off-limits to content
 * scripts (Chrome's viewer is itself an extension, `chrome-extension://mhjf…`;
 * Firefox's pdf.js viewer is a privileged `resource://` page), so this is the
 * only reliable way to learn what PDF the user is looking at:
 *
 *   1. Chrome's built-in viewer: the tab URL is
 *      `chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html?file=<pdf-url>`.
 *   2. The plain `.pdf` suffix heuristic (any browser, incl. local files).
 *   3. Firefox: `tab.mimeType === 'application/pdf'` (Firefox keeps the
 *      original PDF URL as the tab URL).
 */
export function detectPdfUrl(tabUrl: string | undefined, tabMimeType?: string): PdfDetection {
  if (!tabUrl) return { pdfUrl: null, via: null };

  if (tabUrl.startsWith(CHROME_PDF_VIEWER_ORIGIN)) {
    try {
      const parsed = new URL(tabUrl);
      const file = parsed.searchParams.get('file');
      if (file) return { pdfUrl: safeDecode(file), via: 'chrome-viewer' };
    } catch {
      // malformed viewer URL — fall through to the suffix heuristic
    }
  }

  if (PDF_URL_RE.test(tabUrl)) return { pdfUrl: tabUrl, via: 'pdf-suffix' };

  if (tabMimeType === 'application/pdf') return { pdfUrl: tabUrl, via: 'mime-type' };

  return { pdfUrl: null, via: null };
}

export class PdfDetector {
  detectTab(tab: chrome.tabs.Tab): PdfDetection {
    const mimeType = (tab as { mimeType?: string }).mimeType;
    return detectPdfUrl(tab.url, mimeType);
  }

  getPdfUrlForTab(tab: chrome.tabs.Tab): string | null {
    return this.detectTab(tab).pdfUrl;
  }
}

export const pdfDetector = new PdfDetector();
