"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronLeft, WalletCards } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Transaction = {
  id: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  currency: string;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  createdAt: string;
  gateway?: "ZIBAL" | null;
  gatewayStatus?: "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED" | null;
  gatewayTrackId?: string | null;
  gatewayResult?: string | null;
  gatewayMessage?: string | null;
  gatewayRefNumber?: string | null;
  gatewayCardNumber?: string | null;
  gatewayPaidAt?: string | null;
};

type Response = { items: Transaction[]; page: number; limit: number; total: number; pages: number };

function title(type: string) {
  if (type.includes("REFUND")) return "بازگشت وجه";
  if (type.includes("DEBIT") || type.includes("ORDER")) return "پرداخت سفارش";
  if (type.includes("DEPOSIT")) return "شارژ کیف پول";
  if (type.includes("WITHDRAW")) return "برداشت از کیف پول";
  return "تراکنش کیف پول";
}

function amountText(amount: string, currency: string) {
  const value = Number(amount);
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("fa-IR", { maximumFractionDigits: 8 })} ${currency}`;
}

function gatewayStatusLabel(status?: Transaction["gatewayStatus"]) {
  if (status === "SUCCESS") return "موفق";
  if (status === "FAILED") return "ناموفق";
  if (status === "EXPIRED") return "منقضی";
  if (status === "PENDING") return "در حال بررسی";
  return null;
}

export default function WalletTransactionsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api<Response>(`wallet/transactions?page=${page}&limit=20`)
      .then((next) => alive && setData(next))
      .catch(() => alive && setData({ items: [], page, limit: 20, total: 0, pages: 0 }))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [page]);

  return (
    <main dir="rtl" className="min-h-[100dvh] bg-[#070b14] px-4 pb-10 text-white sm:px-6">
      <div className="mx-auto max-w-2xl pt-5">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/panel" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-white/70 hover:bg-white/[.08]">
            <ChevronLeft size={19} />
          </Link>
          <div>
            <p className="text-[11px] font-bold text-cyan-200/70">کیف پول</p>
            <h1 className="text-xl font-black">تراکنش‌های کیف پول</h1>
          </div>
          <div className="mr-auto grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><WalletCards size={20} /></div>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[.035] shadow-2xl shadow-black/20">
          {loading ? (
            <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/[.05]" />)}</div>
          ) : data?.items.length ? (
            <div className="divide-y divide-white/[.06]">
              {data.items.map((transaction) => {
                const positive = Number(transaction.amount) > 0;
                const gatewayStatus = gatewayStatusLabel(transaction.gatewayStatus);
                return (
                  <article key={transaction.id} className="px-4 py-4 sm:px-5">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${positive ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
                        {positive ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{title(transaction.type)}</p>
                        <p className="mt-1 truncate text-[10px] text-white/35">{transaction.description || "تراکنش کیف پول"}</p>
                        <p className="mt-1 text-[9px] text-white/25">{new Date(transaction.createdAt).toLocaleString("fa-IR")}</p>
                      </div>
                      <div className="text-left">
                        <p className={`font-mono text-sm font-black ${positive ? "text-emerald-300" : "text-rose-300"}`}>{amountText(transaction.amount, transaction.currency)}</p>
                        <p className="mt-1 text-[9px] text-white/25">موجودی: {transaction.balanceAfter} {transaction.currency}</p>
                      </div>
                    </div>

                    {transaction.gateway === "ZIBAL" && (
                      <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.035] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-black text-cyan-200">درگاه زیبال</div>
                          {gatewayStatus && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${transaction.gatewayStatus === "SUCCESS" ? "bg-emerald-400/10 text-emerald-200" : transaction.gatewayStatus === "PENDING" ? "bg-amber-400/10 text-amber-200" : "bg-red-400/10 text-red-200"}`}>{gatewayStatus}</span>}
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-[10px] sm:grid-cols-2">
                          {transaction.gatewayTrackId && <div className="rounded-xl bg-black/15 p-2.5"><span className="text-white/35">Track ID</span><div dir="ltr" className="mt-1 font-mono text-white/60">{transaction.gatewayTrackId}</div></div>}
                          {transaction.gatewayResult && <div className="rounded-xl bg-black/15 p-2.5"><span className="text-white/35">کد نتیجه</span><div dir="ltr" className="mt-1 font-mono text-white/60">{transaction.gatewayResult}</div></div>}
                          {transaction.gatewayRefNumber && <div className="rounded-xl bg-black/15 p-2.5"><span className="text-white/35">شماره مرجع</span><div dir="ltr" className="mt-1 font-mono text-white/60">{transaction.gatewayRefNumber}</div></div>}
                          {transaction.gatewayCardNumber && <div className="rounded-xl bg-black/15 p-2.5"><span className="text-white/35">کارت پرداخت</span><div dir="ltr" className="mt-1 font-mono text-white/60">{transaction.gatewayCardNumber}</div></div>}
                        </div>
                        {transaction.gatewayMessage && <p className="mt-2 rounded-xl bg-black/15 p-2.5 text-[10px] text-white/50">پیام زیبال: {transaction.gatewayMessage}</p>}
                        {transaction.gatewayPaidAt && <p className="mt-2 text-[9px] text-white/30">پرداخت در {new Date(transaction.gatewayPaidAt).toLocaleString("fa-IR")}</p>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-16 text-center"><WalletCards className="mx-auto mb-3 text-white/20" size={34} /><p className="font-bold">هنوز تراکنشی ثبت نشده است</p><p className="mt-1 text-xs text-white/35">خرید، شارژ و بازگشت وجه در اینجا نمایش داده می‌شود.</p></div>
          )}
        </section>

        {data && data.pages > 1 ? (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] p-2">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-xl px-4 py-2 text-xs font-bold text-white/70 disabled:opacity-25">قبلی</button>
            <span className="text-[10px] text-white/35">صفحه {page} از {data.pages}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(data.pages, value + 1))} disabled={page >= data.pages} className="rounded-xl px-4 py-2 text-xs font-bold text-white/70 disabled:opacity-25">بعدی</button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
