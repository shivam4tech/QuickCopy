import { OverlayManager } from './overlay/OverlayManager';
import { mountSidebar, unmountSidebar, setSidebarExpanded, raiseSidebarToTop } from './sidebar/index';
import { eventBus } from '@utils/eventBus';
import { logger } from '@utils/logger';
import { browserMessaging } from '@compat/messaging';
import { captureService } from '@services/CaptureService';
import { preprocessingService } from '@services/PreprocessingService';
import { ocrService } from '@services/OCRService';
import { clipboardService } from '@services/ClipboardService';
import { postProcessingService } from '@services/PostProcessingService';
import { getErrorMessage, getErrorStack } from '@utils/logger';
import { STORAGE_KEYS } from '@shared/constants';
import { defaultSettings } from '@type/settings';
import type { ExtensionSettings } from '@type/settings';
import type { Region } from '@type/index';
import { languageManager } from '@services/ocr/LanguageManager';
import type { LanguagesGetDataResponse } from '@type/messages';
import { base64ToUint8Array } from '@utils/encoding';
import { enableTrustedTypesWorkers } from '@utils/trustedTypes';
import { initConsoleGate } from '@utils/logGate';

// Silence console output unless debugMode is enabled (see settings).
initConsoleGate();

// Patch Worker before anything else can spawn one: pages with Trusted Types
// policies (report-only or enforced) otherwise flag the OCR worker's blob URL.
enableTrustedTypesWorkers();

type PipelineState = 'idle' | 'selecting' | 'capturing' | 'preprocessing' | 'ocr_init' | 'ocr_recognizing' | 'postprocessing' | 'completed' | 'failed' | 'cancelled';

const overlay = new OverlayManager();
let sidebarVisible = false;
let sidebarExpanded = false;
let currentSettings: ExtensionSettings = defaultSettings;
let pipelineState: PipelineState = 'idle';
let pipelineLock = false;
let disposed = false;
const cleanupFns: (() => void)[] = [];
let lastSyncedSecondary: string | null | undefined = undefined;

function isExtensionContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

async function loadSettings(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result[STORAGE_KEYS.SETTINGS] as ExtensionSettings | undefined;
    currentSettings = stored ? { ...defaultSettings, ...stored } : { ...defaultSettings };
  } catch (err) {
    console.warn(`[QuickCopy] Failed to load settings in content script`, getErrorMessage(err));
  }
}

