import type { OcrResult } from '@type/index';

export type ContentType = 'code' | 'terminal' | 'markdown' | 'json' | 'yaml' | 'xml' | 'html' | 'sql' | 'config' | 'stacktrace' | 'log' | 'plaintext';

export type ProgrammingLanguage = 'python' | 'javascript' | 'typescript' | 'csharp' | 'java' | 'cpp' | 'go' | 'rust' | 'shell' | 'powershell' | 'yaml' | 'json' | 'markdown' | 'sql' | 'unknown';

export interface QualityScore {
  overall: number;
  averageConfidence: number;
  repairCount: number;
  unknownSymbols: number;
  suspiciousSpacing: number;
  brokenPunctuation: number;
}

export interface StageDebugInfo {
  stageName: string;
  input: string;
  output: string;
  changes: number;
  durationMs: number;
}

export interface PostProcessingContext {
  text: string;
  confidence: number;
  blocks: Array<{
    text: string;
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number } | null;
  }>;
  originalText: string;
  detectedContentType: ContentType;
  detectedLanguage: ProgrammingLanguage;
  qualityScore: QualityScore | null;
  repairCount: number;
  debugInfo: StageDebugInfo[];
  settings: PostProcessingSettings;
}

export interface PostProcessingSettings {
  enabled: boolean;
  smartCleanup: boolean;
  programmingCleanup: boolean;
  markdownCleanup: boolean;
  terminalCleanup: boolean;
  debugMode: boolean;
  confidenceThreshold: number;
}

export interface PostProcessingStage {
  readonly name: string;
  process(ctx: PostProcessingContext): PostProcessingContext;
}

export type PostProcessingResult = OcrResult & {
  qualityScore?: QualityScore;
  debugInfo?: StageDebugInfo[];
  repairCount?: number;
};
