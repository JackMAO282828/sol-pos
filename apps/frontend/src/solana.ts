import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

export function solToLamportsNumber(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid amount');
  return Math.round(amount * LAMPORTS_PER_SOL);
}

export function buildStakeTransaction(input: { from: PublicKey; to: string; amountSol: string }): Transaction {
  return new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: input.from,
      toPubkey: new PublicKey(input.to),
      lamports: solToLamportsNumber(input.amountSol)
    })
  );
}
