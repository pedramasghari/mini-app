"use client";

import Link from "next/link";
import { initials } from "@/lib/helper";
import { Me } from "./types";
import { CreditCard, Home, ShoppingBag, WalletCards } from "lucide-react";
import { fa } from "@/lib/api";
import ServiceCatalogV2 from "./ServiceCatalogV2";
import ActiveNumberOrders from "./ActiveNumberOrders";
import { useAppStore } from "@/context/useApp";

export default function PanelView({ me }: { me: Me }) {
  const { setActiveTab } = useAppStore();
  const { user, wallet } = me;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "کاربر تلگرام";

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3 sm:px-5 sm:pt-5">
      <section className="min-w-0 overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br from-cyan-400/20 to-violet-500/10 p-4 sm:rounded-[30px] sm:p-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[19px] bg-cyan-300 text-lg font-black text-black sm:h-16 sm:w-16">{user.photoUrl ? <img src={user.photoUrl} alt={name} className="h-full w-full object-cover" /> : initials(user)}</div>
          <div className="min-w-0"><p className="text-xs text-white/45">خوش آمدید</p><h2 className="truncate text-lg font-black sm:text-xl">{name}</h2><p className="mt-1 truncate text-xs text-white/40">حساب، کیف پول و سفارش‌های شما</p></div>
        </div>
      </section>

      <div className="mt-3"><button type="button" onClick={() => setActiveTab("deposit")} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.045] p-3 text-right transition hover:bg-white/[.07]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><WalletCards size={21}/></span><span className="min-w-0 flex-1"><span className="block text-xs text-white/40">موجودی کیف پول</span><span className="mt-1 block truncate text-lg font-black">{fa(wallet?.balance ?? 0)} <small className="text-xs font-medium text-white/40">تومان</small></span></span><span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-black">شارژ</span></button></div>

      <ActiveNumberOrders />

      <div className="mt-7 flex min-w-0 items-end justify-between gap-3 sm:mt-8"><div className="min-w-0"><p className="text-xs font-bold text-cyan-300/60">سرویس‌ها</p><h2 className="mt-1 truncate text-xl font-black sm:text-2xl">خرید سرویس</h2></div><ShoppingBag className="shrink-0 text-white/35" size={21}/></div>
      <ServiceCatalogV2 />

      <div className="mt-7 grid grid-cols-2 gap-2.5 sm:mt-8">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] p-3 text-right sm:p-4"><Home size={19} className="text-cyan-200/80"/><p className="mt-2 truncate text-xs text-white/60">فعال‌سازی مرحله‌ای</p></div>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] p-3 text-right sm:p-4"><CreditCard size={19} className="text-cyan-200/80"/><p className="mt-2 truncate text-xs text-white/60">پرداخت امن</p></div>
        <Link href="/panel/wallet/transactions" className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] p-3 text-right transition hover:bg-white/[.06] sm:p-4"><WalletCards size={19} className="text-cyan-200/80"/><p className="mt-2 truncate text-xs text-white/60">تراکنش‌های کیف پول</p></Link>
        <Link href="/panel/orders" className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] p-3 text-right transition hover:bg-white/[.06] sm:p-4"><ShoppingBag size={19} className="text-cyan-200/80"/><p className="mt-2 truncate text-xs text-white/60">سفارش‌های من</p></Link>
      </div>
    </div>
  );
}
