'use client';

import Link from 'next/link';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useServiceStore } from '@/store/serviceStore';

export default function ServicePurchasePage() {
  const { selectedService, selectedProduct } = useServiceStore();

  return (
    <main dir="rtl" className="min-h-[100dvh] overflow-x-hidden bg-[#070b14] px-3 py-4 text-white sm:px-5">
      <div className="mx-auto w-full max-w-2xl">
        <Link href={selectedService ? `/service/${selectedService.slug}` : '/panel'} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><ArrowRight size={16} /> بازگشت</Link>
        <section className="mt-4 rounded-[30px] border border-white/10 bg-white/[.035] p-5 sm:p-7">
          <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><ShoppingBag size={21} /></div><div><p className="text-xs text-white/40">خرید سرویس</p><h1 className="mt-1 text-xl font-black">{selectedService?.title ?? 'سرویس'}</h1></div></div>
          {selectedProduct && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="text-xs text-white/40">محصول انتخاب‌شده</p><p className="mt-1 font-bold">{selectedProduct.title}</p></div>}
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm leading-7 text-white/40">فرم خرید و مراحل اختصاصی این سرویس در این صفحه قرار می‌گیرد. فعلاً این بخش عمداً خالی نگه داشته شده تا فیلدها و روند هر سرویس به‌صورت جداگانه پیاده‌سازی شود.</div>
        </section>
      </div>
    </main>
  );
}
