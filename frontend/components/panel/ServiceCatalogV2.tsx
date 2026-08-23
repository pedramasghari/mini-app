'use client';

import Link from 'next/link';
import { Apple, ArrowLeft, ShoppingBag } from 'lucide-react';
import { usePanel } from '@/context/PanelContext';
import { useServiceStore } from '@/store/serviceStore';
import { fa } from '@/lib/api';

export default function ServiceCatalogV2() {
  const { services, products } = usePanel();
  const setSelection = useServiceStore((state) => state.setSelection);
  return <section className="mt-4 min-w-0 space-y-3 overflow-hidden">
    {services.map((service) => {
      const isApple = service.slug === 'apple-id' || service.icon === 'apple';
      const items = products.filter((p) => p.serviceId === service.id);
      return <article key={service.id} className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[.045] p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">{isApple ? <Apple size={25}/> : <ShoppingBag size={22}/>}</div>
          <div className="min-w-0 flex-1"><p className="text-[10px] text-white/40">سرویس</p><h3 className="truncate font-black">{isApple ? 'اپل آیدی' : service.title}</h3><p className="mt-1 line-clamp-1 text-xs text-white/40">{service.description}</p></div>
          <Link href={`/service/${service.slug}`} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-white/70 hover:bg-white/10">جزئیات <ArrowLeft size={14}/></Link>
        </div>
        <div className="mt-3 space-y-2">{items.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl bg-black/10 p-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{product.title}</p><p className="mt-1 text-[10px] text-white/40">{fa(product.price)} تومان</p></div><Link href={`/service/${service.slug}/purchase`} onClick={() => setSelection(service, product)} className="shrink-0 rounded-xl bg-cyan-300 px-3 py-2 text-[11px] font-black text-black">خرید</Link></div>)}</div>
      </article>;
    })}
    {!services.length && <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/50">هنوز سرویسی اضافه نشده است.</p>}
  </section>;
}
