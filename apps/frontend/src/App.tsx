import { Languages, LogOut, Send, ShieldCheck, Wallet, WalletCards } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { api, AdminUser, MeResponse, setToken, Stake, Withdrawal, YieldSetting } from './api';
import { env } from './env';
import { buildStakeTransaction } from './solana';
import { copy, Language } from './i18n';

type Notice = { kind: 'ok' | 'error'; text: string } | null;
type SolanaProvider = {
  isPhantom?: boolean;
  isTokenPocket?: boolean;
  publicKey?: PublicKey | string | { toBase58: () => string };
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: PublicKey | string | { toBase58: () => string } } | void>;
  disconnect?: () => Promise<void> | void;
  signMessage?: (message: Uint8Array, encoding?: string) => Promise<{ signature?: Uint8Array } | Uint8Array>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<{ signature?: string } | string>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  sendTransaction?: (transaction: Transaction, connection: Connection, options?: { skipPreflight?: boolean; preflightCommitment?: 'confirmed' }) => Promise<string>;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
    tokenpocket?: { solana?: SolanaProvider };
    solflare?: SolanaProvider;
  }
}

export function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [stakeAmount, setStakeAmount] = useState('1');
  const [withdrawAmount, setWithdrawAmount] = useState('1');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminStakes, setAdminStakes] = useState<Stake[]>([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState<Withdrawal[]>([]);
  const [adminYields, setAdminYields] = useState<YieldSetting[]>([]);
  const [dailyRatePercent, setDailyRatePercent] = useState('');
  const [adminMode, setAdminMode] = useState(() => window.location.hash === '#admin' || new URLSearchParams(window.location.search).get('admin') === '1');
  const [referrerWallet] = useState(() => new URLSearchParams(window.location.search).get('ref') || localStorage.getItem('solpos_referrer') || '');
  const [busy, setBusy] = useState(false);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const t = copy[language];
  const connection = useMemo(() => new Connection(env.solanaRpcUrl, 'confirmed'), []);
  const referralLink = me ? `${window.location.origin}?ref=${me.user.wallet}` : '';
  const withdrawableSol = Number(me?.community.combinedWithdrawableSol ?? '0');
  const requestedWithdrawSol = Number(withdrawAmount);
  const canWithdraw = Boolean(me) && Number.isFinite(requestedWithdrawSol) && requestedWithdrawSol >= 1 && requestedWithdrawSol <= withdrawableSol;

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = language === 'zh' ? 'SOL POS | 算力生产 SOL' : 'SOL POS | Hashrate Produces SOL';
    if (referrerWallet) localStorage.setItem('solpos_referrer', referrerWallet);
  }, [language]);

  useEffect(() => {
    const onHashChange = () => setAdminMode(window.location.hash === '#admin' || new URLSearchParams(window.location.search).get('admin') === '1');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const provider = getSolanaProvider();
    void provider?.connect({ onlyIfTrusted: true }).then((result) => {
      const key = toPublicKey(result?.publicKey ?? provider.publicKey);
      if (key) setPublicKey(key);
    }).catch(() => undefined);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const next = await api.me();
      setMe(next);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const loadAdmin = useCallback(async () => {
    if (!me?.user.isAdmin || !adminMode) return;
    const [users, stakes, withdrawals, yields] = await Promise.all([
      api.adminUsers(),
      api.adminStakes(),
      api.adminWithdrawals(),
      api.adminYields()
    ]);
    setAdminUsers(users.users);
    setAdminStakes(stakes.stakes);
    setAdminWithdrawals(withdrawals.withdrawals);
    setAdminYields(yields.yields);
    setDailyRatePercent(yields.yields[0]?.dailyRatePercent ?? '');
  }, [adminMode, me?.user.isAdmin]);

  useEffect(() => {
    void loadAdmin().catch((error) => setNotice({ kind: 'error', text: error.message }));
  }, [loadAdmin]);

  const shortWallet = useMemo(() => {
    const value = me?.user.wallet || publicKey?.toBase58() || '';
    return value ? `${value.slice(0, 4)}...${value.slice(-4)}` : '';
  }, [me?.user.wallet, publicKey]);
  async function updateTodayYield() {
    try {
      await api.updateTodayYield({ dailyRatePercent: Number(dailyRatePercent) });
      await Promise.all([loadAdmin(), refreshMe()]);
      setNotice({ kind: 'ok', text: language === 'zh' ? '每日收益率已更新' : 'Daily yield rate updated' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Update failed' });
    }
  }

  async function signIn() {
    if (me) {
      await refreshMe();
      return;
    }
    const provider = getSolanaProvider();
    if (!provider) {
      setNotice({ kind: 'error', text: language === 'zh' ? '请在 TP/Phantom 钱包浏览器中打开' : 'Open this page in a Solana wallet browser.' });
      return;
    }
    setBusy(true);
    try {
      const activeKey = publicKey ?? await connectWallet(provider);
      setPublicKey(activeKey);
      const walletAddress = activeKey.toBase58();
      const nonce = await api.nonce(walletAddress);
      if (!provider.signMessage) throw new Error(language === 'zh' ? '当前钱包不支持签名登录' : 'This wallet does not support message signing.');
      const signed = await provider.signMessage(new TextEncoder().encode(nonce.message), 'utf8');
      const signatureBytes = signed instanceof Uint8Array ? signed : signed.signature;
      if (!signatureBytes) throw new Error(language === 'zh' ? '钱包未返回签名' : 'Wallet did not return a signature.');
      const signature = bs58Encode(signatureBytes);
      const session = await api.login({ wallet: walletAddress, nonce: nonce.nonce, signature, referrerWallet: referrerWallet || undefined });
      setToken(session.token);
      await refreshMe();
      setNotice({ kind: 'ok', text: language === 'zh' ? '登录成功' : 'Signed in' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Sign in failed' });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      setToken('');
      setMe(null);
      setAdminUsers([]);
      setAdminStakes([]);
      setAdminWithdrawals([]);
      setAdminYields([]);
      setPublicKey(null);
      const provider = getSolanaProvider();
      await provider?.disconnect?.();
      setNotice({ kind: 'ok', text: language === 'zh' ? '已退出，可以切换钱包重新登录' : 'Signed out. You can switch wallets and sign in again.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Sign out failed' });
    } finally {
      setBusy(false);
    }
  }

  async function stake() {
    const provider = getSolanaProvider();
    if (!provider) {
      setNotice({ kind: 'error', text: language === 'zh' ? '请在 TP/Phantom 钱包浏览器中打开' : 'Open this page in a Solana wallet browser.' });
      return;
    }
    if (!env.stakeReceiverAddress) {
      setNotice({ kind: 'error', text: language === 'zh' ? '收款地址未配置' : 'Payment address is not configured.' });
      return;
    }
    if (Number(stakeAmount) < 1) {
      setNotice({ kind: 'error', text: language === 'zh' ? '1 SOL 起购买算力' : 'Minimum purchase is 1 SOL.' });
      return;
    }
    setBusy(true);
    try {
      const activeKey = publicKey ?? await connectWallet(provider);
      setPublicKey(activeKey);
      if (me?.user.wallet && activeKey.toBase58() !== me.user.wallet) {
        throw new Error(language === 'zh' ? '当前钱包和登录钱包不一致' : 'Connected wallet does not match signed-in wallet.');
      }
      const tx = buildStakeTransaction({
        from: activeKey,
        to: env.stakeReceiverAddress,
        amountSol: stakeAmount
      });
      tx.feePayer = activeKey;
      const latest = await connection.getLatestBlockhash();
      tx.recentBlockhash = latest.blockhash;
      const signature = await sendWalletTransaction(provider, tx, connection);
      await connection.confirmTransaction({ signature, ...latest }, 'confirmed');
      await api.verifyStake({ signature, amountSol: stakeAmount });
      await refreshMe();
      setNotice({ kind: 'ok', text: language === 'zh' ? '算力购买已确认' : 'Hashrate purchase confirmed' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Purchase failed' });
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    try {
      const destination = me?.user.wallet || publicKey?.toBase58();
      if (!destination) {
        setNotice({ kind: 'error', text: language === 'zh' ? '请先登录钱包' : 'Sign in first' });
        return;
      }
      if (Number(withdrawAmount) < 1) {
        setNotice({ kind: 'error', text: language === 'zh' ? '1 SOL 起提现' : 'Minimum withdrawal is 1 SOL' });
        return;
      }
      if (Number(withdrawAmount) > Number(me?.community.combinedWithdrawableSol ?? '0')) {
        setNotice({ kind: 'error', text: language === 'zh' ? `可提现余额不足，当前可提现 ${me?.community.combinedWithdrawableSol ?? '0'} SOL` : `Insufficient withdrawable balance. Available: ${me?.community.combinedWithdrawableSol ?? '0'} SOL` });
        return;
      }
      await api.createWithdrawal({ amountSol: withdrawAmount, destination });
      await refreshMe();
      setNotice({ kind: 'ok', text: language === 'zh' ? '提现申请已提交' : 'Withdrawal requested' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Withdrawal failed' });
    } finally {
      setBusy(false);
    }
  }

  async function updateWithdrawal(withdrawal: Withdrawal, status: Withdrawal['status']) {
    try {
      await api.updateWithdrawal(withdrawal.id, { status });
      await loadAdmin();
      setNotice({ kind: 'ok', text: language === 'zh' ? '状态已更新' : 'Status updated' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Update failed' });
    }
  }

  async function payWithdrawal(withdrawal: Withdrawal) {
    const provider = getSolanaProvider();
    if (!provider) return void setNotice({ kind: 'error', text: language === 'zh' ? '请在管理员钱包浏览器中打开' : 'Open with the admin wallet.' });
    setBusy(true);
    try {
      const adminKey = publicKey ?? await connectWallet(provider);
      setPublicKey(adminKey);
      if (!adminKey || adminKey.toBase58() !== me?.user.wallet) throw new Error(language === 'zh' ? '请连接当前管理员钱包' : 'Connect the current admin wallet.');
      const tx = buildStakeTransaction({ from: adminKey, to: withdrawal.destination, amountSol: withdrawal.sol });
      tx.feePayer = adminKey;
      const latest = await connection.getLatestBlockhash();
      tx.recentBlockhash = latest.blockhash;
      const signature = await sendWalletTransaction(provider, tx, connection);
      await connection.confirmTransaction({ signature, ...latest }, 'confirmed');
      await api.updateWithdrawal(withdrawal.id, { status: 'paid', note: `${t.paidByWallet}: ${signature}` });
      await loadAdmin();
      setNotice({ kind: 'ok', text: `${t.paidByWallet}: ${short(signature)}` });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Payment failed' });
    } finally {
      setBusy(false);
    }
  }

  async function copyReferralLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setNotice({ kind: 'ok', text: language === 'zh' ? '推荐链接已复制' : 'Referral link copied' });
  }

  async function copyText(value: string, successText: string) {
    await navigator.clipboard.writeText(value);
    setNotice({ kind: 'ok', text: successText });
  }

  function openAdmin() {
    setAdminMode(true);
    window.location.hash = 'admin';
    void loadAdmin().catch((error) => setNotice({ kind: 'error', text: error.message }));
  }

  function closeAdmin() {
    setAdminMode(false);
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div>
            <strong>SOL POS</strong>
            <span>{language === 'zh' ? '算力生产 SOL' : 'Hashrate produces SOL'}</span>
          </div>
        </div>
        <nav className="utility-actions">
          {me?.user.isAdmin && (
            <button className="soft-action" onClick={adminMode ? closeAdmin : openAdmin}>
              {adminMode ? t.userHome : t.adminPanel}
            </button>
          )}
          <a className={!env.telegramUrl ? 'disabled' : ''} href={env.telegramUrl || undefined} target="_blank" rel="noreferrer">
            {t.telegram}
          </a>
          <a className={!env.xUrl ? 'disabled' : ''} href={env.xUrl || undefined} target="_blank" rel="noreferrer">
            {t.x}
          </a>
          <button className="icon-button" onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} aria-label="Switch language">
            <Languages size={18} />
          </button>
        </nav>
        <nav className="actions">
          <div className="wallet-actions">
            <button className="wallet-button primary-action" disabled={busy} onClick={signIn}>
              <Wallet size={18} />
              {me ? shortWallet : t.signIn}
            </button>
            {me && (
              <button className="sign-out-button" disabled={busy} onClick={signOut} title={t.switchWallet} aria-label={t.switchWallet}>
                <LogOut size={18} />
                {t.signOut}
              </button>
            )}
          </div>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{language === 'zh' ? '算力生产 SOL' : 'Hashrate Produces SOL'}</p>
          <h1>{t.title}</h1>
          {t.subtitle && <p>{t.subtitle}</p>}
        </div>
        {!me && (
          <div className="hero-panel">
            <span>{t.wallet}</span>
            <strong>{shortWallet || (language === 'zh' ? '未连接' : 'Not connected')}</strong>
            <button className="primary-action" disabled={busy} onClick={signIn}>
              <ShieldCheck size={18} />
              {t.signIn}
            </button>
          </div>
        )}
      </section>

      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

      {!adminMode && <section className="grid">
        <Panel title={t.dashboard} icon={<WalletCards size={20} />}>
          <div className="metric-grid">
            <div className="metric">
              <span>{t.totalStaked}</span>
              <strong>{me?.totals.stakedSol ?? '0'} SOL</strong>
            </div>
            <div className="metric">
              <span>{t.dailyYield}</span>
              <strong>{me?.yield.dailyYieldSol ?? '0'} SOL</strong>
            </div>
            <div className="metric">
              <span>{t.totalYield}</span>
              <strong>{me?.yield.totalYieldSol ?? '0'} SOL</strong>
            </div>
            <div className="metric">
              <span>{t.dailyYieldRate}</span>
              <strong>{me?.yield.currentDailyRatePercent ?? '0'}%</strong>
            </div>
          </div>
          <div className="muted">{me ? short(me.user.wallet) : (language === 'zh' ? '请先连接并签名登录钱包' : 'Connect and sign in to load your account')}</div>
        </Panel>

        <Panel title={t.community}>
          <div className="metric-grid">
            <div className="metric">
              <span>{t.referralYield}</span>
              <strong>{me?.community.referralTotalYieldSol ?? '0'} SOL</strong>
            </div>
            <div className="metric">
              <span>{language === 'zh' ? '累计收益' : 'Earned'}</span>
              <strong>{me?.community.combinedEarnedSol ?? '0'} SOL</strong>
            </div>
            <div className="metric">
              <span>{t.withdrawable}</span>
              <strong>{me?.community.combinedWithdrawableSol ?? '0'} SOL</strong>
            </div>
            <div className="metric">
              <span>{language === 'zh' ? '已占用提现' : 'Locked withdrawals'}</span>
              <strong>{me?.community.lockedWithdrawalSol ?? '0'} SOL</strong>
            </div>
          </div>
          <div className="rule-list">
            <div>
              <span>{language === 'zh' ? '推荐比例' : 'Referral rate'}</span>
              <strong>{me?.community.referralRatePercent ?? '10'}%</strong>
            </div>
            <div>
              <span>{language === 'zh' ? '推荐人数' : 'Referrals'}</span>
              <strong>{me?.community.referralCount ?? 0}</strong>
            </div>
          </div>
          <div className="referral-link-box">
            <span>{language === 'zh' ? '推荐链接' : 'Referral link'}</span>
            <strong>{referralLink ? `${window.location.host}?ref=${short(me!.user.wallet)}` : '--'}</strong>
            <button disabled={!referralLink} onClick={copyReferralLink}>{language === 'zh' ? '复制' : 'Copy'}</button>
          </div>
        </Panel>

        <Panel title={t.stake} icon={<Send size={20} />}>
          <label>
            {t.amount}
            <div className="amount-input">
              <input value={stakeAmount} onChange={(event) => setStakeAmount(event.target.value)} inputMode="decimal" />
              <span>SOL</span>
            </div>
          </label>
          <div className="muted">{language === 'zh' ? '1 SOL 起购买' : 'Minimum 1 SOL'}</div>
          <button className="primary-action" disabled={!me || busy} onClick={stake}>{t.submitStake}</button>
        </Panel>

        <Panel title={t.withdraw} icon={<Wallet size={20} />}>
          <label>
            {t.amount}
            <div className="amount-input">
              <input value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} inputMode="decimal" />
              <span>SOL</span>
            </div>
          </label>
          <div className="muted">
            {language === 'zh' ? `1 SOL 起提现，当前可提现 ${me?.community.combinedWithdrawableSol ?? '0'} SOL` : `Minimum 1 SOL. Available: ${me?.community.combinedWithdrawableSol ?? '0'} SOL`}
          </div>
          <button className="primary-action" disabled={!canWithdraw || busy} onClick={withdraw}>{t.submitWithdraw}</button>
        </Panel>
      </section>}

      {!adminMode && <section className="tables">
        <Activity title={t.stakes} rows={me?.stakes ?? []} empty={language === 'zh' ? '暂无购买记录' : 'No purchase records'} />
        <WithdrawalTable title={t.withdrawals} rows={me?.withdrawals ?? []} t={t} empty={language === 'zh' ? '暂无提现申请' : 'No withdrawals'} />
      </section>}

      {!adminMode && <section className="tables">
        <section className="table-wrap">
          <h2>{t.referralRecords}</h2>
          {(me?.community.records.length ?? 0) === 0 ? <p className="muted">{language === 'zh' ? '暂无推荐记录' : 'No referral records'}</p> : me!.community.records.map((record) => (
            <div className="table-row record-card" key={record.wallet}>
              <span className="record-main">{short(record.wallet)}</span>
              <span className="record-meta">{language === 'zh' ? '算力' : 'Hashrate'} {record.hashrateSol} SOL</span>
              <span className="record-date">{language === 'zh' ? '收益' : 'Yield'} {record.totalReferralSol} SOL</span>
            </div>
          ))}
        </section>
      </section>}

      {adminMode && !me?.user.isAdmin && (
        <section className="admin admin-lock">
          <Panel title={t.adminPanel} icon={<ShieldCheck size={20} />}>
            <p className="muted">{language === 'zh' ? '请使用管理员钱包签名登录。普通用户不会看到后台内容。' : 'Sign in with the admin wallet. Regular users cannot see admin content.'}</p>
            <button className="primary-action" disabled={busy} onClick={signIn}>{t.signIn}</button>
          </Panel>
        </section>
      )}

      {adminMode && me?.user.isAdmin && (
        <section className="admin">
          <h2>{t.admin}</h2>
          <div className="admin-grid">
            <Panel title={t.users}>
              <div className="list">
                {adminUsers.map((user) => (
                  <div className="row" key={user.id}>
                    <span>{short(user.wallet)}</span>
                    <small>{language === 'zh' ? '本金' : 'Staked'} {user.totals.stakedSol} SOL · {language === 'zh' ? '总收益' : 'Earned'} {user.withdrawals.earnedSol} SOL</small>
                    <small>{language === 'zh' ? '可提现' : 'Available'} {user.withdrawals.withdrawableSol} SOL · {language === 'zh' ? '已占用' : 'Locked'} {user.withdrawals.lockedSol} SOL</small>
                    <small>{language === 'zh' ? '推荐收益' : 'Referral yield'} {user.community.referralTotalYieldSol} SOL · {user._count.stakes} stakes / {user._count.withdrawals} withdrawals / {user._count.referrals} refs</small>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title={t.dailyYieldRate}>
              <label>
                {t.dailyYieldRate}
                <div className="amount-input">
                  <input value={dailyRatePercent} onChange={(event) => setDailyRatePercent(event.target.value)} inputMode="decimal" />
                  <span>%</span>
                </div>
              </label>
              <button className="primary-action" onClick={updateTodayYield}>{language === 'zh' ? '更新今日收益率' : 'Update today'}</button>
              <div className="list">
                {adminYields.slice(0, 5).map((item) => (
                  <div className="row" key={item.id}>
                    <span>{item.date}</span>
                    <small>{item.dailyRatePercent}%</small>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title={t.withdrawals}>
              <div className="list">
                {adminWithdrawals.map((item) => (
                  <div className="row admin-row" key={item.id}>
                    <span>{short(item.wallet || '')} · {item.sol} SOL · {t[item.status]}</span>
                    <small>{t.destination}: {short(item.destination)}</small>
                    {item.userBalance && (
                      <small>
                        {language === 'zh' ? '用户收益' : 'Earned'} {item.userBalance.earnedSol} SOL · {language === 'zh' ? '可提现' : 'Available'} {item.userBalance.withdrawableSol} SOL · {language === 'zh' ? '已占用' : 'Locked'} {item.userBalance.lockedWithdrawalSol} SOL
                      </small>
                    )}
                    <div className="segmented">
                      <button disabled={busy} onClick={() => copyText(item.destination, language === 'zh' ? '收款钱包已复制' : 'Destination copied')}>{t.copyDestination}</button>
                      <button disabled={busy || item.status !== 'approved'} onClick={() => payWithdrawal(item)}>{t.payWithdrawal}</button>
                      {(['approved', 'rejected', 'paid'] as const).map((status) => (
                        <button disabled={busy || item.status === status} key={status} onClick={() => updateWithdrawal(item, status)}>{t[status]}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title={t.stakes}>
              <div className="list">
                {adminStakes.slice(0, 8).map((item) => (
                  <div className="row" key={item.id}>
                    <span>{item.sol} SOL</span>
                    <small>{short(item.signature)}</small>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>
      )}
    </main>
  );
}

function getSolanaProvider() {
  return window.solana ?? window.phantom?.solana ?? window.tokenpocket?.solana ?? window.solflare ?? null;
}

async function connectWallet(provider: SolanaProvider) {
  const result = await provider.connect();
  const key = toPublicKey(result?.publicKey ?? provider.publicKey);
  if (!key) throw new Error('Wallet connection failed');
  return key;
}

function toPublicKey(value: SolanaProvider['publicKey'] | undefined) {
  if (!value) return null;
  if (value instanceof PublicKey) return value;
  if (typeof value === 'string') return new PublicKey(value);
  return new PublicKey(value.toBase58());
}

async function sendWalletTransaction(provider: SolanaProvider, tx: Transaction, connection: Connection) {
  if (provider.signAndSendTransaction) {
    const result = await provider.signAndSendTransaction(tx);
    const signature = typeof result === 'string' ? result : result.signature;
    if (signature) return signature;
  }
  if (provider.sendTransaction) {
    return provider.sendTransaction(tx, connection, { skipPreflight: false, preflightCommitment: 'confirmed' });
  }
  if (provider.signTransaction) {
    const signed = await provider.signTransaction(tx);
    return connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
  }
  throw new Error('This wallet cannot send Solana transactions');
}

function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{icon}{title}</h2>
      {children}
    </section>
  );
}

function Activity({ title, rows, empty }: { title: string; rows: Stake[]; empty: string }) {
  return (
    <section className="table-wrap">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="muted">{empty}</p> : rows.map((row) => (
        <div className="table-row record-card" key={row.id}>
          <span className="record-main">{row.sol} SOL</span>
          <span className="record-meta">{short(row.signature)}</span>
          <span className="record-date">{new Date(row.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </section>
  );
}

function WithdrawalTable({ title, rows, t, empty }: { title: string; rows: Withdrawal[]; t: Record<string, string>; empty: string }) {
  return (
    <section className="table-wrap">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="muted">{empty}</p> : rows.map((row) => (
        <div className="table-row record-card" key={row.id}>
          <span className="record-main">{row.sol} SOL</span>
          <span className={`status-pill status-${row.status}`}>{t[row.status]}</span>
          <span className="record-meta">{new Date(row.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </section>
  );
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-label="SOL POS logo" role="img">
      <defs>
        <linearGradient id="logo-gradient" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#74d8ad" />
          <stop offset="1" stopColor="#e8c970" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#101820" />
      <path d="M18 17h31l-5 7H13l5-7Zm0 23h31l-5 7H13l5-7Z" fill="url(#logo-gradient)" />
      <path d="M23 28h28l-5 7H18l5-7Z" fill="#f7f7f2" />
      <circle cx="49" cy="18" r="5" fill="#74d8ad" />
    </svg>
  );
}

function short(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-6)}` : '';
}

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58Encode(bytes: Uint8Array) {
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    digits.push(0);
  }
  return digits.reverse().map((digit) => alphabet[digit]).join('');
}
