'use client';

import { CreditCard, Plus } from 'lucide-react';

export default function WalletButton({
  balance,
  currency = 'تومان',
  onClick,
}: {
  balance: string;
  currency?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="کیف پول و شارژ حساب"
      className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[.045] p-3 text-right transition hover:border-cyan-300/30 hover:bg-cyan-300/5 active:scale-[.99] sm:gap-4 sm:p-4"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200 sm:h-12 sm:w-12">
        <CreditCard size={22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block truncate text-xs text-white/45">کیف پول</span>
        <span className="mt-1 block truncate text-base font-black sm:text-lg">
          {balance} <small className="text-xs font-medium text-white/40">{currency === 'USD' ? 'تومان' : currency}</small>
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-black">
        <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
        شارژ
      </span>
    </button>
  );
}