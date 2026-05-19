import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { isDatabaseUnavailable } from '../devStore.js';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../utils/async.js';
import { lamportsToSolString } from '../utils/amount.js';
import { calculateYieldSummary } from '../utils/yield.js';

export const meRouter = Router();
const REFERRAL_RATE = 0.1;

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
  const yieldSummary = await calculateYieldSummary(stakes).catch((error) => {
    if (!isDatabaseUnavailable(error)) throw error;
    return {
      currentDailyRate: 0.003,
      currentDailyRatePercent: '0.3',
      dailyYieldLamports: '0',
      dailyYieldSol: '0',
      totalYieldLamports: '0',
      totalYieldSol: '0',
      latestYieldDate: null,
      rateUpdateTime: '23:59',
      rateTimezone: 'Asia/Shanghai',
      rateCarryForward: true
    };
  });
  const referralRecords = await Promise.all(referrals.map(async (referral) => {
    const summary = await calculateYieldSummary(referral.stakes);
    const daily = BigInt(Math.floor(Number(summary.dailyYieldLamports) * REFERRAL_RATE));
    const total = BigInt(Math.floor(Number(summary.totalYieldLamports) * REFERRAL_RATE));
    const hashrate = referral.stakes.reduce((sum, stake) => sum + stake.lamports, 0n);
    return {
      wallet: referral.wallet,
      createdAt: referral.createdAt,
      hashrateSol: lamportsToSolString(hashrate),
      dailyReferralSol: lamportsToSolString(daily),
      totalReferralSol: lamportsToSolString(total)
    };
  })).catch((error) => {
    if (!isDatabaseUnavailable(error)) throw error;
    return [];
  });
  const referralDailyLamports = referralRecords.reduce((sum, record) => sum + BigInt(Math.floor(Number(record.dailyReferralSol) * 1_000_000_000)), 0n);
  const referralTotalLamports = referralRecords.reduce((sum, record) => sum + BigInt(Math.floor(Number(record.totalReferralSol) * 1_000_000_000)), 0n);
  const combinedTotalLamports = BigInt(yieldSummary.totalYieldLamports) + referralTotalLamports;

  res.json({
    user: { wallet: user.wallet, isAdmin: user.isAdmin },
    totals: { stakedLamports: totalLamports.toString(), stakedSol: lamportsToSolString(totalLamports) },
    yield: yieldSummary,
    community: {
      referralRate: REFERRAL_RATE,
      referralRatePercent: '10',
      referralCount: referralRecords.length,
      referralDailyYieldLamports: referralDailyLamports.toString(),
      referralDailyYieldSol: lamportsToSolString(referralDailyLamports),
      referralTotalYieldLamports: referralTotalLamports.toString(),
      referralTotalYieldSol: lamportsToSolString(referralTotalLamports),
      combinedWithdrawableLamports: combinedTotalLamports.toString(),
      combinedWithdrawableSol: lamportsToSolString(combinedTotalLamports),
      records: referralRecords
    },
    stakes: stakes.map((stake) => ({ ...stake, lamports: stake.lamports.toString(), sol: lamportsToSolString(stake.lamports), slot: stake.slot?.toString() ?? null })),
    withdrawals: withdrawals.map((withdrawal) => ({ ...withdrawal, lamports: withdrawal.lamports.toString(), sol: lamportsToSolString(withdrawal.lamports) }))
  });
}));
