import type { OcrResult } from '@type/index';
import type { PostProcessingResult, PostProcessingSettings } from './postprocessing/types';
import { Pipeline, createContext } from './postprocessing/Pipeline';
import { eventBus } from '@utils/eventBus';
import { logger } from '@utils/logger';
import { settingsService } from './SettingsService';

export class PostProcessingService {
  private static instance: PostProcessingService;
  private pipeline: Pipeline | null = null;
  private currentSettings: PostProcessingSettings = DEFAULT_SETTINGS;

  private constructor() {}

  static getInstance(): PostProcessingService {
    if (!PostProcessingService.instance) {
      PostProcessingService.instance = new PostProcessingService();
    }
    return PostProcessingService.instance;
  }

  async process(result: OcrResult): Promise<PostProcessingResult> {
    if (!this.pipeline) {
      await this.rebuildPipeline();
    }

    const startTime = performance.now();
    const settings = this.currentSettings;

    if (!settings.enabled) {
      return { ...result, qualityScore: undefined, debugInfo: undefined, repairCount: 0 };
    }

    eventBus.emit('status:update', { status: 'busy', message: 'Post-processing OCR output...' });
    logger.debug('PostProcessing: starting', { charCount: result.text.length, confidence: result.confidence });

    const ctx = createContext(
      result.text,
      result.confidence,
      result.blocks,
      settings,
    );

    const processed = this.pipeline!.process(ctx);

    const duration = performance.now() - startTime;
    const repaired = processed.text !== result.text;

    if (repaired) {
      logger.info('PostProcessing: applied corrections', {
        repairCount: processed.repairCount,
        detectedType: processed.detectedContentType,
        detectedLang: processed.detectedLanguage,
        durationMs: Math.round(duration),
      });
    }

    const output: PostProcessingResult = {
      text: processed.text,
      confidence: result.confidence,
      blocks: result.blocks,
      language: result.language,
      duration: result.duration,
      qualityScore: processed.qualityScore ?? undefined,
      debugInfo: settings.debugMode ? processed.debugInfo : undefined,
      repairCount: processed.repairCount,
    };

    eventBus.emit('status:update', { status: 'ready', message: repaired ? 'OCR output cleaned' : 'OCR complete' });

    return output;
  }

  async reloadSettings(): Promise<void> {
    this.pipeline = null;
    await this.rebuildPipeline();
  }

  private async rebuildPipeline(): Promise<void> {
    try {
      const extSettings = await settingsService.getAll();
      this.currentSettings = {
        enabled: true,
        smartCleanup: extSettings.smartCleanup ?? DEFAULT_SETTINGS.smartCleanup,
        programmingCleanup: extSettings.programmingCleanup ?? DEFAULT_SETTINGS.programmingCleanup,
        markdownCleanup: extSettings.markdownCleanup ?? DEFAULT_SETTINGS.markdownCleanup,
        terminalCleanup: extSettings.terminalCleanup ?? DEFAULT_SETTINGS.terminalCleanup,
        debugMode: extSettings.debugMode ?? DEFAULT_SETTINGS.debugMode,
        confidenceThreshold: extSettings.confidenceThreshold ?? DEFAULT_SETTINGS.confidenceThreshold,
      };
    } catch {
      this.currentSettings = { ...DEFAULT_SETTINGS };
    }

    this.pipeline = new Pipeline(this.currentSettings);
  }
}

export const DEFAULT_SETTINGS: PostProcessingSettings = {
  enabled: true,
  smartCleanup: true,
  programmingCleanup: true,
  markdownCleanup: true,
  terminalCleanup: true,
  debugMode: false,
  confidenceThreshold: 60,
};

export const postProcessingService = PostProcessingService.getInstance();
