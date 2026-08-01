import { describe, it, expect } from 'vitest';
import { CodeFormattingStage } from '../../../services/postprocessing/stages/CodeFormattingStage';
import { createTestContext } from '../helpers';

const stage = new CodeFormattingStage();

describe('CodeFormattingStage', () => {
  it('formats detected code', () => {
    const ctx = createTestContext(
      'void Run() {\nif (ready) {\nstart();\n}\nstop();\n}',
      'code'
    );
    const result = stage.process(ctx);
    expect(result.text).toBe(
      'void Run() {\n    if (ready) {\n        start();\n    }\n    stop();\n}'
    );
    expect(result.repairCount).toBeGreaterThan(0);
  });

  it('leaves plaintext untouched', () => {
    const ctx = createTestContext('The quick brown fox jumps over the lazy dog.', 'plaintext');
    const result = stage.process(ctx);
    expect(result.text).toBe(ctx.text);
    expect(result.repairCount).toBe(0);
  });

  it('leaves terminal output untouched', () => {
    const ctx = createTestContext('$ npm run build\n> building...\n', 'terminal');
    const result = stage.process(ctx);
    expect(result.text).toBe(ctx.text);
  });

  it('respects programmingCleanup setting', () => {
    const ctx = createTestContext('if (a) { b(); }', 'code');
    ctx.settings = { ...ctx.settings, programmingCleanup: false };
    const result = stage.process(ctx);
    expect(result.text).toBe(ctx.text);
  });

  it('uses block geometry to recover indentation', () => {
    const ctx = createTestContext(
      'function greet(name) {\nif (name) {\nconsole.log("hi", name);\n}\nreturn "ok";\n}',
      'code'
    );
    ctx.blocks = [
      { text: 'function greet(name) {', confidence: 95, bbox: { x: 100, y: 0, width: 230, height: 20 } },
      { text: 'if (name) {', confidence: 95, bbox: { x: 120, y: 20, width: 110, height: 20 } },
      { text: 'console.log("hi", name);', confidence: 95, bbox: { x: 140, y: 40, width: 250, height: 20 } },
      { text: '}', confidence: 95, bbox: { x: 120, y: 60, width: 10, height: 20 } },
      { text: 'return "ok";', confidence: 95, bbox: { x: 120, y: 80, width: 130, height: 20 } },
      { text: '}', confidence: 95, bbox: { x: 100, y: 100, width: 10, height: 20 } },
    ];
    const result = stage.process(ctx);
    expect(result.text).toBe(
      'function greet(name) {\n  if (name) {\n    console.log("hi", name);\n  }\n  return "ok";\n}'
    );
  });

  it('keeps blank lines and deep indentation from the picture', () => {
    const ctx = createTestContext(
      'function process(items) {\n\nconst out = [];\n\nfor (const item of items) {\nconsole.log("handling", item);\nout.push(process(item));\n}\n\nreturn out;\n}',
      'code'
    );
    ctx.blocks = [
      { text: 'function process(items) {', confidence: 95, bbox: { x: 100, y: 0, width: 250, height: 20 } },
      { text: 'const out = [];', confidence: 95, bbox: { x: 120, y: 20, width: 150, height: 20 } },
      { text: 'for (const item of items) {', confidence: 95, bbox: { x: 120, y: 40, width: 260, height: 20 } },
      { text: 'console.log("handling", item);', confidence: 95, bbox: { x: 140, y: 60, width: 310, height: 20 } },
      { text: 'out.push(process(item));', confidence: 95, bbox: { x: 140, y: 80, width: 240, height: 20 } },
      { text: '}', confidence: 95, bbox: { x: 120, y: 100, width: 10, height: 20 } },
      { text: 'return out;', confidence: 95, bbox: { x: 120, y: 120, width: 110, height: 20 } },
      { text: '}', confidence: 95, bbox: { x: 100, y: 140, width: 10, height: 20 } },
    ];
    const result = stage.process(ctx);
    expect(result.text).toBe(
      'function process(items) {\n\n  const out = [];\n\n  for (const item of items) {\n    console.log("handling", item);\n    out.push(process(item));\n  }\n\n  return out;\n}'
    );
  });
});
