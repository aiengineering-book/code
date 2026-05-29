// #book ch02-format-test
import { describe, expect, it } from 'vitest';
// ch02-dev-env/shared/src/utils/format.test.ts
import { formatDate } from '../index.js';

describe('formatDate', () => {
  it('应该格式化日期为中文格式', () => {
    const date = new Date('2025-01-15T10:30:00.000Z');
    const result = formatDate(date);
    // 验证包含年月日
    expect(result).toContain('2025');
    expect(result).toContain('01');
  });

  it('处理无效日期时不应崩溃', () => {
    const date = new Date('invalid');
    expect(() => formatDate(date)).not.toThrow();
  });
});
// #endbook
