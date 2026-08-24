'use client';

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { api, fa } from '@/lib/api';

type Withdrawal = {
  id: string; userId: string; cardNumber: string; cardHolderName: string; amount: string; currency: string; status: 'PENDING' | 'COMPLETED' | 'CANCELLED'; receiptPath?: string | null; createdAt: string; completedAt?: string | null;
  user?: { id: string; telegramId: string; username?: string | null; firstName?: string | null; lastName?: string | null } | null;
};
type Page = { items: Withdrawal[]; page: number; limit: number; total: number; pages: number };

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), limit: '10' });
    if (status) query.set('status', status);
    const result = await api<Page>(`admin/withdrawals?${query}`);
    setData(result);
    if (selected) setSelected(result.items.find((item) => item.id === selected.id) ?? null);
  }, [page, selected, status]);

  useEffect(() => { load().catch((e) => setError(e instanceof Error ? e.message : 'خطا در دریافت درخواست‌ها')); }, [load]);

  function changeStatus(value: string) { setStatus(value); setPage(1); setSelected(null); }
  function chooseFile(event: ChangeEvent<HTMLInputElement>) { setReceipt(event.target.files?.[0] ?? null); }

  async function complete() {
    if (!selected || !receipt) return;
    setError(''); setMessage(''); setLoading(true);
    try {
      const form = new FormData(); form.append('receipt', receipt);
      await api(`admin/withdrawals/${selected.id}/complete`, { method: 'POST', body: form });
      setReceipt(null); setMessage('وضعیت درخواست به انجام شده تغییر کرد.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'ثبت واریز ناموفق بود.'); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-full p-5 text-right" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><p className="text-sm text-white/45">مدیریت مالی</p><h1 className="mt-1 text-2xl font-bold">درخواست‌های برداشت</h1><p className="mt-2 text-sm text-white/45">درخواست‌های در حال انجام را بررسی کنید و پس از واریز، رسید را ثبت کنید.</p></header>
        {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</div>}
        <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-4"><button onClick={() => changeStatus('PENDING')} className={`rounded-xl px-4 py-2 text-sm ${status === 'PENDING' ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'}`}>در حال انجام</button><button onClick={() => changeStatus('COMPLETED')} className={`rounded-xl px-4 py-2 text-sm ${status === 'COMPLETED' ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'}`}>انجام شده</button><button onClick={() => changeStatus('CANCELLED')} className={`rounded-xl px-4 py-2 text-sm ${status === 'CANCELLED' ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'}`}>لغو شده</button><button onClick={() => changeStatus('')} className={`rounded-xl px-4 py-2 text-sm ${status === '' ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'}`}>همه</button></div>
            <div className="divide-y divide-white/5">
              {data?.items.map((item) => <button key={item.id} onClick={() => setSelected(item)} className={`block w-full p-4 text-right transition hover:bg-white/[0.04] ${selected?.id === item.id ? 'bg-teal-400/5' : ''}`}><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{fa(item.amount)} {item.currency}</div><div className="mt-1 text-xs text-white/45">{item.user?.firstName || ''} {item.user?.lastName || ''} · Telegram: {item.user?.telegramId ?? '—'}</div></div><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-200">{item.status === 'PENDING' ? 'در حال انجام' : item.status === 'COMPLETED' ? 'انجام شده' : 'لغو شده'}</span></div><div className="mt-2 text-xs text-white/35">کارت •••• {item.cardNumber.slice(-4)} · {new Date(item.createdAt).toLocaleString('fa-IR')}</div></button>)}
              {!data?.items.length && <div className="p-10 text-center text-sm text-white/40">درخواستی در این وضعیت وجود ندارد.</div>}
            </div>
            {data && data.pages > 1 && <div className="flex items-center justify-between border-t border-white/10 p-4"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl bg-white/5 px-4 py-2 text-sm disabled:opacity-30">قبلی</button><span className="text-sm text-white/45">{page} / {data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-xl bg-white/5 px-4 py-2 text-sm disabled:opacity-30">بعدی</button></div>}
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            {!selected ? <div className="flex min-h-[360px] items-center justify-center text-center text-sm text-white/35">یک درخواست را برای مشاهده جزئیات انتخاب کنید.</div> : <div className="space-y-5"><div><div className="text-xs text-white/40">مبلغ برداشت</div><div className="mt-1 text-2xl font-bold">{fa(selected.amount)} <span className="text-sm text-white/45">{selected.currency}</span></div></div><div className="space-y-3 rounded-2xl bg-black/15 p-4"><div><div className="text-xs text-white/40">کاربر</div><div className="mt-1">{selected.user?.firstName} {selected.user?.lastName}</div><div className="text-xs text-white/45">Telegram ID: {selected.user?.telegramId}</div></div><div><div className="text-xs text-white/40">شماره کارت</div><div dir="ltr" className="mt-1 text-left font-medium">{selected.cardNumber}</div></div><div><div className="text-xs text-white/40">به نام</div><div className="mt-1">{selected.cardHolderName}</div></div></div>{selected.status === 'PENDING' && <div className="space-y-3"><label className="block rounded-2xl border border-dashed border-white/15 p-4"><span className="block text-sm font-medium">تصویر/فایل واریزی</span><span className="mt-1 block text-xs text-white/40">JPG، PNG، WebP یا PDF تا ۵ مگابایت</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={chooseFile} className="mt-3 block w-full text-sm" /></label><button disabled={!receipt || loading} onClick={complete} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{loading ? 'در حال ثبت...' : 'ثبت واریز و تکمیل درخواست'}</button></div>}{selected.receiptPath && <a target="_blank" rel="noreferrer" href={selected.receiptPath} className="block rounded-2xl bg-white/5 p-3 text-center text-sm text-teal-300">مشاهده رسید واریز</a>}</div>}
          </aside>
        </div>
      </div>
    </main>
  );
}
