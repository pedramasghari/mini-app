'use client';

import Link from 'next/link';
import { ArrowRight, ChevronDown, FileText, HelpCircle, PlayCircle, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { usePanel } from '@/context/PanelContext';
import { useServiceStore } from '@/store/serviceStore';
import { getServiceContent } from '@/lib/serviceContent';
import { fa } from '@/lib/api';

export default function ServicePage() {
  const params = useParams<{ slug: string }>();
  const { services, products } = usePanel();
  const service = services.find((item) => item.slug === params.slug);
  const content = getServiceContent(params.slug);
  const setSelection = useServiceStore((state) => state.setSelection);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const serviceProducts = service ? products.filter((item) => item.serviceId === service.id) : [];

  return (
    <main dir="rtl" className="min-h-[100dvh] overflow-x-hidden bg-[#070b14] px-3 py-4 text-white sm:px-5">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/panel" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10">
          <ArrowRight size={16} /> بازگشت به فروشگاه
        </Link>

        <section className="mt-4 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-cyan-400/15 to-violet-500/10 p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl"></div>
            <div className="min-w-0"><p className="text-xs text-cyan-200/60">سرویس</p><h1 className="mt-1 truncate text-2xl font-black">{content.title}</h1><p className="mt-2 text-sm leading-6 text-white/50">{content.shortDescription}</p></div>
          </div>
        </section>

        {content.tutorial && (
          <section className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[.035] p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><PlayCircle size={18} /> آموزش سرویس</h2>
            {content.tutorial.type === 'video' ? <video controls className="w-full rounded-2xl" src={content.tutorial.src} /> : <img src={content.tutorial.src} alt={content.tutorial.title ?? 'آموزش'} className="w-full rounded-2xl object-cover" />}
          </section>
        )}

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[.035] p-5">
          <h2 className="flex items-center gap-2 font-bold"><FileText size={18} /> توضیحات سرویس</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/60">{content.serverText}</p>
        </section>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[.035] p-5">
          <h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} /> قوانین سرویس</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-white/60">{content.rules.map((rule) => <li key={rule} className="rounded-xl bg-white/[.03] p-3">{rule}</li>)}</ul>
        </section>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[.035] p-5">
          <h2 className="flex items-center gap-2 font-bold"><HelpCircle size={18} /> سوالات متداول</h2>
          <div className="mt-3 space-y-2">{content.faqs.map((faq, index) => <div key={faq.question} className="overflow-hidden rounded-2xl border border-white/10"><button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-3 p-4 text-right text-sm font-bold"><span>{faq.question}</span><ChevronDown size={17} className={openFaq === index ? 'rotate-180' : ''} /></button>{openFaq === index && <p className="border-t border-white/10 p-4 text-xs leading-6 text-white/50">{faq.answer}</p>}</div>)}</div>
        </section>

        <section className="mt-4 space-y-3 pb-8">
          <h2 className="font-bold">انتخاب پلن</h2>
          {serviceProducts.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[.045] p-4"><div className="min-w-0"><h3 className="truncate font-bold">{product.title}</h3><p className="mt-1 text-xs text-white/40">{fa(product.price)} تومان</p></div><Link href={`/service/${params.slug}/purchase`} onClick={() => setSelection(service!, product)} className="shrink-0 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-black">خرید</Link></div>)}
          {!serviceProducts.length && <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/50">پلن‌های خرید این سرویس هنوز اضافه نشده‌اند.</p>}
        </section>
      </div>
    </main>
  );
}
