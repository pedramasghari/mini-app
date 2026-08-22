'use client';

import { useMemo, useState } from 'react';
import { api, fa } from '@/lib/api';
import { usePanel } from '@/context/PanelContext';

export default function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { methods, refresh } = usePanel();
  const cards = useMemo(() => methods.filter((m) => m.type === 'CARD_TRANSFER'), [methods]);
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const numeric = Number(amount.replace(/[^0-9.]/g, ''));
  const validAmount = Number.isFinite(numeric) && numeric > 0;
  const canContinue = Boolean(selected) && validAmount;

  async function submit(e: React.FormEvent) {
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
      setError(e instanceof Error ? e.message : 'ثبت فیش انجام نشد');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-3 backdrop-blur-md">
      <div className="mx-auto flex min-h-full max-w-lg items-center py-6">
        <div className="w-full rounded-[32px] border border-white/10 bg-[#111827] p-5 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-bold text-cyan-300/70">کیف پول</p><h2 className="mt-1 text-2xl font-black">شارژ حساب</h2></div>
            <button type="button" disabled={busy} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-xl">×</button>
          </div>
          <div className="mt-5 flex gap-1">{[1, 2, 3].map((x) => <div key={x} className={`h-1.5 flex-1 rounded-full ${x <= step ? 'bg-cyan-300' : 'bg-white/10'}`} />)}</div>

          {step === 1 && (
            <div className="mt-6">
              <p className="text-sm text-white/50">روش پرداخت و مبلغ موردنظر را مشخص کنید.</p>
              <button type="button" disabled={!cards.length} onClick={() => cards[0] && setSelected(cards[0].id)} className={`mt-4 flex w-full items-center gap-3 rounded-2xl border p-4 text-right ${selected ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-white/10 bg-white/5'} disabled:cursor-not-allowed disabled:opacity-50`}>
                <span className="text-2xl">💳</span><span><b className="block">کارت به کارت</b><small className="text-xs text-white/40">واریز بانکی و ارسال فیش</small></span>
              </button>
              <button type="button" disabled className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[.02] p-4 text-right opacity-40"><span className="text-2xl">🌐</span><span><b className="block">پرداخت آنلاین</b><small>به‌زودی فعال می‌شود</small></span></button>
              <label className="mt-5 block text-xs font-bold text-white/50">مبلغ شارژ</label>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="مثلاً 500000" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left outline-none focus:border-cyan-300/60" />
              {error && <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
              <button type="button" disabled={!canContinue} onClick={() => setStep(2)} className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-4 text-sm font-black text-black enabled:hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30">{canContinue ? 'ادامه' : 'روش پرداخت و مبلغ را انتخاب کنید'}</button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={submit} className="mt-6">
              <p className="text-sm leading-6 text-white/50">مبلغ <b className="text-white">{fa(numeric)}</b> را به یکی از کارت‌های زیر واریز کنید.</p>
              <div className="mt-4 space-y-3">
                {cards.map((c) => <button type="button" key={c.id} onClick={() => setSelected(c.id)} className={`w-full rounded-2xl border p-4 text-right ${selected === c.id ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-white/10 bg-white/5'}`}><div className="flex items-center justify-between"><b>{c.bankName || 'بانک'}</b><span className="text-xs text-white/40">{selected === c.id ? 'انتخاب شده' : 'انتخاب'}</span></div><p className="mt-3 text-lg font-black tracking-wider" dir="ltr">{c.cardNumber}</p><p className="mt-1 text-xs text-white/45">به نام {c.holderName}</p></button>)}
                {!cards.length && <div className="rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-100">در حال حاضر کارت فعالی ثبت نشده است.</div>}
              </div>
              <label className="mt-5 block text-xs font-bold text-white/50">فیش واریزی</label>
              <input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="mt-2 w-full rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-xs" />
              {receipt && <p className="mt-2 truncate text-xs text-emerald-300">✓ {receipt.name}</p>}
              {error && <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
              <button disabled={busy || !receipt || !selected} className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-4 text-sm font-black text-black disabled:opacity-30">{busy ? 'در حال ارسال…' : 'ثبت فیش و ارسال برای بررسی'}</button>
              <button type="button" disabled={busy} onClick={() => setStep(1)} className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm">مرحله قبل</button>
            </form>
          )}

          {step === 3 && <div className="py-10 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-400/15 text-3xl">✓</div><h3 className="mt-5 text-xl font-black">درخواست ثبت شد</h3><p className="mt-3 text-sm leading-7 text-white/50">فیش شما برای بررسی ارسال شد. پس از تأیید ادمین، حساب شما حداکثر تا ۳۰ دقیقه شارژ می‌شود.</p><button onClick={onClose} className="mt-6 w-full rounded-2xl bg-white px-4 py-4 text-sm font-bold text-black">متوجه شدم</button></div>}
        </div>
      </div>
    </div>
  );
}
