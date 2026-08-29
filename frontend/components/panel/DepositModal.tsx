'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, fa } from '@/lib/api';
import { usePanel } from '@/context/PanelContext';
import { ArrowRight } from 'lucide-react';

type ZibalConfig = { enabled: boolean; minAmount: string; maxAmount: string; currency: string };
type PaymentMode = 'ONLINE' | 'CARD';
type Payment = {
  id: string;
  ticketId: string;
  paymentUrl: string | null;
  trackId: string | null;
  amount: string;
  currency: string;
  expiresAt: string;
};

export default function DepositModal() {
  const { methods, refresh } = usePanel();
  const cards = useMemo(() => methods.filter((m) => m.type === 'CARD_TRANSFER'), [methods]);
  const [mode, setMode] = useState<PaymentMode>('ONLINE');
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [zibal, setZibal] = useState<ZibalConfig | null>(null);

  useEffect(() => {
    api<ZibalConfig>('zibal/config').then(setZibal).catch(() => setZibal(null));
  }, []);

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

      if (!payment.paymentUrl || !payment.ticketId) {
        throw new Error('لینک درگاه زیبال دریافت نشد.');
      }

      // Keep the gateway in the current Mini App tab. Opening a second browser
      // tab/window causes Telegram WebView to lose the Mini App session on some clients.
      window.location.assign(payment.paymentUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ایجاد پرداخت آنلاین انجام نشد.');
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
            <p className="mt-2 text-sm leading-6 text-white/50">درگاه زیبال در همین تب باز می‌شود و پس از پرداخت، نتیجه از سرور بررسی و در صفحه وضعیت نمایش داده می‌شود.</p>
            {error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
            <button type="button" disabled={busy || !zibal?.enabled || !validAmount} onClick={onlinePayment} className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-4 text-sm font-black text-black disabled:opacity-40">{busy ? 'در حال ایجاد درخواست…' : 'ادامه و پرداخت آنلاین'}</button>
          </div>
        )}

        {mode === 'CARD' && (
          <form onSubmit={submitCardTransfer} className="mt-5 rounded-3xl border border-white/10 bg-white/[.03] p-5">
            <label className="block text-xs font-bold text-white/50">روش کارت به کارت</label>
            <div className='flex flex-col w-full gap-2'>
            {cards.map((card) => <div className='w-full rounded-lg bg-white/30 border border-[#333]' key={card.id} onClick={() => setSelected(card.id)}>{card.cardNumber}</div>)}
            </div>
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
