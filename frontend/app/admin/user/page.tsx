'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, ShoppingBag, Wallet, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api, fa } from '../../../lib/api';

type UserRow = { id: string; telegramId: string; username: string | null; firstName: string | null; lastName: string | null; photoUrl: string | null; role: string; createdAt: string; balance: string; currency: string; orderCount: number };
type Response = { items: UserRow[]; page: number; limit: number; total: number; pages: number };

export default function AdminUsersPage() {
  const router = useRouter();
  const [data, setData] = useState<Response>({ items: [], page: 1, limit: 10, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (page = 1) => {
    setLoading(true); setError('');
    try { setData(await api<Response>(`admin/users?page=${page}&limit=10&search=${encodeURIComponent(query)}`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'خطا در دریافت کاربران'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(1); }, [query]);
  const range = useMemo(() => { if (!data.total) return '۰ کاربر'; const a = (data.page - 1) * data.limit + 1; return `${fa(a)} تا ${fa(Math.min(data.page * data.limit, data.total))} از ${fa(data.total)}`; }, [data]);

  return <div dir="rtl" className="space-y-5 text-white">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 text-xs text-white/30">مدیریت / کاربران</div><h1 className="text-2xl font-black">مدیریت کاربران</h1><p className="mt-1 text-xs text-white/35">جستجو، موجودی و سفارش‌های هر کاربر</p></div>
      <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }} className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-[#0b111a] p-2"><Search size={17} className="mr-2 text-white/25" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Telegram ID، username، نام..." className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-white/20" /><button className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-black text-slate-950">جستجو</button></form>
    </div>
    <section className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0b111a]">
      <div className="border-b border-white/[0.06] px-5 py-4 text-xs text-white/35">{range}</div>
      {loading ? <div className="grid min-h-[420px] place-items-center"><Loader2 className="animate-spin text-cyan-300" /></div> : error ? <div className="p-10 text-center text-rose-300">{error}</div> : data.items.length === 0 ? <div className="grid min-h-[300px] place-items-center text-sm text-white/30">کاربری پیدا نشد.</div> : <div className="divide-y divide-white/[0.05]">
        {data.items.map((user) => <button key={user.id} onClick={() => router.push(`/admin/orders/${user.id}`)} className="grid w-full grid-cols-1 gap-4 px-5 py-4 text-right transition hover:bg-white/[0.025] md:grid-cols-[minmax(250px,1.5fr)_1fr_1fr_130px] md:items-center">
          <div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cyan-400/10 text-cyan-300">{user.photoUrl ? <img src={user.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={18} />}</div><div className="min-w-0"><div className="truncate font-bold">{user.firstName || user.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : user.username ? `@${user.username}` : 'کاربر'}</div><div className="mt-1 truncate text-xs text-white/35">Telegram ID: {user.telegramId}{user.username ? ` · @${user.username}` : ''}</div></div></div>
          <div className="flex items-center gap-2 text-sm"><ShoppingBag size={15} className="text-cyan-300/70" /><span>{fa(user.orderCount)} سفارش</span></div>
          <div className="flex items-center gap-2 text-sm"><Wallet size={15} className="text-emerald-300/70" /><span>{fa(user.balance)} {user.currency}</span></div>
          <div className="flex items-center justify-end gap-2 text-xs font-bold text-cyan-300">مشاهده سفارش‌ها <ChevronLeft size={16} /></div>
        </button>)}
      </div>}
      {data.pages > 1 && <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4"><button disabled={data.page <= 1 || loading} onClick={() => void load(data.page - 1)} className="rounded-xl border border-white/10 p-2 text-white/50 disabled:opacity-20"><ChevronRight size={17} /></button><div className="text-xs text-white/35">صفحه {fa(data.page)} از {fa(data.pages)}</div><button disabled={data.page >= data.pages || loading} onClick={() => void load(data.page + 1)} className="rounded-xl border border-white/10 p-2 text-white/50 disabled:opacity-20"><ChevronLeft size={17} /></button></div>}
    </section>
  </div>;
}
