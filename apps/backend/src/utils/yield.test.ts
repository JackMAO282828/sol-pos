import { describe, expect, it } from 'vitest';
import { calculateYieldSummaryFromSettings, formatShanghaiDate, todayShanghai } from './yield.js';

const SOL = 1_000_000_000n;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

describe('yield calculation', () => {
  it('carries the latest configured daily rate forward until a newer rate exists', () => {
    const today = todayShanghai();
    const threeDaysAgo = addDays(today, -3);
    const yesterday = addDays(today, -1);

    const summary = calculateYieldSummaryFromSettings(
      [{ lamports: SOL, createdAt: threeDaysAgo }],
      [
        { date: threeDaysAgo, dailyRate: 0.01 },
        { date: yesterday, dailyRate: 0.02 }
      ],
      { date: yesterday, dailyRate: 0.02 }
    );

    expect(summary.totalYieldLamports).toBe('60000000');
    expect(summary.totalYieldSol).toBe('0.06');
    expect(summary.dailyYieldLamports).toBe('20000000');
    expect(summary.dailyYieldSol).toBe('0.02');
    expect(summary.latestYieldDate).toBe(formatShanghaiDate(yesterday));
  });
});
