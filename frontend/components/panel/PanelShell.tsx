'use client';

import { useState } from 'react';
import { Bell, CircleUserRound, CreditCard, Home, ShoppingBag, WalletCards } from 'lucide-react';
import { usePanel } from '@/context/PanelContext';
import { fa } from '@/lib/api';
import NotificationCenter from './NotificationCenter';
import WalletButton from './WalletButton';
import DepositModal from './DepositModal';
import ServiceCatalog from './ServiceCatalog';
import { initials } from '@/lib/helper';
import Header from '../header/header';



export default function PanelShell() {
  const { me, realtime, notifications } = usePanel();
  const [deposit, setDeposit] = useState(false);
  if (!me) return <main dir="rtl" className="grid min-h-screen place-items-center overflow-x-hidden bg-[#070b14] px-4 text-white">در حال بارگذاری…</main>;
  const { user, wallet } = me;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'کاربر تلگرام';
  

  return (
    <main dir="rtl" className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#070b14] text-white">
      <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3 sm:px-5 sm:pt-5">
        
        <Header />
        <section className="min-w-0 overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br from-cyan-400/20 to-violet-500/10 p-4 sm:rounded-[30px] sm:p-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[19px] bg-cyan-300 text-lg font-black text-black sm:h-16 sm:w-16">{user.photoUrl ? <img src={user.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(user)}</div><div className="min-w-0"><p className="text-xs text-white/45">خوش آمدید</p><h2 className="truncate text-lg font-black sm:text-xl">{name}</h2><p className="mt-1 truncate text-xs text-white/40">حساب، کیف پول و سفارش‌های شما</p></div></div>
        </section>

        <div className="mt-3"><WalletButton balance={fa(wallet?.balance ?? 0)} currency="تومان" onClick={() => setDeposit(true)} /></div>

        <div className="mt-7 flex min-w-0 items-end justify-between gap-3 sm:mt-8"><div className="min-w-0"><p className="text-xs font-bold text-cyan-300/60">سرویس‌ها</p><h2 className="mt-1 truncate text-xl font-black sm:text-2xl">خرید سرویس</h2></div><ShoppingBag className="shrink-0 text-white/35" size={21} /></div>
        <ServiceCatalog />

        <div className="mt-7 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-3">
          {[[Home, 'فعال‌سازی مرحله‌ای'], [Bell, 'اعلان‌های لحظه‌ای'], [CreditCard, 'پرداخت امن'], [WalletCards, 'کیف پول']].map(([Icon, title]) => {
            const I = Icon as typeof Home;
            return <div key={title as string} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] p-3 sm:p-4"><I size={19} className="text-cyan-200/80" /><p className="mt-2 truncate text-xs text-white/60">{title as string}</p></div>;
          })}
        </div>
      </div>
      {deposit && <DepositModal open={deposit} onClose={() => setDeposit(false)} />}
    </main>
  );
}