import { describe, it, expect } from 'vitest';
import { Pipeline, createContext } from '../../services/postprocessing/Pipeline';
import type { PostProcessingSettings } from '../../services/postprocessing/types';

const SETTINGS: PostProcessingSettings = {
  enabled: true,
  smartCleanup: true,
  programmingCleanup: true,
  markdownCleanup: true,
  terminalCleanup: true,
  debugMode: false,
  confidenceThreshold: 60,
};

interface BenchmarkCase {
  name: string;
  input: string;
  expected: string;
  type: string;
  minimumImprovement?: number;
}

const BENCHMARKS: BenchmarkCase[] = [
  {
    name: 'console.log repair',
    input: 'console . log("hello world")',
    expected: 'console.log("hello world")',
    type: 'code',
  },
  {
    name: 'URL recovery',
    input: 'Visit https: //example.com for more',
    expected: 'Visit https://example.com for more',
    type: 'plaintext',
  },
  {
    name: 'HTTP status code',
    input: 'Server returned 4O4',
    expected: 'Server returned 404',
    type: 'plaintext',
  },
  {
    name: 'arrow function',
    input: 'const add = (a, b) = > a + b',
    expected: 'const add = (a, b) => a + b',
    type: 'code',
  },
  {
    name: 'strict equality',
    input: 'if (x = = = y) return true',
    expected: 'if (x === y) return true',
    type: 'code',
  },
  {
    name: 'email address',
    input: 'Contact us at hello @ example.com',
    expected: 'Contact us at hello@example.com',
    type: 'plaintext',
  },
  {
    name: 'file path unix',
    input: '/ usr / local / bin',
    expected: '/usr/local/bin',
    type: 'plaintext',
  },
  {
    name: 'markdown header',
    input: '#Title\n##Subtitle',
    expected: '# Title\n## Subtitle',
    type: 'markdown',
  },
  {
    name: 'while loop',
    input: 'whiIe (true) { count++; }',
    expected: 'while (true) { count++; }',
    type: 'code',
  },
  {
    name: 'version number O fix',
    input: 'version: 1.2.O',
    expected: 'version: 1.2.0',
    type: 'plaintext',
  },
  {
    name: 'string with quotes',
    input: "name: \u2018John\u2019",
    expected: "name: 'John'",
    type: 'plaintext',
  },
  {
    name: 'not-equal operator',
    input: 'x ! = null',
    expected: 'x != null',
    type: 'code',
  },
  {
    name: 'greater-or-equal',
    input: 'x > = 10',
    expected: 'x >= 10',
    type: 'code',
  },
  {
    name: 'AND operator',
    input: 'x & & y',
    expected: 'x && y',
    type: 'code',
  },
  {
    name: 'split method call',
    input: 'foo.\nbar()',
    expected: 'foo.bar()',
    type: 'code',
  },
  {
    name: 'import from split',
    input: 'import React\nfrom "react"',
    expected: 'import React from "react"',
    type: 'code',
  },
  {
    name: 'trailing whitespace',
    input: 'hello   \nworld  \n',
    expected: 'hello\nworld\n',
    type: 'plaintext',
  },
  {
    name: 'CRLF to LF',
    input: 'line1\r\nline2\r\n',
    expected: 'line1\nline2\n',
    type: 'plaintext',
  },
];

describe('Benchmark: Post-Processing Accuracy', () => {
  let totalBenchmarks = 0;
  let passedBenchmarks = 0;
  let totalInputChars = 0;
  let totalErrorsBefore = 0;
  let totalErrorsAfter = 0;

  const pipeline = new Pipeline(SETTINGS);

  for (const bench of BENCHMARKS) {
    it(bench.name, () => {
      totalBenchmarks++;

      totalInputChars += bench.input.length;

      let errorsBefore = 0;
      for (let i = 0; i < Math.min(bench.input.length, bench.expected.length); i++) {
        if (bench.input[i] !== bench.expected[i]) errorsBefore++;
      }
      errorsBefore += Math.abs(bench.input.length - bench.expected.length);
      totalErrorsBefore += errorsBefore;

      const ctx = createContext(bench.input, 80, [], { ...SETTINGS });
      const result = pipeline.process(ctx);
      const output = result.text.trimEnd() + (bench.expected.endsWith('\n') ? '\n' : '');

      let errorsAfter = 0;
      for (let i = 0; i < Math.min(output.length, bench.expected.length); i++) {
        if (output[i] !== bench.expected[i]) errorsAfter++;
      }
      errorsAfter += Math.abs(output.length - bench.expected.length);
      totalErrorsAfter += errorsAfter;

      if (bench.minimumImprovement !== undefined) {
        const improvement = errorsBefore > 0
          ? ((errorsBefore - errorsAfter) / errorsBefore) * 100
          : 100;
        expect(improvement).toBeGreaterThanOrEqual(bench.minimumImprovement);
      }

      const tolerance = 2;
      const diff = Math.abs(output.length - bench.expected.length);
      expect(diff).toBeLessThanOrEqual(tolerance);

      if (errorsAfter <= tolerance) {
        passedBenchmarks++;
      }
    });
  }

  it('benchmark summary', () => {
    const accuracyBefore = totalBenchmarks > 0
      ? ((totalInputChars - totalErrorsBefore) / totalInputChars) * 100
      : 0;
    const accuracyAfter = totalBenchmarks > 0
      ? ((totalInputChars - totalErrorsAfter) / totalInputChars) * 100
      : 0;

    console.log(`\n=== Benchmark Summary ===`);
    console.log(`Total cases: ${totalBenchmarks}`);
    console.log(`Passed: ${passedBenchmarks}/${totalBenchmarks} (${((passedBenchmarks / totalBenchmarks) * 100).toFixed(1)}%)`);
    console.log(`Errors before: ${totalErrorsBefore}`);
    console.log(`Errors after: ${totalErrorsAfter}`);
    console.log(`Raw accuracy: ${accuracyBefore.toFixed(1)}%`);
    console.log(`Processed accuracy: ${accuracyAfter.toFixed(1)}%`);
    console.log(`Improvement: ${(accuracyAfter - accuracyBefore).toFixed(1)} percentage points`);

    expect(accuracyAfter).toBeGreaterThan(accuracyBefore);
  });
});
