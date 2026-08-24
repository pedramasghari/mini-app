'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, fa } from '@/lib/api';

type RequestItem = {
  id: string;
  cardNumber: string;
  cardHolderName: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  receiptPath?: string | null;
  createdAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
};

type Page = { items: RequestItem[]; page: number; limit: number; total: number; pages: number };
type Filter = 'ALL' | RequestItem['status'];

const labels: Record<Filter, string> = { ALL: 'همه', PENDING: 'در حال انجام', COMPLETED: 'انجام شده', CANCELLED: 'لغو شده' };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function WalletRequestsPage() {
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10', sort: 'pending_first', order: 'desc' });
      if (filter !== 'ALL') params.set('status', filter);
      setData(await api<Page>(`wallet/withdrawals?${params.toString()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت درخواست‌ها');
    } finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  function changeFilter(value: Filter) { setFilter(value); setPage(1); }

  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-24">
      <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm text-white/45">کیف پول</p><h1 className="mt-1 text-2xl font-bold">درخواست‌های برداشت</h1><p className="mt-2 text-sm text-white/50">درخواست‌ها ابتدا بر اساس وضعیت «در حال انجام» و سپس بر اساس جدیدترین زمان نمایش داده می‌شوند.</p></div>
          <div className="rounded-2xl bg-white/[0.06] px-4 py-3"><div className="text-xs text-white/40">تعداد درخواست‌ها</div><div className="mt-1 font-bold">{fa(data?.total ?? 0)}</div></div>
        </div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(labels) as Filter[]).map((value) => <button key={value} onClick={() => changeFilter(value)} className={`rounded-2xl px-4 py-2 text-sm transition ${filter === value ? 'bg-teal-400 text-black' : 'bg-white/[0.05] text-white/65 hover:bg-white/[0.09]'}`}>{labels[value]}</button>)}
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}

      <section className="space-y-3">
        {loading && <div className="rounded-3xl border border-white/10 p-10 text-center text-sm text-white/40">در حال دریافت درخواست‌ها...</div>}
        {!loading && data?.items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><div className="text-lg font-bold">{fa(item.amount)} <span className="text-sm font-normal text-white/45">{item.currency}</span></div><div className="mt-1 flex items-center gap-2 text-xs text-white/45"><span>{formatDate(item.createdAt)}</span>{item.status === 'PENDING' && <span className="text-amber-300">• در حال بررسی</span>}</div></div>
              <span className={`rounded-full px-3 py-1 text-xs ${item.status === 'PENDING' ? 'bg-amber-400/10 text-amber-200' : item.status === 'COMPLETED' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/10 text-white/50'}`}>{labels[item.status]}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">شماره کارت</div><div dir="ltr" className="mt-1 text-left">•••• •••• •••• {item.cardNumber.slice(-4)}</div></div><div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">به نام</div><div className="mt-1 truncate">{item.cardHolderName}</div></div><div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">شناسه درخواست</div><div dir="ltr" className="mt-1 truncate">{item.id}</div></div></div>
            {item.status === 'COMPLETED' && item.completedAt && <div className="mt-3 text-xs text-emerald-300/70">واریز شده در {formatDate(item.completedAt)}</div>}
            {item.status === 'CANCELLED' && item.cancelledAt && <div className="mt-3 text-xs text-white/40">لغو شده در {formatDate(item.cancelledAt)}</div>}
          </article>
        ))}
        {!loading && !data?.items.length && <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">درخواستی با این فیلتر پیدا نشد.</div>}
      </section>

      {data && data.pages > 1 && <nav className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3"><button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm disabled:opacity-30">قبلی</button><span className="text-sm text-white/50">صفحه {fa(page)} از {fa(data.pages)}</span><button disabled={page >= data.pages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm disabled:opacity-30">بعدی</button></nav>}
    </main>
  );
}
