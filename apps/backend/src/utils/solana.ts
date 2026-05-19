import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js';
import { config } from '../config.js';

export const connection = new Connection(config.SOLANA_RPC_URL, 'confirmed');

export async function verifyStakeTransfer(params: { signature: string; sender: string; expectedLamports: bigint }) {
  const receiver = new PublicKey(config.STAKE_RECEIVER_ADDRESS);
  const sender = new PublicKey(params.sender);
  const tx = await connection.getParsedTransaction(params.signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0
  });

  if (!tx) throw new Error('Transaction was not found or is not confirmed yet');
  if (tx.meta?.err) throw new Error('Transaction failed on-chain');

  let matchedLamports = 0n;
  for (const instruction of tx.transaction.message.instructions) {
    if (!('parsed' in instruction)) continue;
    if (instruction.programId.toBase58() !== SystemProgram.programId.toBase58()) continue;
    if (instruction.parsed?.type !== 'transfer') continue;
    const info = instruction.parsed.info as { source?: string; destination?: string; lamports?: number; sol?: number };
    const lamports = info.lamports ?? (typeof info.sol === 'number' ? Math.round(info.sol * LAMPORTS_PER_SOL) : 0);
    if (info.source === sender.toBase58() && info.destination === receiver.toBase58()) matchedLamports += BigInt(lamports);
  }

  if (matchedLamports < params.expectedLamports) throw new Error('Transaction does not contain the expected SOL purchase transfer');

  return {
    signature: params.signature,
    lamports: matchedLamports,
    receiver: receiver.toBase58(),
    sender: sender.toBase58(),
    slot: BigInt(tx.slot),
    confirmedAt: tx.blockTime ? new Date(tx.blockTime * 1000) : null
  };
}
