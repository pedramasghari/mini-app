"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Check,
  Copy,
  Loader2,
  Phone,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Guide, Product, Service } from "@/components/panel/types";
import { api } from "@/lib/api";

type Props = { service: Service; product: Product; guide: Guide | null };

type SmsOrder = {
  id: string;
  providerOrderId: number | string;
  status: string;
  phoneNumber: string | null;
  expiresAt: string | null;
  canResend: boolean;
  canCancel: boolean;
  canReplace: boolean;
  resendAvailableAt: string | null;
  cancelAvailableAt: string | null;
  replaceAvailableAt: string | null;
};

function remainingSeconds(expiresAt: string | null) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatTimer(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function formatPhone(phone: string | null) {
  if (!phone) return "در حال دریافت شماره...";
  return phone;
}

export default function AppleServicePurchase({ service, product, guide }: Props) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [smsOrder, setSmsOrder] = useState<SmsOrder | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsAction, setSmsAction] = useState<"resend" | "cancel" | null>(null);
  const [smsError, setSmsError] = useState("");
  const [timer, setTimer] = useState(0);
  const [copied, setCopied] = useState(false);

  const steps = useMemo(
    () => (guide?.steps ?? []).slice().sort((a, b) => a.position - b.position),
    [guide],
  );
  const current = steps[step];

  const syncSmsOrder = useCallback(async (id: string) => {
    try {
      const next = await api<SmsOrder>(`smscode/orders/${id}`);
      setSmsOrder(next);
      setTimer(remainingSeconds(next.expiresAt));
      return next;
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : "وضعیت شماره دریافت نشد.");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!smsOrder?.id) return;
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncSmsOrder(smsOrder.id);
    }, 5000);
    return () => window.clearInterval(poll);
  }, [smsOrder?.id, syncSmsOrder]);

  useEffect(() => {
    if (!smsOrder?.expiresAt) return;
    const tick = window.setInterval(() => {
      setTimer(remainingSeconds(smsOrder.expiresAt));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [smsOrder?.expiresAt]);

  async function requestNumber() {
    setSmsLoading(true);
    setSmsError("");
    try {
      const next = await api<SmsOrder>("smscode/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      setSmsOrder(next);
      setTimer(remainingSeconds(next.expiresAt));
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : "دریافت شماره ناموفق بود.");
    } finally {
      setSmsLoading(false);
    }
  }

  async function resend() {
    if (!smsOrder?.canResend) return;
    setSmsAction("resend");
    setSmsError("");
    try {
      const next = await api<SmsOrder>(`smscode/orders/${smsOrder.id}/resend`, { method: "POST" });
      setSmsOrder(next);
      setTimer(remainingSeconds(next.expiresAt));
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : "ارسال مجدد ناموفق بود.");
    } finally {
      setSmsAction(null);
    }
  }

  async function cancel() {
    if (!smsOrder?.canCancel) return;
    setSmsAction("cancel");
    setSmsError("");
    try {
      const next = await api<SmsOrder>(`smscode/orders/${smsOrder.id}/cancel`, { method: "POST" });
      setSmsOrder(next);
      setTimer(remainingSeconds(next.expiresAt));
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : "لغو شماره ناموفق بود.");
    } finally {
      setSmsAction(null);
    }
  }

  async function copyPhone() {
    if (!smsOrder?.phoneNumber) return;
    await navigator.clipboard.writeText(smsOrder.phoneNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!guide || !steps.length || product.requiresGuide === false) {
    return (
      <div className="mt-5 space-y-3">
        <section className="h-[560px] rounded-[28px] border border-white/10 bg-white/[.035] p-5 sm:p-7">
          <h2 className="text-lg font-black">{product.title}</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-8 text-white/55">
            {product.description || service.description}
          </p>
          <button className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950">
            شروع خرید
          </button>
        </section>
        <RequestNumberButton loading={smsLoading} onClick={() => void requestNumber()} />
        <SmsOrderCard order={smsOrder} timer={timer} copied={copied} action={smsAction} error={smsError} onCopy={() => void copyPhone()} onResend={() => void resend()} onCancel={() => void cancel()} />
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      <section className="h-[700px] overflow-hidden rounded-[28px] border border-white/10 bg-white/[.035] p-4 sm:p-6">
        {!started ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-cyan-300">راهنمای سرویس</span>
                <h2 className="mt-1 text-xl font-black">{guide.title}</h2>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                <PlayCircle size={22} />
              </div>
            </div>
            <div className="mt-5 flex-1 overflow-y-auto pr-1">
              <p className="whitespace-pre-line text-sm leading-8 text-white/60">
                {guide.description || product.description}
              </p>
            </div>
            <button
              onClick={() => setStarted(true)}
              className="mt-5 h-12 shrink-0 rounded-2xl bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            >
              شروع
            </button>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex h-12 shrink-0 items-center justify-between">
              <div>
                <p className="text-xs text-white/35">{guide.title}</p>
                <h2 className="mt-1 text-sm font-black">مرحله {step + 1} از {steps.length}</h2>
              </div>
              <span className="max-w-[42%] truncate rounded-full bg-white/[.06] px-3 py-1 text-[11px] text-white/45">
                {product.title}
              </span>
            </div>

            <div className="mt-4 flex h-1.5 shrink-0 gap-1.5">
              {steps.map((item, index) => (
                <button
                  aria-label={`مرحله ${index + 1}`}
                  key={item.id}
                  onClick={() => index <= step && setStep(index)}
                  className={`h-1.5 flex-1 rounded-full transition ${index <= step ? "bg-cyan-300" : "bg-white/10"}`}
                />
              ))}
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.16 }}
                  className="flex h-full min-h-0 flex-col"
                >
                  <div className="h-[285px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    {current.mediaUrl ? (
                      current.mediaType === "video" ? (
                        <video className="h-full w-full object-contain" src={current.mediaUrl} controls playsInline preload="metadata" />
                      ) : (
                        <img className="h-full w-full object-contain" src={current.mediaUrl} alt={current.title} loading="eager" decoding="async" />
                      )
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-white/25">این مرحله مدیا ندارد</div>
                    )}
                  </div>

                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
                    <h3 className="text-lg font-black">{current.title}</h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-8 text-white/60">
                      {current.content}
                    </p>
                    {current.requiresInput && (
                      <div className="mt-5">
                        <label className="mb-2 block text-xs font-bold text-white/60">{current.inputLabel || "اطلاعات مورد نیاز"}</label>
                        <input className="w-full rounded-2xl border border-white/10 bg-white/[.045] px-4 py-3 text-sm outline-none focus:border-cyan-300/50" placeholder={current.inputLabel || ""} />
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-4 flex h-10 shrink-0 items-center justify-between gap-3 border-t border-white/5 pt-3">
              <button
                disabled={step === 0}
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 px-2.5 text-[11px] text-white/55 disabled:opacity-20"
              >
                <ArrowRight size={13} /> قبلی
              </button>
              <div className="flex items-center gap-1.5">
                {steps.map((item, index) => (
                  <span key={item.id} className={`h-1.5 w-1.5 rounded-full transition ${index === step ? "scale-125 bg-cyan-300" : "bg-white/20"}`} />
                ))}
              </div>
              <button
                disabled={step === steps.length - 1}
                onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 px-2.5 text-[11px] text-white/55 disabled:opacity-20"
              >
                بعدی <ArrowLeft size={13} />
              </button>
            </div>
          </div>
        )}
      </section>

      <RequestNumberButton loading={smsLoading} onClick={() => void requestNumber()} disabled={Boolean(smsOrder && !["CANCELED", "EXPIRED", "COMPLETED"].includes(smsOrder.status))} />
      <SmsOrderCard order={smsOrder} timer={timer} copied={copied} action={smsAction} error={smsError} onCopy={() => void copyPhone()} onResend={() => void resend()} onCancel={() => void cancel()} />
    </div>
  );
}

