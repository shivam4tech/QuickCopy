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
import { emojiService, applyEmojiDetections } from '@services/ocr/emoji';
import { getErrorMessage, getErrorStack } from '@utils/logger';
import { STORAGE_KEYS } from '@shared/constants';
import { defaultSettings } from '@type/settings';
import type { ExtensionSettings } from '@type/settings';
import type { Region } from '@type/index';
import { languageManager } from '@services/ocr/LanguageManager';
import type { LanguagesGetDataResponse } from '@type/messages';
import { base64ToUint8Array } from '@utils/encoding';
import { enableTrustedTypesWorkers } from '@utils/trustedTypes';

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

  const resp = await browserMessaging.sendMessage<LanguagesGetDataResponse>({
    type: 'languages:get-data',
    code,
    source: 'content',
    target: 'background',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }).catch(() => undefined);

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
    currentSettings = { ...defaultSettings, ...(change.newValue as ExtensionSettings) };
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

    // Run emoji detection on the ORIGINAL color image in parallel with OCR
    // (preprocessing converts to grayscale, which would destroy color info).
    const emojiPromise = emojiService.detect(captureResult.dataUrl).catch(() => [] as Awaited<ReturnType<typeof emojiService.detect>>);

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

    const emojis = await emojiPromise;
    const emojiAwareResult = emojis.length > 0 ? applyEmojiDetections(ocrResult, emojis) : ocrResult;
    if (emojis.length > 0) {
      console.log(`[QuickCopy] Detected ${emojis.length} emoji: ${emojis.map((e) => e.text).join(' ')}`);
    }

    setPipelineState('postprocessing');
    console.log(`[QuickCopy] [8/10] Post-processing started`);
    const postStart = performance.now();
    eventBus.emit('postprocessing:started', undefined);
    const cleanedResult = await postProcessingService.process(emojiAwareResult);
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
  if (!e.ctrlKey && !e.metaKey) return;

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
