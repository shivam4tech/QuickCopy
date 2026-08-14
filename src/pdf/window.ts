import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/build/pdf.mjs';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { OverlayManager } from '@/content/overlay/OverlayManager';
import { mountSidebar, unmountSidebar } from '@/content/sidebar/index';
import { clipboardService } from '@/services/ClipboardService';
import { preprocessingService } from '@/services/PreprocessingService';
import { ocrService } from '@/services/OCRService';
import { postProcessingService } from '@/services/PostProcessingService';
import { eventBus } from '@/utils/eventBus';
import { logger, getErrorMessage } from '@/utils/logger';
import { STORAGE_KEYS, SIDEBAR_ID } from '@/shared/constants';
import { defaultSettings } from '@type/settings';
import type { ExtensionSettings } from '@type/settings';
import type { Region, OcrResult } from '@type/index';
import { clientRegionToPageRegion } from './regionMapper';
import { extractTextInRegion } from './textExtractor';
import type { PdfTextContent } from './textExtractor';
import { initConsoleGate } from '@utils/logGate';

// Silence console output unless debugMode is enabled (see settings).
initConsoleGate();

/** Hard ceiling on placeholder pages to keep the DOM sane; all pages are present. */
const MAX_PLACEHOLDER_PAGES = 500;
const MAX_SCALE = 2;
const MIN_SCALE = 0.4;
const PAGE_PADDING_X = 48;
/** Raster pages a bit before they enter the viewport for smooth scrolling. */
const LAZY_RENDER_MARGIN_PX = 1200;

interface PageEntry {
  canvas: HTMLCanvasElement;
  viewport: PageViewport;
  page: PDFPageProxy;
  dpr: number;
  rendered: boolean;
}

const overlay = new OverlayManager();
const pageEntries = new Map<number, PageEntry>();
let lazyObserver: IntersectionObserver | null = null;

let settings: ExtensionSettings = defaultSettings;
let processing = false;
let sidebarMounted = false;
let pdfDoc: PDFDocumentProxy | null = null;

const statusEl = document.getElementById('qc-pdf-status') as HTMLSpanElement;
const filenameEl = document.getElementById('qc-pdf-filename') as HTMLSpanElement;
const pagesEl = document.getElementById('qc-pdf-pages') as HTMLElement;
const errorEl = document.getElementById('qc-pdf-error') as HTMLDivElement;
const headerEl = document.getElementById('qc-pdf-header') as HTMLElement;
const pageInputEl = document.getElementById('qc-pdf-page') as HTMLInputElement;
const totalPagesEl = document.getElementById('qc-pdf-total') as HTMLSpanElement;

let totalPageCount = 0;
let pageNavFrame = 0;

function setStatus(message: string, tone: 'default' | 'busy' | 'error' | 'success' = 'default'): void {
  statusEl.textContent = message;
  statusEl.className = tone;
}

function showError(title: string, detail: string): void {
  setStatus('Error', 'error');
  errorEl.classList.add('visible');
  errorEl.replaceChildren();
  const titleEl = document.createElement('div');
  titleEl.className = 'title';
  titleEl.textContent = title;
  errorEl.appendChild(titleEl);
  const detailEl = document.createElement('div');
  detailEl.textContent = detail;
  errorEl.appendChild(detailEl);
}

function fileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '');
    if (last) return last;
    return parsed.hostname || 'PDF document';
  } catch {
    return url.split('/').filter(Boolean).pop() ?? 'PDF document';
  }
}

async function loadSettings(): Promise<ExtensionSettings> {
  try {
    const result = await chrome.storage.local.get({ [STORAGE_KEYS.SETTINGS]: defaultSettings });
    return { ...defaultSettings, ...(result[STORAGE_KEYS.SETTINGS] as ExtensionSettings) };
  } catch {
    return { ...defaultSettings };
  }
}

async function renderPageInto(entry: PageEntry): Promise<void> {
  if (entry.rendered) return;
  entry.rendered = true;
  const renderTask = entry.page.render({
    canvas: entry.canvas,
    viewport: entry.viewport,
    transform: [entry.dpr, 0, 0, entry.dpr, 0, 0],
  });
  await renderTask.promise;
}

