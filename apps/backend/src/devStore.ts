type NonceRecord = {
  wallet: string;
  nonce: string;
  message: string;
  expiresAt: Date;
  usedAt?: Date;
};

const nonces = new Map<string, NonceRecord>();

export function saveDevNonce(record: NonceRecord) {
  nonces.set(record.nonce, record);
}

export function getDevNonce(nonce: string) {
  return nonces.get(nonce);
}

export function useDevNonce(nonce: string) {
  const record = nonces.get(nonce);
  if (record) record.usedAt = new Date();
}

export function isDatabaseUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('DATABASE_URL') ||
    message.includes("Can't reach database") ||
    message.includes('ECONNREFUSED') ||
    message.includes('P1001')
  );
}
