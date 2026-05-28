import { WithdrawalStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../utils/async.js';
import { lamportsToSolString } from '../utils/amount.js';
import { calculateAccountBalance, getYieldSettingsBundle } from '../utils/balance.js';
import { formatShanghaiDate, startOfShanghaiDay } from '../utils/yield.js';

export const adminRouter = Router();
adminRouter.use('/admin', authenticate, requireAdmin);

adminRouter.get('/admin/users', asyncHandler(async (_req, res) => {
  const [{ settings, latest }, users] = await Promise.all([
    getYieldSettingsBundle(),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        stakes: true,
        withdrawals: true,
        referrals: { include: { stakes: true } },
        _count: { select: { stakes: true, withdrawals: true, referrals: true } }
      }
    })
  ]);
  res.json({
    users: users.map((user) => {
      const stakedLamports = user.stakes.reduce((sum, stake) => sum + stake.lamports, 0n);
      const balance = calculateAccountBalance({
        stakes: user.stakes,
        withdrawals: user.withdrawals,
        referrals: user.referrals,
        settings,
        latest
      });
      return {
        id: user.id,
        wallet: user.wallet,
        adminNote: user.adminNote,
        createdAt: user.createdAt,
        referrerId: user.referrerId,
        _count: user._count,
        totals: {
          stakedLamports: stakedLamports.toString(),
          stakedSol: lamportsToSolString(stakedLamports)
        },
        yield: balance.yieldSummary,
        community: {
          referralCount: balance.referralRecords.length,
          referralTotalYieldLamports: balance.referralTotalLamports.toString(),
          referralTotalYieldSol: lamportsToSolString(balance.referralTotalLamports)
        },
        withdrawals: {
          lockedLamports: balance.lockedWithdrawalLamports.toString(),
          lockedSol: lamportsToSolString(balance.lockedWithdrawalLamports),
          withdrawableLamports: balance.withdrawableLamports.toString(),
          withdrawableSol: lamportsToSolString(balance.withdrawableLamports),
          earnedLamports: balance.earnedLamports.toString(),
          earnedSol: lamportsToSolString(balance.earnedLamports)
        }
      };
    })
  });
}));

adminRouter.patch('/admin/users/:id/note', asyncHandler(async (req, res) => {
  const body = z.object({ adminNote: z.string().max(1000).optional().nullable() }).parse(req.body);
  const userId = String(req.params.id);
  const adminNote = body.adminNote?.trim() ? body.adminNote.trim() : null;
  const user = await prisma.user.update({
    where: { id: userId },
    data: { adminNote }
  }).catch(() => null);
  if (!user) return void res.status(404).json({ error: 'User not found' });
  await prisma.adminOperation.create({
    data: {
      adminWallet: req.user!.wallet,
      action: 'user_note_update',
      note: `Updated note for ${user.wallet}`
    }
  });
  res.json({ user: { id: user.id, wallet: user.wallet, adminNote: user.adminNote } });
}));

adminRouter.get('/admin/stakes', asyncHandler(async (_req, res) => {
  const stakes = await prisma.stake.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ stakes: stakes.map((stake) => ({ ...stake, lamports: stake.lamports.toString(), sol: lamportsToSolString(stake.lamports), slot: stake.slot?.toString() ?? null })) });
}));

adminRouter.get('/admin/withdrawals', asyncHandler(async (_req, res) => {
  const withdrawals = await prisma.withdrawal.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const userIds = [...new Set(withdrawals.map((withdrawal) => withdrawal.userId))];
  const [{ settings, latest }, users] = await Promise.all([
    getYieldSettingsBundle(),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      include: { stakes: true, withdrawals: true, referrals: { include: { stakes: true } } }
    })
  ]);
  const balancesByUserId = new Map(users.map((user) => [
    user.id,
    calculateAccountBalance({ stakes: user.stakes, withdrawals: user.withdrawals, referrals: user.referrals, settings, latest })
  ]));
  res.json({
    withdrawals: withdrawals.map((withdrawal) => {
      const balance = balancesByUserId.get(withdrawal.userId);
      return {
        ...withdrawal,
        lamports: withdrawal.lamports.toString(),
        sol: lamportsToSolString(withdrawal.lamports),
        userBalance: balance ? {
          earnedLamports: balance.earnedLamports.toString(),
          earnedSol: lamportsToSolString(balance.earnedLamports),
          lockedWithdrawalLamports: balance.lockedWithdrawalLamports.toString(),
          lockedWithdrawalSol: lamportsToSolString(balance.lockedWithdrawalLamports),
          withdrawableLamports: balance.withdrawableLamports.toString(),
          withdrawableSol: lamportsToSolString(balance.withdrawableLamports)
        } : null
      };
    })
  });
}));

adminRouter.get('/admin/yields', asyncHandler(async (_req, res) => {
  const yields = await prisma.yieldSetting.findMany({ orderBy: { date: 'desc' }, take: 30 });
  res.json({
    yields: yields.map((item) => ({
      id: item.id,
      date: formatShanghaiDate(item.date),
      dailyRate: item.dailyRate.toString(),
      dailyRatePercent: trimPercent(Number(item.dailyRate) * 100),
      adminWallet: item.adminWallet,
      updatedAt: item.updatedAt
    }))
  });
}));

adminRouter.put('/admin/yields/today', asyncHandler(async (req, res) => {
  const body = z.object({ dailyRatePercent: z.coerce.number().min(0).max(100) }).parse(req.body);
  const dailyRate = body.dailyRatePercent / 100;
  const date = startOfShanghaiDay(new Date());
  const setting = await prisma.yieldSetting.upsert({
    where: { date },
    create: { date, dailyRate, adminWallet: req.user!.wallet },
    update: { dailyRate, adminWallet: req.user!.wallet }
  });
  await prisma.adminOperation.create({
    data: {
      adminWallet: req.user!.wallet,
      action: 'yield_rate_update',
      note: `Set ${formatShanghaiDate(date)} daily rate to ${body.dailyRatePercent}%`
    }
  });
  res.json({
    yield: {
      id: setting.id,
      date: formatShanghaiDate(setting.date),
      dailyRate: setting.dailyRate.toString(),
      dailyRatePercent: trimPercent(Number(setting.dailyRate) * 100),
      adminWallet: setting.adminWallet,
      updatedAt: setting.updatedAt
    }
  });
}));

adminRouter.patch('/admin/withdrawals/:id', asyncHandler(async (req, res) => {
  const body = z.object({ status: z.nativeEnum(WithdrawalStatus), note: z.string().max(500).optional() }).parse(req.body);
  const withdrawalId = String(req.params.id);
  const current = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!current) return void res.status(404).json({ error: 'Withdrawal not found' });
  const updated = await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: body.status, note: body.note, reviewedBy: req.user!.wallet, reviewedAt: new Date() }
    });
    await tx.adminOperation.create({
      data: {
        adminWallet: req.user!.wallet,
        action: 'withdrawal_status_update',
        fromStatus: current.status,
        toStatus: body.status,
        note: body.note,
        withdrawalId: current.id
      }
    });
    return withdrawal;
  });
  res.json({ withdrawal: { ...updated, lamports: updated.lamports.toString(), sol: lamportsToSolString(updated.lamports) } });
}));

function trimPercent(value: number) {
  return value.toFixed(6).replace(/\.?0+$/, '');
}
