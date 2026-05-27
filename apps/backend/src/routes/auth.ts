import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { adminWallets, isProduction } from '../config.js';
import { getDevNonce, isDatabaseUnavailable, saveDevNonce, useDevNonce } from '../devStore.js';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../utils/async.js';
import { signSession, verifyWalletSignature } from '../utils/auth.js';

export const authRouter = Router();
const walletSchema = z.object({ wallet: z.string().min(32).max(64) });

authRouter.post('/nonce', asyncHandler(async (req, res) => {
  const { wallet } = walletSchema.parse(req.body);
  const nonce = nanoid(32);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const message = ['Sign in to SOL POS', '', `Wallet: ${wallet}`, `Nonce: ${nonce}`, `Expires: ${expiresAt.toISOString()}`].join('\n');

  try {
    await prisma.user.upsert({ where: { wallet }, create: { wallet }, update: {} });
    await prisma.loginNonce.create({ data: { wallet, nonce, message, expiresAt } });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    saveDevNonce({ wallet, nonce, message, expiresAt });
  }
  res.json({ nonce, message, expiresAt });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const body = walletSchema.extend({ nonce: z.string().min(10), signature: z.string().min(20), referrerWallet: z.string().min(32).max(64).optional() }).parse(req.body);
  let record = await prisma.loginNonce.findUnique({ where: { nonce: body.nonce } }).catch((error) => {
    if (!isDatabaseUnavailable(error)) throw error;
    return getDevNonce(body.nonce) ?? null;
  });
  if (!record || record.wallet !== body.wallet || record.usedAt || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'Nonce is invalid or expired' });
    return;
  }
  if (!verifyWalletSignature(body.wallet, record.message, body.signature)) {
    res.status(401).json({ error: 'Wallet signature is invalid' });
    return;
  }

  const user = await prisma.user.upsert({ where: { wallet: body.wallet }, create: { wallet: body.wallet }, update: {} }).catch((error) => {
    if (!isDatabaseUnavailable(error)) throw error;
    return { id: `dev-${body.wallet}`, wallet: body.wallet, referrerId: null };
  });
  if (body.referrerWallet && body.referrerWallet !== body.wallet && !user.referrerId) {
    await Promise.all([
      prisma.user.findUnique({ where: { wallet: body.referrerWallet } }),
      prisma.stake.count({ where: { userId: user.id } }),
      prisma.withdrawal.count({ where: { userId: user.id } })
    ]).then(async ([referrer, stakeCount, withdrawalCount]) => {
      if (referrer && referrer.id !== user.id && stakeCount === 0 && withdrawalCount === 0) {
        await prisma.user.update({ where: { id: user.id }, data: { referrerId: referrer.id } });
      }
    }).catch((error) => {
      if (!isDatabaseUnavailable(error)) throw error;
    });
  }
  await prisma.loginNonce.update({ where: { nonce: body.nonce }, data: { usedAt: new Date() } }).catch((error) => {
    if (!isDatabaseUnavailable(error)) throw error;
    useDevNonce(body.nonce);
  });
  const token = signSession({ userId: user.id, wallet: user.wallet, isAdmin: adminWallets.has(user.wallet) });
  res.cookie('session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ token, user: { wallet: user.wallet, isAdmin: adminWallets.has(user.wallet) } });
}));
