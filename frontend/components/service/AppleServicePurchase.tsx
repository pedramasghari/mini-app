'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, PlayCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Guide, Product, Service } from '@/components/panel/types';

type Props = { service: Service; product: Product; guide: Guide | null };

export default function AppleServicePurchase({ service, product, guide }: Props) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const steps = useMemo(() => (guide?.steps ?? []).slice().sort((a, b) => a.position - b.position), [guide]);
  const current = steps[step];

  if (!guide || !steps.length || product.requiresGuide === false) {
    return <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[.035] p-5 sm:p-7"><h2 className="text-lg font-black">{product.title}</h2><p className="mt-3 whitespace-pre-line text-sm leading-8 text-white/55">{product.description || service.description}</p><button className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950">شروع خرید</button></section>;
  }

  if (!started) {
    return <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[.035] p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><span className="text-xs text-cyan-300">راهنمای سرویس</span><h2 className="mt-1 text-xl font-black">{guide.title}</h2></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><PlayCircle size={22} /></div></div><p className="whitespace-pre-line text-sm leading-8 text-white/60">{guide.description || product.description}</p><button onClick={() => setStarted(true)} className="mt-7 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200">شروع</button></section>;
  }

  return <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[.035] p-4 sm:p-6">
    <div className="mb-5 flex items-center justify-between"><div><p className="text-xs text-white/35">{guide.title}</p><h2 className="mt-1 font-black">مرحله {step + 1} از {steps.length}</h2></div><span className="rounded-full bg-white/[.06] px-3 py-1 text-[11px] text-white/45">{product.title}</span></div>
    <div className="mb-6 flex gap-1.5">{steps.map((item, index) => <button aria-label={`مرحله ${index + 1}`} key={item.id} onClick={() => index <= step && setStep(index)} className={`h-1.5 flex-1 rounded-full transition ${index <= step ? 'bg-cyan-300' : 'bg-white/10'}`} />)}</div>
    <AnimatePresence mode="wait"><motion.div key={current.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .2 }}>
      {current.mediaUrl && <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20">{current.mediaType === 'video' ? <video className="aspect-video w-full object-cover" src={current.mediaUrl} controls playsInline /> : <img className="max-h-[55vh] w-full object-contain" src={current.mediaUrl} alt={current.title} />}</div>}
      <div className="px-1"><h3 className="text-lg font-black">{current.title}</h3><p className="mt-3 whitespace-pre-line text-sm leading-8 text-white/60">{current.content}</p>{current.requiresInput && <div className="mt-5"><label className="mb-2 block text-xs font-bold text-white/60">{current.inputLabel || 'اطلاعات مورد نیاز'}</label><input className="w-full rounded-2xl border border-white/10 bg-white/[.045] px-4 py-3 text-sm outline-none focus:border-cyan-300/50" placeholder={current.inputLabel || ''} /></div>}</div>
    </motion.div></AnimatePresence>
    <div className="mt-7 flex items-center justify-between gap-3"><button disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 disabled:opacity-25"><ArrowRight size={14} /> قبلی</button><div className="flex items-center gap-1.5">{steps.map((item, index) => <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${index === step ? 'bg-cyan-300 scale-125' : 'bg-white/20'}`} />)}</div><button onClick={() => setStep(value => Math.min(steps.length - 1, value + 1))} disabled={step === steps.length - 1} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 disabled:opacity-25">بعدی <ArrowLeft size={14} /></button></div>
    {step === steps.length - 1 && <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-emerald-400/10 py-3 text-xs text-emerald-300"><CheckCircle2 size={16} /> راهنما به پایان رسید</div>}
  </section>;
}