async function syncSecondaryLanguage(code: string | null): Promise<void> {
  if (disposed || lastSyncedSecondary === code) return;

  if (!code) {
    if (lastSyncedSecondary) {
      await languageManager.removeLanguage(lastSyncedSecondary);
      console.log(`[Language] Purged local cache for ${lastSyncedSecondary}`);
    }
    lastSyncedSecondary = null;
    return;
  }

  if (await languageManager.isLanguageInstalled(code)) {
    console.log(`[Language] ${code} already in local cache`);
    lastSyncedSecondary = code;
    return;
  }

  // Pull the traineddata from the extension store into the page cache. A
  // single attempt can fail transiently (cold service worker, restore races),
  // and there is no later settings change to re-trigger it — a restart was
  // the only recovery. Retry a few times so the language works right away.
  let resp: LanguagesGetDataResponse | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    resp = await browserMessaging.sendMessage<LanguagesGetDataResponse>({
      type: 'languages:get-data',
      code,
      source: 'content',
      target: 'background',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }).catch(() => undefined);

    if (resp?.success && resp.dataBase64) break;
    if (attempt < 3) {
      console.warn(`[Language] get-data failed for ${code} (attempt ${attempt}/3) — retrying…`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }

  if (resp?.success && resp.dataBase64) {
    const data = base64ToUint8Array(resp.dataBase64);
    if (data && data.length === (resp.size ?? data.length)) {
      await languageManager.storeLanguage(code, data);
      console.log(`[Language] Synced ${code} (${data.length} bytes) to page cache`);
    } else {
      await languageManager.removeLanguage(code);
      console.warn(`[Language] Corrupt traineddata received for ${code} — English only`);
    }
  } else {
    await languageManager.removeLanguage(code);
    console.warn(`[Language] ${code} not available in extension store — English only`);
  }
  lastSyncedSecondary = code;
}

/**
 * Always make English available to the page-local worker by seeding the
 * bundled eng.traineddata into the page IndexedDB (same cache the worker
 * reads). Without this, local OCR relies on a cross-origin fetch of the
 * extension asset, which some page CSPs block.
 */
async function syncEnglishIntoPageCache(): Promise<void> {
  if (disposed) return;
  if (await languageManager.isLanguageInstalled('eng')) {
    console.log(`[Language] eng already in local cache`);
    return;
  }
  try {
    const resp = await fetch(chrome.runtime.getURL('tessdata/eng.traineddata'));
    if (!resp.ok) {
      console.warn(`[Language] eng.traineddata fetch failed (${resp.status})`);
      return;
    }
    const data = new Uint8Array(await resp.arrayBuffer());
    await languageManager.storeLanguage('eng', data);
    console.log(`[Language] Seeded eng into page cache (${data.length} bytes)`);
  } catch (err) {
    console.warn(`[Language] eng seed failed`, getErrorMessage(err));
  }
}

function handleSettingsChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void {
  if (areaName !== 'local') return;
  const change = changes[STORAGE_KEYS.SETTINGS];
  if (change?.newValue) {
    const oldSecondary = currentSettings.secondaryLanguage;
    const wasEnabled = currentSettings.enabled;
    currentSettings = { ...defaultSettings, ...(change.newValue as ExtensionSettings) };
    if (wasEnabled && !currentSettings.enabled) {
      console.log('[QuickCopy] Extension paused — hiding overlay and closing panel');
      overlay.hide();
      if (sidebarVisible) closeSidebar();
    }
    const newSecondary = currentSettings.secondaryLanguage;
    if (oldSecondary !== newSecondary) {
      console.log(`[QuickCopy] Secondary language changed: ${oldSecondary} → ${newSecondary}`);
      void syncSecondaryLanguage(newSecondary)
        .catch((err) => console.warn(`[QuickCopy] Secondary language sync failed`, err))
        .then(() => ocrService.rebuildWorker().catch(() => {}));
    }
  }
}

void loadSettings().then(() => {
  void syncEnglishIntoPageCache().catch(() => {});
  void syncSecondaryLanguage(currentSettings.secondaryLanguage).catch(() => {});
});
chrome.storage.onChanged.addListener(handleSettingsChanged);
cleanupFns.push(() => chrome.storage.onChanged.removeListener(handleSettingsChanged));

function setPipelineState(state: PipelineState): void {
  pipelineState = state;
  console.log(`[QuickCopy] State: ${state}`);
  eventBus.emit('pipeline:stateChange', state);
}

function handleMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  if (!event.data?.type) return;
  const type = event.data.type as string;
  if (type.startsWith('quickcopy:')) {
    logger.debug('Window message received', { type });
  }
}

window.addEventListener('message', handleMessage);
cleanupFns.push(() => window.removeEventListener('message', handleMessage));

