export const LAMPORTS_PER_SOL_BIGINT = 1_000_000_000n;

export function solToLamports(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,9})?$/.test(trimmed)) throw new Error('Invalid SOL amount');
  const [whole, fractional = ''] = trimmed.split('.');
  return BigInt(whole) * LAMPORTS_PER_SOL_BIGINT + BigInt(fractional.padEnd(9, '0'));
}

export function lamportsToSolString(lamports: bigint): string {
  const whole = lamports / LAMPORTS_PER_SOL_BIGINT;
  const fractional = lamports % LAMPORTS_PER_SOL_BIGINT;
  const suffix = fractional.toString().padStart(9, '0').replace(/0+$/, '');
  return suffix ? `${whole}.${suffix}` : whole.toString();
}
