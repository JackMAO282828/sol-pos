import { env } from './env';

export type Stake = {
  id: string;
  signature: string;
  lamports: string;
  sol: string;
  receiver: string;
  confirmedAt: string | null;
  createdAt: string;
};

export type Withdrawal = {
  id: string;
  destination: string;
  lamports: string;
  sol: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  note?: string | null;
  createdAt: string;
  updatedAt?: string;
  wallet?: string;
};

export type MeResponse = {
  user: { wallet: string; isAdmin: boolean };
  totals: { stakedLamports: string; stakedSol: string };
  yield: {
    currentDailyRate: number;
    currentDailyRatePercent: string;
    dailyYieldLamports: string;
    dailyYieldSol: string;
    totalYieldLamports: string;
    totalYieldSol: string;
    latestYieldDate: string | null;
    rateUpdateTime: string;
    rateTimezone: string;
    rateCarryForward: boolean;
  };
  community: {
    referralRate: number;
    referralRatePercent: string;
    referralCount: number;
    referralDailyYieldLamports: string;
    referralDailyYieldSol: string;
    referralTotalYieldLamports: string;
    referralTotalYieldSol: string;
    combinedWithdrawableLamports: string;
    combinedWithdrawableSol: string;
    records: Array<{
      wallet: string;
      createdAt: string;
      hashrateSol: string;
      dailyReferralSol: string;
      totalReferralSol: string;
    }>;
  };
  stakes: Stake[];
  withdrawals: Withdrawal[];
};

export type YieldSetting = {
  id: string;
  date: string;
  dailyRate: string;
  dailyRatePercent: string;
  adminWallet: string;
  updatedAt: string;
};

export type AdminUser = {
  id: string;
  wallet: string;
  createdAt: string;
  _count: { stakes: number; withdrawals: number };
};

let token = localStorage.getItem('sollll_token') || '';

export function setToken(nextToken: string) {
  token = nextToken;
  localStorage.setItem('sollll_token', nextToken);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    },
    credentials: 'include'
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'Request failed');
  return json as T;
}

export const api = {
  nonce(wallet: string) {
    return request<{ nonce: string; message: string; expiresAt: string }>('/api/auth/nonce', {
      method: 'POST',
      body: JSON.stringify({ wallet })
    });
  },
  login(input: { wallet: string; nonce: string; signature: string; referrerWallet?: string }) {
    return request<{ token: string; user: { wallet: string; isAdmin: boolean } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  me: () => request<MeResponse>('/api/me'),
  verifyStake(input: { signature: string; amountSol: string }) {
    return request<{ stake: Stake }>('/api/stakes/verify', { method: 'POST', body: JSON.stringify(input) });
  },
  createWithdrawal(input: { amountSol: string; destination: string }) {
    return request<{ withdrawal: Withdrawal }>('/api/withdrawals', { method: 'POST', body: JSON.stringify(input) });
  },
  adminUsers: () => request<{ users: AdminUser[] }>('/api/admin/users'),
  adminStakes: () => request<{ stakes: Stake[] }>('/api/admin/stakes'),
  adminWithdrawals: () => request<{ withdrawals: Withdrawal[] }>('/api/admin/withdrawals'),
  adminYields: () => request<{ yields: YieldSetting[] }>('/api/admin/yields'),
  updateTodayYield(input: { dailyRatePercent: number }) {
    return request<{ yield: YieldSetting }>('/api/admin/yields/today', { method: 'PUT', body: JSON.stringify(input) });
  },
  updateWithdrawal(id: string, input: { status: Withdrawal['status']; note?: string }) {
    return request<{ withdrawal: Withdrawal }>(`/api/admin/withdrawals/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  }
};
