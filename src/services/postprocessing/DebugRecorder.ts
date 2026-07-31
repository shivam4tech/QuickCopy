import type { StageDebugInfo } from './types';

export class DebugRecorder {
  private stages: StageDebugInfo[] = [];

  record(stageName: string, input: string, output: string, startTime: number): void {
    const durationMs = performance.now() - startTime;
    let changes = 0;
    if (input !== output) {
      const minLen = Math.min(input.length, output.length);
      for (let i = 0; i < minLen; i++) {
        if (input[i] !== output[i]) changes++;
      }
      changes += Math.abs(input.length - output.length);
    }
    this.stages.push({ stageName, input, output, changes, durationMs: Math.round(durationMs * 100) / 100 });
  }

  getAll(): StageDebugInfo[] {
    return this.stages;
  }

  clear(): void {
    this.stages = [];
  }
}
