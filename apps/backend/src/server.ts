import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { config } from './config.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { stakesRouter } from './routes/stakes.js';
import { withdrawalsRouter } from './routes/withdrawals.js';

export const app = express();

if (config.TRUST_PROXY === '1' || config.TRUST_PROXY === 'true') app.set('trust proxy', 1);

const configuredOrigins = config.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
const privateNetworkOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (configuredOrigins.includes(origin)) return callback(null, true);
    if (config.NODE_ENV !== 'production' && privateNetworkOrigin.test(origin)) return callback(null, true);
    return callback(new Error('CORS origin is not allowed'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser() as unknown as express.RequestHandler);
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }) as unknown as express.RequestHandler);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sollll-api' }));
app.use('/api/auth', authRouter);
app.use('/api', meRouter, stakesRouter, withdrawalsRouter, adminRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) return void res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  const message = err instanceof Error ? err.message : 'Unexpected server error';
  res.status(message.includes('not found') ? 404 : 500).json({ error: message });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.PORT, () => console.log(`SOL POS API listening on :${config.PORT}`));
}