/**
 * Create placeholder canvases for EVERY page immediately (so the whole PDF is
 * present and scrollable), but rasterize lazily as pages approach the
 * viewport. The text layer does not need the canvas at all — only the OCR
 * fallback does, and that renders the single page on demand.
 */
async function createPages(doc: PDFDocumentProxy): Promise<void> {
  const pageCount = Math.min(doc.numPages, MAX_PLACEHOLDER_PAGES);
  const containerWidth = Math.max(pagesEl.clientWidth - PAGE_PADDING_X, 200);

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });

    const fitWidth = (containerWidth - 1) / baseViewport.width;
    const scale = Math.min(Math.max(fitWidth, MIN_SCALE), MAX_SCALE);
    const viewport = page.getViewport({ scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const canvas = document.createElement('canvas');
    canvas.className = 'qc-page';
    canvas.dataset.pageIndex = String(i - 1);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);

    pagesEl.appendChild(canvas);
    pageEntries.set(i - 1, { canvas, viewport, page, dpr, rendered: false });
  }

  if (doc.numPages > MAX_PLACEHOLDER_PAGES) {
    setStatus(`Loaded first ${MAX_PLACEHOLDER_PAGES} of ${doc.numPages} pages`, 'default');
  }

  lazyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const pageEntry = pageEntries.get(Number((entry.target as HTMLCanvasElement).dataset.pageIndex));
        if (pageEntry && !pageEntry.rendered) {
          void renderPageInto(pageEntry).catch((err) => {
            logger.warn('Lazy PDF page render failed', getErrorMessage(err));
          });
        }
        lazyObserver?.unobserve(entry.target);
      }
    },
    { root: pagesEl, rootMargin: `${LAZY_RENDER_MARGIN_PX}px 0px` },
  );

  for (const entry of pageEntries.values()) {
    lazyObserver.observe(entry.canvas);
  }
}

function pageEntryAt(clientX: number, clientY: number): PageEntry | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    if (el instanceof HTMLCanvasElement && el.dataset.pageIndex != null) {
      const entry = pageEntries.get(Number(el.dataset.pageIndex));
      if (entry && entry.canvas === el) return entry;
    }
  }
  return null;
}

/** Page (0-based) whose top edge is closest to the top of the scroll area. */
function currentPageIndex(): number {
  const threshold = pagesEl.getBoundingClientRect().top;
  let best = 0;
  let bestDist = Infinity;
  for (const [idx, entry] of pageEntries) {
    const dist = Math.abs(entry.canvas.getBoundingClientRect().top - threshold);
    if (dist < bestDist) {
      bestDist = dist;
      best = idx;
    } else {
      break;
    }
  }
  return best;
}

function scrollToPage(pageIndex: number): void {
  const entry = pageEntries.get(pageIndex);
  if (!entry) return;
  const containerTop = pagesEl.getBoundingClientRect().top;
  const pageTop = entry.canvas.getBoundingClientRect().top;
  pagesEl.scrollTop += pageTop - containerTop - 12;
  pageInputEl.value = String(pageIndex + 1);
}

function scheduleCurrentPageUpdate(): void {
  if (pageNavFrame) return;
  pageNavFrame = requestAnimationFrame(() => {
    pageNavFrame = 0;
    if (document.activeElement !== pageInputEl) {
      pageInputEl.value = String(currentPageIndex() + 1);
    }
  });
}

function cropCanvas(canvas: HTMLCanvasElement, region: Region, rect: DOMRect): string {
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const sx = (region.x - rect.left) * scaleX;
  const sy = (region.y - rect.top) * scaleY;
  const sw = region.width * scaleX;
  const sh = region.height * scaleY;

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw));
  out.height = Math.max(1, Math.round(sh));
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for crop');
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

function rearmSelection(): void {
  if (processing) return;
  overlay.show({
    topOffset: headerEl.offsetHeight,
    onComplete: (region) => {
      void handleRegionSelected(region);
    },
    onCancel: () => {
      logger.debug('PDF selection cancelled — re-arming');
      setStatus('Drag over the PDF to copy · Esc to close', 'default');
      rearmSelection();
    },
  });
  setStatus('Drag over the PDF to copy · Esc to close', 'default');
}

function closeSidebarAndRearm(): void {
  unmountSidebar();
  sidebarMounted = false;
  rearmSelection();
}

