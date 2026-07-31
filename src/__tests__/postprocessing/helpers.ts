import type { PostProcessingContext, PostProcessingSettings, ContentType } from '../../services/postprocessing/types';

const DEFAULT_SETTINGS: PostProcessingSettings = {
  enabled: true,
  smartCleanup: true,
  programmingCleanup: true,
  markdownCleanup: true,
  terminalCleanup: true,
  debugMode: false,
  confidenceThreshold: 60,
};

export function createTestContext(text: string, contentType?: ContentType): PostProcessingContext {
  return {
    text,
    confidence: 85,
    blocks: [],
    originalText: text,
    detectedContentType: contentType ?? 'plaintext',
    detectedLanguage: 'unknown',
    qualityScore: null,
    repairCount: 0,
    debugInfo: [],
    settings: DEFAULT_SETTINGS,
  };
}
