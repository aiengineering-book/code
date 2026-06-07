/**
 * Tests for scan-duplication.ts — focused on the short-file filtering bug
 * that caused identical files with < 5 meaningful lines to be missed.
 *
 * Run: pnpm exec vitest run scan-duplication.test.ts
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ── helpers copied from scan-duplication.ts ──────────────────────────────────

function meaningfulLines(content: string): string[] {
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('*'));
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let matched = 0;
  for (const line of setA) if (setB.has(line)) matched++;
  const total = Math.max(setA.size, setB.size);
  return total === 0 ? 0 : matched / total;
}

const MIN_LINES = 5; // threshold in scan-duplication.ts walkDir

// ── mock file content ─────────────────────────────────────────────────────────

// The simple openai.ts that ch08/ch09 originally had — only 4 meaningful lines
const SIMPLE_OPENAI = `import OpenAI from 'openai';
import { env } from '../env.js';

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
export const DEFAULT_MODEL = 'gpt-4o';
`;

// A file with 6 meaningful lines — would NOT be skipped
const LONGER_OPENAI = `import OpenAI from 'openai';
import { env } from '../env.js';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 5 * 60 * 1000,
  maxRetries: 0,
});
export const DEFAULT_MODEL = 'gpt-4o';
`;

// ── tests ─────────────────────────────────────────────────────────────────────

describe('scan-duplication: short-file filter bug', () => {
  it('simple openai.ts has fewer than MIN_LINES meaningful lines → skipped', () => {
    const lines = meaningfulLines(SIMPLE_OPENAI);
    expect(lines.length).toBeLessThan(MIN_LINES);
  });

  it('simple openai.ts copies are 100% similar', () => {
    const a = meaningfulLines(SIMPLE_OPENAI);
    const b = meaningfulLines(SIMPLE_OPENAI);
    expect(jaccard(a, b)).toBe(1.0);
  });

  it('identical copies are missed because both are below MIN_LINES', () => {
    // Both ch08 and ch09 had the simple version: 4 meaningful lines < 5
    // scan-duplication skips them before comparison → 0 results
    const linesA = meaningfulLines(SIMPLE_OPENAI);
    const linesB = meaningfulLines(SIMPLE_OPENAI);
    const wouldBeSkipped =
      linesA.length < MIN_LINES || linesB.length < MIN_LINES;
    expect(wouldBeSkipped).toBe(true);
    // Yet they ARE 100% similar — the bug
    expect(jaccard(linesA, linesB)).toBe(1.0);
  });

  it('longer openai.ts has >= MIN_LINES → NOT skipped', () => {
    const lines = meaningfulLines(LONGER_OPENAI);
    expect(lines.length).toBeGreaterThanOrEqual(MIN_LINES);
  });

  it('fix suggestion: lowering threshold to 3 would catch the simple case', () => {
    const FIXED_MIN = 3;
    const lines = meaningfulLines(SIMPLE_OPENAI);
    expect(lines.length).toBeGreaterThanOrEqual(FIXED_MIN);
  });
});
