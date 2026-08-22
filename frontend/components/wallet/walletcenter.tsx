'use client';

import { ArrowDownToLine, ArrowUpFromLine, List, WalletMinimal, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface WalletCenterProps {
  balance?: number | string;
  currency?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onTransactions?: () => void;
}

export function WalletCenter({ balance = 0, currency = 'تومان', open, onOpenChange, onDeposit, onWithdraw, onTransactions }: WalletCenterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const formattedBalance = Number(balance || 0).toLocaleString('fa-IR');

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  const action = (callback?: () => void) => {
    onOpenChange(false);
    callback?.();
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="کیف پول" aria-expanded={open} aria-haspopup="menu" onClick={() => onOpenChange(!open)} className={`relative grid h-10 w-10 place-items-center rounded-xl border transition active:scale-95 sm:h-11 sm:w-11 sm:rounded-2xl ${open ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200' : 'border-white/10 bg-white/[.05] text-white/80 hover:bg-white/[.09]'}`}>
        <WalletMinimal size={20} strokeWidth={1.8} />
        {Number(balance) > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#070b14] bg-emerald-400" />}
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-[26px] border border-white/10 bg-[#111827]/98 shadow-2xl backdrop-blur-2xl sm:left-auto sm:right-0 sm:w-80">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><WalletMinimal size={21} /></div>
                <div className="min-w-0"><p className="text-xs text-white/40">کیف پول</p><p className="mt-1 truncate text-sm font-bold">موجودی حساب</p></div>
              </div>
              <button type="button" aria-label="بستن" onClick={() => onOpenChange(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"><X size={16} /></button>
            </div>
          </div>

          <div className="p-4">
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
              <p className="text-xs text-white/40">موجودی قابل استفاده</p>
              <div className="mt-2 flex items-baseline gap-2"><span className="truncate text-2xl font-black">{formattedBalance}</span><span className="shrink-0 text-xs text-white/40">{currency}</span></div>
            </div>

            <div className="mt-3 space-y-2">
              <button type="button" role="menuitem" onClick={() => action(onDeposit)} className="flex w-full items-center gap-3 rounded-2xl bg-cyan-300 px-3 py-3 text-sm font-bold text-black transition hover:bg-cyan-200 active:scale-[.99]"><ArrowDownToLine size={17} /> شارژ حساب <span className="mr-auto text-[10px] opacity-50">افزایش موجودی</span></button>
              <button type="button" role="menuitem" onClick={() => action(onWithdraw)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] px-3 py-3 text-sm font-bold text-white/80 transition hover:bg-white/[.09] active:scale-[.99]"><ArrowUpFromLine size={17} /> برداشت وجه <span className="mr-auto text-[10px] text-white/35">انتقال وجه</span></button>
              <button type="button" role="menuitem" onClick={() => action(onTransactions)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-3 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[.08]"><List size={17} /> تراکنش‌های کیف پول <span className="mr-auto text-[10px] text-white/35">مشاهده همه</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
