import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { describe, expect, it } from 'vitest';
import { verifyWalletSignature } from './auth.js';

describe('wallet signature verification', () => {
  it('accepts a valid Solana wallet signature', () => {
    const keypair = Keypair.generate();
    const message = 'Sign in to SOL POS';
    const signature = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
    expect(verifyWalletSignature(keypair.publicKey.toBase58(), message, bs58.encode(signature))).toBe(true);
  });

  it('rejects a signature for a different message', () => {
    const keypair = Keypair.generate();
    const signature = nacl.sign.detached(new TextEncoder().encode('one message'), keypair.secretKey);
    expect(verifyWalletSignature(keypair.publicKey.toBase58(), 'another message', bs58.encode(signature))).toBe(false);
  });
});
