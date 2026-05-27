import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

const LAMPORTS_PER_SOL_BIGINT = BigInt(LAMPORTS_PER_SOL);

export function solToLamports(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,9})?$/.test(trimmed)) throw new Error('Invalid SOL amount');
  const [whole, fractional = ''] = trimmed.split('.');
  const lamports = BigInt(whole) * LAMPORTS_PER_SOL_BIGINT + BigInt(fractional.padEnd(9, '0'));
  if (lamports <= 0n) throw new Error('Invalid SOL amount');
  return lamports;
}

export function buildStakeTransaction(input: { from: PublicKey; to: string; amountSol: string }): Transaction {
  return new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: input.from,
      toPubkey: new PublicKey(input.to),
      lamports: solToLamports(input.amountSol)
    })
  );
}
