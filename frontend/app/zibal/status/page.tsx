'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import { api, fa } from '@/lib/api';
import { usePanel } from '@/context/PanelContext';

type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

type StatusResponse = {
  id: string;
  ticketId: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  expiresAt: string | null;
};

export default function ZibalStatusPage() {
  const searchParams = useSearchParams();
  const { refresh } = usePanel();
  const ticketId = searchParams.get('ticketId');
  const [payment, setPayment] = useState<StatusResponse | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!ticketId) return;
    setChecking(true);
    try {
      const data = await api<StatusResponse>(
        `zibal/payments/${encodeURIComponent(ticketId)}/status`,
      );
      setPayment(data);
      setError('');
      if (data.status === 'SUCCESS') await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت وضعیت پرداخت انجام نشد.');
    } finally {
      setChecking(false);
    }
  }, [ticketId, refresh]);

  // The query string is intentionally never removed. The user stays on this
  // URL until they explicitly press the back button.
  useEffect(() => {
    if (!ticketId) return;
    let disposed = false;
    let timer: number | undefined;

    const poll = async () => {
      if (disposed) return;
      await checkStatus();
      if (!disposed) timer = window.setTimeout(poll, 2000);
    };

    void poll();
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [ticketId, checkStatus]);

  const remaining = useMemo(() => {
    if (!payment?.expiresAt) return null;
    const seconds = Math.max(0, Math.floor((new Date(payment.expiresAt).getTime() - Date.now()) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }, [payment?.expiresAt]);

  const back = () => {
    window.location.assign('/panel');
  };

  if (!ticketId) {
    return (
      <main className="mx-auto w-full max-w-2xl px-3 pb-24 pt-8 sm:px-5">
        <section className="rounded-[32px] border border-red-400/20 bg-[#111827] p-7 text-center text-white shadow-2xl">
          <XCircle className="mx-auto h-16 w-16 text-red-300" />
          <h1 className="mt-5 text-2xl font-black">شناسه پرداخت وجود ندارد</h1>
          <p className="mt-3 text-sm leading-7 text-white/50">برای مشاهده وضعیت، این صفحه باید با Ticket ID باز شود.</p>
          <button onClick={back} className="mt-7 w-full rounded-2xl bg-white px-4 py-4 text-sm font-black text-black">بازگشت به پنل</button>
        </section>
      </main>
    );
  }

  const status = payment?.status ?? 'PENDING';
  const isSuccess = status === 'SUCCESS';
  const isFailed = status === 'FAILED';
  const isExpired = status === 'EXPIRED';

  return (
    <main className="mx-auto w-full max-w-2xl px-3 pb-24 pt-8 sm:px-5">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[#111827] text-white shadow-2xl">
        <div className="border-b border-white/10 p-5">
          <button onClick={back} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-white/70">
            <ArrowRight size={17} /> بازگشت
          </button>
        </div>

        <div className="p-7 text-center">
          {isSuccess ? (
            <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-300" />
          ) : isFailed || isExpired ? (
            <XCircle className="mx-auto h-20 w-20 text-red-300" />
          ) : (
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-400/10">
              <Clock3 className="h-10 w-10 animate-pulse text-amber-300" />
            </div>
          )}

          <p className="mt-6 text-xs font-bold text-cyan-300/70">وضعیت پرداخت زیبال</p>
          <h1 className="mt-2 text-2xl font-black">
            {isSuccess ? 'پرداخت با موفقیت انجام شد' : isExpired ? 'مهلت پرداخت تمام شد' : isFailed ? 'پرداخت تکمیل نشد' : 'در حال بررسی پرداخت'}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/50">
            {isSuccess
              ? 'پرداخت توسط سرور از زیبال تأیید شد و مبلغ به کیف پول شما اضافه شده است.'
              : isExpired
                ? 'مهلت ۲۰ دقیقه‌ای این درخواست تمام شده و دیگر برای آن درخواست Verify انجام نمی‌شود.'
                : isFailed
                  ? 'نتیجه پرداخت توسط سرور بررسی شده و این پرداخت موفق تشخیص داده نشده است.'
                  : 'شما می‌توانید این صفحه را باز بگذارید. وضعیت بدون نیاز به Callback مرورگر، مستقیماً از سرور به‌روزرسانی می‌شود.'}
          </p>

          <div className="mt-7 rounded-3xl border border-white/10 bg-white/[.03] p-5 text-right">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-white/40">Ticket ID</span>
              <span dir="ltr" className="max-w-[70%] truncate font-mono text-xs text-white/60">{ticketId}</span>
            </div>
            {payment && (
              <>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-white/40">مبلغ</span>
                  <strong>{fa(Number(payment.amount))} {payment.currency}</strong>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-white/40">وضعیت</span>
                  <strong className={isSuccess ? 'text-emerald-300' : isFailed || isExpired ? 'text-red-300' : 'text-amber-300'}>
                    {isSuccess ? 'موفق' : isExpired ? 'منقضی شده' : isFailed ? 'ناموفق' : 'در حال بررسی'}
                  </strong>
                </div>
                {status === 'PENDING' && remaining && (
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-white/40">زمان باقی‌مانده</span>
                    <strong dir="ltr" className="text-amber-300">{remaining}</strong>
                  </div>
                )}
              </>
            )}
          </div>

          {error && <p className="mt-4 rounded-2xl bg-red-400/10 p-4 text-xs leading-6 text-red-200">{error}</p>}

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-white/30">
            {status === 'PENDING' && <><span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" /> بررسی خودکار هر ۲ ثانیه</>}
            {isSuccess && '✓ موجودی کیف پول به‌روزرسانی شد'}
            {isFailed && '× نتیجه نهایی از سرور دریافت شد'}
            {isExpired && '× درخواست منقضی شده است'}
          </div>

          <button onClick={() => void checkStatus()} disabled={checking} className="mt-7 w-full rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white/80 disabled:opacity-50">
            <span className="inline-flex items-center gap-2"><RefreshCw size={17} className={checking ? 'animate-spin' : ''} /> بررسی مجدد</span>
          </button>
          <button onClick={back} className="mt-2 w-full rounded-2xl bg-white px-4 py-4 text-sm font-black text-black">بازگشت به پنل</button>
        </div>
      </section>
    </main>
  );
}
