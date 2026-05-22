import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../utils/async.js';
import { lamportsToSolString, solToLamports } from '../utils/amount.js';
import { verifyStakeTransfer } from '../utils/solana.js';

export const stakesRouter = Router();
const MIN_HASHRATE_PURCHASE_LAMPORTS = 1_000_000_000n;

stakesRouter.get('/stakes', authenticate, asyncHandler(async (req, res) => {
  const stakes = await prisma.stake.findMany({ where: { userId: req.user!.userId }, orderBy: { createdAt: 'desc' } });
  res.json({ stakes: stakes.map((stake) => ({ ...stake, lamports: stake.lamports.toString(), sol: lamportsToSolString(stake.lamports), slot: stake.slot?.toString() ?? null })) });
}));

stakesRouter.post('/stakes/verify', authenticate, asyncHandler(async (req, res) => {
  const body = z.object({ signature: z.string().min(20), amountSol: z.string().min(1) }).parse(req.body);
  const expectedLamports = solToLamports(body.amountSol);
  if (expectedLamports < MIN_HASHRATE_PURCHASE_LAMPORTS) return void res.status(400).json({ error: 'Minimum hashrate purchase is 1 SOL' });
  const existing = await prisma.stake.findUnique({ where: { signature: body.signature } });
  if (existing) return void res.status(409).json({ error: 'Purchase transaction was already recorded' });
  const verified = await verifyStakeTransfer({ signature: body.signature, sender: req.user!.wallet, expectedLamports });
  const stake = await prisma.stake.create({
    data: {
      userId: req.user!.userId,
      wallet: req.user!.wallet,
      signature: verified.signature,
      lamports: expectedLamports,
      receiver: verified.receiver,
      slot: verified.slot,
      confirmedAt: verified.confirmedAt
    }
  });
  res.status(201).json({ stake: { ...stake, lamports: stake.lamports.toString(), sol: lamportsToSolString(stake.lamports), slot: stake.slot?.toString() ?? null } });
}));
