export type OcrMode = 'auto' | 'text' | 'code' | 'debug';
export type ProviderId = 'tesseract' | 'codeocr';

export type RouteReason =
  | 'high-code'
  | 'high-text'
  | 'uncertain'
  | 'manual-code'
  | 'manual-text'
  | 'fallback'
  | 'none';

export interface RoutingDecision {
  provider: ProviderId;
  /** provider to retry with if the first pass fails the quality gate (max one retry) */
  retryProvider: ProviderId | null;
  reason: RouteReason;
  textScore: number;
  codeScore: number;
}

export interface RouteScores {
  textScore: number;
  codeScore: number;
}

/**
 * Decide which provider handles a capture. Pure — no engine state.
 *
 * Band semantics: score > 80 = HIGH, 40-80 = UNCERTAIN.
 */
export function planRoute(mode: OcrMode, scores: RouteScores): RoutingDecision {
  const { textScore, codeScore } = scores;

  if (mode === 'code') {
    return { provider: 'codeocr', retryProvider: null, reason: 'manual-code', textScore, codeScore };
  }
  if (mode === 'text') {
    return { provider: 'tesseract', retryProvider: null, reason: 'manual-text', textScore, codeScore };
  }

  // auto / debug
  if (codeScore > 80) {
    return { provider: 'codeocr', retryProvider: null, reason: 'high-code', textScore, codeScore };
  }
  if (textScore > 80) {
    return { provider: 'tesseract', retryProvider: null, reason: 'high-text', textScore, codeScore };
  }

  // UNCERTAIN: cheap engine first, quality-gated retry with code engine.
  return { provider: 'tesseract', retryProvider: 'codeocr', reason: 'uncertain', textScore, codeScore };
}

/** True when the decision routes to the code engine directly. */
export function isCodeRoute(decision: RoutingDecision): boolean {
  return decision.provider === 'codeocr';
}

/** True when the decision will use the quality gate to potentially retry. */
export function isUncertainRoute(decision: RoutingDecision): boolean {
  return decision.retryProvider !== null;
}
