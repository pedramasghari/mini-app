'use client';

import { useEffect, useMemo, useState } from 'react';

type User = { id: string; telegramId: string; username: string | null; firstName: string | null; lastName: string | null; photoUrl: string | null; languageCode: string | null };
type Wallet = { id: string; balance: string; currency: string };
type MeResponse = { user: User; wallet: Wallet | null };

function initials(user: User) {
  const value = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return value ? value.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() : 'U';
}

export default function PanelPage() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => { if (!res.ok) throw new Error('Session expired'); return res.json() as Promise<MeResponse>; })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const displayName = useMemo(() => {
    if (!data?.user) return 'Telegram User';
    return [data.user.firstName, data.user.lastName].filter(Boolean).join(' ') || 'Telegram User';
  }, [data]);

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#0b1020] text-white"><div className="animate-pulse rounded-2xl bg-white/10 px-6 py-4">Loading your dashboard…</div></main>;
  if (error || !data) return <main className="min-h-screen grid place-items-center bg-[#0b1020] p-6 text-center text-white"><div><p className="text-xl font-semibold">Session expired</p><p className="mt-2 text-white/60">Please reopen the Mini App from Telegram.</p></div></main>;

  const { user, wallet } = data;
  const balance = Number(wallet?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="min-h-screen overflow-hidden bg-[#080d19] text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="relative mx-auto w-full max-w-xl px-4 pb-8 pt-5 sm:px-6">
        <header className="mb-6 flex items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/70">Dashboard</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Welcome back</h1></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/60">Online</div></header>

        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.12] to-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"><div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-transparent to-violet-400/10" /><div className="relative flex items-center gap-4"><div className="relative shrink-0"><div className="grid h-20 w-20 place-items-center overflow-hidden rounded-[24px] bg-gradient-to-br from-cyan-300 to-blue-600 text-2xl font-bold shadow-lg shadow-cyan-500/20 ring-4 ring-white/10">{user.photoUrl ? <img src={user.photoUrl} alt={displayName} className="h-full w-full object-cover" /> : initials(user)}</div><span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-[#111827] bg-emerald-400" /></div><div className="min-w-0"><h2 className="truncate text-xl font-bold">{displayName}</h2><p className="mt-1 truncate text-sm text-white/55">{user.username ? `@${user.username}` : `Telegram ID ${user.telegramId}`}</p><div className="mt-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/60">Telegram account</div></div></div></section>

        <section className="mt-4 overflow-hidden rounded-[28px] border border-cyan-300/10 bg-gradient-to-br from-cyan-500/20 via-blue-600/15 to-violet-600/20 p-5 shadow-xl shadow-cyan-950/20"><div className="flex items-start justify-between"><div><p className="text-sm text-white/60">Available balance</p><p className="mt-2 text-4xl font-bold tracking-tight">{balance}</p></div><div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs font-semibold text-white/70">{wallet?.currency ?? 'USD'}</div></div><div className="mt-7 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/45"><span>Wallet</span><span>{wallet ? wallet.id.slice(0, 8) : 'Not created'}</span></div></section>

        <section className="mt-4 grid grid-cols-2 gap-3"><button disabled className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left opacity-80"><span className="text-xl">↗</span><p className="mt-3 font-semibold">Deposit</p><p className="mt-1 text-xs text-white/40">Coming soon</p></button><button disabled className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left opacity-80"><span className="text-xl">↘</span><p className="mt-3 font-semibold">Withdraw</p><p className="mt-1 text-xs text-white/40">Coming soon</p></button></section>

        <section className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"><p className="text-sm font-semibold">Account</p><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-white/45">Telegram ID</span><span className="font-mono text-xs text-white/70">{user.telegramId}</span></div><div className="flex justify-between gap-4"><span className="text-white/45">Language</span><span className="text-white/70">{user.languageCode ?? '—'}</span></div><div className="flex justify-between gap-4"><span className="text-white/45">Account</span><span className="text-emerald-300">Active</span></div></div></section>

        <nav className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-center text-xs text-white/45"><span className="rounded-xl bg-white/10 px-3 py-2.5 text-white">Home</span><span className="px-3 py-2.5">Transactions</span><span className="px-3 py-2.5">Services</span></nav>
      </div>
    </main>
  );
}
