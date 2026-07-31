import type { PostProcessingContext, PostProcessingSettings, PostProcessingStage, StageDebugInfo, QualityScore } from './types';
import { DebugRecorder } from './DebugRecorder';
import { NormalizeStage } from './stages/NormalizeStage';
import { WhitespaceStage } from './stages/WhitespaceStage';
import { LineRecoveryStage } from './stages/LineRecoveryStage';
import { CharacterRepairStage } from './stages/CharacterRepairStage';
import { UrlEmailStage } from './stages/UrlEmailStage';
import { FilePathStage } from './stages/FilePathStage';
import { ProgrammingStage } from './stages/ProgrammingStage';
import { MarkdownStage } from './stages/MarkdownStage';
import { TerminalStage } from './stages/TerminalStage';
import { ValidationStage } from './stages/ValidationStage';
import { contentDetector } from './ContentDetector';

export class Pipeline {
  private stages: PostProcessingStage[] = [];
  private debugRecorder = new DebugRecorder();

  constructor(settings: PostProcessingSettings) {
    this.buildStages(settings);
  }

  private buildStages(settings: PostProcessingSettings): void {
    this.stages = [
      new NormalizeStage(),
      new WhitespaceStage(),
      new LineRecoveryStage(),
      new CharacterRepairStage(),
      new UrlEmailStage(),
      new FilePathStage(),
    ];

    if (settings.programmingCleanup) {
      this.stages.push(new ProgrammingStage());
    }
    if (settings.markdownCleanup) {
      this.stages.push(new MarkdownStage());
    }
    if (settings.terminalCleanup) {
      this.stages.push(new TerminalStage());
    }

    this.stages.push(new ValidationStage());
  }

  process(ctx: PostProcessingContext): PostProcessingContext {
    this.debugRecorder.clear();
    let current = ctx;

    for (const stage of this.stages) {
      const startTime = performance.now();
      const input = current.text;

      if (current.settings.debugMode) {
        current = stage.process(current);
        this.debugRecorder.record(stage.name, input, current.text, startTime);
      } else {
        current = stage.process(current);
      }
    }

    if (current.settings.debugMode) {
      current.debugInfo = this.debugRecorder.getAll();
    }

    return current;
  }

  getDebugInfo(): StageDebugInfo[] {
    return this.debugRecorder.getAll();
  }
}

export function createContext(
  text: string,
  confidence: number,
  blocks: Array<{ text: string; confidence: number }>,
  settings: PostProcessingSettings,
): PostProcessingContext {
  const detectedContentType = contentDetector.detectContentType(text);
  const detectedLanguage = contentDetector.detectLanguage(text);

  return {
    text,
    confidence,
    blocks,
    originalText: text,
    detectedContentType,
    detectedLanguage,
    qualityScore: null as QualityScore | null,
    repairCount: 0,
    debugInfo: [] as StageDebugInfo[],
    settings,
  };
}

export { DebugRecorder };
export type { PostProcessingContext, PostProcessingSettings, StageDebugInfo, QualityScore };
