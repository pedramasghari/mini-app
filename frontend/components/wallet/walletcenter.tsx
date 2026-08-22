"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  WalletMinimal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface WalletCenterProps {
  balance?: number | string;
  currency?: string;
  onDeposit?: () => void;
  onWithdraw?: () => void;
}

export function WalletCenter({
  balance = 0,
  currency = "تومان",
  onDeposit,
  onWithdraw,
}: WalletCenterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const formattedBalance = Number(balance || 0).toLocaleString("fa-IR");

  /**
   * بستن منو با کلیک خارج از آن
   */
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  /**
   * بستن با Escape
   */
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleDeposit = () => {
    setOpen(false);
    onDeposit?.();
  };

  const handleWithdraw = () => {
    setOpen(false);
    onWithdraw?.();
  };

  return (
    <div ref={ref} className="relative">
      {/* Wallet Button */}
      <button
        type="button"
        aria-label="کیف پول"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10 text-xl transition hover:bg-white/15"
      
      >
        <WalletMinimal
          size={20}
          strokeWidth={1.8}
          className="transition-transform duration-200"
        />

        {/* موجودی صفر / وضعیت */}
        {Number(balance) > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#070b14] bg-emerald-400" />
        )}
      </button>

      {/* Wallet Menu */}
      {open && (
        <div
          role="menu"
          className="
            absolute left-5 top-[calc(100%+10px)] z-50
            w-[min(20rem,calc(100vw-1.5rem))]
            -translate-x-1/2
            overflow-hidden
            rounded-[26px]
            border border-white/10
            bg-[#111827]/95
            shadow-2xl
            backdrop-blur-2xl
            sm:left-auto
            sm:right-0
            sm:w-80
          "
        >
          {/* Header */}
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                  <WalletMinimal size={21} strokeWidth={1.8} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-white/40">
                    کیف پول
                  </p>

                  <p className="mt-1 truncate text-sm font-bold text-white">
                    موجودی حساب
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="بستن"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/5 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Balance */}
          <div className="p-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/40">
                موجودی قابل استفاده
              </p>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="truncate text-2xl font-black tracking-tight text-white">
                  {formattedBalance}
                </span>

                <span className="shrink-0 text-xs font-medium text-white/40">
                  {currency}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                role="menuitem"
                onClick={handleDeposit}
                className="
                  flex min-w-0 items-center justify-center
                  gap-2 rounded-2xl
                  bg-cyan-300 px-3 py-3
                  text-xs font-bold text-black
                  transition-all duration-200
                  hover:bg-cyan-200
                  active:scale-[0.98]
                "
              >
                <ArrowDownToLine size={16} strokeWidth={2.2} />

                <span className="truncate">
                  شارژ حساب
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleWithdraw}
                className="
                  flex min-w-0 items-center justify-center
                  gap-2 rounded-2xl
                  border border-white/10
                  bg-white/[0.05]
                  px-3 py-3
                  text-xs font-bold text-white/80
                  transition-all duration-200
                  hover:bg-white/[0.09]
                  active:scale-[0.98]
                "
              >
                <ArrowUpFromLine size={16} strokeWidth={2} />

                <span className="truncate">
                  برداشت وجه
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}