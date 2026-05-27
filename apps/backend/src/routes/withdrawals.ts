import { PublicKey } from '@solana/web3.js';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../utils/async.js';
import { lamportsToSolString, solToLamports } from '../utils/amount.js';
import { calculateAccountBalance, getYieldSettingsBundle } from '../utils/balance.js';

export const withdrawalsRouter = Router();
const MIN_WITHDRAWAL_LAMPORTS = 1_000_000_000n;

withdrawalsRouter.post('/withdrawals', authenticate, asyncHandler(async (req, res) => {
  const body = z.object({ amountSol: z.string().min(1), destination: z.string().min(32).max(64) }).parse(req.body);
  const lamports = solToLamports(body.amountSol);
  if (lamports < MIN_WITHDRAWAL_LAMPORTS) return void res.status(400).json({ error: 'Minimum withdrawal is 1 SOL' });
  try {
    new PublicKey(body.destination);
  } catch {
    return void res.status(400).json({ error: 'Destination wallet is invalid' });
  }
  const [{ settings, latest }, stakes, withdrawals, referrals] = await Promise.all([
    getYieldSettingsBundle(),
    prisma.stake.findMany({ where: { userId: req.user!.userId } }),
    prisma.withdrawal.findMany({ where: { userId: req.user!.userId } }),
    prisma.user.findMany({ where: { referrerId: req.user!.userId }, include: { stakes: true } })
  ]);
  const balance = calculateAccountBalance({ stakes, withdrawals, referrals, settings, latest });
  if (lamports > balance.withdrawableLamports) {
    return void res.status(400).json({
      error: `Insufficient withdrawable balance. Available: ${lamportsToSolString(balance.withdrawableLamports)} SOL`
    });
  }
  const withdrawal = await prisma.withdrawal.create({
    data: { userId: req.user!.userId, wallet: req.user!.wallet, destination: body.destination, lamports }
  });
  res.status(201).json({ withdrawal: { ...withdrawal, lamports: withdrawal.lamports.toString(), sol: lamportsToSolString(withdrawal.lamports) } });
}));
