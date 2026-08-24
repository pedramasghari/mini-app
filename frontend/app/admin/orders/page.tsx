'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Copy, CreditCard, Loader2, Package, Server, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, fa } from '../../../lib/api';

type OrderItem = { id: string; userId: string; kind: 'ORDER' | 'SMSCODE'; status: string; amount: string | number; currency: string; createdAt: string; updatedAt: string; product?: { id: string; title: string } | null; service?: { id: string; title: string } | null; phoneNumber?: string | null; providerOrderId?: string | null; refunded?: boolean; user?: Record<string, unknown> | null };
type ListResponse = { items: OrderItem[]; page: number; limit: number; total: number; pages: number; statuses: string[] };
type Detail = { found: boolean; kind?: 'ORDER' | 'SMSCODE'; order?: Record<string, unknown>; product?: Record<string, unknown> | null; service?: Record<string, unknown> | null; user?: Record<string, unknown> | null; sms?: Record<string, unknown> | null };
const date = (v: unknown) => v ? new Date(String(v)).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const money = (v: unknown, c = 'IRT') => `${fa(Number(v || 0))} ${c}`;
const statusLabel = (s: string) => ({ CREATING: 'در حال ایجاد', PROVIDER_PENDING: 'در انتظار سرویس‌دهنده', ACTIVE: 'فعال', OTP_RECEIVED: 'کد دریافت شد', COMPLETED: 'تکمیل شده', CANCELLED: 'لغو شده', FAILED: 'ناموفق', REFUNDED: 'بازگشت وجه' } as Record<string, string>)[s] ?? s;

