'use client';

import { useState } from 'react';
import { usePanel } from '@/context/PanelContext';
import { fa } from '@/lib/api';
import NotificationCenter from './NotificationCenter';
import WalletButton from './WalletButton';
import DepositModal from './DepositModal';
import ServiceCatalog from './ServiceCatalog';

function initials(u: { firstName: string | null; lastName: string | null }) {
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'U';
}

export default function PanelShell() {
  const { me, realtime } = usePanel();
  const [deposit, setDeposit] = useState(false);
  if (!me) return <main dir="rtl" className="min-h-screen grid place-items-center bg-[#070b14] text-white">در حال بارگذاری…</main>;
  const { user, wallet } = me;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'کاربر تلگرام';
  return (
    <main dir="rtl" className="min-h-screen bg-[#070b14] text-white">
      <div className="mx-auto max-w-xl px-4 pb-10 pt-4">
        <header className="sticky top-0 z-30 -mx-4 mb-5 flex items-center justify-between border-b border-white/5 bg-[#070b14]/90 px-4 py-3 backdrop-blur-xl">
          <div><p className="text-[10px] font-bold text-cyan-300/70">فروشگاه</p><h1 className="text-lg font-black">داشبورد</h1></div>
          <div className="flex items-center gap-2">
            <span title={realtime ? 'اتصال لحظه‌ای فعال است' : 'در حال اتصال'} className={`h-2.5 w-2.5 rounded-full ${realtime ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <NotificationCenter />
            <button aria-label="پروفایل" className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/10">{user.photoUrl ? <img src={user.photoUrl} alt="پروفایل" className="h-full w-full object-cover" /> : initials(user)}</button>
          </div>
        </header>
        <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-cyan-400/20 to-violet-500/10 p-5">
          <div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center overflow-hidden rounded-[22px] bg-cyan-300 text-xl font-black text-black">{user.photoUrl ? <img src={user.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(user)}</div><div><p className="text-xs text-white/45">خوش آمدید</p><h2 className="text-xl font-black">{name}</h2><p className="mt-1 text-xs text-white/40">حساب، کیف پول و سفارش‌های شما</p></div></div>
        </section>
        <div className="mt-4"><WalletButton balance={fa(wallet?.balance ?? 0)} currency={wallet?.currency ?? 'USD'} onClick={() => setDeposit(true)} /></div>
        <div className="mt-8"><p className="text-xs font-bold text-cyan-300/60">سرویس‌ها</p><h2 className="mt-1 text-2xl font-black">خرید سرویس</h2></div>
        <ServiceCatalog />
        <div className="mt-8 grid grid-cols-2 gap-3">{[['✓', 'فعال‌سازی مرحله‌ای'], ['⚡', 'پشتیبانی سریع'], ['🔒', 'پرداخت امن'], ['💳', 'کیف پول']].map(([i, t]) => <div key={t} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><span>{i}</span><p className="mt-2 text-xs text-white/60">{t}</p></div>)}</div>
      </div>
      {deposit && <DepositModal open={deposit} onClose={() => setDeposit(false)} />}
    </main>
  );
}
