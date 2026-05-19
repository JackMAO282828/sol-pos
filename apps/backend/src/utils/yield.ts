import type { Stake, YieldSetting } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../prisma.js';
import { lamportsToSolString } from './amount.js';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function startOfShanghaiDay(date: Date) {
  const shanghai = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  return new Date(Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth(), shanghai.getUTCDate()) - SHANGHAI_OFFSET_MS);
}

export function todayShanghai() {
  return startOfShanghaiDay(new Date());
}

export function rateToNumber(rate: unknown) {
  return Number(rate?.toString?.() ?? rate ?? 0);
}

export async function getLatestYieldSetting() {
  return prisma.yieldSetting.findFirst({ orderBy: { date: 'desc' } });
}

export async function calculateYieldSummary(stakes: Stake[]) {
  const latest = await getLatestYieldSetting();
  const settings = await prisma.yieldSetting.findMany({ orderBy: { date: 'asc' } });
  return calculateYieldSummaryFromSettings(stakes, settings, latest);
}

export function calculateYieldSummaryFromSettings(stakes: Pick<Stake, 'lamports' | 'createdAt'>[], settings: Pick<YieldSetting, 'date' | 'dailyRate'>[], latest?: Pick<YieldSetting, 'date' | 'dailyRate'> | null) {
  let totalYieldLamports = 0n;
  const today = todayShanghai();
  const defaultRate = config.DEFAULT_DAILY_YIELD_RATE;

  for (const stake of stakes) {
    const stakeDay = startOfShanghaiDay(stake.createdAt);
    if (settings.length === 0) {
      const activeDays = Math.max(0, Math.floor((today.getTime() - stakeDay.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      totalYieldLamports += BigInt(Math.floor(Number(stake.lamports) * defaultRate * activeDays));
    } else {
      for (const setting of settings) {
        const settingDay = startOfShanghaiDay(setting.date);
        if (settingDay < stakeDay || settingDay > today) continue;
        const rate = rateToNumber(setting.dailyRate);
        totalYieldLamports += BigInt(Math.floor(Number(stake.lamports) * rate));
      }
    }
  }

  const latestRate = latest ? rateToNumber(latest.dailyRate) : defaultRate;
  const totalHashrateLamports = stakes.reduce((sum, stake) => sum + stake.lamports, 0n);
  const dailyYieldLamports = BigInt(Math.floor(Number(totalHashrateLamports) * latestRate));

  return {
    currentDailyRate: latestRate,
    currentDailyRatePercent: trimNumber(latestRate * 100),
    dailyYieldLamports: dailyYieldLamports.toString(),
    dailyYieldSol: lamportsToSolString(dailyYieldLamports),
    totalYieldLamports: totalYieldLamports.toString(),
    totalYieldSol: lamportsToSolString(totalYieldLamports),
    latestYieldDate: latest ? formatShanghaiDate(latest.date) : formatShanghaiDate(today),
    rateUpdateTime: '23:59',
    rateTimezone: 'Asia/Shanghai',
    rateCarryForward: true
  };
}

function trimNumber(value: number) {
  return value.toFixed(6).replace(/\.?0+$/, '');
}

export function formatShanghaiDate(date: Date) {
  const shanghai = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  return shanghai.toISOString().slice(0, 10);
}
