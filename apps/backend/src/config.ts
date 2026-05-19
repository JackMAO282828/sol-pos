import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default('postgresql://sollll:sollll@localhost:5432/sollll?schema=public'),
  JWT_SECRET: z.string().min(16).default('dev-secret-change-this-before-production'),
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),
  STAKE_RECEIVER_ADDRESS: z.string().min(1).default('11111111111111111111111111111111'),
  ADMIN_WALLETS: z.string().default(''),
  DEFAULT_DAILY_YIELD_RATE: z.coerce.number().min(0).default(0.003),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.string().default('0'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development')
});

export const config = envSchema.parse(process.env);
export const adminWallets = new Set(config.ADMIN_WALLETS.split(',').map((wallet) => wallet.trim()).filter(Boolean));
export const isProduction = config.NODE_ENV === 'production';
