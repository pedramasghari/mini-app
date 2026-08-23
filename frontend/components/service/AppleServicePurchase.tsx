"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Loader2, Phone, PlayCircle, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Guide, Product, Service } from "@/components/panel/types";
import { api } from "@/lib/api";

type Props = { service: Service; product: Product; guide: Guide | null };

type SmsOrder = {
  id: string;
  providerOrderId: number | string | null;
  status: string;
  phoneNumber: string | null;
  expiresAt: string | null;
  canResend: boolean;
  canCancel: boolean;
  canReplace: boolean;
  resendAvailableAt: string | null;
  cancelAvailableAt: string | null;
  replaceAvailableAt: string | null;
  otpCode?: string | null;
  otpMessage?: string | null;
  smsRevision?: number;
  chargedAmount?: string;
  currency?: string;
  refunded?: boolean;
};

const ACTIVE_STATUSES = new Set(["CREATING", "PROVIDER_PENDING", "ACTIVE", "OTP_RECEIVED"]);
const TERMINAL = new Set(["CANCELED", "EXPIRED", "COMPLETED"]);

function remainingSeconds(expiresAt: string | null) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatTimer(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function statusLabel(status: string) {
  switch (status) {
    case "CREATING": return "در حال ایجاد";
    case "PROVIDER_PENDING": return "در انتظار تخصیص";
    case "ACTIVE": return "فعال";
    case "OTP_RECEIVED": return "کد دریافت شد";
    case "CANCELED": return "لغو شده";
    case "EXPIRED": return "منقضی شده";
    case "COMPLETED": return "تکمیل شده";
    default: return "در حال بررسی";
  }
}

export default function AppleServicePurchase({ service, product, guide }: Props) {
  const storageKey = `apple-guide-state:${product.id}`;
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [smsOrder, setSmsOrder] = useState<SmsOrder | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsAction, setSmsAction] = useState<"resend" | "cancel" | null>(null);
  const [timer, setTimer] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeOrderResolved, setActiveOrderResolved] = useState(false);
  const lastStatus = useRef<string | null>(null);
  const notifiedRevision = useRef(0);

  const steps = useMemo(() => (guide?.steps ?? []).slice().sort((a, b) => a.position - b.position), [guide]);
  const current = steps[step];
  const activeSms = Boolean(smsOrder && ACTIVE_STATUSES.has(smsOrder.status));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null") as { started?: boolean; step?: number } | null;
      if (saved) {
        setStarted(Boolean(saved.started));
        if (typeof saved.step === "number") setStep(Math.max(0, saved.step));
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ started, step })); } catch {}
  }, [storageKey, started, step]);

  const syncSmsOrder = useCallback(async (id: string, silent = true) => {
    try {
      const next = await api<SmsOrder>(`smscode/orders/${id}`);
      setSmsOrder(next);
      setTimer(remainingSeconds(next.expiresAt));
      if (!silent && next.status !== lastStatus.current) toast.success(statusText(next.status));
      if (next.status !== lastStatus.current && next.status !== "ACTIVE") {
        if (next.status === "OTP_RECEIVED" && (next.smsRevision ?? 0) > notifiedRevision.current) {
          notifiedRevision.current = next.smsRevision ?? 0;
          toast.success(next.otpCode ? `کد تأیید: ${next.otpCode}` : "پیامک تأیید دریافت شد.");
        } else if (next.status === "CANCELED") toast.success("شماره لغو شد و وجه به کیف پول برگشت داده شد.");
        else if (next.status === "EXPIRED") toast.success("شماره منقضی شد و وجه به کیف پول برگشت داده شد.");
        else if (next.status === "COMPLETED") toast.success("سفارش شماره تکمیل شد.");
      }
      lastStatus.current = next.status;
      return next;
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "وضعیت شماره دریافت نشد.");
      return null;
    }
  }, []);

  // مهم: تا پایان این درخواست، دکمه خرید عمداً غیرفعال است تا در refresh یک سفارش دوم ساخته نشود.
  useEffect(() => {
    let cancelled = false;
    setActiveOrderResolved(false);
    api<SmsOrder | null>(`smscode/orders/active?serviceId=${encodeURIComponent(service.id)}`)
      .then((next) => {
        if (cancelled) return;
        if (next) {
          setSmsOrder(next);
          setTimer(remainingSeconds(next.expiresAt));
          lastStatus.current = next.status;
          notifiedRevision.current = next.smsRevision ?? 0;
        } else {
          setSmsOrder(null);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("بررسی شماره فعال انجام نشد. لطفاً دوباره تلاش کنید.");
      })
      .finally(() => {
        if (!cancelled) setActiveOrderResolved(true);
      });
    return () => { cancelled = true; };
  }, [service.id]);

  useEffect(() => {
    if (!smsOrder?.id || !ACTIVE_STATUSES.has(smsOrder.status)) return;
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncSmsOrder(smsOrder.id);
    }, 5000);
    return () => window.clearInterval(poll);
  }, [smsOrder?.id, smsOrder?.status, syncSmsOrder]);

  useEffect(() => {
    if (!smsOrder?.expiresAt || TERMINAL.has(smsOrder.status)) return;
    const tick = window.setInterval(() => setTimer(remainingSeconds(smsOrder.expiresAt)), 1000);
    return () => window.clearInterval(tick);
  }, [smsOrder?.expiresAt, smsOrder?.status]);

  async function requestNumber() {
    if (!activeOrderResolved || activeSms || smsLoading) return;
    setSmsLoading(true);
    try {
      const next = await api<SmsOrder>("smscode/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      setSmsOrder(next);
      setTimer(remainingSeconds(next.expiresAt));
      lastStatus.current = next.status;
      toast.success(next.phoneNumber ? "شماره با موفقیت دریافت شد." : "سفارش ثبت شد؛ در حال تخصیص شماره…");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت شماره ناموفق بود.");
    } finally { setSmsLoading(false); }
  }

  async function resend() {
    if (!smsOrder?.canResend || smsAction) return;
    setSmsAction("resend");
    try {
      const next = await api<SmsOrder>(`smscode/orders/${smsOrder.id}/resend`, { method: "POST" });
      setSmsOrder(next);
      setTimer(remainingSeconds(next.expiresAt));
      toast.success("درخواست ارسال مجدد ثبت شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ارسال مجدد ناموفق بود.");
    } finally { setSmsAction(null); }
  }

  async function cancel() {
    if (!smsOrder?.canCancel || smsAction) return;
    setSmsAction("cancel");
    try {
      const next = await api<SmsOrder>(`smscode/orders/${smsOrder.id}/cancel`, { method: "POST" });
      setSmsOrder(next);
      setTimer(remainingSeconds(next.expiresAt));
      toast.success("شماره لغو شد؛ وجه به کیف پول برمی‌گردد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "لغو شماره ناموفق بود.");
    } finally { setSmsAction(null); }
  }

  async function copyPhone() {
    if (!smsOrder?.phoneNumber) return;
    try {
      await navigator.clipboard.writeText(smsOrder.phoneNumber);
      setCopied(true);
      toast.success("شماره کپی شد.");
      window.setTimeout(() => setCopied(false), 1400);
    } catch { toast.error("کپی شماره انجام نشد."); }
  }

  const guideSection = !guide || !steps.length || product.requiresGuide === false ? (
    <section className="flex h-[560px] flex-col rounded-[28px] border border-white/10 bg-white/[.035] p-5 sm:p-7">
      <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><PlayCircle size={22} /></div><div><span className="text-xs text-cyan-300">سرویس</span><h2 className="mt-1 text-lg font-black">{product.title}</h2></div></div>
      <div className="mt-5 flex-1 overflow-y-auto"><p className="whitespace-pre-line text-sm leading-8 text-white/55">{product.description || service.description}</p></div>
      <button onClick={() => setStarted(true)} className="mt-5 h-12 shrink-0 rounded-2xl bg-cyan-300 px-5 text-sm font-black text-slate-950">شروع</button>
    </section>
  ) : (
    <section className="h-[700px] overflow-hidden rounded-[28px] border border-white/10 bg-white/[.035] p-4 sm:p-6">
      {!started ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between"><div><span className="text-xs text-cyan-300">راهنمای سرویس</span><h2 className="mt-1 text-xl font-black">{guide.title}</h2></div><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><PlayCircle size={22} /></div></div>
          <div className="mt-5 flex-1 overflow-y-auto pr-1"><p className="whitespace-pre-line text-sm leading-8 text-white/60">{guide.description || product.description}</p></div>
          <button onClick={() => setStarted(true)} className="mt-5 h-12 shrink-0 rounded-2xl bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200">شروع</button>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between"><div><p className="text-xs text-white/35">{guide.title}</p><h2 className="mt-1 text-sm font-black">مرحله {step + 1} از {steps.length}</h2></div><span className="max-w-[42%] truncate rounded-full bg-white/[.06] px-3 py-1 text-[11px] text-white/45">{product.title}</span></div>
          <div className="mt-4 flex h-1.5 shrink-0 gap-1.5">{steps.map((item, index) => <button aria-label={`مرحله ${index + 1}`} key={item.id} onClick={() => index <= step && setStep(index)} className={`h-1.5 flex-1 rounded-full transition ${index <= step ? "bg-cyan-300" : "bg-white/10"}`} />)}</div>
          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              {current && <motion.div key={current.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.16 }} className="flex h-full min-h-0 flex-col">
                <div className="h-[285px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20">{current.mediaUrl ? current.mediaType === "video" ? <video className="h-full w-full object-contain" src={current.mediaUrl} controls playsInline preload="metadata" /> : <img className="h-full w-full object-contain" src={current.mediaUrl} alt={current.title} loading="eager" decoding="async" /> : <div className="grid h-full place-items-center text-xs text-white/25">این مرحله مدیا ندارد</div>}</div>
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-1 pb-2"><h3 className="text-lg font-black">{current.title}</h3><p className="mt-3 whitespace-pre-line text-sm leading-8 text-white/60">{current.content}</p>{current.requiresInput && <div className="mt-5"><label className="mb-2 block text-xs font-bold text-white/60">{current.inputLabel || "اطلاعات مورد نیاز"}</label><input className="w-full rounded-2xl border border-white/10 bg-white/[.045] px-4 py-3 text-sm outline-none focus:border-cyan-300/50" placeholder={current.inputLabel || ""} /></div>}</div>
              </motion.div>}
            </AnimatePresence>
          </div>
          <div className="mt-4 flex h-10 shrink-0 items-center justify-between gap-3 border-t border-white/5 pt-3"><button disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 px-2.5 text-[11px] text-white/55 disabled:opacity-20"><ArrowRight size={13} /> قبلی</button><div className="flex items-center gap-1.5">{steps.map((item, index) => <span key={item.id} className={`h-1.5 w-1.5 rounded-full transition ${index === step ? "scale-125 bg-cyan-300" : "bg-white/20"}`} />)}</div><button disabled={step === steps.length - 1} onClick={() => setStep(value => Math.min(steps.length - 1, value + 1))} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 px-2.5 text-[11px] text-white/55 disabled:opacity-20">بعدی <ArrowLeft size={13} /></button></div>
        </div>
      )}
    </section>
  );

  return <div className="mt-5 space-y-3">{smsOrder && <SmsOrderCard order={smsOrder} timer={timer} copied={copied} action={smsAction} onCopy={() => void copyPhone()} onResend={() => void resend()} onCancel={() => void cancel()} />}{guideSection}<RequestNumberButton loading={smsLoading} disabled={!activeOrderResolved || activeSms} onClick={() => void requestNumber()} /></div>;
}

