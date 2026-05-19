import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import { config } from '../config.js';
import type { SessionUser } from '../types.js';

export function verifyWalletSignature(wallet: string, message: string, signature: string): boolean {
  try {
    const publicKey = new PublicKey(wallet);
    return nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(signature), publicKey.toBytes());
  } catch {
    return false;
  }
}

export function signSession(payload: SessionUser): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });
}

export function verifySession(token: string): SessionUser | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as SessionUser;
    if (!decoded.userId || !decoded.wallet) return null;
    return { userId: decoded.userId, wallet: decoded.wallet, isAdmin: Boolean(decoded.isAdmin) };
  } catch {
    return null;
  }
}
