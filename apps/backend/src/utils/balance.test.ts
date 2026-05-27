import { describe, expect, it } from 'vitest';
import { calculateAccountBalance } from './balance.js';
import { todayShanghai } from './yield.js';

describe('account balance calculation', () => {
  it('keeps withdrawable balance at zero when an account has no earnings', () => {
    const balance = calculateAccountBalance({
      stakes: [],
      withdrawals: [{ lamports: 1_000_000_000n, status: 'pending' }],
      referrals: [],
      settings: [],
      latest: null
    });

    expect(balance.earnedLamports).toBe(0n);
    expect(balance.withdrawableLamports).toBe(0n);
  });

  it('subtracts pending and paid withdrawals from earned balance', () => {
    const today = todayShanghai();
    const balance = calculateAccountBalance({
      stakes: [{ lamports: 1_000_000_000n, createdAt: today }],
      withdrawals: [
        { lamports: 100_000_000n, status: 'pending' },
        { lamports: 200_000_000n, status: 'paid' },
        { lamports: 50_000_000n, status: 'rejected' }
      ],
      referrals: [],
      settings: [{ date: today, dailyRate: 0.5 }],
      latest: { date: today, dailyRate: 0.5 }
    });

    expect(balance.earnedLamports).toBe(500_000_000n);
    expect(balance.lockedWithdrawalLamports).toBe(300_000_000n);
    expect(balance.withdrawableLamports).toBe(200_000_000n);
  });
});