async function handleRegionSelected(region: Region): Promise<void> {
  if (processing) return;
  processing = true;
  // Wrong/empty captures must not leave the window dead — unless the sidebar
  // is up (its close re-arms), put the selection overlay back after an error.
  let rearmOnDone = false;

  try {
    eventBus.emit('capture:started', undefined);

    if (settings.showPanel && !sidebarMounted) {
      await mountSidebar(closeSidebarAndRearm);
      sidebarMounted = true;
    }

    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    const entry = pageEntryAt(centerX, centerY);
    if (!entry) {
      rearmOnDone = true;
      eventBus.emit('status:update', { status: 'error', message: 'Drag inside the PDF page' });
      setStatus('Drag inside the PDF page', 'error');
      return;
    }

    const rect = entry.canvas.getBoundingClientRect();
    const pageRegion = clientRegionToPageRegion(region, rect, entry.viewport);

    // 1) Text layer: extraction, never OCR of selectable text. Works even
    //    on a not-yet-rasterized page.
    const extractStart = performance.now();
    const textContent = await entry.page.getTextContent();
    // pdf.js returns TextMarkedContent entries alongside text items; the
    // extractor skips anything without a `str` property.
    const extracted = extractTextInRegion(textContent as unknown as PdfTextContent, pageRegion);
    const extractMs = Math.round(performance.now() - extractStart);
    logger.debug('PDF text-layer extraction', { chars: extracted.length, ms: extractMs });

    if (extracted.trim().length > 0) {
      const result: OcrResult = {
        text: extracted,
        confidence: 100,
        language: 'eng',
        duration: extractMs,
        blocks: [],
        engine: undefined,
      };
      eventBus.emit('postprocessing:completed', result);
      await clipboardService.copy(extracted);
      setStatus('Copied ✓', 'success');
      afterCopy();
      return;
    }

    // 2) No text layer — scanned page. Reuse the existing OCR pipeline.
    logger.debug('No PDF text layer in region — falling back to OCR');
    eventBus.emit('status:update', { status: 'busy', message: 'No selectable text — running OCR…' });
    setStatus('No selectable text — OCR…', 'busy');

    if (!entry.rendered) {
      await renderPageInto(entry);
    }
    const cropDataUrl = cropCanvas(entry.canvas, region, rect);
    const preprocessed = await preprocessingService.preprocess(cropDataUrl, 2);
    const ocrResult = await ocrService.recognize(preprocessed.dataUrl);
    const cleaned = await postProcessingService.process(ocrResult);

    if (cleaned.text.trim().length === 0) {
      rearmOnDone = true;
      eventBus.emit('status:update', { status: 'error', message: 'No text found — try a different area' });
      setStatus('No text found — try a different area', 'error');
      return;
    }

    eventBus.emit('postprocessing:completed', cleaned);
    await clipboardService.copy(cleaned.text);
    setStatus('Copied ✓', 'success');
    afterCopy();
  } catch (err) {
    const message = getErrorMessage(err);
    logger.error('PDF capture failed', err);
    rearmOnDone = true;
    eventBus.emit('status:update', { status: 'error', message: `PDF capture failed: ${message}` });
    setStatus('PDF capture failed', 'error');
  } finally {
    processing = false;
    if (rearmOnDone && !sidebarMounted) {
      rearmSelection();
    }
  }
}

/**
 * After a successful copy the window stays open for more captures — only the
 * side panel closes (per its own dismissal logic, which calls onClose → the
 * overlay is re-armed for the next drag). With the panel hidden, re-arm
 * directly after a short confirmation pause.
 */
function afterCopy(): void {
  if (!settings.showPanel) {
    setTimeout(() => {
      if (!processing) rearmSelection();
    }, 700);
  }
}

function onDocumentMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return;
  if (processing) return;
  if (!overlay.isVisible()) return;

  // The toolbar and the sidebar are interactive chrome — a click there must
  // never start (or cancel) a region selection.
  const target = e.target as HTMLElement | null;
  if (target) {
    if (headerEl.contains(target)) return;
    const sidebarHost = document.getElementById(SIDEBAR_ID);
    if (sidebarHost && sidebarHost.contains(target)) return;
  }

  overlay.startSelection(e.clientX, e.clientY);
}