async function handleRegionSelected(region: Region): Promise<void> {
  if (disposed) return;
  logger.info('Region selected', region);

  try {
    setPipelineState('capturing');
    eventBus.emit('capture:started', undefined);

    if (!isExtensionContextValid()) {
      throw new Error('Extension context invalidated');
    }

    const captureStart = performance.now();
    const captureResult = await captureService.captureRegion(region);
    console.log(`[QuickCopy] Capture done in ${Math.round(performance.now() - captureStart)}ms`);

    // Sidebar mounts after capture completes (not during drag)
    if (currentSettings.showPanel) {
      await ensureSidebar();
    }

    // Run OCR on the preprocessed image
    setPipelineState('preprocessing');
    const preprocessStart = performance.now();
    const preprocessed = await preprocessingService.preprocess(captureResult.dataUrl, 2);
    console.log(`[QuickCopy] [5/10] Preprocessing complete ✓`, {
      originalSize: `${preprocessed.width / 2}x${preprocessed.height / 2}`,
      processedSize: `${preprocessed.width}x${preprocessed.height}`,
      upscaleFactor: 2,
      grayscaleApplied: true,
      executionTimeMs: Math.round(performance.now() - preprocessStart),
    });

    setPipelineState('ocr_init');
    const ocrStart = performance.now();
    const ocrResult = await ocrService.recognize(preprocessed.dataUrl);
    console.log(`[QuickCopy] OCR done in ${Math.round(performance.now() - ocrStart)}ms`);

    setPipelineState('postprocessing');
    console.log(`[QuickCopy] [8/10] Post-processing started`);
    const postStart = performance.now();
    eventBus.emit('postprocessing:started', undefined);
    const cleanedResult = await postProcessingService.process(ocrResult);
    console.log(`[QuickCopy] [8/10] Post-processing complete ✓`, {
      textLength: cleanedResult.text.length,
      repairCount: cleanedResult.repairCount,
      executionTimeMs: Math.round(performance.now() - postStart),
    });
    eventBus.emit('postprocessing:completed', cleanedResult);

    setPipelineState('completed');

    if (currentSettings.autoCopy) {
      console.log(`[QuickCopy] [9.5/10] Auto-copy enabled — copying to clipboard`);
      const clipResult = await clipboardService.copy(cleanedResult.text);
      if (clipResult) {
        console.log(`[QuickCopy] [10/10] Auto-copied to clipboard ✓`);
      } else {
        console.warn(`[QuickCopy] [10/10] Auto-copy FAILED — user can copy from the panel`);
      }
    } else {
      console.log(`[QuickCopy] [9.5/10] Auto-copy disabled — awaiting user copy in panel`);
    }
  } catch (error) {
    const errMsg = getErrorMessage(error);
    console.error(`[QuickCopy] Pipeline FAILED at ${pipelineState}`, {
      message: errMsg,
      stack: getErrorStack(error),
      type: typeof error,
    });
    setPipelineState('failed');
    eventBus.emit('status:update', { status: 'error', message: errMsg });
    logger.error('Workflow failed', error);
  } finally {
    pipelineLock = false;
  }
}

async function ensureSidebar(): Promise<void> {
  if (!sidebarVisible) {
    console.log(`[QuickCopy] Mounting sidebar...`);
    await mountSidebar(closeSidebar);
    sidebarVisible = true;
    eventBus.emit('sidebar:opened', undefined);
    console.log(`[QuickCopy] Sidebar mounted ✓`);
  }
  raiseSidebarToTop();
}

function closeSidebar(): void {
  if (!sidebarVisible) return;
  unmountSidebar();
  sidebarVisible = false;
  sidebarExpanded = false;
  eventBus.emit('sidebar:closed', undefined);
  console.log(`[QuickCopy] Sidebar closed ✓`);
}

function onSidebarExpandedChanged(e: Event): void {
  sidebarExpanded = (e as CustomEvent<boolean>).detail === true;
}

window.addEventListener('quickcopy:sidebar:expanded-changed', onSidebarExpandedChanged);
cleanupFns.push(() => window.removeEventListener('quickcopy:sidebar:expanded-changed', onSidebarExpandedChanged));

async function beginSelection(clientX?: number, clientY?: number): Promise<void> {
  if (pipelineLock) {
    console.log(`[QuickCopy] Pipeline locked, ignoring selection`);
    return;
  }
  if (pipelineState !== 'idle' && pipelineState !== 'completed' && pipelineState !== 'failed' && pipelineState !== 'cancelled') {
    console.log(`[QuickCopy] Pipeline busy (${pipelineState}), ignoring selection`);
    return;
  }
  if (!isExtensionContextValid()) {
    console.error(`[QuickCopy] Extension context invalidated, cannot begin selection`);
    return;
  }

  // Close the sidebar if it was showing a prior result — it will be re-opened
  // after the new drag finishes.
  if (sidebarVisible) {
    closeSidebar();
  }

  pipelineLock = true;
  setPipelineState('selecting');

  try {
    overlay.show({
      onComplete: (region) => {
        handleRegionSelected(region);
      },
      onCancel: () => {
        setPipelineState('cancelled');
        pipelineLock = false;
        logger.debug('Selection cancelled');
      },
    });

    if (clientX != null && clientY != null) {
      overlay.startSelection(clientX, clientY);
    }
  } catch (err) {
    console.error(`[QuickCopy] beginSelection failed`, err);
    pipelineLock = false;
    setPipelineState('idle');
  }
}

