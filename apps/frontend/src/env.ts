function defaultApiBaseUrl() {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000`;
}

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl(),
  solanaRpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  stakeReceiverAddress: import.meta.env.VITE_STAKE_RECEIVER_ADDRESS || '',
  telegramUrl: import.meta.env.VITE_TELEGRAM_URL || '',
  xUrl: import.meta.env.VITE_X_URL || ''
};
