'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, fa } from '@/lib/api';
import { usePanel } from '@/context/PanelContext';
import { ArrowRight } from 'lucide-react';

type ZibalConfig = { enabled: boolean; minAmount: string; maxAmount: string; currency: string };
type PaymentMode = 'ONLINE' | 'CARD';
type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

type Payment = {
  id: string;
  ticketId: string;
  paymentUrl: string;
  trackId: string;
  amount: string;
  currency: string;
  expiresAt: string;
};

type StatusResponse = {
  id: string;
  ticketId: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  expiresAt: string | null;
};

const clearPaymentQuery = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('ticketId');
  url.searchParams.delete('payment');
  url.searchParams.delete('paymentId');
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
};

export default function DepositModal() {
  const { methods, refresh } = usePanel();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const cards = useMemo(() => methods.filter((m) => m.type === 'CARD_TRANSFER'), [methods]);

  const [mode, setMode] = useState<PaymentMode>('ONLINE');
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [zibal, setZibal] = useState<ZibalConfig | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    api<ZibalConfig>('zibal/config').then(setZibal).catch(() => setZibal(null));
  }, []);

  // The ticketId is the payment-status page identifier. The Mini App stays on
  // this page while the Zibal gateway is opened in the user's external browser.
  useEffect(() => {
    if (!ticketId) {
      setStatus(null);
      return;
    }

    let disposed = false;
    let timer: number | undefined;

    const check = async () => {
      if (disposed) return;
      try {
        const data = await api<StatusResponse>(
          `zibal/payments/${encodeURIComponent(ticketId)}/status`,
        );
        if (disposed) return;
        setStatus(data);

        if (data.status === 'SUCCESS') {
          await refresh();
          clearPaymentQuery();
          return;
        }
        if (data.status === 'FAILED' || data.status === 'EXPIRED') {
          clearPaymentQuery();
          return;
        }
      } catch {
        // Temporary network/session errors must not mark a payment as failed.
      }
      if (!disposed) timer = window.setTimeout(check, 2000);
    };

    void check();
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [ticketId, refresh]);

  const numeric = Number(amount.replace(/[^0-9]/g, ''));
  const min = Number(zibal?.minAmount ?? 0);
  const max = Number(zibal?.maxAmount ?? Number.MAX_SAFE_INTEGER);
  const validAmount = Number.isSafeInteger(numeric) && numeric > 0 && numeric >= min && numeric <= max;

  useEffect(() => {
    if (!zibal || !amount) return;
    if (numeric < min) setError(`حداقل مبلغ شارژ ${fa(min)} تومان است.`);
    else if (numeric > max) setError(`حداکثر مبلغ شارژ ${fa(max)} تومان است.`);
    else setError('');
  }, [zibal, amount, numeric, min, max]);

  async function onlinePayment() {
    if (!validAmount) {
      setError(`مبلغ باید بین ${fa(min)} تا ${fa(max)} تومان باشد.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payment = await api<Payment>('zibal/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: String(numeric) }),
      });

      // Navigate the Mini App to its own payment-status page first.
      const url = new URL(window.location.href);
      url.searchParams.set('ticketId', payment.ticketId);
      url.searchParams.delete('payment');
      url.searchParams.delete('paymentId');
      window.history.pushState({}, document.title, url.pathname + url.search + url.hash);

      setStatus({
        id: payment.id,
        ticketId: payment.ticketId,
        status: 'PENDING',
        amount: payment.amount,
        currency: payment.currency,
        expiresAt: payment.expiresAt,
      });

      // Open Zibal in a separate browser context. The Mini App itself remains
      // mounted on /panel/wallet/deposit and continues checking the backend.
      const opened = window.open(payment.paymentUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        setError('مرورگر اجازه باز کردن درگاه را نداد. لطفاً دوباره تلاش کنید.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ایجاد پرداخت آنلاین انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCardTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !validAmount || !receipt) {
      setError('روش پرداخت، مبلغ و فیش واریزی را انتخاب کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('amount', String(numeric));
      fd.append('paymentMethodId', selected);
      fd.append('receipt', receipt);
      await api('payments/card-transfer', { method: 'POST', body: fd });
      await refresh();
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت فیش انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  const go = (path: string) => { window.location.href = path; };

  if (ticketId && status) {
    if (status.status === 'SUCCESS') {
      return (
        <div className="mx-auto w-full max-w-2xl px-3 pb-24 sm:px-5">
          <div className="rounded-[32px] border border-emerald-400/20 bg-[#111827] p-7 text-center text-white shadow-2xl">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-4xl text-emerald-300">✓</div>
            <p className="mt-5 text-xs font-bold text-emerald-300/70">پرداخت زیبال</p>
            <h2 className="mt-2 text-2xl font-black">شارژ با موفقیت انجام شد</h2>
            <p className="mt-3 text-sm leading-7 text-white/50">نتیجه توسط سرور از زیبال تأیید شد و مبلغ به کیف پول شما اضافه شد.</p>
            <p className="mt-4 text-xs text-white/30" dir="ltr">Ticket ID: {status.ticketId}</p>
            <button onClick={() => go('/panel')} className="mt-7 w-full rounded-2xl bg-white px-4 py-4 text-sm font-black text-black">بازگشت به پنل</button>
          </div>
        </div>
      );
    }

    if (status.status === 'FAILED' || status.status === 'EXPIRED') {
      return (
        <div className="mx-auto w-full max-w-2xl px-3 pb-24 sm:px-5">
          <div className="rounded-[32px] border border-red-400/20 bg-[#111827] p-7 text-center text-white shadow-2xl">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-400/10 text-4xl text-red-300">!</div>
            <p className="mt-5 text-xs font-bold text-red-300/70">پرداخت زیبال</p>
            <h2 className="mt-2 text-2xl font-black">{status.status === 'EXPIRED' ? 'مهلت پرداخت تمام شد' : 'پرداخت تکمیل نشد'}</h2>
            <p className="mt-3 text-sm leading-7 text-white/50">وضعیت پرداخت فقط بر اساس بررسی سرور مشخص شده است و اطلاعات ارسالی مرورگر قابل اعتماد نیست.</p>
            <button onClick={() => go('/panel')} className="mt-7 w-full rounded-2xl bg-white px-4 py-4 text-sm font-black text-black">بازگشت به پنل</button>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-2xl px-3 pb-24 sm:px-5">
        <div className="rounded-[32px] border border-amber-400/20 bg-[#111827] p-7 text-center text-white shadow-2xl">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-400/10 text-4xl text-amber-300">…</div>
          <p className="mt-5 text-xs font-bold text-amber-300/70">پرداخت زیبال</p>
          <h2 className="mt-2 text-2xl font-black">در حال بررسی پرداخت</h2>
          <p className="mt-3 text-sm leading-7 text-white/50">درگاه زیبال در مرورگر جداگانه باز شده است. شما لازم نیست کاری برای Callback انجام دهید؛ سرور به‌صورت خودکار پرداخت را بررسی می‌کند.</p>
          <div className="mt-5 rounded-2xl bg-white/[.04] p-4 text-right">
            <div className="flex justify-between text-sm"><span className="text-white/40">مبلغ</span><strong>{fa(Number(status.amount))} {status.currency}</strong></div>
            <div className="mt-2 flex justify-between text-sm"><span className="text-white/40">وضعیت</span><strong className="text-amber-300">در حال بررسی</strong></div>
            <div className="mt-2 flex justify-between text-sm"><span className="text-white/40">Ticket ID</span><span className="font-mono text-xs text-white/40">{status.ticketId}</span></div>
          </div>
          <p className="mt-4 text-xs text-white/30">این صفحه هر ۲ ثانیه وضعیت ثبت‌شده در سرور را بررسی می‌کند. Job سرور نیز حداکثر هر یک دقیقه از زیبال Verify می‌گیرد.</p>
          <button onClick={() => { void refresh(); }} className="mt-7 w-full rounded-2xl bg-white px-4 py-4 text-sm font-black text-black">به‌روزرسانی موجودی</button>
          <button onClick={() => go('/panel')} className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white/70">بازگشت به پنل</button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 pb-24 sm:px-5">
        <div className="rounded-[32px] border border-emerald-400/20 bg-[#111827] p-7 text-center text-white shadow-2xl">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-4xl text-emerald-300">✓</div>
          <h2 className="mt-5 text-2xl font-black">درخواست شما ثبت شد</h2>
          <p className="mt-3 text-sm leading-7 text-white/50">پس از بررسی فیش، نتیجه و موجودی کیف پول شما به‌روزرسانی می‌شود.</p>
          <button onClick={() => go('/panel')} className="mt-7 w-full rounded-2xl bg-white px-4 py-4 text-sm font-black text-black">بازگشت به پنل</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-24 sm:px-5">
      <div className="w-full rounded-[32px] border border-white/10 bg-[#111827] p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-bold text-cyan-300/70">کیف پول</p><h2 className="mt-1 text-2xl font-black">شارژ حساب</h2></div>
          <button type="button" disabled={busy} onClick={() => go('/panel')} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><ArrowRight size={18} /></button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <label className="block text-xs font-bold text-white/50">مبلغ شارژ</label>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="مثلاً 500000" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left text-lg font-bold outline-none focus:border-cyan-300/60" />
          {zibal && <p className="mt-2 text-xs text-white/35">حداقل {fa(min)} و حداکثر {fa(max)} تومان</p>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/[.04] p-1">
          <button type="button" onClick={() => { setMode('ONLINE'); setError(''); }} className={`rounded-xl px-3 py-3 text-sm font-bold ${mode === 'ONLINE' ? 'bg-cyan-300 text-black' : 'text-white/55'}`}>پرداخت آنلاین</button>
          <button type="button" onClick={() => { setMode('CARD'); setError(''); }} className={`rounded-xl px-3 py-3 text-sm font-bold ${mode === 'CARD' ? 'bg-cyan-300 text-black' : 'text-white/55'}`}>کارت به کارت</button>
        </div>

        {mode === 'ONLINE' && (
          <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-300/[.04] p-5">
            <h3 className="font-black">پرداخت امن با زیبال</h3>
            <p className="mt-2 text-sm leading-6 text-white/50">پس از ثبت درخواست، همین صفحه به صفحه وضعیت پرداخت تبدیل می‌شود و درگاه زیبال در مرورگر جداگانه باز خواهد شد.</p>
            {error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
            <button type="button" disabled={busy || !zibal?.enabled || !validAmount} onClick={onlinePayment} className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-4 text-sm font-black text-black disabled:opacity-40">{busy ? 'در حال ایجاد درخواست…' : 'ادامه و پرداخت آنلاین'}</button>
          </div>
        )}

        {mode === 'CARD' && (
          <form onSubmit={submitCardTransfer} className="mt-5 rounded-3xl border border-white/10 bg-white/[.03] p-5">
            <label className="block text-xs font-bold text-white/50">روش کارت به کارت</label>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm">
              <option value="">انتخاب کنید</option>
              {cards.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
            </select>
            <label className="mt-4 block text-xs font-bold text-white/50">فیش واریزی</label>
            <input type="file" accept="image/*" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
            {error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
            <button disabled={busy} className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-4 text-sm font-black text-black disabled:opacity-40">ثبت درخواست شارژ</button>
          </form>
        )}
      </div>
    </div>
  );
}