const mousedownHandler = (e: MouseEvent) => {
  if (e.button !== 0) return;
  if (!currentSettings.enabled) return;

  // Armed overlay (keyboard shortcut): any left press starts selection
  // immediately — no modifier needed.
  if (overlay.isVisible()) {
    e.preventDefault();
    e.stopPropagation();
    overlay.startSelection(e.clientX, e.clientY);
    return;
  }

  const modifierMatches = currentSettings.dragModifier === 'alt+shift'
    ? e.altKey && e.shiftKey
    : e.ctrlKey || e.metaKey;
  if (!modifierMatches) return;

  console.log(`[QuickCopy] [1/10] CTRL detected ✓`);
  e.preventDefault();
  e.stopPropagation();

  beginSelection(e.clientX, e.clientY);
};

document.addEventListener('mousedown', mousedownHandler, true);
cleanupFns.push(() => document.removeEventListener('mousedown', mousedownHandler, true));

const cleanupMessaging = browserMessaging.onMessage(async (message) => {
  switch (message.type) {
    case 'overlay:show': {
      if (!currentSettings.enabled) {
        return { success: false, error: 'QuickCopy is paused' };
      }
      beginSelection();
      return { success: true };
    }
    case 'overlay:hide': {
      overlay.hide();
      return { success: true };
    }
    case 'sidebar:toggle': {
      if (!sidebarVisible) {
        await mountSidebar(closeSidebar);
        sidebarVisible = true;
        eventBus.emit('sidebar:opened', undefined);
        setSidebarExpanded(true);
      } else {
        setSidebarExpanded(!sidebarExpanded);
      }
      return { success: true };
    }
    case 'sidebar:open': {
      if (!sidebarVisible) {
        await mountSidebar(closeSidebar);
        sidebarVisible = true;
        eventBus.emit('sidebar:opened', undefined);
      }
      setSidebarExpanded(true);
      return { success: true };
    }
    case 'sidebar:close': {
      if (sidebarVisible) {
        setSidebarExpanded(false);
      }
      return { success: true };
    }
    default:
      return;
  }
});
cleanupFns.push(cleanupMessaging);

// Keep the background service worker (and its warm OCR worker) alive across
// tab switches. Chrome kills the SW after ~30s idle, which would otherwise
// cold-start the OCR worker on every newly opened page. A 20s heartbeat (well
// under the idle limit) keeps it resident, so switching tabs and scanning
// stays instantaneous.
//
// The heartbeat ONLY runs while this tab is visible: hidden tabs have their
// timers throttled by Chrome (down to ~1/min), so relying on them would let
// the SW idle out whenever the user works in another tab. The visible tab's
// timer is never throttled, so the active tab alone keeps the SW resident no
// matter how many tabs are open. Chrome's 30s SW idle limit is reset by any
// incoming message, and 20s < 30s guarantees the SW never sleeps while at
// least one tab is on screen.
const KEEPALIVE_INTERVAL_MS = 20000;
let keepaliveTimer: number | null = null;

const startKeepalive = (): void => {
  if (keepaliveTimer != null || disposed) return;
  const beat = (): void => {
    if (disposed) return;
    browserMessaging.sendMessage({
      type: 'keepalive',
      source: 'content',
      target: 'background',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }).catch(() => undefined);
  };
  beat();
  keepaliveTimer = window.setInterval(beat, KEEPALIVE_INTERVAL_MS);
};

const stopKeepalive = (): void => {
  if (keepaliveTimer != null) {
    window.clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
};

const handleVisibilityChange = (): void => {
  if (document.visibilityState === 'visible') {
    startKeepalive();
  } else {
    stopKeepalive();
  }
};

if (document.visibilityState === 'visible') {
  startKeepalive();
}
document.addEventListener('visibilitychange', handleVisibilityChange);
cleanupFns.push(() => {
  stopKeepalive();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

console.log(`[QuickCopy] Content script loaded (build: ${__BUILD_ID__})`);
logger.info('Content script loaded');
eventBus.emit('app:ready', undefined);

function dispose(): void {
  if (disposed) return;
  disposed = true;
  pipelineLock = true;
  overlay.destroy();
  unmountSidebar();
  cleanupFns.forEach(fn => fn());
  cleanupFns.length = 0;
  captureService.dispose();
  ocrService.terminate();
  eventBus.clear();
  logger.info('Content script disposed');
}

export { overlay, sidebarVisible, dispose };
