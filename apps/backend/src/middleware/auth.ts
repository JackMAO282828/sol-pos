import type { NextFunction, Response } from 'express';
import { adminWallets } from '../config.js';
import type { AuthedRequest } from '../types.js';
import { verifySession } from '../utils/auth.js';

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.get('authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const cookie = typeof req.cookies?.session === 'string' ? req.cookies.session : undefined;
  const token = bearer ?? cookie;
  if (!token) return void res.status(401).json({ error: 'Authentication required' });

  const session = verifySession(token);
  if (!session) return void res.status(401).json({ error: 'Invalid session' });
  req.user = { ...session, isAdmin: session.isAdmin || adminWallets.has(session.wallet) };
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) return void res.status(403).json({ error: 'Admin wallet required' });
  next();
}
