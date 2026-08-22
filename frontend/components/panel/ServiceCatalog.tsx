'use client';

import { Apple, CheckCircle2, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { api, fa } from '@/lib/api';
import { usePanel } from '@/context/PanelContext';
import type { GuideData, Guide, Order, Progress, Product } from './types';

export default function ServiceCatalog() {
  const { services, products } = usePanel();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [guide, setGuide] = useState<GuideData | null>(null);

  async function buy(product: Product) {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ order: Order; progress: Progress; guide: Guide | null }>('orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      if (!result.guide) {
        setError('راهنمای فعال‌سازی این سرویس هنوز آماده نشده است.');
        return;
      }
      setGuide(await api<GuideData>(`orders/${result.order.id}/guide`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خرید سرویس انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 min-w-0 space-y-3 overflow-hidden">
      {services.map((service) => {
        const isApple = service.slug === 'apple-id' || service.icon === 'apple';
        const serviceTitle = isApple ? 'اپل آیدی' : service.title;
        const serviceProducts = products.filter((product) => product.serviceId === service.id);
        return (
          <div key={service.id} className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2 px-1 text-xs font-semibold text-white/45">
              {isApple ? <Apple size={15} /> : <ShoppingBag size={15} />}
              <span className="truncate">{serviceTitle}</span>
            </div>
            {serviceProducts.map((product) => (
              <article key={product.id} className="min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-white/[.045] p-3.5 sm:rounded-[26px] sm:p-4">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-white sm:h-14 sm:w-14">
                    {isApple ? <Apple size={25} strokeWidth={1.8} /> : <ShoppingBag size={23} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">{isApple ? 'خرید اپل آیدی' : product.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{product.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end text-left">
                    <b className="whitespace-nowrap text-xs sm:text-sm">{fa(product.price)} <span className="text-[10px] font-medium text-white/40">تومان</span></b>
                    <button disabled={busy} onClick={() => buy(product)} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-cyan-300 px-2.5 py-2 text-[11px] font-bold text-black disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-xs">
                      <CheckCircle2 size={14} />
                      {busy ? 'در حال ثبت…' : 'خرید و شروع'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        );
      })}
      {error && <p className="overflow-hidden rounded-2xl bg-red-400/10 p-4 text-xs leading-6 text-red-200">{error}</p>}
      {guide && <div className="fixed inset-0 z-[90] grid min-h-[100dvh] place-items-center overflow-y-auto bg-black/70 p-3 sm:p-4"><div className="w-full max-w-lg overflow-hidden rounded-3xl bg-[#111827] p-5 sm:p-6"><h3 className="text-xl font-black">{guide.guide.title}</h3><p className="mt-3 text-sm text-white/50">راهنمای فعال‌سازی آماده است.</p><button onClick={() => setGuide(null)} className="mt-5 w-full rounded-xl bg-white px-5 py-3 text-sm font-bold text-black">بستن</button></div></div>}
    </section>
  );
}