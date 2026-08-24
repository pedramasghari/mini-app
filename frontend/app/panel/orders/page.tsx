"use client";

import { ChevronDown, CreditCard, Loader2, Phone, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import SmsOrderCard, { SmsOrderCardData } from "@/components/service/SmsOrderCard";
import { api } from "@/lib/api";

type OtpCode = { code: string | null; message: string | null; revision: number; receivedAt: string };
type Transaction = { id: string; type: string; amount: string; currency: string; balanceBefore: string; balanceAfter: string; description: string | null; createdAt: string };
type NumberOrder = {
  id: string;
  orderNumber: string;
  smsCodeOrderId: string;
  status: string;
  phoneNumber: string | null;
  amount: string;
  currency: string;
  createdAt: string;
  product: { id: string; title: string; icon: string; currency: string } | null;
  otpCodes: OtpCode[];
  transactions: Transaction[];
  metadata: { expiresAt?: string | null };
};

function statusLabel(status: string) {
  switch (status) {
    case "IN_PROCESS": return "در حال پردازش";
    case "VERIFY": return "در انتظار تأیید";
    case "SUCCESS": return "موفق";
    case "EXPIRED": return "منقضی شده";
    case "CANCEL": return "لغو شده";
    default: return "در حال بررسی";
  }
}

function statusClass(status: string) {
  if (status === "SUCCESS") return "bg-emerald-400/10 text-emerald-200";
  if (status === "VERIFY" || status === "IN_PROCESS") return "bg-cyan-300/10 text-cyan-200";
  if (status === "CANCEL") return "bg-red-400/10 text-red-200";
  return "bg-amber-300/10 text-amber-200";
}

function amount(value: string, currency: string) {
  return `${new Intl.NumberFormat("fa-IR").format(Number(value || 0))} ${currency === "IRT" ? "تومان" : currency}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<NumberOrder[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [active, setActive] = useState<SmsOrderCardData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const next = await api<NumberOrder[]>("number-orders/me");
      setOrders(next);
      const current = next.find((item) => item.status === "IN_PROCESS" || item.status === "VERIFY");
      if (current) {
        const sms = await api<SmsOrderCardData>(`smscode/orders/${current.smsCodeOrderId}`);
        setActive({ ...sms, orderNumber: current.orderNumber });
      } else {
        setActive(null);
      }
    } catch {
      // handled by the empty/error state below
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) {
    return <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center px-4" dir="rtl"><Loader2 className="animate-spin text-cyan-200" /></main>;
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-3 pb-24 pt-4 sm:px-5" dir="rtl">
      <div className="mb-5">
        <p className="text-xs font-bold text-cyan-300/60">حساب کاربری</p>
        <h1 className="mt-1 text-2xl font-black">سفارش‌های من</h1>
        <p className="mt-2 text-xs leading-6 text-white/40">شماره‌ها، کدهای دریافت‌شده و تراکنش‌های هر سفارش را اینجا می‌بینید.</p>
      </div>

      {active ? (
        <section className="mb-5 rounded-[26px] border border-cyan-300/10 bg-cyan-300/[.025] p-3">
          <div className="mb-2 flex items-center gap-2 px-1"><Phone size={15} className="text-cyan-200" /><span className="text-xs font-bold text-white/60">شماره فعال</span></div>
          <SmsOrderCard order={active} onChange={(next) => setActive({ ...next, orderNumber: active.orderNumber })} onRemove={() => { setActive(null); void load(); }} />
        </section>
      ) : null}

      {!orders.length ? (
        <section className="rounded-[26px] border border-white/10 bg-white/[.035] p-8 text-center">
          <ReceiptText className="mx-auto text-white/25" size={34} />
          <p className="mt-4 text-sm font-bold text-white/60">هنوز سفارشی ثبت نکرده‌اید.</p>
        </section>
      ) : (
        <div className="space-y-2.5">
          {orders.map((order) => {
            const isOpen = open === order.id;
            const isActive = order.status === "IN_PROCESS" || order.status === "VERIFY";
            return (
              <section key={order.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[.035]">
                <button type="button" onClick={() => setOpen(isOpen ? null : order.id)} className="flex w-full items-center gap-3 p-4 text-right">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><Phone size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate text-sm font-black">{order.product?.title || "سفارش شماره"}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span></span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-white/35"><span className="font-mono">{order.phoneNumber || "بدون شماره"}</span><span>•</span><span>{order.orderNumber}</span></span>
                  </span>
                  <ChevronDown size={18} className={`shrink-0 text-white/30 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen ? (
                  <div className="border-t border-white/8 px-4 pb-4 pt-3">
                    {isActive ? (
                      <SmsOrderCard
                        order={active && active.id === order.smsCodeOrderId ? active : {
                          id: order.smsCodeOrderId,
                          orderNumber: order.orderNumber,
                          status: order.status,
                          phoneNumber: order.phoneNumber,
                          expiresAt: order.metadata?.expiresAt ?? null,
                          canResend: false,
                          canCancel: false,
                          canReplace: false,
                        }}
                        onChange={(next) => { setActive({ ...next, orderNumber: order.orderNumber }); void load(); }}
                        onRemove={() => { setActive(null); void load(); }}
                      />
                    ) : (
                      <>
                        <div className="rounded-2xl bg-black/15 p-3">
                          <div className="flex items-center justify-between text-[11px] text-white/35"><span>کدهای دریافت‌شده</span><span>{order.otpCodes.length} پیامک</span></div>
                          {order.otpCodes.length ? <div className="mt-2 space-y-2">{order.otpCodes.map((otp, index) => <div key={`${otp.revision}-${index}`} className="rounded-xl border border-white/8 bg-white/[.025] p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-lg font-black tracking-widest text-cyan-200">{otp.code || "کد شناسایی نشد"}</span><span className="text-[9px] text-white/25">پیامک {otp.revision || index + 1}</span></div>{otp.message ? <p className="mt-1 text-[10px] leading-5 text-white/40">{otp.message}</p> : null}</div>)}</div> : <p className="mt-3 text-xs text-white/30">کدی برای این سفارش ثبت نشده است.</p>}
                        </div>
                        <div className="mt-3 rounded-2xl bg-black/15 p-3">
                          <div className="flex items-center gap-2 text-[11px] font-bold text-white/45"><CreditCard size={14} /> تراکنش‌ها</div>
                          {order.transactions.length ? <div className="mt-2 space-y-2">{order.transactions.map((tx) => <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3 text-xs"><div><p className="font-bold text-white/60">{tx.description || tx.type}</p><p className="mt-1 text-[9px] text-white/25">{new Date(tx.createdAt).toLocaleString("fa-IR")}</p></div><span className={Number(tx.amount) < 0 ? "font-black text-red-200" : "font-black text-emerald-200"}>{amount(tx.amount, tx.currency)}</span></div>)}</div> : <p className="mt-3 text-xs text-white/30">تراکنشی برای این سفارش ثبت نشده است.</p>}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
