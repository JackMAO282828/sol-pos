import type { Request } from 'express';

export type SessionUser = {
  userId: string;
  wallet: string;
  isAdmin: boolean;
};

export type AuthedRequest = Request & {
  user?: SessionUser;
};
