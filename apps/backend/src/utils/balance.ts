import type { Stake, Withdrawal, WithdrawalStatus, YieldSetting } from '@prisma/client';
import { prisma } from '../prisma.js';
import { lamportsToSolString } from './amount.js';
import { calculateYieldSummaryFromSettings } from './yield.js';

export const REFERRAL_RATE = 0.1;

const BALANCE_LOCKING_WITHDRAWAL_STATUSES = new Set<WithdrawalStatus>(['pending', 'approved', 'paid']);

type YieldSettingInput = Pick<YieldSetting, 'date' | 'dailyRate'>;
type StakeInput = Pick<Stake, 'lamports' | 'createdAt'>;
type WithdrawalInput = Pick<Withdrawal, 'lamports' | 'status'>;
type ReferralInput = {
  wallet: string;
  createdAt: Date;
  stakes: StakeInput[];
};

export async function getYieldSettingsBundle() {
  const [settings, latest] = await Promise.all([
    prisma.yieldSetting.findMany({ orderBy: { date: 'asc' } }),
    prisma.yieldSetting.findFirst({ orderBy: { date: 'desc' } })
  ]);
  return { settings, latest };
}

export function calculateAccountBalance(input: {
  stakes: StakeInput[];
  withdrawals: WithdrawalInput[];
  referrals?: ReferralInput[];
  settings: YieldSettingInput[];
  latest?: YieldSettingInput | null;
}) {
  const yieldSummary = calculateYieldSummaryFromSettings(input.stakes, input.settings, input.latest);
  const referralRecords = (input.referrals ?? []).map((referral) => {
    const summary = calculateYieldSummaryFromSettings(referral.stakes, input.settings, input.latest);
    const daily = BigInt(summary.dailyYieldLamports) / 10n;
    const total = BigInt(summary.totalYieldLamports) / 10n;
    const hashrate = referral.stakes.reduce((sum, stake) => sum + stake.lamports, 0n);
    return {
      wallet: referral.wallet,
      createdAt: referral.createdAt,
      hashrateLamports: hashrate.toString(),
      hashrateSol: lamportsToSolString(hashrate),
      dailyReferralLamports: daily.toString(),
      dailyReferralSol: lamportsToSolString(daily),
      totalReferralLamports: total.toString(),
      totalReferralSol: lamportsToSolString(total)
    };
  });
  const referralDailyLamports = referralRecords.reduce((sum, record) => sum + BigInt(record.dailyReferralLamports), 0n);
  const referralTotalLamports = referralRecords.reduce((sum, record) => sum + BigInt(record.totalReferralLamports), 0n);
  const earnedLamports = BigInt(yieldSummary.totalYieldLamports) + referralTotalLamports;
  const lockedWithdrawalLamports = input.withdrawals.reduce((sum, withdrawal) => {
    if (!BALANCE_LOCKING_WITHDRAWAL_STATUSES.has(withdrawal.status)) return sum;
    return sum + withdrawal.lamports;
  }, 0n);
  const withdrawableLamports = earnedLamports > lockedWithdrawalLamports ? earnedLamports - lockedWithdrawalLamports : 0n;

  return {
    yieldSummary,
    referralRecords,
    referralDailyLamports,
    referralTotalLamports,
    earnedLamports,
    lockedWithdrawalLamports,
    withdrawableLamports
  };
}
