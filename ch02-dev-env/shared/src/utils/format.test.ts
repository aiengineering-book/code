// #book ch02-format-test
// ch02-dev-env/shared/src/utils/format.test.ts
import { describe, expect, it } from 'vitest';
import { formatDate } from '../index.js';

describe('formatDate', () => {
  it('should format a valid date', () => {
    const date = new Date('2025-01-15T10:30:00.000Z');
    const result = formatDate(date);
    // Verify year and month are present
    expect(result).toContain('2025');
    expect(result).toContain('01');
  });

  it('should not throw on an invalid date', () => {
    const date = new Date('invalid');
    expect(() => formatDate(date)).not.toThrow();
  });
});
// #endbook
