"use client";

import { Copy, Loader2, Phone, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSmsCode } from "@/modules/smscode/SmsCodeProvider";

export type SmsOrderCardData = {
  id: string;
  smsOrderId?: string;
  orderNumber?: string;
  status: string;
  phoneNumber: string | null;
  countryName?: string | null;
  countryCode?: string | null;
  expiresAt: string | null;
  canResend?: boolean;
  canCancel?: boolean;
  canReplace?: boolean;
  resendAvailableAt?: string | null;
  cancelAvailableAt?: string | null;
  replaceAvailableAt?: string | null;
  otpCode?: string | null;
  otpMessage?: string | null;
  smsRevision?: number;
  chargedAmount?: string;
  currency?: string;
  refunded?: boolean;
};

type Props = {
  order: SmsOrderCardData;
  onChange?: (order: SmsOrderCardData) => void;
  onRemove?: () => void;
};
const CLOSED = new Set([
  "CANCELED",
  "CANCELLED",
  "EXPIRED",
  "SUCCESS",
  "COMPLETED",
]);

const DIAL_CODES: Record<string, string> = {
  AF: "+93", AL: "+355", DZ: "+213", AR: "+54", AM: "+374", AU: "+61", AT: "+43", AZ: "+994", BH: "+973", BD: "+880", BY: "+375", BE: "+32", BO: "+591", BA: "+387", BR: "+55", BG: "+359", KH: "+855", CA: "+1", CL: "+56", CN: "+86", CO: "+57", CR: "+506", HR: "+385", CY: "+357", CZ: "+420", DK: "+45", DO: "+1", EC: "+593", EG: "+20", EE: "+372", FI: "+358", FR: "+33", GE: "+995", DE: "+49", GH: "+233", GR: "+30", GT: "+502", HK: "+852", HU: "+36", IS: "+354", IN: "+91", ID: "+62", IE: "+353", IL: "+972", IT: "+39", JP: "+81", JO: "+962", KZ: "+7", KE: "+254", KR: "+82", KW: "+965", LV: "+371", LB: "+961", LT: "+370", LU: "+352", MY: "+60", MT: "+356", MX: "+52", MD: "+373", MC: "+377", MN: "+976", ME: "+382", MA: "+212", NP: "+977", NL: "+31", NZ: "+64", NG: "+234", MK: "+389", NO: "+47", OM: "+968", PK: "+92", PA: "+507", PE: "+51", PH: "+63", PL: "+48", PT: "+351", QA: "+974", RO: "+40", RU: "+7", SA: "+966", RS: "+381", SG: "+65", SK: "+421", SI: "+386", ZA: "+27", ES: "+34", LK: "+94", SE: "+46", CH: "+41", TW: "+886", TH: "+66", TN: "+216", TR: "+90", UA: "+380", AE: "+971", GB: "+44", US: "+1", UZ: "+998", VN: "+84", YE: "+967",
};

