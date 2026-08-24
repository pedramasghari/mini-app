'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, fa } from '@/lib/api';
import { usePanel } from '@/context/PanelContext';

type Withdrawal = {
  id: string;
  cardNumber: string;
  cardHolderName: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  receiptPath?: string | null;
  createdAt: string;
};

type Page = { items: Withdrawal[]; page: number; limit: number; total: number; pages: number };

const statusText: Record<Withdrawal['status'], string> = { PENDING: 'در حال انجام', COMPLETED: 'انجام شده', CANCELLED: 'لغو شده' };

function receiptUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export default function WithdrawalsPage() {
  const { me, refresh } = usePanel();
  const [amount, setAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    const result = await api<Page>(`wallet/withdrawals?page=${page}&limit=10`);
    setData(result);
  }, [page]);

  useEffect(() => { load().catch((e) => setError(e instanceof Error ? e.message : 'خطا در دریافت درخواست‌ها')); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      await api<Withdrawal>('wallet/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, cardNumber, cardHolderName }) });
      setAmount(''); setCardNumber(''); setCardHolderName(''); setPage(1); setSuccess('درخواست برداشت با موفقیت ثبت شد.'); await Promise.all([load(), refresh()]);
    } catch (e) { setError(e instanceof Error ? e.message : 'ثبت درخواست ناموفق بود.'); } finally { setLoading(false); }
  }

  async function cancel(id: string) {
    setError(''); setCancelId(id);
    try { await api(`wallet/withdrawals/${id}/cancel`, { method: 'POST' }); setSuccess('درخواست لغو شد و مبلغ به کیف پول بازگشت.'); await Promise.all([load(), refresh()]); }
    catch (e) { setError(e instanceof Error ? e.message : 'لغو درخواست ناموفق بود.'); }
    finally { setCancelId(null); }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4 pb-24 text-right" dir="rtl">
      <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
        <p className="text-sm text-white/50">کیف پول</p>
        <div className="mt-2 flex items-end justify-between gap-4"><div><h1 className="text-2xl font-bold">برداشت وجه</h1><p className="mt-1 text-sm text-white/55">درخواست برداشت را ثبت کنید؛ مبلغ تا زمان واریز نزد سیستم رزرو می‌شود.</p></div><div className="rounded-2xl bg-white/[0.06] px-4 py-3 text-left"><div className="text-xs text-white/45">موجودی</div><div className="mt-1 font-bold">{fa(me?.wallet?.balance ?? 0)} {me?.wallet?.currency ?? 'IRT'}</div></div></div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-lg font-semibold">درخواست برداشت جدید</h2><form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block"><span className="mb-2 block text-sm text-white/65">شماره کارت</span><input dir="ltr" inputMode="numeric" maxLength={19} value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="6037 0000 0000 0000" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-teal-400" /></label>
        <label className="block"><span className="mb-2 block text-sm text-white/65">به نام</span><input value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} placeholder="نام و نام خانوادگی صاحب کارت" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-teal-400" /></label>
        <label className="block"><span className="mb-2 block text-sm text-white/65">مبلغ برداشت</span><input dir="ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/,/g, ''))} placeholder="1000000" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-teal-400" /></label>
        {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}{success && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{success}</div>}
        <button disabled={loading} className="w-full rounded-2xl bg-teal-500 px-4 py-3 font-semibold text-black transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'در حال ثبت...' : 'ثبت درخواست برداشت'}</button>
      </form></section>

      <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">درخواست‌های من</h2><span className="text-xs text-white/40">{data?.total ?? 0} درخواست</span></div>
        {data?.items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{fa(item.amount)} {item.currency}</div><div className="mt-1 text-xs text-white/45">{new Date(item.createdAt).toLocaleString('fa-IR')}</div></div><span className={`rounded-full px-3 py-1 text-xs ${item.status === 'PENDING' ? 'bg-amber-400/10 text-amber-200' : item.status === 'COMPLETED' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/10 text-white/50'}`}>{statusText[item.status]}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">کارت</div><div dir="ltr" className="mt-1 text-left">•••• •••• •••• {item.cardNumber.slice(-4)}</div></div><div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">به نام</div><div className="mt-1">{item.cardHolderName}</div></div></div>
            {item.status === 'COMPLETED' && item.receiptPath && <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-emerald-200">رسید واریز</span><a href={receiptUrl(item.receiptPath)} target="_blank" rel="noreferrer" className="text-xs text-teal-300 hover:text-teal-200">مشاهده کامل</a></div>{/\.(jpe?g|png|webp)$/i.test(item.receiptPath) ? <img src={receiptUrl(item.receiptPath)} alt="رسید واریز" className="max-h-96 w-full rounded-xl object-contain" loading="lazy" /> : <a href={receiptUrl(item.receiptPath)} target="_blank" rel="noreferrer" className="block rounded-xl bg-black/20 p-4 text-center text-sm text-white/70 hover:bg-black/30">مشاهده فایل رسید واریز</a>}</div>}
            {item.status === 'PENDING' && <button disabled={cancelId === item.id} onClick={() => cancel(item.id)} className="mt-4 w-full rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200 disabled:opacity-50">{cancelId === item.id ? 'در حال لغو...' : 'لغو درخواست و بازگشت مبلغ'}</button>}
          </article>
        ))}
        {!data?.items.length && <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">هنوز درخواست برداشتی ثبت نشده است.</div>}
        {data && data.pages > 1 && <div className="flex items-center justify-between rounded-2xl border border-white/10 p-3"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl bg-white/5 px-4 py-2 text-sm disabled:opacity-30">قبلی</button><span className="text-sm text-white/50">صفحه {page} از {data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-xl bg-white/5 px-4 py-2 text-sm disabled:opacity-30">بعدی</button></div>}
      </section>
    </main>
  );
}
