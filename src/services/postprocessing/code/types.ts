export type CodeLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'csharp'
  | 'java'
  | 'cpp'
  | 'go'
  | 'rust'
  | 'php'
  | 'kotlin'
  | 'swift'
  | 'unknown';

export interface CodeDetectorResult {
  isCode: boolean;
  confidence: number;
}

export interface IndentStyle {
  unit: number;
  useTabs: boolean;
}

export interface CodeFormattingResult {
  text: string;
  confidence: number;
  language: CodeLanguage;
  changed: boolean;
  lineChanges: number;
}

export interface FormattableBlock {
  text: string;
  bbox?: { x: number; y: number; width: number; height: number } | null;
}

export const CODE_DETECT_THRESHOLD = 35;
export const FORMAT_CONFIDENCE_THRESHOLD = 45;
export const MAX_REPAIR = 100;