function RequestNumberButton({ loading, disabled, onClick }: { loading: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-sm font-black text-cyan-200 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {loading ? <Loader2 className="animate-spin" size={17} /> : <Phone size={17} />}
      {disabled ? "شماره فعال است" : "درخواست شماره"}
    </button>
  );
}

function SmsOrderCard({ order, timer, copied, action, error, onCopy, onResend, onCancel }: { order: SmsOrder | null; timer: number; copied: boolean; action: "resend" | "cancel" | null; error: string; onCopy: () => void; onResend: () => void; onCancel: () => void }) {
  if (!order) return null;
  const terminal = ["CANCELED", "EXPIRED", "COMPLETED"].includes(order.status);
  const timerText = terminal ? "--:--" : formatTimer(timer);
  const replaceEnabled = order.canReplace;

  return (
    <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#080d18] shadow-xl shadow-black/10">
      <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-black text-cyan-300">#{order.providerOrderId}</span>
            <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${order.status === "ACTIVE" ? "bg-cyan-400/10 text-cyan-300" : "bg-white/10 text-white/45"}`}>{order.status}</span>
          </div>
          <div className="mt-3 text-[10px] font-bold tracking-wider text-white/30">PHONE</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-base font-black tracking-wide text-white">{formatPhone(order.phoneNumber)}</span>
            {order.phoneNumber && <button onClick={onCopy} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-white/45 hover:bg-white/5" aria-label="کپی شماره">{copied ? <Check size={14} /> : <Copy size={14} />}</button>}
          </div>
        </div>
        <div className="pt-1 text-sm font-black tabular-nums text-cyan-300">{timerText}</div>
      </div>

      {error && <div className="border-t border-red-400/10 bg-red-400/5 px-4 py-2 text-[11px] text-red-200">{error}</div>}

      <div className="grid grid-cols-4 border-t border-white/10">
        <ActionButton icon={<CheckCircle2 size={13} />} label="انجام" disabled />
        <ActionButton icon={action === "resend" ? <Loader2 className="animate-spin" size={13} /> : <RotateCcw size={13} />} label="ارسال مجدد" disabled={!order.canResend || action !== null} onClick={onResend} />
        <ActionButton icon={action === "cancel" ? <Loader2 className="animate-spin" size={13} /> : <X size={13} />} label="لغو" disabled={!order.canCancel || action !== null} onClick={onCancel} danger />
        <ActionButton icon={<RefreshCw size={13} />} label="جایگزین" disabled={!replaceEnabled} title={!replaceEnabled ? "طبق وضعیت فعلی SMSCode در دسترس نیست" : "SMSCode API عمومی endpoint مستقیمی برای Replace مستند نکرده است"} />
      </div>
    </section>
  );
}

function ActionButton({ icon, label, disabled, onClick, danger, title }: { icon: React.ReactNode; label: string; disabled?: boolean; onClick?: () => void; danger?: boolean; title?: string }) {
  return <button type="button" title={title} disabled={disabled} onClick={onClick} className={`flex h-9 items-center justify-center gap-1 border-l border-white/5 text-[9px] font-bold transition disabled:cursor-not-allowed disabled:opacity-25 ${danger ? "text-red-300/70 hover:bg-red-400/5" : "text-white/45 hover:bg-white/5"}`}>{icon}{label}</button>;
}