export default function AdminOrdersPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<{ id: string; kind: string } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = () => { setLoading(true); api<ListResponse>(`admin/orders?page=${page}&limit=10${status ? `&status=${encodeURIComponent(status)}` : ''}`).then(setData).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [page, status]);
  useEffect(() => { if (!selected) { setDetail(null); return; } setDetailLoading(true); api<Detail>(`admin/orders/${encodeURIComponent(selected.id)}?kind=${encodeURIComponent(selected.kind)}`).then(setDetail).finally(() => setDetailLoading(false)); }, [selected]);

  return <div dir="rtl" className="space-y-5">
    <div><div className="text-xs text-white/30">مدیریت / سفارش‌ها</div><h1 className="mt-1 text-2xl font-black">تمام سفارش‌ها</h1><p className="mt-1 text-xs text-white/35">لیست متمرکز سفارش‌های سرویس و SMSCode</p></div>
    <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#0b111a] p-3">
      <button onClick={() => { setStatus(''); setPage(1); }} className={`rounded-xl px-4 py-2 text-xs font-bold ${!status ? 'bg-cyan-400 text-slate-950' : 'bg-white/5 text-white/50'}`}>همه</button>
      {(data?.statuses ?? []).map(s => <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`rounded-xl px-4 py-2 text-xs font-bold ${status === s ? 'bg-cyan-400 text-slate-950' : 'bg-white/5 text-white/50'}`}>{statusLabel(s)}</button>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0b111a]">
        <div className="flex items-center justify-between border-b border-white/10 p-5"><h2 className="font-black">سفارش‌ها</h2><span className="text-xs text-white/30">{fa(data?.total ?? 0)} سفارش</span></div>
        {loading ? <div className="grid min-h-[420px] place-items-center"><Loader2 className="animate-spin text-cyan-300" /></div> : <div className="divide-y divide-white/[0.06]">{(data?.items ?? []).map(o => <button key={`${o.kind}-${o.id}`} onClick={() => setSelected({ id: o.id, kind: o.kind })} className={`flex w-full items-center gap-3 p-4 text-right transition hover:bg-white/[0.03] ${selected?.id === o.id && selected?.kind === o.kind ? 'bg-cyan-400/[0.05]' : ''}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">{o.kind === 'SMSCODE' ? <Server size={17} /> : <Package size={17} />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-bold">{o.service?.title ?? o.product?.title ?? (o.kind === 'SMSCODE' ? 'SMSCode' : 'سفارش سرویس')}</span><span className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-white/45">{statusLabel(o.status)}</span></div><div className="mt-1 text-[10px] text-white/30">{o.user?.telegramId ? `Telegram: ${o.user.telegramId}` : o.userId} · {date(o.createdAt)}</div></div><div className="text-left"><div className="font-black">{money(o.amount, o.currency)}</div><div className="mt-1 text-[10px] text-white/25">{o.kind}</div></div></button>)}{!data?.items.length && <div className="p-10 text-center text-sm text-white/30">سفارشی پیدا نشد.</div>}</div>}
        <div className="flex items-center justify-between border-t border-white/10 p-4 text-xs"><span className="text-white/30">صفحه {fa(page)} از {fa(data?.pages ?? 1)}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl border border-white/10 px-3 py-2 disabled:opacity-20">قبلی</button><button disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(p => p + 1)} className="rounded-xl border border-white/10 px-3 py-2 disabled:opacity-20">بعدی</button></div></div>
      </section>
      <section className="min-h-[520px]">{detailLoading ? <div className="grid h-full min-h-[420px] place-items-center rounded-[26px] border border-white/10 bg-[#0b111a]"><Loader2 className="animate-spin text-cyan-300" /></div> : detail?.found ? <OrderDetail data={detail} /> : <div className="grid min-h-[420px] place-items-center rounded-[26px] border border-dashed border-white/10 bg-[#0b111a] p-8 text-center text-sm text-white/25">برای مشاهده جزئیات، یک سفارش را انتخاب کنید.</div>}</section>
    </div>
  </div>;
}

function OrderDetail({ data }: { data: Detail }) { const order = data.order ?? {}; const user = data.user ?? {}; const product = data.product ?? {}; const service = data.service ?? {}; const sms = data.sms ?? {}; const isSms = data.kind === 'SMSCODE'; const currency = String(order.currency ?? 'IRT'); return <div className="space-y-4 rounded-[26px] border border-white/10 bg-[#0b111a] p-5"><div><div className="text-xs text-white/30">جزئیات سفارش</div><h2 className="mt-1 text-xl font-black">{String(service.title ?? product.title ?? (isSms ? 'SMSCode Order' : 'سفارش سرویس'))}</h2></div><div className="grid gap-3 sm:grid-cols-2"><Info icon={Package} title="وضعیت" value={statusLabel(String(order.status ?? '—'))} /><Info icon={CreditCard} title="مبلغ" value={money(order.amount ?? order.chargedAmount, currency)} /><Info icon={Clock3} title="تاریخ" value={date(order.createdAt)} /><Info icon={UserRound} title="Telegram ID" value={String(user.telegramId ?? '—')} /></div><div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3"><Detail label="Order ID" value={String(order.id ?? '—')} copy /><Detail label="User ID" value={String(user.id ?? '—')} copy />{isSms && <><Detail label="Provider Order ID" value={String(order.providerOrderId ?? '—')} copy /><Detail label="شماره" value={String(order.phoneNumber ?? sms.phoneNumber ?? '—')} copy /><Detail label="انقضا" value={date(order.expiresAt ?? sms.expiresAt)} /><Detail label="Refund" value={order.refundedAt ? `بله · ${money(order.refundedAmount, currency)}` : 'خیر'} /></>}</div>{isSms && <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-cyan-300"><Server size={15} /> کنترل SMSCode</div><div className="text-xs text-white/45">وضعیت سرویس‌دهنده: {String(sms.status ?? order.status ?? '—')}</div></div>}</div> }
function Info({ icon: Icon, title, value }: { icon: LucideIcon; title: string; value: string }) { return <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="mb-1 flex items-center gap-2 text-[10px] text-white/25"><Icon size={13} />{title}</div><div className="truncate text-sm font-black">{value}</div></div>; }
function Detail({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) { return <div><div className="mb-1 text-[10px] text-white/25">{label}</div><div className="flex items-center gap-2 text-sm text-white/65"><span className="min-w-0 flex-1 break-all">{value}</span>{copy && value !== '—' && <button onClick={() => void navigator.clipboard?.writeText(value)} className="text-white/25 hover:text-cyan-300"><Copy size={13} /></button>}</div></div>; }
