'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, fa } from '@/lib/api';

type Kind = 'WITHDRAWAL' | 'DEPOSIT';
type Status = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

type RequestItem = {
  id: string;
  kind: Kind;
  amount: string;
  currency: string;
  status: Status;
  createdAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  rejectedAt?: string | null;
  receiptPath?: string | null;
  cardNumber?: string;
  cardHolderName?: string;
  adminReason?: string | null;
  gateway?: 'CARD_TRANSFER' | 'ZIBAL' | null;
  gatewayTrackId?: string | null;
  gatewayResult?: string | null;
  gatewayMessage?: string | null;
  gatewayRefNumber?: string | null;
  gatewayPaidAt?: string | null;
};

type Page = { items: RequestItem[]; page: number; limit: number; total: number; pages: number };
type Filter = 'ALL' | 'PENDING' | 'WITHDRAWAL' | 'DEPOSIT' | 'COMPLETED' | 'CANCELLED' | 'REJECTED' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

const filters: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'همه' },
  { value: 'PENDING', label: 'در حال انجام' },
  { value: 'WITHDRAWAL', label: 'برداشت' },
  { value: 'DEPOSIT', label: 'شارژ' },
  { value: 'SUCCESS', label: 'پرداخت موفق' },
  { value: 'FAILED', label: 'پرداخت ناموفق' },
  { value: 'EXPIRED', label: 'منقضی شده' },
  { value: 'COMPLETED', label: 'برداشت انجام شده' },
  { value: 'CANCELLED', label: 'برداشت لغو شده' },
  { value: 'REJECTED', label: 'شارژ رد شده' },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function statusLabel(item: RequestItem) {
  if (item.gateway === 'ZIBAL') {
    return item.status === 'PENDING' ? 'در حال بررسی زیبال' : item.status === 'SUCCESS' ? 'پرداخت موفق' : item.status === 'EXPIRED' ? 'منقضی شده' : 'پرداخت ناموفق';
  }
  if (item.kind === 'DEPOSIT') {
    return item.status === 'PENDING' ? 'در انتظار بررسی' : item.status === 'APPROVED' ? 'تأیید شده' : 'رد شده';
  }
  return item.status === 'PENDING' ? 'در حال انجام' : item.status === 'COMPLETED' ? 'انجام شده' : 'لغو شده';
}