function statusText(status: string) {
  if (status === "OTP_RECEIVED") return "پیامک تأیید دریافت شد.";
  if (status === "CANCELED") return "سفارش لغو شد.";
  if (status === "EXPIRED") return "سفارش منقضی شد.";
  if (status === "COMPLETED") return "سفارش تکمیل شد.";
  return "وضعیت سفارش به‌روزرسانی شد.";
}

function RequestNumberButton({ loading, disabled, onClick }: { loading: boolean; disabled?: boolean; onClick: () => void }) {
  const label = loading ? "در حال دریافت…" : !disabled ? "دریافت شماره" : "در حال بررسی شماره…";
  return <button onClick={onClick} disabled={loading || disabled} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-sm font-black text-cyan-200 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-45">{loading ? <Loader2 className="animate-spin" size={17} /> : <Phone size={17} />}{label}</button>;
}

function SmsOrderCard({ order, timer, copied, action, onCopy, onResend, onCancel }: { order: SmsOrder; timer: number; copied: boolean; action: "resend" | "cancel" | null; onCopy: () => void; onResend: () => void; onCancel: () => void }) {
  const terminal = TERMINAL.has(order.status);
  const canResend = order.canResend && !action;
  const canCancel = order.canCancel && !action;
  const timerText = terminal ? "--:--" : formatTimer(timer);
  const otpWaiting = !order.otpCode;
  return <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#080d18] shadow-xl shadow-black/10">
    <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="truncate text-sm font-black text-cyan-300">#{order.providerOrderId ?? "—"}</span><span className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${order.status === "ACTIVE" ? "bg-cyan-400/10 text-cyan-300" : order.status === "OTP_RECEIVED" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/10 text-white/45"}`}>{statusLabel(order.status)}</span></div>
        <div className="mt-3 text-[10px] font-bold tracking-wider text-white/30">شماره</div>
        <div className="mt-1 flex items-center gap-2"><span className="truncate text-base font-black tracking-wide text-white">{order.phoneNumber ?? "در حال دریافت شماره..."}</span>{order.phoneNumber && <button onClick={onCopy} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-white/45 hover:bg-white/5" aria-label="کپی شماره">{copied ? <Check size={14} /> : <Copy size={14} />}</button>}</div>
        <div className="mt-3 rounded-xl border border-white/5 bg-white/[.025] px-3 py-2.5">
          <div className="text-[10px] font-bold text-white/35">آخرین کد دریافت‌شده</div>
          {order.otpCode ? <div className="mt-1 text-sm font-black tracking-[0.2em] text-emerald-300">{order.otpCode}</div> : <div className="mt-1 text-xs text-white/35">در انتظار دریافت پیامک...</div>}
        </div>
        {order.otpMessage && <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/45">متن پیامک: {order.otpMessage}</p>}
      </div>
      <div className="pt-1 text-sm font-black tabular-nums text-cyan-300">{timerText}</div>
    </div>
    <div className="grid grid-cols-4 border-t border-white/5">
      <button disabled className="flex h-9 items-center justify-center gap-1 text-[10px] text-white/15"><CheckCircle2 size={12}/> تکمیل</button>
      <button disabled={!canResend} onClick={onResend} className="flex h-9 items-center justify-center gap-1 border-x border-white/5 text-[10px] text-white/45 disabled:opacity-20">{action === "resend" ? <Loader2 className="animate-spin" size={12}/> : <RefreshCw size={12}/>} ارسال مجدد</button>
      <button disabled={!canCancel} onClick={onCancel} className="flex h-9 items-center justify-center gap-1 text-[10px] text-white/45 disabled:opacity-20"><X size={12}/> لغو</button>
      <button disabled={!order.canReplace} onClick={() => toast.info("تعویض شماره هنوز توسط API عمومی SMSCode قابل اجرا نیست.")} className="flex h-9 items-center justify-center gap-1 border-r border-white/5 text-[10px] text-white/45 disabled:opacity-20"><RefreshCw size={12}/> تعویض</button>
    </div>
    {order.refunded && <div className="border-t border-emerald-400/10 bg-emerald-400/5 px-4 py-2 text-[10px] text-emerald-300">وجه این سفارش برگشت داده شده است.</div>}
  </section>;
}
