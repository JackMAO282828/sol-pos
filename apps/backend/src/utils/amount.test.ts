import { describe, expect, it } from 'vitest';
import { lamportsToSolString, solToLamports } from './amount.js';

describe('amount utilities', () => {
  it('converts SOL strings to lamports exactly', () => {
    expect(solToLamports('1').toString()).toBe('1000000000');
    expect(solToLamports('0.000000001').toString()).toBe('1');
    expect(solToLamports('12.3456789').toString()).toBe('12345678900');
  });

  it('formats lamports as SOL strings', () => {
    expect(lamportsToSolString(1n)).toBe('0.000000001');
    expect(lamportsToSolString(1_500_000_000n)).toBe('1.5');
  });

  it('rejects precision beyond lamports', () => {
    expect(() => solToLamports('0.0000000001')).toThrow('Invalid SOL amount');
  });
});