function statusClass(item: RequestItem) {
  if (item.status === 'PENDING') return 'bg-amber-400/10 text-amber-200';
  if (item.status === 'APPROVED' || item.status === 'COMPLETED' || item.status === 'SUCCESS') return 'bg-emerald-400/10 text-emerald-200';
  return 'bg-white/10 text-white/50';
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
      const gatewayStatuses = ['SUCCESS', 'FAILED', 'EXPIRED'];
      const params = new URLSearchParams({ page: String(page), limit: '10', sort: 'pending_first', order: 'desc', type: filter === 'WITHDRAWAL' || filter === 'DEPOSIT' ? filter : 'ALL' });
      if (['PENDING', 'COMPLETED', 'CANCELLED', 'REJECTED', ...gatewayStatuses].includes(filter)) params.set('status', filter);
      setData(await api<Page>(`wallet/requests?${params.toString()}`));
    } catch (e) { setError(e instanceof Error ? e.message : 'خطا در دریافت درخواست‌ها'); }
    finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);
  const changeFilter = (value: Filter) => { setFilter(value); setPage(1); };

  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-24">
      <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm text-white/45">کیف پول</p><h1 className="mt-1 text-2xl font-bold">درخواست‌های کیف پول</h1><p className="mt-2 text-sm text-white/50">درخواست‌های شارژ و برداشت، به‌همراه وضعیت و اطلاعات درگاه زیبال.</p></div>
          <div className="rounded-2xl bg-white/[0.06] px-4 py-3"><div className="text-xs text-white/40">تعداد درخواست‌ها</div><div className="mt-1 font-bold">{fa(data?.total ?? 0)}</div></div>
        </div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-3"><div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item.value} onClick={() => changeFilter(item.value)} className={`rounded-2xl px-4 py-2 text-sm transition ${filter === item.value ? 'bg-teal-400 text-black' : 'bg-white/[0.05] text-white/65 hover:bg-white/[0.09]'}`}>{item.label}</button>)}</div></section>
      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}

      <section className="space-y-3">
        {loading && <div className="rounded-3xl border border-white/10 p-10 text-center text-sm text-white/40">در حال دریافت درخواست‌ها...</div>}
        {!loading && data?.items.map((item) => (
          <article key={`${item.kind}-${item.id}`} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.kind === 'DEPOSIT' ? 'bg-sky-400/10 text-sky-300' : 'bg-violet-400/10 text-violet-300'}`}>{item.kind === 'DEPOSIT' ? '↓' : '↑'}</div><div><div className="text-lg font-bold">{fa(item.amount)} <span className="text-sm font-normal text-white/45">{item.currency}</span></div><div className="mt-1 text-xs text-white/45">{item.kind === 'DEPOSIT' ? 'درخواست شارژ کیف پول' : 'درخواست برداشت وجه'} · {formatDate(item.createdAt)}</div></div></div>
              <span className={`rounded-full px-3 py-1 text-xs ${statusClass(item)}`}>{statusLabel(item)}</span>
            </div>
            {item.kind === 'WITHDRAWAL' && <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">شماره کارت</div><div dir="ltr" className="mt-1 text-left">•••• •••• •••• {(item.cardNumber ?? '').slice(-4)}</div></div><div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">به نام</div><div className="mt-1 truncate">{item.cardHolderName}</div></div><div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">شناسه</div><div dir="ltr" className="mt-1 truncate">{item.id}</div></div></div>}
            {item.kind === 'DEPOSIT' && item.gateway === 'CARD_TRANSFER' && item.receiptPath && <div className="mt-4 rounded-2xl bg-black/15 p-3 text-sm text-white/55">رسید پرداخت ثبت شده است.</div>}
            {item.gateway === 'ZIBAL' && <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">درگاه</div><div className="mt-1 font-bold text-cyan-200">زیبال</div></div>
              {item.gatewayTrackId && <div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">Track ID</div><div dir="ltr" className="mt-1 font-mono text-xs text-white/65">{item.gatewayTrackId}</div></div>}
              {item.gatewayResult && <div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">کد نتیجه</div><div dir="ltr" className="mt-1 font-mono text-xs text-white/65">{item.gatewayResult}</div></div>}
              {item.gatewayRefNumber && <div className="rounded-2xl bg-black/15 p-3"><div className="text-xs text-white/40">شماره مرجع</div><div dir="ltr" className="mt-1 font-mono text-xs text-white/65">{item.gatewayRefNumber}</div></div>}
              {item.gatewayMessage && <div className="rounded-2xl bg-black/15 p-3 sm:col-span-2"><div className="text-xs text-white/40">پیام درگاه</div><div className="mt-1 text-xs text-white/60">{item.gatewayMessage}</div></div>}
              {item.gatewayPaidAt && <div className="rounded-2xl bg-black/15 p-3 sm:col-span-2"><div className="text-xs text-white/40">زمان پرداخت</div><div className="mt-1 text-xs text-white/60">{formatDate(item.gatewayPaidAt)}</div></div>}
            </div>}
            {item.status === 'COMPLETED' && item.completedAt && <div className="mt-3 text-xs text-emerald-300/70">انجام شده در {formatDate(item.completedAt)}</div>}
            {item.status === 'APPROVED' && <div className="mt-3 text-xs text-emerald-300/70">شارژ تأیید شده است.</div>}
            {item.status === 'CANCELLED' && item.cancelledAt && <div className="mt-3 text-xs text-white/40">لغو شده در {formatDate(item.cancelledAt)}</div>}
            {item.status === 'REJECTED' && item.adminReason && <div className="mt-3 rounded-2xl bg-red-400/5 p-3 text-xs text-red-200">دلیل رد: {item.adminReason}</div>}
            {item.gateway === 'ZIBAL' && item.status === 'FAILED' && item.adminReason && <div className="mt-3 rounded-2xl bg-red-400/5 p-3 text-xs text-red-200">دلیل شکست درگاه: {item.adminReason}</div>}
          </article>
        ))}
        {!loading && !data?.items.length && <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">درخواستی با این فیلتر پیدا نشد.</div>}
      </section>

      {data && data.pages > 1 && <nav className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3"><button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm disabled:opacity-30">قبلی</button><span className="text-sm text-white/50">صفحه {fa(page)} از {fa(data.pages)}</span><button disabled={page >= data.pages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm disabled:opacity-30">بعدی</button></nav>}
    </main>
  );
}