function scrollPages(deltaX: number, deltaY: number): void {
  pagesEl.scrollBy({ left: deltaX, top: deltaY, behavior: 'auto' });
}

function handleKeyDown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null;
  const inTextField = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
  const k = e.key;

  if (inTextField) return;

  // Keyboard scrolling while the selection overlay is up (wheel is forwarded
  // separately — the overlay sits above the scroll container).
  if (overlay.isVisible() && (k === 'ArrowUp' || k === 'ArrowDown' || k === 'PageUp' || k === 'PageDown' || k === 'Home' || k === 'End' || k === ' ')) {
    e.preventDefault();
    if (k === 'ArrowUp') pagesEl.scrollTop -= 80;
    else if (k === 'ArrowDown') pagesEl.scrollTop += 80;
    else if (k === 'PageUp') pagesEl.scrollTop -= pagesEl.clientHeight * 0.8;
    else if (k === 'PageDown' || k === ' ') pagesEl.scrollTop += pagesEl.clientHeight * 0.8;
    else if (k === 'Home') pagesEl.scrollTop = 0;
    else if (k === 'End') pagesEl.scrollTop = pagesEl.scrollHeight;
    return;
  }

  if (k === 'Escape') {
    window.close();
  }
}

async function loadPdf(data: ArrayBuffer): Promise<void> {
  try {
    setStatus('Loading PDF…', 'busy');
    pdfDoc = await getDocument({ data }).promise;
    await createPages(pdfDoc);

    totalPageCount = Math.min(pdfDoc.numPages, MAX_PLACEHOLDER_PAGES);
    totalPagesEl.textContent = String(pdfDoc.numPages);
    pageInputEl.disabled = false;
    pageInputEl.value = '1';

    rearmSelection();
  } catch (err) {
    const message = getErrorMessage(err);
    logger.error('PDF open failed', err);
    showError('Could not open this PDF', message);
  }
}

async function main(): Promise<void> {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const pdfUrl = new URLSearchParams(location.search).get('url');
  if (!pdfUrl) {
    showError('Nothing to capture', 'QuickCopy could not determine which PDF to open. Re-trigger capture (Alt+Shift+Q on Chrome / Alt+Shift+C on Firefox) from the PDF tab.');
    return;
  }

  if (pdfUrl.startsWith('file:')) {
    logger.warn('Local file PDF unsupported', pdfUrl);
    showError(
      'Local PDF files are not supported yet',
      'PDFs opened from the browser (https://) work out of the box. Reading local file:// PDFs is planned for a future update.',
    );
    return;
  }

  filenameEl.textContent = fileNameFromUrl(pdfUrl);
  settings = await loadSettings();

  // Pre-warm the in-window OCR worker while the PDF loads so the first
  // capture is instant instead of spending 10–30s on first-time init.
  void ocrService.initialize().catch(() => undefined);

  document.getElementById('qc-pdf-close')?.addEventListener('click', () => window.close());

  pageInputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const n = parseInt(pageInputEl.value, 10);
    if (Number.isNaN(n) || totalPageCount === 0) {
      pageInputEl.value = String(currentPageIndex() + 1);
      return;
    }
    const clamped = Math.min(Math.max(n, 1), totalPageCount);
    scrollToPage(clamped - 1);
    pageInputEl.blur();
  });

  pagesEl.addEventListener('scroll', scheduleCurrentPageUpdate, { passive: true });

  window.addEventListener('keydown', handleKeyDown);

  // The selection overlay is a fixed full-window canvas above the scroll
  // container, so wheel events never reach it — forward them manually while
  // the overlay is up (when the sidebar is open, wheel scrolls the panel).
  document.addEventListener('wheel', (e) => {
    if (!overlay.isVisible()) return;
    e.preventDefault();
    scrollPages(e.deltaX, e.deltaY);
  }, { passive: false, capture: true });

  document.addEventListener('mousedown', onDocumentMouseDown, true);

  try {
    const resp = await fetch(pdfUrl);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const data = await resp.arrayBuffer();
    await loadPdf(data);
  } catch (err) {
    const message = getErrorMessage(err);
    logger.error('PDF open failed', err);
    showError(
      'Could not open this PDF',
      `${message}\n\nTip: website PDFs work out of the box. This URL may require authentication, or the server blocked the request.`,
    );
  }
}

void main();
