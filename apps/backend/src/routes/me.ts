import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { isDatabaseUnavailable } from '../devStore.js';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../utils/async.js';
import { lamportsToSolString } from '../utils/amount.js';
import { calculateAccountBalance, getYieldSettingsBundle, REFERRAL_RATE } from '../utils/balance.js';

export const meRouter = Router();

meRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = req.user!;
  const [stakes, withdrawals, referrals] = await Promise.all([
    prisma.stake.findMany({ where: { userId: user.userId }, orderBy: { createdAt: 'desc' } }),
    prisma.withdrawal.findMany({ where: { userId: user.userId }, orderBy: { createdAt: 'desc' } }),
    prisma.user.findMany({ where: { referrerId: user.userId }, include: { stakes: true }, orderBy: { createdAt: 'desc' } })
  ]).catch((error) => {
    if (!isDatabaseUnavailable(error)) throw error;
    return [[], [], []];
  });
  const totalLamports = stakes.reduce((sum, stake) => sum + stake.lamports, 0n);
  const { settings, latest } = await getYieldSettingsBundle().catch((error) => {
    if (!isDatabaseUnavailable(error)) throw error;
    return { settings: [], latest: null };
  });
  const balance = calculateAccountBalance({ stakes, withdrawals, referrals, settings, latest });

  res.json({
    user: { wallet: user.wallet, isAdmin: user.isAdmin },
    totals: { stakedLamports: totalLamports.toString(), stakedSol: lamportsToSolString(totalLamports) },
    yield: balance.yieldSummary,
    community: {
      referralRate: REFERRAL_RATE,
      referralRatePercent: '10',
      referralCount: balance.referralRecords.length,
      referralDailyYieldLamports: balance.referralDailyLamports.toString(),
      referralDailyYieldSol: lamportsToSolString(balance.referralDailyLamports),
      referralTotalYieldLamports: balance.referralTotalLamports.toString(),
      referralTotalYieldSol: lamportsToSolString(balance.referralTotalLamports),
      combinedEarnedLamports: balance.earnedLamports.toString(),
      combinedEarnedSol: lamportsToSolString(balance.earnedLamports),
      lockedWithdrawalLamports: balance.lockedWithdrawalLamports.toString(),
      lockedWithdrawalSol: lamportsToSolString(balance.lockedWithdrawalLamports),
      combinedWithdrawableLamports: balance.withdrawableLamports.toString(),
      combinedWithdrawableSol: lamportsToSolString(balance.withdrawableLamports),
      records: balance.referralRecords
    },
    stakes: stakes.map((stake) => ({ ...stake, lamports: stake.lamports.toString(), sol: lamportsToSolString(stake.lamports), slot: stake.slot?.toString() ?? null })),
    withdrawals: withdrawals.map((withdrawal) => ({ ...withdrawal, lamports: withdrawal.lamports.toString(), sol: lamportsToSolString(withdrawal.lamports) }))
  });
}));