function statusLabel(status: string) {
  switch (status) {
    case "IN_PROCESS":
    case "CREATING":
    case "PROVIDER_PENDING":
    case "ACTIVE": return "فعال";
    case "VERIFY":
    case "OTP_RECEIVED": return "کد دریافت شد";
    case "SUCCESS":
    case "COMPLETED": return "موفق";
    case "EXPIRED": return "منقضی شده";
    case "CANCELED":
    case "CANCELLED": return "لغو شده";
    default: return "در حال بررسی";
  }
}
function remaining(expiresAt: string | null) {
  return expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;
}
function timerText(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function formatPhone(phoneNumber: string | null, countryCode?: string | null, countryName?: string | null) {
  if (!phoneNumber) return { local: "در انتظار شماره…", country: "" };
  const normalized = phoneNumber.replace(/[\s()-]/g, "");
  const code = countryCode?.toUpperCase() ?? "";
  const dialCode = DIAL_CODES[code];
  const dialcodewithoutPlus = dialCode?.replace("+", "");
  const localNumber = dialcodewithoutPlus && normalized.startsWith(dialcodewithoutPlus)
    ? normalized.slice(dialcodewithoutPlus.length)
    : normalized.startsWith("+") ? normalized.slice(1) : normalized;
  if (!dialCode || !countryName) return { country: "", local: phoneNumber };
  return { country: `${countryName} (${dialCode})`, local: localNumber };
}

export default function SmsOrderCard({ order, onChange, onRemove }: Props) {
  const { resend: resendOrder, cancel: cancelOrder } = useSmsCode();
  const [timer, setTimer] = useState(() => remaining(order.expiresAt));
  const [action, setAction] = useState<"resend" | "cancel" | null>(null);
  const [copied, setCopied] = useState(false);
  const displayPhone = useMemo(() => formatPhone(order.phoneNumber, order.countryCode, order.countryName), [order.phoneNumber, order.countryCode, order.countryName]);

  useEffect(() => setTimer(remaining(order.expiresAt)), [order.expiresAt]);
  useEffect(() => {
    if (!order.expiresAt || CLOSED.has(order.status)) return;
    const id = window.setInterval(() => setTimer(remaining(order.expiresAt)), 1000);
    return () => window.clearInterval(id);
  }, [order.expiresAt, order.status]);

  const otpText = useMemo(() => order.otpCode || "در انتظار دریافت پیامک...", [order.otpCode]);

  async function copy() {
    if (!displayPhone.local) return;
    try {
      await navigator.clipboard.writeText(displayPhone.local);
      setCopied(true);
      toast.success("شماره کپی شد.");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("کپی شماره انجام نشد.");
    }
  }

  async function resend() {
    if (!order.canResend || action) return;
    setAction("resend");
    try {
      onChange?.(await resendOrder(order.id));
      toast.success("درخواست ارسال مجدد ثبت شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ارسال مجدد ناموفق بود.");
    } finally {
      setAction(null);
    }
  }

  async function cancel() {
    if (!order.canCancel || action || !order.phoneNumber) return;
    setAction("cancel");
    try {
      const next = await cancelOrder(order.id);
      if (["CANCELED", "CANCELLED", "EXPIRED"].includes(next.status)) {
        onRemove?.();
        toast.success("شماره لغو شد و وجه به کیف پول برگشت داده شد.");
      } else onChange?.(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "لغو شماره ناموفق بود.");
    } finally {
      setAction(null);
    }
  }

  return (
    <article className="min-w-[290px] rounded-[24px] border border-white/10 bg-white/[.045] p-4 shadow-xl shadow-black/10 w-full" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Phone size={17} /></span>
          <div className="min-w-0"><p className="truncate text-[11px] text-white/35">شماره فعال</p><p className="truncate text-sm font-black text-white">{statusLabel(order.status)}</p></div>
        </div>
        <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200">{timerText(timer)}</span>
      </div>
      <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-black/20 px-3 py-2.5"><span className="text-cyan-300/80">کشور</span><span>{displayPhone.country}</span></div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-black/20 px-3 py-2.5"><span className="min-w-0 flex-1 truncate font-mono text-base font-black tracking-wide text-white" dir="ltr">{displayPhone.local}</span><button type="button" onClick={() => void copy()} disabled={!order.phoneNumber} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[.06] text-white/65 disabled:opacity-30" aria-label="کپی شماره"><Copy size={15} /></button></div>
      <div className="mt-3 rounded-2xl border border-white/8 bg-white/[.025] px-3 py-2.5"><div className="flex items-center justify-between gap-2 text-[10px] text-white/35"><span>آخرین کد دریافت‌شده</span><span>{order.smsRevision ? `پیامک ${order.smsRevision}` : ""}</span></div><p className="mt-1 font-mono text-sm font-black tracking-widest text-cyan-200">{otpText}</p>{order.otpMessage ? <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-white/40">{order.otpMessage}</p> : null}</div>
      {order.orderNumber ? <p className="mt-2 truncate text-[10px] text-white/25">شماره سفارش: {order.orderNumber}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void resend()} disabled={!order.canResend || Boolean(action)} className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/[.06] text-[10px] font-bold text-white/70 disabled:opacity-30"><RefreshCw size={13} className={action === "resend" ? "animate-spin" : ""} /> ارسال مجدد</button>
        <button type="button" onClick={() => void cancel()} disabled={!order.canCancel || Boolean(action) || !order.phoneNumber} className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-400/10 text-[10px] font-bold text-red-200 disabled:opacity-30">{action === "cancel" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} لغو شماره</button>
      </div>
      {copied ? <p className="mt-2 text-center text-[10px] text-cyan-200">شماره کپی شد</p> : null}
    </article>
  );
}
