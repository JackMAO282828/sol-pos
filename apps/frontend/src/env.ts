function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function defaultApiBaseUrl() {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  const { protocol, hostname } = window.location;
  if (isLocalHost(hostname)) return `${protocol}//${hostname}:4000`;
  return window.location.origin;
}

function normalizeApiBaseUrl(value: string) {
  if (typeof window === 'undefined') return value.replace(/\/+$/, '');
  try {
    const url = new URL(value);
    if (window.location.protocol === 'https:' && url.protocol === 'http:' && !isLocalHost(url.hostname)) {
      url.protocol = 'https:';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return value.replace(/\/+$/, '');
  }
}

export const env = {
  apiBaseUrl: normalizeApiBaseUrl(defaultApiBaseUrl()),
  solanaRpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com',
  stakeReceiverAddress: import.meta.env.VITE_STAKE_RECEIVER_ADDRESS || '',
  telegramUrl: import.meta.env.VITE_TELEGRAM_URL || '',
  xUrl: import.meta.env.VITE_X_URL || ''
};
