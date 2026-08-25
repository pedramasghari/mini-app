'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, fa } from '@/lib/api';
import { usePanel } from '@/context/PanelContext';
import { ArrowRight } from 'lucide-react';

type ZibalConfig = { enabled: boolean; minAmount: string; maxAmount: string; currency: string };

type PaymentMode = 'ONLINE' | 'CARD';

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
      const payment = await api<{ paymentUrl: string }>('zibal/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: String(numeric) }),
      });
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

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-24 sm:px-5">
      <div className="w-full rounded-[32px] border border-white/10 bg-[#111827] p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-cyan-300/70">کیف پول</p>
            <h2 className="mt-1 text-2xl font-black">شارژ حساب</h2>
          </div>
          <button type="button" disabled={busy} onClick={() => go('/panel')} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-xl">
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <label className="block text-xs font-bold text-white/50">مبلغ شارژ</label>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="مثلاً 500000"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left text-lg font-bold outline-none focus:border-cyan-300/60"
          />
          {zibal && <p className="mt-2 text-xs text-white/35">حداقل {fa(min)} و حداکثر {fa(max)} تومان</p>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/[.04] p-1">
          <button type="button" onClick={() => { setMode('ONLINE'); setError(''); }} className={`rounded-xl px-3 py-3 text-sm font-bold ${mode === 'ONLINE' ? 'bg-cyan-300 text-black' : 'text-white/55'}`}>
            پرداخت آنلاین
          </button>
          <button type="button" onClick={() => { setMode('CARD'); setError(''); }} className={`rounded-xl px-3 py-3 text-sm font-bold ${mode === 'CARD' ? 'bg-cyan-300 text-black' : 'text-white/55'}`}>
            کارت به کارت
          </button>
        </div>

        {mode === 'ONLINE' && (
          <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-300/[.04] p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-2xl">🌐</span>
              <div>
                <h3 className="font-black">پرداخت امن با زیبال</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">بعد از پرداخت، زیبال شما را به برنامه برمی‌گرداند و تراکنش به‌صورت خودکار بررسی و در صورت موفق بودن به کیف پول اضافه می‌شود.</p>
              </div>
            </div>
            {error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
            <button type="button" disabled={busy || !zibal?.enabled || !validAmount} onClick={onlinePayment} className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-4 text-sm font-black text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30">
              {busy ? 'در حال اتصال به درگاه…' : !zibal?.enabled ? 'پرداخت آنلاین غیرفعال است' : `پرداخت ${validAmount ? fa(numeric) : ''} تومان`}
            </button>
          </div>
        )}

        {mode === 'CARD' && step !== 3 && (
          <form onSubmit={submitCardTransfer} className="mt-5">
            <div className="space-y-3">
              {cards.map((c) => (
                <button type="button" key={c.id} onClick={() => setSelected(c.id)} className={`w-full rounded-2xl border p-4 text-right ${selected === c.id ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-white/10 bg-white/5'}`}>
                  <div className="flex items-center justify-between"><b>{c.bankName || 'بانک'}</b><span className="text-xs text-white/40">{selected === c.id ? 'انتخاب شده' : 'انتخاب'}</span></div>
                  <p className="mt-3 text-lg font-black tracking-wider" dir="ltr">{c.cardNumber}</p>
                  <p className="mt-1 text-xs text-white/45">به نام {c.holderName}</p>
                </button>
              ))}
            </div>
            <label className="mt-5 block text-xs font-bold text-white/50">فیش واریزی</label>
            <input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="mt-2 w-full rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-xs" />
            {receipt && <p className="mt-2 truncate text-xs text-emerald-300">✓ {receipt.name}</p>}
            {error && <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
            <button disabled={busy || !receipt || !selected || !validAmount} className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-4 text-sm font-black text-black disabled:opacity-30">{busy ? 'در حال ارسال…' : 'ثبت فیش و ارسال برای بررسی'}</button>
          </form>
        )}

        {step === 3 && (
          <div className="py-10 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-400/15 text-3xl">✓</div>
            <h3 className="mt-5 text-xl font-black">درخواست ثبت شد</h3>
            <p className="mt-3 text-sm leading-7 text-white/50">فیش شما برای بررسی ارسال شد.</p>
            <button onClick={() => go('/panel')} className="mt-6 w-full rounded-2xl bg-white px-4 py-4 text-sm font-bold text-black">متوجه شدم</button>
          </div>
        )}
      </div>
    </div>
  );
}
